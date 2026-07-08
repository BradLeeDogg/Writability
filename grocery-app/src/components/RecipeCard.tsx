import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import type { Recipe } from '../recipes';
import { colors, radius, spacing } from '../theme';

interface Props {
  recipe: Recipe;
  onPress: (recipe: Recipe) => void;
}

function RecipeCardBase({ recipe, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(recipe)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.name}. ${recipe.ingredients.length} ingredients.`}
    >
      <Text style={styles.emoji}>{recipe.emoji}</Text>
      <View style={styles.body}>
        <Text style={styles.name}>{recipe.name}</Text>
        <Text style={styles.blurb} numberOfLines={2}>
          {recipe.blurb}
        </Text>
        <Text style={styles.meta}>
          {`🍽️ ${recipe.servings}  ·  ⏱️ ${recipe.minutes} min  ·  🧾 ${recipe.ingredients.length} items`}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export const RecipeCard = React.memo(RecipeCardBase);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  emoji: {
    fontSize: 34,
    marginRight: spacing.md,
  },
  body: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  blurb: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    lineHeight: 19,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 26,
    color: colors.border,
    marginLeft: spacing.sm,
  },
});
