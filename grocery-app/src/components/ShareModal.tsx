import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Share,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ListMode } from '../useGroceryList';
import { colors, radius, spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  mode: ListMode;
  syncAvailable: boolean;
  onCreate: () => Promise<string>;
  onJoin: (code: string) => Promise<void>;
  onLeave: () => void;
}

export function ShareModal({
  visible,
  onClose,
  mode,
  syncAvailable,
  onCreate,
  onJoin,
  onLeave,
}: Props) {
  const insets = useSafeAreaInsets();
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setJoinCode('');
    setError(null);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the list.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    setBusy(true);
    setError(null);
    try {
      await onJoin(joinCode);
      setJoinCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join that list.');
    } finally {
      setBusy(false);
    }
  };

  const shareCode = (code: string) => {
    Share.share({
      message: `Join my grocery list! Open the Grocery List app, tap Share, choose "Join a list", and enter this code: ${code}`,
    }).catch(() => {});
  };

  const shared = mode.kind === 'shared';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Share &amp; sync</Text>
            <TouchableOpacity onPress={close} hitSlop={10} accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {!syncAvailable ? (
              <View style={styles.block}>
                <Text style={styles.bodyText}>
                  Sharing needs a quick one-time setup (a free Firebase project). Until then, your
                  list stays private on this phone.
                </Text>
                <Text style={styles.hint}>
                  See “Turn on list sharing” in the project README for the steps.
                </Text>
              </View>
            ) : shared ? (
              <View style={styles.block}>
                <Text style={styles.label}>This list is shared</Text>
                <Text style={styles.bodyText}>
                  Anyone who enters this code sees the same list, and changes sync live.
                </Text>
                <View style={styles.codeBox}>
                  <Text style={styles.code} selectable>
                    {mode.code}
                  </Text>
                </View>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => shareCode(mode.code)}>
                  <Text style={styles.primaryBtnText}>Share this code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.leaveBtn}
                  onPress={() => {
                    onLeave();
                    close();
                  }}
                >
                  <Text style={styles.leaveText}>Leave shared list (back to my private list)</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.block}>
                <Text style={styles.label}>Create a shared list</Text>
                <Text style={styles.bodyText}>
                  Turns your current list into a shared one and gives you a code to send to family.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, busy && styles.btnDisabled]}
                  onPress={handleCreate}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Create shared list</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.divider} />

                <Text style={styles.label}>Join with a code</Text>
                <Text style={styles.bodyText}>Enter a code someone shared with you.</Text>
                <TextInput
                  style={styles.input}
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder="e.g. ABC123"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleJoin}
                />
                <TouchableOpacity
                  style={[styles.secondaryBtn, (busy || !joinCode.trim()) && styles.btnDisabled]}
                  onPress={handleJoin}
                  disabled={busy || !joinCode.trim()}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={styles.secondaryBtnText}>Join list</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '86%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  close: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textMuted,
  },
  block: {
    paddingBottom: spacing.md,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bodyText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  codeBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  code: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 6,
    color: colors.primaryDark,
  },
  primaryBtn: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  input: {
    height: 50,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    letterSpacing: 2,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  leaveBtn: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  leaveText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
});
