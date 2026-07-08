import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';

import { CATEGORIES, guessCategory, type CategoryKey } from '../categories';
import { colors, radius, spacing } from '../theme';

interface Props {
  onAdd: (name: string, category: CategoryKey) => void;
}

export function AddItemBar({ onAdd }: Props) {
  const [text, setText] = useState('');
  // Null means "follow the auto-guess"; a value means the user picked a chip.
  const [manualCategory, setManualCategory] = useState<CategoryKey | null>(null);

  const effectiveCategory: CategoryKey = manualCategory ?? guessCategory(text);
  const canAdd = text.trim().length > 0;

  const submit = () => {
    const name = text.trim();
    if (!name) return;
    onAdd(name, effectiveCategory);
    setText('');
    setManualCategory(null);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="always"
      >
        {CATEGORIES.map((c) => {
          const selected = c.key === effectiveCategory;
          return (
            <TouchableOpacity
              key={c.key}
              onPress={() => setManualCategory(c.key)}
              style={[
                styles.chip,
                selected && { backgroundColor: c.color, borderColor: c.color },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={styles.chipEmoji}>{c.emoji}</Text>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Add an item…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={submit}
          blurOnSubmit={false}
          autoCapitalize="sentences"
        />
        <TouchableOpacity
          style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}
          onPress={submit}
          disabled={!canAdd}
          accessibilityLabel="Add item"
        >
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  chips: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  chipText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.text,
  },
  addBtn: {
    height: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: colors.border,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
