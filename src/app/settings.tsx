import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, IconButton, Panel, Screen } from '@/components/ui';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '@/lib/ads/ad-config';
import { useAds } from '@/lib/ads/ads-context';
import { CONTROL_SIZES, MAX_VOLUME, useSettings, type ControlsSize } from '@/lib/settings';
import { Colors } from '@/theme/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, update } = useSettings();
  const ads = useAds();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const [tutorialReset, setTutorialReset] = useState(false);

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
          <AppText variant="heading">Sound</AppText>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">Sound effects</AppText>
              <AppText variant="meta" color={Colors.muted}>
                Footsteps, digging, crafting, monsters.
              </AppText>
            </View>
            <Switch
              value={settings.soundEffects}
              onValueChange={(soundEffects) => update({ soundEffects })}
              trackColor={{ true: Colors.accent, false: Colors.line }}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">Music & ambience</AppText>
              <AppText variant="meta" color={Colors.muted}>
                Soft wind by day, crickets at night.
              </AppText>
            </View>
            <Switch
              value={settings.music}
              onValueChange={(music) => update({ music })}
              trackColor={{ true: Colors.accent, false: Colors.line }}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">Volume</AppText>
              <AppText variant="meta" color={Colors.muted}>
                {settings.volume === 0 ? 'Muted' : `${settings.volume * 10}%`}
              </AppText>
            </View>
            <IconButton
              icon="remove"
              label="Lower the volume"
              onPress={() => update({ volume: Math.max(0, settings.volume - 1) })}
            />
            <View style={styles.meter} accessibilityLabel={`Volume ${settings.volume} of ${MAX_VOLUME}`}>
              {Array.from({ length: MAX_VOLUME }, (_, i) => (
                <View key={i} style={[styles.meterBar, { height: 6 + i * 1.6 }, i < settings.volume && styles.meterOn]} />
              ))}
            </View>
            <IconButton
              icon="add"
              label="Raise the volume"
              onPress={() => update({ volume: Math.min(MAX_VOLUME, settings.volume + 1) })}
            />
          </View>
        </Panel>

        <Panel>
          <AppText variant="heading">How to play</AppText>
          <AppText variant="body" color={Colors.muted} style={styles.sub}>
            {
              'Your goal: find 10 glowing crystals deep underground and build the Haven Beacon. Follow the quest card at the top of the screen; each quest gives a reward.'
            }
          </AppText>
          <AppText variant="body" color={Colors.muted} style={styles.sub}>
            {
              'Walk with the arrows and jump with the up button. Tap a nearby block to mine it, tap empty space to place the block selected in your hotbar. Open the bag to craft planks, sticks, tools, swords, torches and food.'
            }
          </AppText>
          <AppText variant="body" color={Colors.muted} style={styles.sub}>
            {
              'Stone and coal need a wooden pickaxe, iron needs a stone pickaxe and crystals need an iron one. Eat berries, apples or berry pie when the hunger bar runs low. At night monsters walk the surface: tap them to fight, or stay in torch light. Long falls hurt. Peaceful worlds have no monsters and no hunger.'
            }
          </AppText>
          <Button
            label={tutorialReset ? 'Tutorial will play when you open a world' : 'Replay the tutorial'}
            icon="school-outline"
            kind="secondary"
            disabled={tutorialReset}
            onPress={() => {
              update({ tutorialDone: false, tutorialStep: 'walk' });
              setTutorialReset(true);
            }}
            style={styles.sub}
          />
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
  meter: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 24 },
  meterBar: { width: 5, borderRadius: 2, backgroundColor: Colors.line },
  meterOn: { backgroundColor: Colors.accent },
});
