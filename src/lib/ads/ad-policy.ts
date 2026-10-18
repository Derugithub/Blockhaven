/**
 * Pure rules for when ads may show. Gameplay never waits on an ad: every rule only says
 * whether an ad is allowed, and callers continue either way.
 */

/** Minimum gap between two interstitials. */
export const INTERSTITIAL_MIN_GAP_MS = 4 * 60 * 1000;
/** No interstitial in the first minutes after launch. */
export const INTERSTITIAL_SESSION_GRACE_MS = 3 * 60 * 1000;
/** The player must have played this long in the world they are leaving. */
export const INTERSTITIAL_MIN_PLAY_MS = 2 * 60 * 1000;
/** At most this many interstitials per app session. */
export const INTERSTITIAL_SESSION_CAP = 4;

/** The rewarded bonus bundle can be claimed once per this period. */
export const BONUS_COOLDOWN_MS = 10 * 60 * 1000;

export type InterstitialInput = {
  now: number;
  sessionStartedAt: number;
  lastShownAt: number | null;
  shownThisSession: number;
  playedMs: number;
  loaded: boolean;
};

export function canShowInterstitial(input: InterstitialInput): boolean {
  if (!input.loaded) return false;
  if (input.shownThisSession >= INTERSTITIAL_SESSION_CAP) return false;
  if (input.now - input.sessionStartedAt < INTERSTITIAL_SESSION_GRACE_MS) return false;
  if (input.playedMs < INTERSTITIAL_MIN_PLAY_MS) return false;
  if (input.lastShownAt != null && input.now - input.lastShownAt < INTERSTITIAL_MIN_GAP_MS) return false;
  return true;
}

export function bonusReadyIn(lastClaimedAt: number | null, now: number): number {
  if (lastClaimedAt == null) return 0;
  return Math.max(0, lastClaimedAt + BONUS_COOLDOWN_MS - now);
}
