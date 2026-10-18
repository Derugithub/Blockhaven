export type GoogleMobileAdsModule = typeof import('react-native-google-mobile-ads');

/** Loads the Google Mobile Ads module on first use so a failure never blocks app start. */
export function loadGoogleMobileAds(): GoogleMobileAdsModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-google-mobile-ads') as GoogleMobileAdsModule;
}
