import { createContext, useContext } from 'react';

export type AdsContextValue = {
  /** Consent gathered and the SDK initialised; ad requests are allowed. */
  ready: boolean;
  /** UMP says the app must offer a privacy options entry point. */
  privacyOptionsRequired: boolean;
  rewardedReady: boolean;
  /** Shows the rewarded ad. Resolves true only when the reward was earned. Never throws. */
  showRewarded: () => Promise<boolean>;
  /** Shows an interstitial if the frequency cap allows it. Never blocks navigation. */
  maybeShowInterstitial: (playedMs: number) => void;
  openPrivacyOptions: () => Promise<void>;
};

export const idleAdsContext: AdsContextValue = {
  ready: false,
  privacyOptionsRequired: false,
  rewardedReady: false,
  showRewarded: async () => false,
  maybeShowInterstitial: () => undefined,
  openPrivacyOptions: async () => undefined,
};

export const AdsContext = createContext<AdsContextValue>(idleAdsContext);

export function useAds(): AdsContextValue {
  return useContext(AdsContext);
}
