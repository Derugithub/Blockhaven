import type { ReactNode } from 'react';

import { AdsContext, idleAdsContext } from '@/lib/ads/ads-context';

/** Web has no ad SDK. Screens keep rendering; every ad call is a no-op. */
export function AdsProvider({ children }: { children: ReactNode }) {
  return <AdsContext.Provider value={idleAdsContext}>{children}</AdsContext.Provider>;
}
