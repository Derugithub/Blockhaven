import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';

import { MenuBanner } from '@/components/ad-banner';
import { AppText, Button, IconButton, Screen } from '@/components/ui';
import { deleteWorld, listWorlds, type WorldSummary } from '@/lib/worlds';
import { Colors } from '@/theme/theme';

function timeAgo(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(ms).toLocaleDateString();
}

export default function WorldsScreen() {
  const router = useRouter();
  const [worlds, setWorlds] = useState<WorldSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listWorlds()
      .then((list) => {
        setWorlds(list);
        setError(null);
      })
      .catch(() => {
        setWorlds([]);
        setError('Saved worlds could not be read.');
      });
  }, []);

  useFocusEffect(refresh);

  const confirmDelete = (world: WorldSummary) => {
    Alert.alert('Delete world?', `“${world.name}” will be removed from this device. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteWorld(world.id)
            .catch(() => setError('The world could not be deleted.'))
            .finally(refresh);
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
          <View>
            <AppText variant="display">Blockhaven</AppText>
            <AppText variant="meta" color={Colors.muted}>
              Dig, build and light up the night
            </AppText>
          </View>
        </View>
        <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      <Button label="New world" icon="add" onPress={() => router.push('/new-world')} style={styles.newWorld} />

      {error ? (
        <AppText variant="meta" color={Colors.danger} style={styles.error}>
          {error}
        </AppText>
      ) : null}

      {worlds === null ? (
        <ActivityIndicator color={Colors.accent} style={styles.loading} />
      ) : (
        <FlatList
          data={worlds}
          keyExtractor={(w) => w.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="earth-outline" size={36} color={Colors.muted} />
              <AppText variant="heading">No worlds yet</AppText>
              <AppText variant="body" color={Colors.muted} style={styles.center}>
                Create a world to start exploring. Each world is saved on this device.
              </AppText>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Play ${item.name}`}
              onPress={() => router.push({ pathname: '/play/[id]', params: { id: item.id } })}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={styles.rowIcon}>
                <Ionicons name="play" size={18} color={Colors.accentInk} />
              </View>
              <View style={styles.rowText}>
                <AppText variant="bodyMedium" numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText variant="meta" color={Colors.muted} numberOfLines={1}>
                  {[
                    `Seed ${item.seedText}`,
                    item.difficulty === 'peaceful' ? 'Peaceful' : null,
                    item.won ? 'Beacon built' : null,
                    `played ${timeAgo(item.updatedAt)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </View>
              <IconButton icon="trash-outline" label={`Delete ${item.name}`} onPress={() => confirmDelete(item)} />
            </Pressable>
          )}
        />
      )}
      <View style={styles.banner}>
        <MenuBanner />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  logo: { width: 52, height: 52, borderRadius: 12 },
  newWorld: { marginTop: 18 },
  error: { marginTop: 10 },
  loading: { marginTop: 32 },
  list: { flex: 1, marginTop: 14 },
  listContent: { gap: 10, paddingBottom: 12 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 12 },
  center: { textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.panel,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  rowPressed: { opacity: 0.8 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  banner: { paddingBottom: 4 },
});
