import { Image, StyleSheet, View } from 'react-native';

import { itemIconUri } from '@/render/assets';

/** Crisp item icon drawn from the same code-made pixels as the world. */
export function ItemIcon({ item, size }: { item: number; size: number }) {
  const uri = itemIconUri(item);
  if (!uri) return <View style={{ width: size, height: size }} />;
  return <Image source={{ uri }} style={[styles.icon, { width: size, height: size }]} resizeMode="contain" />;
}

const styles = StyleSheet.create({ icon: { backgroundColor: 'transparent' } });
