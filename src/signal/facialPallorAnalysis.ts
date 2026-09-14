// Facial pallor screening — sudden pale/ashen skin color, one of several
// possible external signs of reduced blood perfusion that can accompany a
// heart attack (alongside cold sweat, clammy skin, and — far more
// importantly — chest pain/pressure, shortness of breath, and pain
// radiating to the arm or jaw). This is the WEAKEST and most confounded
// camera-based signal in this app, even more so than Speech Check — see
// "IMPORTANT LIMITATIONS" below — so like every other screening check here,
// it only ever produces a "flag for follow-up" result and never
// auto-triggers the emergency alert flow (see src/signal/triageEngine.ts
// for the one signature that does, and why).
//
// Approach: skin tone varies enormously across people — an ABSOLUTE "pale"
// threshold would be both useless and biased. Instead this compares a short
// front-camera burst against a BASELINE this same person captured earlier
// in normal conditions (src/services/skinToneBaseline.ts) — screening for a
// CHANGE from their own normal color, not against some universal "normal"
// skin tone. Color is reduced to normalized redness, r / (r+g+b), which is
// less sensitive to overall brightness than raw RGB (though not immune to a
// change in light color between the baseline and the check — see below).
//
// IMPORTANT LIMITATIONS: a phone camera's automatic white balance and
// exposure actively work AGAINST this kind of measurement — they're
// designed to compensate for color casts and lighting changes, not
// preserve them for comparison. Makeup, sun exposure/tanning, room
// lighting color temperature, and camera angle can all shift the reading
// as much as or more than real pallor would. This is a supplementary
// signal only. It does not replace the actual heart attack warning signs
// (chest pain/pressure, shortness of breath, pain radiating to arm/jaw/back,
// cold sweat, nausea) — call emergency services for those regardless of
// what this check shows.

import { PallorBaseline, PallorResult, SkinColorSample } from '../types';

const MIN_VALID_FRAMES = 10;
// Normalized-redness (r/(r+g+b)) drop from baseline that counts as a flag.
// A starting heuristic, not a clinically validated cutoff — see the
// module note above and the README's medical disclaimer.
const REDNESS_DROP_FLAG_THRESHOLD = 0.02;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** r / (r+g+b), 0..1. 0 for a fully black sample (no light at all) rather than dividing by zero. */
export function normalizedRedness(color: { r: number; g: number; b: number }): number {
  const total = color.r + color.g + color.b;
  return total === 0 ? 0 : color.r / total;
}

/** Median color across a burst's valid (plausibly-a-face) frames — robust against a handful of noisy frames. */
export function aggregateSkinColor(samples: SkinColorSample[]): { r: number; g: number; b: number; sampleCount: number } {
  const valid = samples.filter((s) => s.faceDetected);
  return {
    r: median(valid.map((s) => s.r)),
    g: median(valid.map((s) => s.g)),
    b: median(valid.map((s) => s.b)),
    sampleCount: valid.length,
  };
}

/**
 * Compares a burst of camera color samples against a stored baseline. If no
 * baseline exists yet, this doesn't score anything — it reports that the
 * caller should save this burst's aggregate color as the new baseline (see
 * PallorCheckScreen), so a first-ever run establishes the reference point
 * instead of comparing against nothing.
 */
export function comparePallor(baseline: PallorBaseline | null, samples: SkinColorSample[]): PallorResult {
  const aggregate = aggregateSkinColor(samples);

  if (aggregate.sampleCount < MIN_VALID_FRAMES) {
    return {
      level: 'NORMAL',
      reasons: ['Not enough clear frames of your face to assess skin color — try again with better, even lighting'],
      rednessDrop: 0,
      normalizedRedness: 0,
      sampleCount: aggregate.sampleCount,
      reliable: false,
      savedAsBaseline: false,
    };
  }

  const currentRedness = normalizedRedness(aggregate);

  if (!baseline) {
    return {
      level: 'NORMAL',
      reasons: ['No baseline yet — this capture has been saved as your normal skin color for future comparisons'],
      rednessDrop: 0,
      normalizedRedness: currentRedness,
      sampleCount: aggregate.sampleCount,
      reliable: true,
      savedAsBaseline: true,
    };
  }

  const baselineRedness = normalizedRedness(baseline);
  const rednessDrop = baselineRedness - currentRedness;

  if (rednessDrop >= REDNESS_DROP_FLAG_THRESHOLD) {
    return {
      level: 'LOW',
      reasons: [
        'Your skin tone looks noticeably paler than your saved baseline. If this comes with chest pain, ' +
          'shortness of breath, cold sweat, or pain in your arm or jaw, treat it as a possible heart ' +
          'attack and call emergency services now.',
      ],
      rednessDrop,
      normalizedRedness: currentRedness,
      sampleCount: aggregate.sampleCount,
      reliable: true,
      savedAsBaseline: false,
    };
  }

  return {
    level: 'NORMAL',
    reasons: ['Skin tone looks consistent with your saved baseline'],
    rednessDrop,
    normalizedRedness: currentRedness,
    sampleCount: aggregate.sampleCount,
    reliable: true,
    savedAsBaseline: false,
  };
}
