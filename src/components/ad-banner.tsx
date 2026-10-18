import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getUnitId } from '@/lib/ads/ad-units';
import { useAds } from '@/lib/ads/ads-context';
import { isTestAdsMode, logAdDecision } from '@/lib/ads/ads-mode';
import { loadGoogleMobileAds } from '@/lib/ads/native-ads';

/** Anchored adaptive banner for the world list. Renders nothing until consent and the SDK are ready. */
export function MenuBanner() {
  const { ready } = useAds();
  const [failed, setFailed] = useState(false);
  if (!ready || failed) return null;

  const ads = loadGoogleMobileAds();
  const unitId = getUnitId('menu_banner', {
    testMode: isTestAdsMode(),
    testIds: { menu_banner: ads.TestIds.ADAPTIVE_BANNER },
  });
  if (!unitId) return null;
  const { BannerAd, BannerAdSize } = ads;

  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={(error) => {
          logAdDecision('banner failed', { error: String(error) });
          setFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 8 },
});
