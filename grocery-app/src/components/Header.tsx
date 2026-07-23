import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { colors, radius, spacing } from '../theme';

interface Props {
  totalCount: number;
  checkedCount: number;
  isShared: boolean;
  sharedCode?: string;
  onShare: () => void;
  onClearChecked: () => void;
  onClearAll: () => void;
}

export function Header({
  totalCount,
  checkedCount,
  isShared,
  sharedCode,
  onShare,
  onClearChecked,
  onClearAll,
}: Props) {
  const remaining = totalCount - checkedCount;
  const subtitle =
    totalCount === 0 ? 'Nothing on the list yet' : `${remaining} to buy · ${checkedCount} in cart`;

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>🛒 Grocery List</Text>
        <TouchableOpacity
          style={[styles.shareBtn, isShared && styles.shareBtnActive]}
          onPress={onShare}
          hitSlop={8}
          accessibilityLabel="Share and sync"
        >
          <Text style={[styles.shareText, isShared && styles.shareTextActive]}>
            {isShared ? `🔗 ${sharedCode}` : '👥 Share'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.subRow}>
        <Text style={styles.subtitle}>{subtitle}</Text>
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
  shareBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareBtnActive: {
    backgroundColor: colors.checkBg,
    borderColor: colors.primary,
  },
  shareText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  shareTextActive: {
    color: colors.primaryDark,
    letterSpacing: 1,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginLeft: spacing.md,
  },
  action: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  danger: {
    color: colors.danger,
  },
});
