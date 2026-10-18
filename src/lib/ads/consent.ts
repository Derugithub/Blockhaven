import type { AdsConsentInfo } from 'react-native-google-mobile-ads';

import { loadGoogleMobileAds } from '@/lib/ads/native-ads';

/** Runs the UMP flow: refreshes consent info and shows the form when Google requires it. */
export async function gatherConsent(): Promise<AdsConsentInfo> {
  return loadGoogleMobileAds().AdsConsent.gatherConsent();
}

export function privacyOptionsRequired(info: AdsConsentInfo): boolean {
  const { AdsConsentPrivacyOptionsRequirementStatus } = loadGoogleMobileAds();
  return info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
}

export async function showPrivacyOptions(): Promise<AdsConsentInfo> {
  return loadGoogleMobileAds().AdsConsent.showPrivacyOptionsForm();
}
