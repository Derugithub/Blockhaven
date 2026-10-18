import { LIVE_AD_UNITS_ENABLED, PRODUCTION_UNIT_IDS as PRODUCTION_UNIT_ID_VALUES } from './production-unit-ids';

export const AD_PLACEMENTS = ['menu_banner', 'return_interstitial', 'game_rewarded'] as const;

export type AdPlacement = (typeof AD_PLACEMENTS)[number];

/**
 * Production unit IDs live in production-unit-ids.js. During closed testing they are commented out
 * (null), and every build, production included, uses Google's test units. See that file to re-enable.
 */
export const PRODUCTION_UNIT_IDS: Record<AdPlacement, string> | null = PRODUCTION_UNIT_ID_VALUES;

export { LIVE_AD_UNITS_ENABLED };

/** Test units are used in test mode, and in live mode while real ad units are commented out. */
export function usesTestUnits(testMode: boolean, liveUnitsEnabled: boolean = LIVE_AD_UNITS_ENABLED): boolean {
  return testMode || !liveUnitsEnabled || PRODUCTION_UNIT_IDS === null;
}

/** Google's public Android test unit IDs, matching `TestIds` in react-native-google-mobile-ads. */
export const GOOGLE_TEST_UNIT_IDS: Record<AdPlacement, string> = {
  menu_banner: 'ca-app-pub-3940256099942544/9214589741',
  return_interstitial: 'ca-app-pub-3940256099942544/1033173712',
  game_rewarded: 'ca-app-pub-3940256099942544/5224354917',
};

export type TestIdMap = Record<AdPlacement, string>;

/**
 * Returns a unit ID, or null when live mode still has a placeholder (that placement stays off).
 * In test mode the value comes from the library's `TestIds` when passed, otherwise Google's IDs.
 */
export function getUnitId(
  placement: AdPlacement,
  options: { testMode: boolean; testIds?: Partial<TestIdMap>; liveUnitsEnabled?: boolean },
): string | null {
  if (usesTestUnits(options.testMode, options.liveUnitsEnabled) || PRODUCTION_UNIT_IDS === null) {
    return options.testIds?.[placement] ?? GOOGLE_TEST_UNIT_IDS[placement];
  }
  const id = PRODUCTION_UNIT_IDS[placement];
  if (!id || id.includes('XXXXXXXX')) return null;
  return id;
}
