import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { canShowInterstitial } from '@/lib/ads/ad-policy';
import { TEST_DEVICE_IDENTIFIERS } from '@/lib/ads/ad-config';
import { getUnitId } from '@/lib/ads/ad-units';
import { AdsContext, type AdsContextValue } from '@/lib/ads/ads-context';
import { isTestAdsMode, logAdDecision } from '@/lib/ads/ads-mode';
import { gatherConsent, privacyOptionsRequired, showPrivacyOptions } from '@/lib/ads/consent';
import { loadGoogleMobileAds } from '@/lib/ads/native-ads';

type Interstitial = ReturnType<ReturnType<typeof loadGoogleMobileAds>['InterstitialAd']['createForAdRequest']>;
type Rewarded = ReturnType<ReturnType<typeof loadGoogleMobileAds>['RewardedAd']['createForAdRequest']>;

const RETRY_MS = 60_000;

/**
 * Gathers UMP consent, initialises the SDK only when consent allows ad requests, and keeps one
 * interstitial and one rewarded ad preloaded. Any failure leaves ads off; gameplay never waits.
 */
export function AdsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [rewardedReady, setRewardedReady] = useState(false);

  const sessionStartedAt = useRef<number | null>(null);
  const interstitial = useRef<{ ad: Interstitial; loaded: boolean } | null>(null);
  const rewarded = useRef<{ ad: Rewarded; loaded: boolean } | null>(null);
  const lastInterstitialAt = useRef<number | null>(null);
  const shownThisSession = useRef(0);
  const rewardResolver = useRef<((earned: boolean) => void) | null>(null);
  const earned = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const unsubscribers = useRef<(() => void)[]>([]);

  const setUp = useCallback(() => {
    const ads = loadGoogleMobileAds();
    const testMode = isTestAdsMode();
    const testIds = {
      menu_banner: ads.TestIds.ADAPTIVE_BANNER,
      return_interstitial: ads.TestIds.INTERSTITIAL,
      game_rewarded: ads.TestIds.REWARDED,
    };

    const interstitialId = getUnitId('return_interstitial', { testMode, testIds });
    if (interstitialId) {
      const ad = ads.InterstitialAd.createForAdRequest(interstitialId);
      const holder = { ad, loaded: false };
      interstitial.current = holder;
      unsubscribers.current.push(
        ad.addAdEventListener(ads.AdEventType.LOADED, () => {
          holder.loaded = true;
        }),
        ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
          holder.loaded = false;
          ad.load();
        }),
        ad.addAdEventListener(ads.AdEventType.ERROR, (error) => {
          holder.loaded = false;
          logAdDecision('interstitial failed', { error: String(error) });
          timers.current.push(setTimeout(() => ad.load(), RETRY_MS));
        }),
      );
      ad.load();
    }

    const rewardedId = getUnitId('game_rewarded', { testMode, testIds });
    if (rewardedId) {
      const ad = ads.RewardedAd.createForAdRequest(rewardedId);
      const holder = { ad, loaded: false };
      rewarded.current = holder;
      const finish = (value: boolean) => {
        const resolve = rewardResolver.current;
        rewardResolver.current = null;
        resolve?.(value);
      };
      unsubscribers.current.push(
        ad.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
          holder.loaded = true;
          setRewardedReady(true);
        }),
        ad.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => {
          earned.current = true;
        }),
        ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
          holder.loaded = false;
          setRewardedReady(false);
          finish(earned.current);
          ad.load();
        }),
        ad.addAdEventListener(ads.AdEventType.ERROR, (error) => {
          holder.loaded = false;
          setRewardedReady(false);
          logAdDecision('rewarded failed', { error: String(error) });
          finish(false);
          timers.current.push(setTimeout(() => ad.load(), RETRY_MS));
        }),
      );
      ad.load();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    sessionStartedAt.current = Date.now();
    (async () => {
      try {
        const info = await gatherConsent();
        if (cancelled) return;
        setPrivacyRequired(privacyOptionsRequired(info));
        if (!info.canRequestAds) {
          logAdDecision('consent does not allow ad requests');
          return;
        }
        const ads = loadGoogleMobileAds();
        if (isTestAdsMode()) {
          await ads.default().setRequestConfiguration({ testDeviceIdentifiers: [...TEST_DEVICE_IDENTIFIERS] });
        }
        await ads.default().initialize();
        if (cancelled) return;
        setUp();
        setReady(true);
        logAdDecision('ads ready');
      } catch (error) {
        logAdDecision('ads disabled', { error: String(error) });
      }
    })();
    const pending = timers.current;
    const subs = unsubscribers.current;
    return () => {
      cancelled = true;
      pending.forEach(clearTimeout);
      subs.forEach((unsubscribe) => unsubscribe());
    };
  }, [setUp]);

  const showRewarded = useCallback(async (): Promise<boolean> => {
    const holder = rewarded.current;
    if (!holder || !holder.loaded || rewardResolver.current) return false;
    earned.current = false;
    return new Promise<boolean>((resolve) => {
      rewardResolver.current = resolve;
      holder.ad.show().catch(() => {
        rewardResolver.current = null;
        resolve(false);
      });
    });
  }, []);

  const maybeShowInterstitial = useCallback((playedMs: number) => {
    const holder = interstitial.current;
    const now = Date.now();
    const allowed = canShowInterstitial({
      now,
      sessionStartedAt: sessionStartedAt.current ?? now,
      lastShownAt: lastInterstitialAt.current,
      shownThisSession: shownThisSession.current,
      playedMs,
      loaded: Boolean(holder?.loaded),
    });
    logAdDecision('interstitial check', { allowed, playedMs });
    if (!allowed || !holder) return;
    lastInterstitialAt.current = now;
    shownThisSession.current += 1;
    holder.ad.show().catch(() => undefined);
  }, []);

  const openPrivacyOptions = useCallback(async () => {
    try {
      const info = await showPrivacyOptions();
      setPrivacyRequired(privacyOptionsRequired(info));
    } catch (error) {
      logAdDecision('privacy options failed', { error: String(error) });
    }
  }, []);

  const value = useMemo<AdsContextValue>(
    () => ({
      ready,
      privacyOptionsRequired: privacyRequired,
      rewardedReady: ready && rewardedReady,
      showRewarded,
      maybeShowInterstitial,
      openPrivacyOptions,
    }),
    [ready, privacyRequired, rewardedReady, showRewarded, maybeShowInterstitial, openPrivacyOptions],
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}
