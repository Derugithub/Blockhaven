import { Ionicons } from '@expo/vector-icons';
import { useMemo, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { PulseRing } from './hud';

/**
 * A button that reports press and release. Each button tracks its own finger, so walking and
 * jumping (and mining with a third finger) work at the same time.
 */
export function HoldButton({
  icon,
  label,
  size,
  onChange,
  style,
  highlighted = false,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  size: number;
  onChange: (pressed: boolean) => void;
  style?: StyleProp<ViewStyle>;
  /** Pulsing ring, used by the tutorial to point at this button. */
  highlighted?: boolean;
}) {
  const gesture = useMemo(
    () =>
      Gesture.Manual()
        .runOnJS(true)
        .onTouchesDown((_event, manager) => {
          manager.activate();
          onChange(true);
        })
        .onTouchesUp((_event, manager) => {
          onChange(false);
          manager.end();
        })
        .onTouchesCancelled((_event, manager) => {
          onChange(false);
          manager.end();
        })
        .onFinalize(() => onChange(false)),
    [onChange],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.button, { width: size, height: size, borderRadius: size * 0.28 }, style]}>
        <Ionicons name={icon} size={size * 0.46} color="rgba(255,255,255,0.92)" />
        {highlighted ? <PulseRing radius={size * 0.32} /> : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(16, 20, 30, 0.42)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * Full-screen touch layer over the world. A touch down taps the tile under the finger; dragging
 * reports each new tile so digging can follow the finger.
 */
export function WorldTouchLayer({
  children,
  onTouch,
  onEnd,
}: {
  children: ReactNode;
  onTouch: (x: number, y: number, moving: boolean) => void;
  onEnd: () => void;
}) {
  const gesture = useMemo(
    () =>
      Gesture.Manual()
        .runOnJS(true)
        .onTouchesDown((event, manager) => {
          manager.activate();
          const touch = event.changedTouches[0];
          if (touch) onTouch(touch.x, touch.y, false);
        })
        .onTouchesMove((event) => {
          const touch = event.changedTouches[0];
          if (touch) onTouch(touch.x, touch.y, true);
        })
        .onTouchesUp((event, manager) => {
          onEnd();
          if (event.numberOfTouches === 0) manager.end();
        })
        .onTouchesCancelled((_event, manager) => {
          onEnd();
          manager.end();
        }),
    [onTouch, onEnd],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}
