// Storage for the user's saved "normal" skin color (see
// src/signal/facialPallorAnalysis.ts for why this is baseline-relative
// rather than an absolute "pale" threshold). Same thin-wrapper pattern as
// emergencyContacts.ts and history.ts.

import { STORAGE_KEYS } from '../config/constants';
import { PallorBaseline } from '../types';
import { getJson, setJson } from './storage';

export async function getSkinToneBaseline(): Promise<PallorBaseline | null> {
  return getJson<PallorBaseline | null>(STORAGE_KEYS.skinToneBaseline, null);
}

export async function saveSkinToneBaseline(baseline: PallorBaseline): Promise<void> {
  await setJson(STORAGE_KEYS.skinToneBaseline, baseline);
}

/** Lets a user re-capture from scratch (lighting setup changed, tan, makeup, etc.) rather than being stuck with a stale baseline. */
export async function clearSkinToneBaseline(): Promise<void> {
  await setJson<PallorBaseline | null>(STORAGE_KEYS.skinToneBaseline, null);
}
