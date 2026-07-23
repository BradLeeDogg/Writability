import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SectionList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import type { GroceryItem } from '../types';
import { CATEGORIES, type CategoryKey } from '../categories';
import { colors, spacing } from '../theme';
import { Header } from '../components/Header';
import { AddItemBar } from '../components/AddItemBar';
import { ItemRow } from '../components/ItemRow';
import { EmptyState } from '../components/EmptyState';

interface Section {
  key: string;
  title: string;
  emoji: string;
  color: string;
  data: GroceryItem[];
}

interface Props {
  items: GroceryItem[];
  loaded: boolean;
  isShared: boolean;
  sharedCode?: string;
  onShare: () => void;
  onAdd: (name: string, category: CategoryKey) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeQty: (id: string, delta: number) => void;
  onClearChecked: () => void;
  onClearAll: () => void;
}

export function ListScreen({
  items,
  loaded,
  isShared,
  sharedCode,
  onShare,
  onAdd,
  onToggle,
  onDelete,
  onChangeQty,
  onClearChecked,
  onClearAll,
}: Props) {
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        totalCount={items.length}
        checkedCount={checkedCount}
        isShared={isShared}
        sharedCode={sharedCode}
        onShare={onShare}
        onClearChecked={onClearChecked}
        onClearAll={onClearAll}
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            onToggle={onToggle}
            onDelete={onDelete}
            onChangeQty={onChangeQty}
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
        contentContainerStyle={sections.length ? styles.listContent : styles.listContentEmpty}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />

      <AddItemBar onAdd={onAdd} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
