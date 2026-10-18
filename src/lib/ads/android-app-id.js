/* global __dirname */
const fs = require('fs');
const path = require('path');

/** Placeholder an app.json may carry before any AdMob Android app ID was set. */
const ADMOB_ANDROID_APP_ID_PLACEHOLDER = 'ca-app-pub-XXXXXXXX~YYYYYYYY';

/**
 * TEMPORARY: Google's sample AdMob Android app ID.
 * Blockhaven has no AdMob app yet. Replace this with the real Blockhaven app ID from the AdMob
 * account (publisher pub-4342572133101591) before release, here, in app.json (plugin androidAppId
 * and root android_app_id) and in the eas.json production env ADMOB_ANDROID_APP_ID.
 */
const ADMOB_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

/** Google's sample publisher. Allowed only while every ad unit is a Google test unit. */
const GOOGLE_SAMPLE_PUBLISHER = 'ca-app-pub-3940256099942544';
const GOOGLE_SAMPLE_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

const APP_ID_PATTERN = /^ca-app-pub-\d{16}~\d{10}$/;

// Kept for a future iOS release. Android is the only ad target for now.
// const GOOGLE_SAMPLE_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

/**
 * A build is live when ADS_MODE is live, or when the EAS profile is production
 * and ADS_MODE was not forced to test. Live builds request production ad units
 * once they are enabled in production-unit-ids.js.
 */
function isLiveAdBuild(input) {
  if (input.adsMode === 'live') return true;
  if (input.adsMode === 'test') return false;
  return input.profile === 'production';
}

function isRealAppId(value) {
  return APP_ID_PATTERN.test(value) && !value.startsWith(`${GOOGLE_SAMPLE_PUBLISHER}~`);
}

function isGoogleSampleAppId(value) {
  return value === GOOGLE_SAMPLE_ANDROID_APP_ID;
}

/**
 * Resolves the AdMob Android app ID that native config should use. A missing or invalid ID
 * crashes the native SDK at launch, so this throws instead of shipping one.
 *
 * 1. `ADMOB_ANDROID_APP_ID` when it is set
 * 2. Otherwise the app.json plugin value
 * 3. It must be a real ID, or Google's sample ID while real ad units are still off
 *    (`liveUnitsEnabled` false). Real units with the sample app ID would never serve, so that throws.
 *
 * This file is plain JavaScript because Expo loads app.config.ts without transpiling
 * TypeScript dependencies.
 */
function resolveAndroidAppId(input) {
  const envId = input.fromEnv?.trim() ?? '';
  const configId = input.fromConfig?.trim() ?? '';
  const source = envId ? 'ADMOB_ANDROID_APP_ID' : 'app.json androidAppId';
  const id = envId || configId;
  if (!id || id === ADMOB_ANDROID_APP_ID_PLACEHOLDER) {
    throw new Error('Set the AdMob Android app ID in app.json or ADMOB_ANDROID_APP_ID');
  }
  if (isGoogleSampleAppId(id)) {
    if (input.liveUnitsEnabled) {
      throw new Error(
        `${source} is still Google's sample app ID. Set the real Blockhaven AdMob app ID before enabling real ad units.`,
      );
    }
    return id;
  }
  if (!isRealAppId(id)) {
    throw new Error(`${source} "${id}" is not a valid AdMob Android app ID`);
  }
  return id;
}

function resolveMobileAdsAppIds(input) {
  return {
    androidAppId: resolveAndroidAppId({
      profile: input.profile,
      adsMode: input.adsMode,
      fromEnv: input.androidFromEnv,
      fromConfig: input.androidFromConfig,
      liveUnitsEnabled: input.liveUnitsEnabled,
    }),
    // Kept for a future iOS release. Android is the only ad target for now.
  };
}

/**
 * Gradle reads the root `react-native-google-mobile-ads` block from app.json on disk.
 * The Expo plugin `androidAppId` is a different key. The iOS app id stays commented out.
 */
function withoutFullLineComments(source) {
  return source
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

/**
 * Writes the resolved Android app ID. Gradle parses app.json with strict JSON, so the
 * native-build rewrite also drops full-line comments. `expo start` does not write that rewrite.
 */
function applyRootMobileAdsAppIds(appJsonText, ids) {
  const withAndroid = replaceJsonString(appJsonText, 'android_app_id', ids.androidAppId);
  return withoutFullLineComments(withAndroid);
}

function replaceJsonString(source, key, value) {
  const pattern = new RegExp(`("${key}"\\s*:\\s*")[^"]*(")`);
  if (!pattern.test(source)) {
    throw new Error(`app.json is missing "${key}"`);
  }
  return source.replace(pattern, `$1${value}$2`);
}

/** Native builds need the root IDs rewritten before Gradle reads app.json. */
function shouldSyncRootAppJson(env = process.env, argv = process.argv) {
  if (env.EAS_BUILD === 'true') return true;
  return /prebuild|run:android|run:ios/.test(argv.join(' '));
}

function defaultAppJsonPath() {
  return path.join(__dirname, '..', '..', '..', 'app.json');
}

/**
 * Writes the resolved IDs into the root block during EAS and local native builds.
 * `expo start` leaves the committed file alone. Returns true when the file changed.
 */
function syncRootMobileAdsAppIds(ids, options = {}) {
  const env = options.env ?? process.env;
  const argv = options.argv ?? process.argv;
  if (!shouldSyncRootAppJson(env, argv)) return false;
  const file = options.file ?? defaultAppJsonPath();
  const source = fs.readFileSync(file, 'utf8');
  const next = applyRootMobileAdsAppIds(source, ids);
  if (next === source) return false;
  fs.writeFileSync(file, next);
  return true;
}

module.exports = {
  ADMOB_ANDROID_APP_ID,
  ADMOB_ANDROID_APP_ID_PLACEHOLDER,
  GOOGLE_SAMPLE_PUBLISHER,
  GOOGLE_SAMPLE_ANDROID_APP_ID,
  isLiveAdBuild,
  isGoogleSampleAppId,
  resolveAndroidAppId,
  resolveMobileAdsAppIds,
  applyRootMobileAdsAppIds,
  shouldSyncRootAppJson,
  syncRootMobileAdsAppIds,
};
