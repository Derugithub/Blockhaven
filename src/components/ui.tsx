import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { renderFontChildren, systemFaceOverride, type FontWeight } from '@/theme/font-text';
import { Colors, Fonts, MAX_CONTENT_WIDTH } from '@/theme/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyMedium' | 'label' | 'meta';

const variantStyle: Record<Variant, TextStyle> = {
  display: { fontFamily: Fonts.bold, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  title: { fontFamily: Fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontFamily: Fonts.semi, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 22 },
  bodyMedium: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: Fonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase' },
  meta: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18 },
};

const variantWeight: Record<Variant, FontWeight> = {
  display: '700',
  title: '700',
  heading: '600',
  body: '400',
  bodyMedium: '500',
  label: '600',
  meta: '400',
};

/** Text in Inter. Amharic and other scripts Inter lacks switch to the system face per run. */
export function AppText({
  children,
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; children?: ReactNode }) {
  const weight = variantWeight[variant];
  const only = typeof children === 'string' ? children : null;
  return (
    <Text
      {...rest}
      style={[variantStyle[variant], { color: color ?? Colors.ink }, style, only ? systemFaceOverride(only, weight) : null]}>
      {renderFontChildren(children, weight)}
    </Text>
  );
}

/** Full screen with safe-area padding on all four sides and a centred column for large screens. */
export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}>
      <View style={[styles.column, style]}>{children}</View>
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  busy,
  style,
  compact,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const palette = buttonColors[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={palette.ink} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={palette.ink} /> : null}
          <AppText variant="bodyMedium" color={palette.ink} style={compact ? styles.compactText : null}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const buttonColors: Record<ButtonKind, { bg: string; ink: string; border: string }> = {
  primary: { bg: Colors.accent, ink: Colors.accentInk, border: Colors.accent },
  secondary: { bg: Colors.panelRaised, ink: Colors.ink, border: Colors.line },
  ghost: { bg: 'transparent', ink: Colors.ink, border: Colors.line },
  danger: { bg: 'transparent', ink: Colors.danger, border: Colors.danger },
};

export function IconButton({
  icon,
  label,
  onPress,
  size = 22,
  style,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.7 : 1 }, style]}>
      <Ionicons name={icon} size={size} color={Colors.ink} />
    </Pressable>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  column: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: 20 },
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonCompact: { minHeight: 38, paddingHorizontal: 12, borderRadius: 10 },
  compactText: { fontSize: 14 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.panelRaised,
  },
  panel: {
    backgroundColor: Colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: 16,
  },
});
