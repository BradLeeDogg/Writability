import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Recipe, RecipeIngredient } from '../recipes';
import { getCategory } from '../categories';
import { colors, radius, spacing } from '../theme';

interface Props {
  recipe: Recipe | null;
  onClose: () => void;
  onAdd: (ingredients: RecipeIngredient[]) => void;
}

export function RecipeDetailModal({ recipe, onClose, onAdd }: Props) {
  const insets = useSafeAreaInsets();
  // One boolean per ingredient — all ticked by default so "add everything"
  // is a single tap, but she can untick anything she already has.
  const [selected, setSelected] = useState<boolean[]>([]);

  useEffect(() => {
    if (recipe) setSelected(recipe.ingredients.map(() => true));
  }, [recipe]);

  if (!recipe) return null;

  const chosen = recipe.ingredients.filter((_, i) => selected[i]);
  const toggle = (i: number) =>
    setSelected((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const handleAdd = () => {
    if (chosen.length === 0) return;
    onAdd(chosen);
  };

  return (
    <Modal visible={recipe !== null} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {recipe.emoji}  {recipe.name}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close recipe">
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.blurb}>{recipe.blurb}</Text>
          <Text style={styles.meta}>
            {`🍽️ Serves ${recipe.servings}   ·   ⏱️ ${recipe.minutes} min`}
          </Text>

          <Text style={styles.sectionTitle}>Ingredients</Text>
          <Text style={styles.hint}>Tap to add or skip — ticked items go on your list.</Text>

          {recipe.ingredients.map((ing, i) => {
            const on = selected[i];
            const cat = getCategory(ing.category);
            return (
              <TouchableOpacity
                key={`${ing.name}-${i}`}
                style={styles.ingRow}
                onPress={() => toggle(i)}
                activeOpacity={0.6}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${ing.name}, ${ing.amount}`}
              >
                <View style={[styles.checkbox, on && styles.checkboxOn]}>
                  {on ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <View style={styles.ingText}>
                  <Text style={[styles.ingName, !on && styles.ingNameOff]}>{ing.name}</Text>
                  <Text style={styles.ingCat}>
                    {cat.emoji} {cat.label}
                  </Text>
                </View>
                <Text style={styles.ingAmount}>{ing.amount}</Text>
              </TouchableOpacity>
            );
          })}

          <Text style={styles.sectionTitle}>Method</Text>
          {recipe.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TouchableOpacity
            style={[styles.addBtn, chosen.length === 0 && styles.addBtnDisabled]}
            onPress={handleAdd}
            disabled={chosen.length === 0}
            accessibilityLabel={`Add ${chosen.length} items to shopping list`}
          >
            <Text style={styles.addBtnText}>
              {chosen.length === 0
                ? 'Select some ingredients'
                : `Add ${chosen.length} ${chosen.length === 1 ? 'item' : 'items'} to list`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  topTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.md,
  },
  close: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textMuted,
  },
  scroll: {
    padding: spacing.lg,
  },
  blurb: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  ingText: {
    flex: 1,
  },
  ingName: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  ingNameOff: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  ingCat: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  ingAmount: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  footer: {
    padding: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  addBtn: {
    height: 52,
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
