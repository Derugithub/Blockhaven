import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button } from '@/components/ui';
import { CONTROL_SIZES, type ControlsSize } from '@/lib/settings';
import { Colors } from '@/theme/theme';

function Backdrop({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.backdrop,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 },
      ]}>
      <View style={styles.card}>
        <ScrollView contentContainerStyle={styles.cardBody}>{children}</ScrollView>
      </View>
    </View>
  );
}

export function PauseMenu({
  worldName,
  seedText,
  controlsSize,
  bonusLabel,
  bonusEnabled,
  saving,
  onResume,
  onInventory,
  onQuests,
  onBonus,
  onControlsSize,
  onQuit,
}: {
  worldName: string;
  seedText: string;
  controlsSize: ControlsSize;
  bonusLabel: string;
  bonusEnabled: boolean;
  saving: boolean;
  onResume: () => void;
  onInventory: () => void;
  onQuests: () => void;
  onBonus: () => void;
  onControlsSize: (size: ControlsSize) => void;
  onQuit: () => void;
}) {
  return (
    <Backdrop>
      <AppText variant="title">Paused</AppText>
      <AppText variant="meta" color={Colors.muted} style={styles.sub}>
        {`${worldName} · seed ${seedText}`}
      </AppText>
      <View style={styles.stack}>
        <Button label="Resume" icon="play" onPress={onResume} />
        <Button label="Inventory & crafting" icon="cube-outline" kind="secondary" onPress={onInventory} />
        <Button label="Quests" icon="trophy-outline" kind="secondary" onPress={onQuests} />
        <Button label={bonusLabel} icon="gift-outline" kind="secondary" disabled={!bonusEnabled} onPress={onBonus} />
        <View>
          <AppText variant="label" color={Colors.muted} style={styles.label}>
            Controls size
          </AppText>
          <View style={styles.segment}>
            {(Object.keys(CONTROL_SIZES) as ControlsSize[]).map((size) => (
              <Button
                key={size}
                compact
                label={size[0].toUpperCase() + size.slice(1)}
                kind={size === controlsSize ? 'primary' : 'ghost'}
                onPress={() => onControlsSize(size)}
                style={styles.segmentItem}
              />
            ))}
          </View>
        </View>
        <Button label="Save & quit to menu" icon="exit-outline" kind="ghost" busy={saving} onPress={onQuit} />
      </View>
    </Backdrop>
  );
}

export function DeathDialog({
  canRevive,
  busy,
  onRespawn,
  onRevive,
}: {
  canRevive: boolean;
  busy: boolean;
  onRespawn: () => void;
  onRevive: () => void;
}) {
  return (
    <Backdrop>
      <AppText variant="title">You took a hard fall</AppText>
      <AppText variant="body" color={Colors.muted} style={styles.sub}>
        Your items are safe. Respawn at the world spawn, or watch a short ad to get back up right here.
      </AppText>
      <View style={styles.stack}>
        <Button label="Respawn" icon="home-outline" onPress={onRespawn} />
        {canRevive ? (
          <Button label="Revive here (watch ad)" icon="heart-outline" kind="secondary" busy={busy} onPress={onRevive} />
        ) : null}
      </View>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    flexShrink: 1,
    backgroundColor: Colors.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  cardBody: { padding: 20 },
  sub: { marginTop: 4 },
  stack: { gap: 10, marginTop: 16 },
  label: { marginBottom: 6 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: { flex: 1 },
});
