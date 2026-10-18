import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import type { GameState } from '@/game/game';
import { loadWorld, type WorldSummary } from '@/lib/worlds';
import { GameScreen } from '@/screens/game/game-screen';
import { Colors } from '@/theme/theme';

export default function PlayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ summary: WorldSummary; game: GameState } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    loadWorld(id)
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'The world could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <View style={styles.center}>
        <AppText variant="heading">Could not open this world</AppText>
        <AppText variant="body" color={Colors.muted} style={styles.text}>
          {error}
        </AppText>
        <Button label="Back to worlds" onPress={() => router.back()} />
      </View>
    );
  }

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
        <AppText variant="meta" color={Colors.muted}>
          Loading world…
        </AppText>
      </View>
    );
  }

  return (
    <GameScreen
      worldId={loaded.summary.id}
      worldName={loaded.summary.name}
      seedText={loaded.summary.seedText}
      initial={loaded.game}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: Colors.bg },
  text: { textAlign: 'center' },
});
