import React, { useCallback, useState } from 'react';
import { StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useGroceryList } from './src/useGroceryList';
import { colors } from './src/theme';
import { ListScreen } from './src/screens/ListScreen';
import { RecipesScreen } from './src/screens/RecipesScreen';
import { ShareModal } from './src/components/ShareModal';
import { TabBar, type TabKey } from './src/components/TabBar';

export default function App() {
  const list = useGroceryList();
  const [tab, setTab] = useState<TabKey>('list');
  const [shareOpen, setShareOpen] = useState(false);

  const goToList = useCallback(() => setTab('list'), []);

  const clearAll = useCallback(() => {
    Alert.alert('Clear the whole list?', 'This removes every item. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: list.clearAll },
    ]);
  }, [list.clearAll]);

  const isShared = list.mode.kind === 'shared';
  const sharedCode = list.mode.kind === 'shared' ? list.mode.code : undefined;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />

        {tab === 'list' ? (
          <ListScreen
            items={list.items}
            loaded={list.loaded}
            isShared={isShared}
            sharedCode={sharedCode}
            onShare={() => setShareOpen(true)}
            onAdd={list.addItem}
            onToggle={list.toggleItem}
            onDelete={list.deleteItem}
            onChangeQty={list.changeQty}
            onClearChecked={list.clearChecked}
            onClearAll={clearAll}
          />
        ) : (
          <RecipesScreen onAddIngredients={list.addIngredients} onGoToList={goToList} />
        )}

        <TabBar active={tab} onChange={setTab} />

        <ShareModal
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          mode={list.mode}
          syncAvailable={list.syncAvailable}
          onCreate={list.createShared}
          onJoin={list.joinShared}
          onLeave={list.leaveShared}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
