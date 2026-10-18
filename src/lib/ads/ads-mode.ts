import Constants from 'expo-constants';

type AdsExtra = { adsMode?: string };

/**
 * EAS bakes `extra.adsMode` from `ADS_MODE` at build time.
 * Release builds sometimes leave `expoConfig` null and keep the config on the
 * embedded manifest, so check each place Expo documents.
 */
function readAdsExtra(): AdsExtra | undefined {
  const constants = Constants as typeof Constants & {
    manifest?: { extra?: AdsExtra } | null;
    manifest2?: { extra?: { expoClient?: { extra?: AdsExtra } } } | null;
  };
  return (
    constants.expoConfig?.extra ??
    constants.manifest2?.extra?.expoClient?.extra ??
    constants.manifest?.extra ??
    undefined
  );
}

/**
 * Test ads are used in dev and in any build whose EAS profile is not live.
 * A missing mode stays on test IDs; only an explicit `live` may use production units.
 */
export function isTestAdsMode(): boolean {
  if (__DEV__) return true;
  return readAdsExtra()?.adsMode !== 'live';
}

/** Lifecycle logs for dev and preview. Production live builds stay quiet. */
export function logAdDecision(message: string, detail?: Record<string, unknown>): void {
  if (!isTestAdsMode()) return;
  if (detail) console.log(`[Blockhaven ads] ${message}`, detail);
  else console.log(`[Blockhaven ads] ${message}`);
}
