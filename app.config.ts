import type { ConfigContext, ExpoConfig } from 'expo/config';

import { isLiveAdBuild, resolveMobileAdsAppIds, syncRootMobileAdsAppIds } from './src/lib/ads/android-app-id.js';
import { checkLiveAdUnits, LIVE_AD_UNITS_ENABLED } from './src/lib/ads/production-unit-ids.js';

/**
 * app.json stays the source for everything except the resolved AdMob Android app ID and ads mode.
 * During closed testing the real units are commented out, so every build, production included,
 * uses Google's test units. Blockhaven has no AdMob app yet, so the app ID is Google's sample ID;
 * that is accepted only while real units are off. Once real units are uncommented, a live build
 * throws if a placement has no real unit ID or the app ID is still the sample.
 *
 * The Expo plugin options and the root `react-native-google-mobile-ads` block are separate.
 * Gradle reads the root `android_app_id` from disk, so native builds also rewrite that block.
 * That rewrite drops full-line comments so Gradle's strict JSON parser still sees the Android app ID.
 *
 * Kept for a future iOS release. Android is the only ad target for now.
 * "iosAppId": "ca-app-pub-3940256099942544~1458002511",
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE ?? 'local';
  const adsMode = process.env.ADS_MODE ?? (profile === 'production' ? 'live' : 'test');

  const entry = (config.plugins ?? []).find(
    (plugin): plugin is [string, Record<string, unknown>] =>
      Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads',
  );
  const options = entry?.[1] ?? {};
  const ids = resolveMobileAdsAppIds({
    profile,
    adsMode,
    androidFromEnv: process.env.ADMOB_ANDROID_APP_ID,
    androidFromConfig: typeof options.androidAppId === 'string' ? options.androidAppId : undefined,
    liveUnitsEnabled: LIVE_AD_UNITS_ENABLED,
  });
  // Checks unit IDs only once real ad units are uncommented in production-unit-ids.js.
  checkLiveAdUnits(isLiveAdBuild({ profile, adsMode }));
  syncRootMobileAdsAppIds(ids);

  const plugins = (config.plugins ?? []).map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== 'react-native-google-mobile-ads') return plugin;
    const current = { ...(plugin[1] ?? {}) } as Record<string, unknown>;
    // Kept for a future iOS release. Android is the only ad target for now.
    delete current.iosAppId;
    return ['react-native-google-mobile-ads', { ...current, androidAppId: ids.androidAppId }] as [
      string,
      Record<string, unknown>,
    ];
  });

  return {
    ...config,
    name: config.name ?? 'Blockhaven',
    slug: config.slug ?? 'blockhaven',
    plugins,
    extra: {
      ...config.extra,
      adsMode,
    },
  };
};
