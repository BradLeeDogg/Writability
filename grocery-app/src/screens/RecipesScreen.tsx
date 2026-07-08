import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';

import {
  RECIPES,
  suggestRecipes,
  searchRecipes,
  type Recipe,
  type RecipeIngredient,
} from '../recipes';
import { colors, radius, spacing } from '../theme';
import { RecipeCard } from '../components/RecipeCard';
import { RecipeDetailModal } from '../components/RecipeDetailModal';

interface Props {
  // Adds the chosen ingredients to the shopping list; returns how many were added.
  onAddIngredients: (ingredients: RecipeIngredient[]) => number;
  onGoToList: () => void;
}

export function RecipesScreen({ onAddIngredients, onGoToList }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Recipe[]>(() => suggestRecipes(3));
  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null);

  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? searchRecipes(query) : RECIPES), [query, searching]);

  const reshuffle = () => setSuggestions(suggestRecipes(3, suggestions.map((r) => r.id)));

  const handleAdd = (ingredients: RecipeIngredient[]) => {
    const n = onAddIngredients(ingredients);
    setOpenRecipe(null);
    Alert.alert(
      'Added to your list',
      `${n} ${n === 1 ? 'item' : 'items'} added to your shopping list.`,
      [
        { text: 'Keep browsing', style: 'cancel' },
        { text: 'View list', onPress: onGoToList },
      ],
    );
  };

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.title}>🍳 Recipes</Text>
        <Text style={styles.subtitle}>Pick a meal and add its ingredients to your list.</Text>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search recipes or ingredients…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {!searching ? (
          <>
            <View style={styles.suggestHead}>
              <Text style={styles.sectionTitle}>Suggested for you</Text>
              <TouchableOpacity onPress={reshuffle} hitSlop={8} accessibilityLabel="Show different suggestions">
                <Text style={styles.shuffle}>🎲 Shuffle</Text>
              </TouchableOpacity>
            </View>
            {suggestions.map((r) => (
              <RecipeCard key={r.id} recipe={r} onPress={setOpenRecipe} />
            ))}

            <Text style={[styles.sectionTitle, styles.allTitle]}>All recipes</Text>
            {RECIPES.map((r) => (
              <RecipeCard key={r.id} recipe={r} onPress={setOpenRecipe} />
            ))}
          </>
        ) : results.length > 0 ? (
          results.map((r) => <RecipeCard key={r.id} recipe={r} onPress={setOpenRecipe} />)
        ) : (
          <Text style={styles.noResults}>No recipes match “{query.trim()}”.</Text>
        )}
      </ScrollView>

      <RecipeDetailModal recipe={openRecipe} onClose={() => setOpenRecipe(null)} onAdd={handleAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    color: colors.textMuted,
  },
  search: {
    marginTop: spacing.md,
    height: 44,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  suggestHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  allTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  shuffle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  noResults: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
