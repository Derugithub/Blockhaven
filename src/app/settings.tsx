import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, IconButton, Panel, Screen } from '@/components/ui';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '@/lib/ads/ad-config';
import { useAds } from '@/lib/ads/ads-context';
import { CONTROL_SIZES, useSettings, type ControlsSize } from '@/lib/settings';
import { Colors } from '@/theme/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, update } = useSettings();
  const ads = useAds();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <AppText variant="title">Settings</AppText>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Panel>
          <AppText variant="heading">Controls</AppText>
          <AppText variant="meta" color={Colors.muted} style={styles.sub}>
            Size of the on-screen walk and jump buttons.
          </AppText>
          <View style={styles.segment}>
            {(Object.keys(CONTROL_SIZES) as ControlsSize[]).map((size) => (
              <Button
                key={size}
                compact
                label={size[0].toUpperCase() + size.slice(1)}
                kind={settings.controlsSize === size ? 'primary' : 'ghost'}
                onPress={() => update({ controlsSize: size })}
                style={styles.segmentItem}
              />
            ))}
          </View>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">Gameplay hints</AppText>
              <AppText variant="meta" color={Colors.muted}>
                Short tips such as “Out of reach”.
              </AppText>
            </View>
            <Switch
              value={settings.showHints}
              onValueChange={(showHints) => update({ showHints })}
              trackColor={{ true: Colors.accent, false: Colors.line }}
            />
          </View>
        </Panel>

        <Panel>
          <AppText variant="heading">How to play</AppText>
          <AppText variant="body" color={Colors.muted} style={styles.sub}>
            {
              'Walk with the arrows and jump with the up button. Tap a nearby block to mine it, tap empty space to place the block selected in your hotbar. Open the inventory to craft planks, sticks, torches and pickaxes. Stone and coal need a pickaxe, iron needs a stone pickaxe. Torches light up caves and the night. Long falls hurt.'
            }
          </AppText>
        </Panel>

        <Panel>
          <AppText variant="heading">Privacy & ads</AppText>
          <AppText variant="meta" color={Colors.muted} style={styles.sub}>
            Worlds are saved only on this device. Blockhaven shows ads from Google AdMob and asks for consent where
            the law requires it.
          </AppText>
          <View style={styles.stack}>
            {ads.privacyOptionsRequired ? (
              <Button label="Ad privacy choices" icon="shield-checkmark-outline" kind="secondary" onPress={() => void ads.openPrivacyOptions()} />
            ) : null}
            <Button
              label="Privacy policy"
              icon="document-text-outline"
              kind="secondary"
              onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL).catch(() => Linking.openURL(PRIVACY_POLICY_URL))}
            />
            <Button
              label="Contact support"
              icon="mail-outline"
              kind="secondary"
              onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Blockhaven`).catch(() => undefined)}
            />
          </View>
          <AppText variant="meta" color={Colors.muted} style={styles.sub}>
            {SUPPORT_EMAIL}
          </AppText>
        </Panel>

        <AppText variant="meta" color={Colors.muted} style={styles.version}>
          {`Blockhaven ${version}`}
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 12 },
  body: { gap: 14, paddingBottom: 32 },
  sub: { marginTop: 6 },
  segment: { flexDirection: 'row', gap: 8, marginTop: 12 },
  segmentItem: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  stack: { gap: 10, marginTop: 12 },
  version: { textAlign: 'center' },
});
