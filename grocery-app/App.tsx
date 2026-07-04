import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SectionList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import type { GroceryItem } from './src/types';
import { CATEGORIES, type CategoryKey } from './src/categories';
import { loadItems, saveItems } from './src/storage';
import { colors, spacing } from './src/theme';
import { Header } from './src/components/Header';
import { AddItemBar } from './src/components/AddItemBar';
import { ItemRow } from './src/components/ItemRow';
import { EmptyState } from './src/components/EmptyState';

interface Section {
  key: string;
  title: string;
  emoji: string;
  color: string;
  data: GroceryItem[];
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function App() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

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
      // Adding something already on the list (same name + aisle, not yet in
      // the cart) just bumps its quantity instead of duplicating the row.
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
      const item: GroceryItem = {
        id: makeId(),
        name,
        quantity: 1,
        category,
        checked: false,
        createdAt: Date.now(),
      };
      return [item, ...prev];
    });
  }, []);

  const toggleItem = useCallback((id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const changeQty = useCallback((id: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i,
      ),
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

  const checkedCount = useMemo(() => items.filter((i) => i.checked).length, [items]);

  // Group unchecked items into aisle sections (in CATEGORIES order), then
  // append a single "In cart" section for everything already checked off.
  const sections = useMemo<Section[]>(() => {
    const active = items.filter((i) => !i.checked);
    const done = items.filter((i) => i.checked);

    const byCat: Record<string, GroceryItem[]> = {};
    for (const it of active) {
      (byCat[it.category] ||= []).push(it);
    }

    const result: Section[] = [];
    for (const c of CATEGORIES) {
      const data = byCat[c.key];
      if (data && data.length) {
        result.push({ key: c.key, title: c.label, emoji: c.emoji, color: c.color, data });
      }
    }
    if (done.length) {
      result.push({ key: '__cart', title: 'In cart', emoji: '✅', color: colors.textMuted, data: done });
    }
    return result;
  }, [items]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <Header
          totalCount={items.length}
          checkedCount={checkedCount}
          onClearChecked={clearChecked}
          onClearAll={clearAll}
        />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ItemRow
                item={item}
                onToggle={toggleItem}
                onDelete={deleteItem}
                onChangeQty={changeQty}
              />
            )}
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, { borderLeftColor: section.color }]}>
                <Text style={styles.sectionEmoji}>{section.emoji}</Text>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionCount}>{section.data.length}</Text>
              </View>
            )}
            ListEmptyComponent={loaded ? <EmptyState /> : null}
            contentContainerStyle={
              sections.length ? styles.listContent : styles.listContentEmpty
            }
            stickySectionHeadersEnabled
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />

          <AddItemBar onAdd={addItem} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderLeftWidth: 4,
  },
  sectionEmoji: {
    fontSize: 15,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
