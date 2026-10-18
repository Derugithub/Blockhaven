import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AdsProvider } from '@/lib/ads/ads-provider';
import { SettingsProvider } from '@/lib/settings';
import { Colors } from '@/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(Colors.bg).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <AdsProvider>
            <ThemeProvider
              value={{
                ...DarkTheme,
                colors: {
                  ...DarkTheme.colors,
                  background: Colors.bg,
                  card: Colors.bg,
                  text: Colors.ink,
                  border: Colors.line,
                  primary: Colors.accent,
                },
              }}>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: Colors.bg },
                  animation: 'fade',
                }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="new-world" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="play/[id]" options={{ gestureEnabled: false }} />
              </Stack>
            </ThemeProvider>
          </AdsProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
