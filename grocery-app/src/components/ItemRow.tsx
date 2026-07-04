import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import type { GroceryItem } from '../types';
import { colors, radius, spacing } from '../theme';

interface Props {
  item: GroceryItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeQty: (id: string, delta: number) => void;
}

function ItemRowBase({ item, onToggle, onDelete, onChangeQty }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.main}
        onPress={() => onToggle(item.id)}
        activeOpacity={0.6}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={item.name}
      >
        <View style={[styles.checkbox, item.checked && styles.checkboxOn]}>
          {item.checked ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={[styles.name, item.checked && styles.nameChecked]} numberOfLines={2}>
          {item.name}
        </Text>
      </TouchableOpacity>

      {!item.checked ? (
        <View style={styles.qty}>
          <TouchableOpacity
            onPress={() => onChangeQty(item.id, -1)}
            style={styles.qtyBtn}
            hitSlop={8}
            accessibilityLabel={`Decrease quantity of ${item.name}`}
          >
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <TouchableOpacity
            onPress={() => onChangeQty(item.id, 1)}
            style={styles.qtyBtn}
            hitSlop={8}
            accessibilityLabel={`Increase quantity of ${item.name}`}
          >
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={() => onDelete(item.id)}
        style={styles.delBtn}
        hitSlop={8}
        accessibilityLabel={`Remove ${item.name}`}
      >
        <Text style={styles.delText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export const ItemRow = React.memo(ItemRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 26,
    height: 26,
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
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  name: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  nameChecked: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  qty: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.sm,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 20,
    color: colors.primaryDark,
    fontWeight: '600',
    lineHeight: 22,
  },
  qtyText: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  delBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  delText: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
