// Local emergency dispatch numbers vary by country — hard-coding "911"
// would make the app actively wrong (and useless) outside the US/Canada.
// This is a best-effort default lookup; users can and should override it in
// Settings, especially when traveling.

const EMERGENCY_NUMBER_BY_REGION: Record<string, string> = {
  US: '911',
  CA: '911',
  MX: '911',
  GB: '999',
  IE: '112',
  AU: '000',
  NZ: '111',
  IN: '112',
  JP: '119', // ambulance/fire; 110 is police
  CN: '120', // ambulance; 110 is police
  BR: '192', // ambulance (SAMU); 193 fire
  ZA: '112',
};

// 112 works across the EU and is increasingly recognized by carriers
// worldwide as a GSM standard fallback even outside Europe.
export const DEFAULT_FALLBACK_EMERGENCY_NUMBER = '112';

export function emergencyNumberForRegion(regionCode: string | undefined | null): string {
  if (!regionCode) return DEFAULT_FALLBACK_EMERGENCY_NUMBER;
  return EMERGENCY_NUMBER_BY_REGION[regionCode.toUpperCase()] ?? DEFAULT_FALLBACK_EMERGENCY_NUMBER;
}
