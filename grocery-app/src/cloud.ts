import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  type CollectionReference,
} from 'firebase/firestore';

import { getDb, ensureSignedIn } from './firebase';
import type { GroceryItem } from './types';
import type { CategoryKey } from './categories';

// Human-friendly codes: no 0/O/1/I to avoid confusion when read aloud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function itemsCol(code: string): CollectionReference {
  return collection(getDb(), 'lists', code, 'items');
}

type CloudItemInput = {
  name: string;
  quantity: number;
  category: CategoryKey;
  checked: boolean;
  createdAt: number;
};

// Create a brand-new shared list, optionally seeded with existing items.
export async function createSharedList(name: string, seed: GroceryItem[]): Promise<string> {
  await ensureSignedIn();
  const db = getDb();
  const code = generateCode();
  await setDoc(doc(db, 'lists', code), { name, createdAt: Date.now() });
  if (seed.length) {
    const batch = writeBatch(db);
    for (const it of seed) {
      batch.set(doc(itemsCol(code)), {
        name: it.name,
        quantity: it.quantity,
        category: it.category,
        checked: it.checked,
        createdAt: it.createdAt || Date.now(),
      });
    }
    await batch.commit();
  }
  return code;
}

export async function listExists(code: string): Promise<boolean> {
  await ensureSignedIn();
  const snap = await getDoc(doc(getDb(), 'lists', code));
  return snap.exists();
}

// Live subscription to a shared list's items. Returns an unsubscribe function.
export function subscribeItems(
  code: string,
  onItems: (items: GroceryItem[]) => void,
  onError?: (e: Error) => void,
): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;

  ensureSignedIn()
    .then(() => {
      if (cancelled) return;
      const q = query(itemsCol(code), orderBy('createdAt', 'desc'));
      unsub = onSnapshot(
        q,
        (snap) => {
          const items: GroceryItem[] = snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            const createdAt =
              typeof data.createdAt === 'number' ? (data.createdAt as number) : Date.now();
            return {
              id: d.id,
              name: String(data.name ?? ''),
              quantity: typeof data.quantity === 'number' ? (data.quantity as number) : 1,
              category: (data.category as CategoryKey) ?? 'Other',
              checked: Boolean(data.checked),
              createdAt,
            };
          });
          onItems(items);
        },
        (err) => onError?.(err as Error),
      );
    })
    .catch((e) => onError?.(e as Error));

  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

export async function cloudAddItem(code: string, item: CloudItemInput): Promise<void> {
  await ensureSignedIn();
  await addDoc(itemsCol(code), item);
}

export async function cloudUpdateItem(
  code: string,
  id: string,
  patch: Partial<CloudItemInput>,
): Promise<void> {
  await ensureSignedIn();
  await updateDoc(doc(getDb(), 'lists', code, 'items', id), patch);
}

export async function cloudDeleteItem(code: string, id: string): Promise<void> {
  await ensureSignedIn();
  await deleteDoc(doc(getDb(), 'lists', code, 'items', id));
}

export async function cloudDeleteMany(code: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await ensureSignedIn();
  const db = getDb();
  // writeBatch handles up to 500 ops; chunk to be safe.
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 400)) {
      batch.delete(doc(db, 'lists', code, 'items', id));
    }
    await batch.commit();
  }
}
