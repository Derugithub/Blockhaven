type ConsentInfo = { canRequestAds: false; privacyOptionsRequirementStatus: 'NOT_REQUIRED' };

const idle: ConsentInfo = { canRequestAds: false, privacyOptionsRequirementStatus: 'NOT_REQUIRED' };

export async function gatherConsent(): Promise<ConsentInfo> {
  return idle;
}

export function privacyOptionsRequired(): boolean {
  return false;
}

export async function showPrivacyOptions(): Promise<ConsentInfo> {
  return idle;
}
