import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { colors, spacing } from '../theme';

export function EmptyState() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>🧺</Text>
      <Text style={styles.title}>Your list is empty</Text>
      <Text style={styles.body}>
        Type an item below and tap Add. Items are grouped by aisle, and your list
        is saved on this phone automatically.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
  },
  emoji: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
