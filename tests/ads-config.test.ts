import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  bonusReadyIn,
  BONUS_COOLDOWN_MS,
  canShowInterstitial,
  INTERSTITIAL_MIN_GAP_MS,
  INTERSTITIAL_SESSION_CAP,
} from '../src/lib/ads/ad-policy.ts';

const require = createRequire(import.meta.url);
const units = require('../src/lib/ads/production-unit-ids.js');
const appId = require('../src/lib/ads/android-app-id.js');

test('closed testing: real unit IDs are switched off', () => {
  assert.equal(units.PRODUCTION_UNIT_IDS, null);
  assert.equal(units.LIVE_AD_UNITS_ENABLED, false);
  assert.deepEqual(units.missingProductionUnits(), ['menu_banner', 'return_interstitial', 'game_rewarded']);
  assert.doesNotThrow(() => units.checkLiveAdUnits(true));
});

test('enabling live units without real IDs stops the build', () => {
  assert.throws(() => units.checkLiveAdUnits(true, true, { menu_banner: 'ca-app-pub-3940256099942544/9214589741' }));
  assert.doesNotThrow(() =>
    units.checkLiveAdUnits(true, true, {
      menu_banner: 'ca-app-pub-4342572133101591/1234567890',
      return_interstitial: 'ca-app-pub-4342572133101591/1234567891',
      game_rewarded: 'ca-app-pub-4342572133101591/1234567892',
    }),
  );
});

test('the Google sample app ID is allowed only while test units are in use', () => {
  const sample = 'ca-app-pub-3940256099942544~3347511713';
  assert.equal(appId.ADMOB_ANDROID_APP_ID, sample);
  assert.equal(
    appId.resolveAndroidAppId({ profile: 'production', adsMode: 'live', fromConfig: sample, liveUnitsEnabled: false }),
    sample,
  );
  assert.throws(() =>
    appId.resolveAndroidAppId({ profile: 'production', adsMode: 'live', fromConfig: sample, liveUnitsEnabled: true }),
  );
  assert.throws(() => appId.resolveAndroidAppId({ profile: 'preview', fromConfig: 'ca-app-pub-XXXXXXXX~YYYYYYYY' }));
  assert.equal(
    appId.resolveAndroidAppId({ profile: 'production', fromEnv: 'ca-app-pub-4342572133101591~1234567890', liveUnitsEnabled: true }),
    'ca-app-pub-4342572133101591~1234567890',
  );
});

test('the root app.json block is rewritten for Gradle without comment lines', () => {
  const text = '{\n  "x": 1,\n  "react-native-google-mobile-ads": {\n    "android_app_id": "old",\n    // comment\n    "delay_app_measurement_init": true\n  }\n}';
  const next = appId.applyRootMobileAdsAppIds(text, { androidAppId: 'ca-app-pub-3940256099942544~3347511713' });
  assert.ok(!next.includes('// comment'));
  assert.equal(JSON.parse(next)['react-native-google-mobile-ads'].android_app_id, 'ca-app-pub-3940256099942544~3347511713');
});

const base = {
  now: 10_000_000,
  sessionStartedAt: 10_000_000 - 10 * 60_000,
  lastShownAt: null,
  shownThisSession: 0,
  playedMs: 5 * 60_000,
  loaded: true,
};

test('interstitials are frequency capped', () => {
  assert.equal(canShowInterstitial(base), true);
  assert.equal(canShowInterstitial({ ...base, loaded: false }), false);
  assert.equal(canShowInterstitial({ ...base, playedMs: 30_000 }), false);
  assert.equal(canShowInterstitial({ ...base, sessionStartedAt: base.now - 30_000 }), false);
  assert.equal(canShowInterstitial({ ...base, lastShownAt: base.now - INTERSTITIAL_MIN_GAP_MS + 1000 }), false);
  assert.equal(canShowInterstitial({ ...base, lastShownAt: base.now - INTERSTITIAL_MIN_GAP_MS }), true);
  assert.equal(canShowInterstitial({ ...base, shownThisSession: INTERSTITIAL_SESSION_CAP }), false);
});

test('the rewarded bonus has a cooldown', () => {
  assert.equal(bonusReadyIn(null, 1000), 0);
  assert.equal(bonusReadyIn(1000, 1000), BONUS_COOLDOWN_MS);
  assert.equal(bonusReadyIn(1000, 1000 + BONUS_COOLDOWN_MS + 5), 0);
});
