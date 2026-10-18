import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { MAX_HEALTH } from '@/game/player';
import type { Slot } from '@/game/inventory';
import { Colors, Fonts } from '@/theme/theme';

import { ItemIcon } from './item-icon';

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
