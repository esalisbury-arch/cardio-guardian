// The "Time" in FAST (Face, Arm, Speech, Time) — unlike the other three,
// Time isn't a sensor signal, it's a call to action: note exactly when
// symptoms started, because stroke treatment options (e.g. tPA) are
// genuinely time-windowed, and EMS/hospital staff will ask. This module
// just remembers a single onset timestamp locally; elapsed time is derived
// live from it (see StrokeScreeningScreen) rather than storing a running
// counter, so it can't drift even if the app is backgrounded for hours.
//
// Same thin-wrapper-over-AsyncStorage pattern as skinToneBaseline.ts /
// language.ts. Local-only, never transmitted — same as everything else this
// app stores.

import { STORAGE_KEYS } from '../config/constants';
import { getJson, setJson } from './storage';

export async function getSymptomOnset(): Promise<number | null> {
  return getJson<number | null>(STORAGE_KEYS.symptomOnset, null);
}

export async function setSymptomOnsetNow(): Promise<number> {
  const now = Date.now();
  await setJson<number | null>(STORAGE_KEYS.symptomOnset, now);
  return now;
}

export async function clearSymptomOnset(): Promise<void> {
  await setJson<number | null>(STORAGE_KEYS.symptomOnset, null);
}
