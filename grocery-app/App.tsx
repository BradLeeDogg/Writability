import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import type { GroceryItem } from './src/types';
import type { CategoryKey } from './src/categories';
import type { RecipeIngredient } from './src/recipes';
import { loadItems, saveItems } from './src/storage';
import { colors } from './src/theme';
import { ListScreen } from './src/screens/ListScreen';
import { RecipesScreen } from './src/screens/RecipesScreen';
import { TabBar, type TabKey } from './src/components/TabBar';

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function App() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<TabKey>('list');

  // Load once on startup.
  useEffect(() => {
    let active = true;
    loadItems().then((stored) => {
      if (!active) return;
      setItems(stored);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist on every change, but only after the initial load so we never
  // overwrite saved data with the empty starting state.
  useEffect(() => {
    if (loaded) saveItems(items);
  }, [items, loaded]);

  const addItem = useCallback((name: string, category: CategoryKey) => {
    setItems((prev) => {
      const idx = prev.findIndex(
        (i) =>
          !i.checked &&
          i.category === category &&
          i.name.toLowerCase() === name.toLowerCase(),
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        { id: makeId(), name, quantity: 1, category, checked: false, createdAt: Date.now() },
        ...prev,
      ];
    });
  }, []);

  // Add a batch of recipe ingredients at once, merging with anything already
  // on the list. Returns the count so the caller can confirm it.
  const addIngredients = useCallback((ingredients: RecipeIngredient[]) => {
    setItems((prev) => {
      const next = [...prev];
      for (const ing of ingredients) {
        const idx = next.findIndex(
          (i) =>
            !i.checked &&
            i.category === ing.category &&
            i.name.toLowerCase() === ing.name.toLowerCase(),
        );
        if (idx >= 0) {
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
  }, []);

  const toggleItem = useCallback((id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const changeQty = useCallback((id: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)),
    );
  }, []);

  const clearChecked = useCallback(() => {
    setItems((prev) => prev.filter((i) => !i.checked));
  }, []);

  const clearAll = useCallback(() => {
    Alert.alert('Clear the whole list?', 'This removes every item. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: () => setItems([]) },
    ]);
  }, []);

  const goToList = useCallback(() => setTab('list'), []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />

        {tab === 'list' ? (
          <ListScreen
            items={items}
            loaded={loaded}
            onAdd={addItem}
            onToggle={toggleItem}
            onDelete={deleteItem}
            onChangeQty={changeQty}
            onClearChecked={clearChecked}
            onClearAll={clearAll}
          />
        ) : (
          <RecipesScreen onAddIngredients={addIngredients} onGoToList={goToList} />
        )}

        <TabBar active={tab} onChange={setTab} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
