import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { MAX_HEALTH } from '@/game/player';
import type { Slot } from '@/game/inventory';
import { MAX_HUNGER } from '@/game/survival';
import { Colors, Fonts } from '@/theme/theme';

import { ItemIcon } from './item-icon';

/** A pulsing gold frame drawn around whatever it is placed in. Used by the tutorial. */
export function PulseRing({ radius = 14, inset = -6 }: { radius?: number; inset?: number }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [pulse]);
  const animated = useAnimatedStyle(() => ({
    opacity: 0.4 + pulse.get() * 0.6,
    transform: [{ scale: 1 + pulse.get() * 0.06 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, { top: inset, left: inset, right: inset, bottom: inset, borderRadius: radius }, animated]}
    />
  );
}

/** Wraps a control and rings it while `on` is true. */
export function Highlightable({ on, radius, children }: { on: boolean; radius?: number; children: ReactNode }) {
  return (
    <View>
      {children}
      {on ? <PulseRing radius={radius} /> : null}
    </View>
  );
}

/** Hunger as ten small bars that empty from the right, with half steps. */
export function HungerBar({ hunger }: { hunger: number }) {
  const halves = Math.ceil(hunger * 2);
  return (
    <View style={styles.hunger} accessibilityLabel={`Hunger ${Math.ceil(hunger)} of ${MAX_HUNGER}`}>
      {Array.from({ length: MAX_HUNGER }, (_, i) => {
        const fill = Math.max(0, Math.min(2, halves - i * 2));
        return (
          <View key={i} style={[styles.food, styles.foodEmpty]}>
            {fill > 0 ? <View style={[styles.foodFill, { width: fill === 2 ? '100%' : '50%' }]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

/** Depth below the spawn ground, with the crystal layer called out once you are close. */
export function DepthMeter({ depth, crystalDepth }: { depth: number; crystalDepth: number }) {
  const label = depth <= 0 ? 'Surface' : `${depth} m deep`;
  const near = depth >= crystalDepth - 6;
  return (
    <View style={styles.chip} accessibilityLabel={depth <= 0 ? 'At the surface' : `Depth ${depth} metres`}>
      <Ionicons name="arrow-down" size={13} color={near ? '#7BE3EC' : '#FFFFFF'} />
      <AppText variant="meta" color={near ? '#7BE3EC' : '#FFFFFF'}>
        {near && depth > 0 ? `${label} · crystal layer` : label}
      </AppText>
    </View>
  );
}

/** The current quest with its progress. Tap to open the quest list. */
export function QuestCard({
  title,
  progress,
  target,
  done,
  onPress,
}: {
  title: string;
  progress: number;
  target: number;
  done: boolean;
  onPress: () => void;
}) {
  const ratio = target > 0 ? Math.min(1, progress / target) : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={done ? 'All quests done. Open quests' : `Quest: ${title}, ${progress} of ${target}. Open quests`}
      onPress={onPress}
      style={({ pressed }) => [styles.quest, pressed && styles.questPressed]}>
      <View style={styles.questRow}>
        <Ionicons name={done ? 'trophy' : 'flag'} size={13} color={Colors.warn} />
        <AppText variant="meta" color="#FFFFFF" numberOfLines={1} style={styles.questTitle}>
          {done ? 'All quests done!' : title}
        </AppText>
        {!done && target > 1 ? (
          <AppText variant="meta" color={Colors.muted}>
            {`${progress}/${target}`}
          </AppText>
        ) : null}
      </View>
      {!done ? (
        <View style={styles.questTrack}>
          <View style={[styles.questFill, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** Round button shown when the selected hotbar item is food. */
export function EatButton({ size, onPress }: { size: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Eat the selected food"
      onPress={onPress}
      style={({ pressed }) => [
        styles.eat,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.questPressed,
      ]}>
      <Ionicons name="restaurant" size={size * 0.42} color="#FFFFFF" />
    </Pressable>
  );
}

export function Hearts({ health }: { health: number }) {
  return (
    <View style={styles.hearts} accessibilityLabel={`Health ${health} of ${MAX_HEALTH}`}>
      {Array.from({ length: MAX_HEALTH }, (_, i) => (
        <View key={i} style={[styles.heart, i < health ? styles.heartFull : styles.heartEmpty]} />
      ))}
    </View>
  );
}

export function Clock({ label, night }: { label: string; night: boolean }) {
  return (
    <View style={styles.clock}>
      <Ionicons name={night ? 'moon' : 'sunny'} size={14} color={night ? '#D7DCF0' : '#FFD45C'} />
      <AppText variant="meta" color="#FFFFFF">
        {label}
      </AppText>
    </View>
  );
}

export function Hotbar({
  slots,
  selected,
  slotSize,
  onSelect,
}: {
  slots: Slot[];
  selected: number;
  slotSize: number;
  onSelect: (index: number) => void;
}) {
  return (
    <View style={styles.hotbar}>
      {slots.map((slot, i) => (
        <Pressable
          key={i}
          accessibilityRole="button"
          accessibilityLabel={`Hotbar slot ${i + 1}`}
          onPress={() => onSelect(i)}
          style={[
            styles.slot,
            { width: slotSize, height: slotSize },
            i === selected ? styles.slotSelected : null,
          ]}>
          {slot ? <ItemIcon item={slot.item} size={slotSize * 0.66} /> : null}
          {slot && slot.count > 1 ? (
            <AppText variant="meta" color="#FFFFFF" style={styles.count}>
              {String(slot.count)}
            </AppText>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 3, borderColor: Colors.warn },
  hunger: { flexDirection: 'row', gap: 3, marginTop: 4 },
  food: { width: 11, height: 11, borderRadius: 2, borderWidth: 1, overflow: 'hidden' },
  foodEmpty: { backgroundColor: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.3)' },
  foodFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#D99A3E' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignSelf: 'flex-start',
  },
  quest: {
    marginTop: 8,
    width: 196,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(10,12,20,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(242,193,78,0.35)',
  },
  questPressed: { opacity: 0.8 },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  questTitle: { flex: 1 },
  questTrack: { height: 4, borderRadius: 2, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  questFill: { height: 4, borderRadius: 2, backgroundColor: Colors.warn },
  eat: {
    backgroundColor: 'rgba(217,154,62,0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hearts: { flexDirection: 'row', gap: 3 },
  heart: { width: 11, height: 11, borderRadius: 2, borderWidth: 1 },
  heartFull: { backgroundColor: '#E5534B', borderColor: '#7A1F1A' },
  heartEmpty: { backgroundColor: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.3)' },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignSelf: 'flex-start',
  },
  hotbar: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 12, 20, 0.55)',
  },
  slot: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotSelected: { borderColor: Colors.warn, backgroundColor: 'rgba(242,193,78,0.18)' },
  count: { position: 'absolute', right: 4, bottom: 1, fontSize: 11, lineHeight: 14, fontFamily: Fonts.bold },
});
