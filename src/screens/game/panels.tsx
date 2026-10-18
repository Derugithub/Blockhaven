import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, IconButton } from '@/components/ui';
import { Item, itemName } from '@/game/blocks';
import { BEACON_CRYSTALS } from '@/game/crafting';
import type { Quest } from '@/game/quests';
import { rewardLabel } from '@/game/quests';
import { Colors } from '@/theme/theme';

import { ItemIcon } from './item-icon';

export type QuestRow = { quest: Quest; progress: number; done: boolean };

/** Every quest with progress, rewards and what to do next. */
export function QuestPanel({
  rows,
  crystals,
  onClose,
}: {
  rows: QuestRow[];
  crystals: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const finished = rows.filter((r) => r.done).length;
  return (
    <View
      style={[
        styles.backdrop,
        {
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 12,
          paddingLeft: insets.left + 12,
          paddingRight: insets.right + 12,
        },
      ]}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View>
            <AppText variant="title">Quests</AppText>
            <AppText variant="meta" color={Colors.muted}>
              {`${finished} of ${rows.length} done`}
            </AppText>
          </View>
          <IconButton icon="close" label="Close quests" onPress={onClose} />
        </View>
        <View style={styles.goal}>
          <ItemIcon item={Item.Crystal} size={28} />
          <View style={styles.flex}>
            <AppText variant="bodyMedium">The goal: build the Haven Beacon</AppText>
            <AppText variant="meta" color={Colors.muted}>
              {`Crystals ${Math.min(crystals, BEACON_CRYSTALS)}/${BEACON_CRYSTALS}. They hide just above the bedrock and need an iron pickaxe.`}
            </AppText>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {rows.map(({ quest, progress, done }) => (
            <View key={quest.id} style={[styles.row, done && styles.rowDone]}>
              <Ionicons
                name={done ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={done ? Colors.accent : Colors.muted}
              />
              <View style={styles.flex}>
                <View style={styles.titleRow}>
                  <AppText variant="bodyMedium" style={styles.flex}>
                    {quest.title}
                  </AppText>
                  {!done && quest.target > 1 ? (
                    <AppText variant="meta" color={Colors.muted}>
                      {`${progress}/${quest.target}`}
                    </AppText>
                  ) : null}
                </View>
                {!done ? (
                  <>
                    <AppText variant="meta" color={Colors.muted}>
                      {quest.hint}
                    </AppText>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${Math.round((progress / quest.target) * 100)}%` }]} />
                    </View>
                  </>
                ) : null}
                <AppText variant="meta" color={done ? Colors.muted : Colors.warn}>
                  {`${done ? 'Earned' : 'Reward'}: ${rewardLabel(quest.rewards, itemName)}`}
                </AppText>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const CONFETTI_COLORS = ['#6CC56A', '#F2C14E', '#7BE3EC', '#E5675E', '#F3F5FA', '#B48CF2'];

function ConfettiPiece({ index, width, height, clock }: { index: number; width: number; height: number; clock: SharedValue<number> }) {
  const seed = (index * 9301 + 49297) % 233280;
  const x = (seed / 233280) * width;
  const delay = (index * 0.137) % 1;
  const size = 6 + (index % 4) * 2;
  const drift = ((index % 7) - 3) * 10;
  const animated = useAnimatedStyle(() => {
    const t = (clock.get() + delay) % 1;
    return {
      transform: [
        { translateX: x + Math.sin(t * Math.PI * 4 + index) * 14 + drift * t },
        { translateY: -30 + t * (height + 60) },
        { rotate: `${t * 720 + index * 40}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.confetti,
        { width: size, height: size * 0.6, backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length] },
        animated,
      ]}
    />
  );
}

/** Celebration when the Haven Beacon is built. Play carries on afterwards. */
export function WinOverlay({
  days,
  maxDepth,
  monsters,
  onContinue,
}: {
  days: number;
  maxDepth: number;
  monsters: number;
  onContinue: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clock = useSharedValue(0);
  const glow = useSharedValue(0);
  useEffect(() => {
    clock.set(withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1, false));
    glow.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => {
      cancelAnimation(clock);
      cancelAnimation(glow);
    };
  }, [clock, glow]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + glow.get() * 0.5,
    transform: [{ scale: 1 + glow.get() * 0.12 }],
  }));
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => i), []);

  return (
    <View style={[styles.backdrop, styles.winBackdrop]}>
      <View pointerEvents="none" style={styles.confettiLayer}>
        {pieces.map((i) => (
          <ConfettiPiece key={i} index={i} width={width} height={height} clock={clock} />
        ))}
      </View>
      <View style={[styles.winCard, { marginTop: insets.top, marginBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={styles.winBody}>
          <View style={styles.beaconWrap}>
            <Animated.View style={[styles.beaconGlow, glowStyle]} />
            <ItemIcon item={Item.Beacon} size={72} />
          </View>
          <AppText variant="display" style={styles.center}>
            Haven found!
          </AppText>
          <AppText variant="body" color={Colors.muted} style={styles.center}>
            You built the Haven Beacon. Place it anywhere to light up your home. The world is yours to keep exploring.
          </AppText>
          <View style={styles.stats}>
            <Stat icon="sunny-outline" label="Days" value={String(days)} />
            <Stat icon="arrow-down" label="Deepest" value={`${maxDepth} m`} />
            <Stat icon="skull-outline" label="Monsters" value={String(monsters)} />
          </View>
          <Button label="Keep playing" icon="play" onPress={onContinue} />
        </ScrollView>
      </View>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: 'sunny-outline' | 'arrow-down' | 'skull-outline'; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={Colors.warn} />
      <AppText variant="heading">{value}</AppText>
      <AppText variant="meta" color={Colors.muted}>
        {label}
      </AppText>
    </View>
  );
}

/** The current tutorial hint with a skip button. */
export function TutorialCard({
  title,
  text,
  index,
  total,
  onSkip,
  onDone,
}: {
  title: string;
  text: string;
  index: number;
  total: number;
  onSkip: () => void;
  /** Shown on the last card instead of skip. */
  onDone?: () => void;
}) {
  return (
    <View style={styles.tutorial} accessibilityLiveRegion="polite">
      <View style={styles.flex}>
        <AppText variant="label" color={Colors.warn}>
          {onDone ? 'Tutorial complete' : `Tutorial ${index}/${total} · ${title}`}
        </AppText>
        <AppText variant="body" color="#FFFFFF">
          {text}
        </AppText>
      </View>
      {onDone ? (
        <Button compact label="Got it" onPress={onDone} />
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Skip the tutorial" onPress={onSkip} hitSlop={10} style={styles.skip}>
          <AppText variant="meta" color={Colors.muted}>
            Skip
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    flexShrink: 1,
    backgroundColor: Colors.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: 16,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.panelRaised,
    borderWidth: 1,
    borderColor: 'rgba(123,227,236,0.4)',
    marginBottom: 10,
  },
  list: { gap: 8, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.panelRaised,
  },
  rowDone: { opacity: 0.7 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 5, borderRadius: 3, marginVertical: 6, backgroundColor: Colors.line, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: Colors.warn },
  winBackdrop: { backgroundColor: 'rgba(8,10,18,0.82)' },
  confettiLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  confetti: { position: 'absolute', top: 0, left: 0, borderRadius: 1 },
  winCard: {
    width: '90%',
    maxWidth: 460,
    flexShrink: 1,
    backgroundColor: Colors.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(123,227,236,0.5)',
  },
  winBody: { padding: 22, gap: 14, alignItems: 'stretch' },
  beaconWrap: { alignSelf: 'center', width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  beaconGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(123,227,236,0.28)',
  },
  stats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 },
  stat: { alignItems: 'center', gap: 2 },
  tutorial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 460,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(10,12,20,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(242,193,78,0.55)',
  },
  skip: { paddingHorizontal: 8, paddingVertical: 6 },
});
