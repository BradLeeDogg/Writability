import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GroceryItem } from './types';
import type { CategoryKey } from './categories';
import type { RecipeIngredient } from './recipes';
import { loadItems, saveItems } from './storage';
import { firestoreEnabled } from './firebase';
import {
  createSharedList,
  listExists,
  subscribeItems,
  cloudAddItem,
  cloudUpdateItem,
  cloudDeleteItem,
  cloudDeleteMany,
  normalizeCode,
} from './cloud';

export type ListMode = { kind: 'local' } | { kind: 'shared'; code: string };

const MODE_KEY = 'grocery.activeList.v1';

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function findMatch(items: GroceryItem[], name: string, category: CategoryKey): GroceryItem | undefined {
  return items.find(
    (i) => !i.checked && i.category === category && i.name.toLowerCase() === name.toLowerCase(),
  );
}

export interface GroceryListApi {
  items: GroceryItem[];
  loaded: boolean;
  mode: ListMode;
  syncAvailable: boolean;
  syncError: string | null;
  addItem: (name: string, category: CategoryKey) => void;
  addIngredients: (ingredients: RecipeIngredient[]) => number;
  toggleItem: (id: string) => void;
  deleteItem: (id: string) => void;
  changeQty: (id: string, delta: number) => void;
  clearChecked: () => void;
  clearAll: () => void;
  createShared: () => Promise<string>;
  joinShared: (code: string) => Promise<void>;
  leaveShared: () => void;
}

export function useGroceryList(): GroceryListApi {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<ListMode>({ kind: 'local' });
  const [modeLoaded, setModeLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Refs give the mutation callbacks the current values without being recreated
  // on every keystroke.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Restore which list was active last time.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(MODE_KEY);
        if (raw) {
          const m = JSON.parse(raw);
          if (m?.kind === 'shared' && typeof m.code === 'string' && firestoreEnabled()) {
            setMode({ kind: 'shared', code: m.code });
          }
        }
      } catch {
        // ignore corrupt mode
      }
      setModeLoaded(true);
    })();
  }, []);

  const persistMode = useCallback(async (m: ListMode) => {
    setMode(m);
    try {
      await AsyncStorage.setItem(MODE_KEY, JSON.stringify(m));
    } catch {
      // best-effort
    }
  }, []);

  // Wire up the active data source: AsyncStorage for local, a live Firestore
  // subscription for shared.
  useEffect(() => {
    if (!modeLoaded) return;
    let cancelled = false;
    setLoaded(false);
    setSyncError(null);

    if (mode.kind === 'local') {
      loadItems().then((stored) => {
        if (cancelled) return;
        setItems(stored);
        setLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    }

    if (!firestoreEnabled()) {
      setSyncError('Sharing is not set up yet.');
      setItems([]);
      setLoaded(true);
      return;
    }

    const unsub = subscribeItems(
      mode.code,
      (next) => {
        if (cancelled) return;
        setItems(next);
        setLoaded(true);
      },
      (err) => {
        if (cancelled) return;
        setSyncError(err.message);
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [mode, modeLoaded]);

  // Persist the private list on change (local mode only).
  useEffect(() => {
    if (!modeLoaded || !loaded || mode.kind !== 'local') return;
    saveItems(items);
  }, [items, mode, modeLoaded, loaded]);

  const reportError = useCallback((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    setSyncError(msg);
  }, []);

  const addItem = useCallback(
    (name: string, category: CategoryKey) => {
      const m = modeRef.current;
      if (m.kind === 'local') {
        setItems((prev) => {
          const existing = findMatch(prev, name, category);
          if (existing) {
            return prev.map((i) =>
              i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i,
            );
          }
          return [
            { id: makeId(), name, quantity: 1, category, checked: false, createdAt: Date.now() },
            ...prev,
          ];
        });
        return;
      }
      const existing = findMatch(itemsRef.current, name, category);
      if (existing) {
        cloudUpdateItem(m.code, existing.id, { quantity: existing.quantity + 1 }).catch(reportError);
      } else {
        cloudAddItem(m.code, {
          name,
          quantity: 1,
          category,
          checked: false,
          createdAt: Date.now(),
        }).catch(reportError);
      }
    },
    [reportError],
  );

  const addIngredients = useCallback(
    (ingredients: RecipeIngredient[]) => {
      const m = modeRef.current;
      if (m.kind === 'local') {
        setItems((prev) => {
          const next = [...prev];
          for (const ing of ingredients) {
            const existing = findMatch(next, ing.name, ing.category);
            if (existing) {
              const idx = next.findIndex((i) => i.id === existing.id);
              next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
            } else {
              next.unshift({
                id: makeId(),
                name: ing.name,
                quantity: 1,
                category: ing.category,
                checked: false,
                createdAt: Date.now(),
              });
            }
          }
          return next;
        });
        return ingredients.length;
      }
      // Shared: apply against the current snapshot; onSnapshot refreshes the UI.
      let working = itemsRef.current;
      for (const ing of ingredients) {
        const existing = findMatch(working, ing.name, ing.category);
        if (existing) {
          working = working.map((i) =>
            i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i,
          );
          cloudUpdateItem(m.code, existing.id, { quantity: existing.quantity + 1 }).catch(reportError);
        } else {
          cloudAddItem(m.code, {
            name: ing.name,
            quantity: 1,
            category: ing.category,
            checked: false,
            createdAt: Date.now(),
          }).catch(reportError);
        }
      }
      return ingredients.length;
    },
    [reportError],
  );

  const toggleItem = useCallback(
    (id: string) => {
      const m = modeRef.current;
      if (m.kind === 'local') {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
        return;
      }
      const cur = itemsRef.current.find((i) => i.id === id);
      if (cur) cloudUpdateItem(m.code, id, { checked: !cur.checked }).catch(reportError);
    },
    [reportError],
  );

  const deleteItem = useCallback(
    (id: string) => {
      const m = modeRef.current;
      if (m.kind === 'local') {
        setItems((prev) => prev.filter((i) => i.id !== id));
        return;
      }
      cloudDeleteItem(m.code, id).catch(reportError);
    },
    [reportError],
  );

  const changeQty = useCallback(
    (id: string, delta: number) => {
      const m = modeRef.current;
      if (m.kind === 'local') {
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)),
        );
        return;
      }
      const cur = itemsRef.current.find((i) => i.id === id);
      if (cur) {
        cloudUpdateItem(m.code, id, { quantity: Math.max(1, cur.quantity + delta) }).catch(reportError);
      }
    },
    [reportError],
  );

  const clearChecked = useCallback(() => {
    const m = modeRef.current;
    if (m.kind === 'local') {
      setItems((prev) => prev.filter((i) => !i.checked));
      return;
    }
    const ids = itemsRef.current.filter((i) => i.checked).map((i) => i.id);
    cloudDeleteMany(m.code, ids).catch(reportError);
  }, [reportError]);

  const clearAll = useCallback(() => {
    const m = modeRef.current;
    if (m.kind === 'local') {
      setItems([]);
      return;
    }
    const ids = itemsRef.current.map((i) => i.id);
    cloudDeleteMany(m.code, ids).catch(reportError);
  }, [reportError]);

  const createShared = useCallback(async () => {
    const seed = modeRef.current.kind === 'local' ? itemsRef.current : [];
    const code = await createSharedList('Shared list', seed);
    await persistMode({ kind: 'shared', code });
    return code;
  }, [persistMode]);

  const joinShared = useCallback(
    async (rawCode: string) => {
      const code = normalizeCode(rawCode);
      if (code.length < 4) throw new Error('That code looks too short.');
      const exists = await listExists(code);
      if (!exists) throw new Error('No shared list found for that code.');
      await persistMode({ kind: 'shared', code });
    },
    [persistMode],
  );

  const leaveShared = useCallback(() => {
    persistMode({ kind: 'local' });
  }, [persistMode]);

  return {
    items,
    loaded,
    mode,
    syncAvailable: firestoreEnabled(),
    syncError,
    addItem,
    addIngredients,
    toggleItem,
    deleteItem,
    changeQty,
    clearChecked,
    clearAll,
    createShared,
    joinShared,
    leaveShared,
  };
}
