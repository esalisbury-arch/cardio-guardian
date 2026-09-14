// Finger tapping test — a simple motor-screening proxy modeled on the
// tapping tasks neurologists use to assess motor speed/coordination
// (classically for Parkinsonian bradykinesia, but the same left-vs-right
// asymmetry principle applies to stroke: sudden one-sided weakness is a
// hallmark FAST sign — Face drooping, Arm weakness, Speech difficulty,
// Time to call emergency services).
//
// IMPORTANT LIMITATION: tapping on a phone screen is a coarse, single-modality
// proxy. It cannot see facial drooping or hear slurred speech — the other two
// FAST signs — and normal side-to-side differences (handedness, fatigue,
// prior injury) can also produce asymmetry. This module only ever produces a
// "flag for follow-up" signal, never a diagnosis, and never auto-triggers the
// emergency alert flow the way the cardiac arrest signature does (see
// src/signal/triageEngine.ts) — a single ambiguous motor-asymmetry reading is
// not specific enough to justify that on its own.

import { FingerTapResult, Hand, StrokeScreeningResult } from '../types';

const MIN_TAPS_FOR_RELIABLE_RESULT = 6;
// Relative difference in tap rate between hands beyond which we flag for
// follow-up. Loosely modeled on thresholds used in motor-asymmetry research
// tools; not a clinically validated cutoff.
const RATE_ASYMMETRY_FLAG_THRESHOLD = 0.25;
const RHYTHM_ASYMMETRY_WEIGHT = 0.3;
const RATE_ASYMMETRY_WEIGHT = 0.7;

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length);
}

/**
 * @param tapTimestampsMs timestamps (ms) of each tap during the test window, in order
 * @param durationMs length of the test window
 */
export function analyzeFingerTaps(hand: Hand, tapTimestampsMs: number[], durationMs: number): FingerTapResult {
  const tapCount = tapTimestampsMs.length;
  const rateHz = durationMs > 0 ? tapCount / (durationMs / 1000) : 0;

  if (tapCount < MIN_TAPS_FOR_RELIABLE_RESULT) {
    return { hand, tapCount, durationMs, rateHz, meanIntervalMs: 0, rhythmCv: 0, reliable: false };
  }

  const intervals: number[] = [];
  for (let i = 1; i < tapTimestampsMs.length; i++) {
    intervals.push(tapTimestampsMs[i] - tapTimestampsMs[i - 1]);
  }
  const meanIntervalMs = mean(intervals);
  const rhythmCv = meanIntervalMs > 0 ? std(intervals) / meanIntervalMs : 0;

  return { hand, tapCount, durationMs, rateHz, meanIntervalMs, rhythmCv, reliable: true };
}

export function compareHands(left: FingerTapResult, right: FingerTapResult): StrokeScreeningResult {
  if (!left.reliable || !right.reliable) {
    return {
      level: 'NORMAL',
      reasons: ['Not enough taps on one or both hands to assess asymmetry — try the test again'],
      left,
      right,
      asymmetryScore: 0,
    };
  }

  const maxRate = Math.max(left.rateHz, right.rateHz);
  const rateAsymmetry = maxRate > 0 ? Math.abs(left.rateHz - right.rateHz) / maxRate : 0;
  const rhythmAsymmetry = Math.min(1, Math.abs(left.rhythmCv - right.rhythmCv) / 0.5);

  const asymmetryScore = Math.max(
    0,
    Math.min(1, RATE_ASYMMETRY_WEIGHT * rateAsymmetry + RHYTHM_ASYMMETRY_WEIGHT * rhythmAsymmetry)
  );

  if (rateAsymmetry >= RATE_ASYMMETRY_FLAG_THRESHOLD) {
    const slowerHand = left.rateHz < right.rateHz ? 'left' : 'right';
    return {
      level: 'LOW',
      reasons: [
        `Tap rate differs notably between hands (${slowerHand} slower) — ` +
          `if this comes with face drooping or slurred speech, treat as a possible stroke and call emergency services now`,
      ],
      left,
      right,
      asymmetryScore,
    };
  }

  return {
    level: 'NORMAL',
    reasons: ['Tap rate and rhythm are roughly symmetric between hands'],
    left,
    right,
    asymmetryScore,
  };
}
