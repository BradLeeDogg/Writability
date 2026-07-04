import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { colors, spacing } from '../theme';

interface Props {
  totalCount: number;
  checkedCount: number;
  onClearChecked: () => void;
  onClearAll: () => void;
}

export function Header({ totalCount, checkedCount, onClearChecked, onClearAll }: Props) {
  const remaining = totalCount - checkedCount;
  const subtitle =
    totalCount === 0
      ? 'Nothing on the list yet'
      : `${remaining} to buy · ${checkedCount} in cart`;

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>🛒 Grocery List</Text>
        {totalCount > 0 ? (
          <View style={styles.actions}>
            {checkedCount > 0 ? (
              <TouchableOpacity onPress={onClearChecked} hitSlop={8} accessibilityLabel="Clear items in cart">
                <Text style={styles.action}>Clear cart</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onClearAll} hitSlop={8} accessibilityLabel="Clear all items">
              <Text style={[styles.action, styles.danger]}>Clear all</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  danger: {
    color: colors.danger,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    color: colors.textMuted,
  },
});
