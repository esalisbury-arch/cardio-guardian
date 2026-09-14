// Beat-to-beat irregularity screening.
//
// IMPORTANT LIMITATION: these intervals come from a camera PPG signal, not
// an ECG. PPG pulse-transit timing correlates with but is not identical to
// true cardiac RR intervals, and motion/lighting artifact can masquerade as
// irregularity. Treat this purely as a "flag for follow-up", never as an
// arrhythmia diagnosis (that requires ECG-grade signal + clinical review).

import { IrregularityResult } from '../types';

const MIN_BEATS_FOR_RELIABLE_SCORE = 12;

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sdnn(ibiMs: number[]): number {
  if (ibiMs.length < 2) return 0;
  const m = mean(ibiMs);
  const variance = ibiMs.reduce((a, b) => a + (b - m) ** 2, 0) / (ibiMs.length - 1);
  return Math.sqrt(variance);
}

function rmssd(ibiMs: number[]): number {
  if (ibiMs.length < 2) return 0;
  let sumSq = 0;
  for (let i = 1; i < ibiMs.length; i++) {
    sumSq += (ibiMs[i] - ibiMs[i - 1]) ** 2;
  }
  return Math.sqrt(sumSq / (ibiMs.length - 1));
}

/**
 * Maps RMSSD-based variability into a 0..1 "irregularity" score.
 * Calibrated loosely: a healthy resting RMSSD is commonly ~15-60ms and
 * fairly smooth; disorganized rhythms (e.g. AFib-like patterns) tend to
 * push both SDNN and RMSSD much higher *and* unpredictable relative to the
 * mean interval. This is a heuristic screening threshold, not a validated
 * clinical cutoff.
 */
export function analyzeIrregularity(ibiMs: number[]): IrregularityResult {
  if (ibiMs.length < 3) {
    return { score: 0, sdnnMs: 0, rmssdMs: 0, sampleCount: ibiMs.length, reliable: false };
  }

  const meanIbi = mean(ibiMs);
  const sdnnMs = sdnn(ibiMs);
  const rmssdMs = rmssd(ibiMs);

  // Normalize RMSSD by the mean beat interval so the score is heart-rate
  // independent (a fast HR naturally has smaller absolute ms variability).
  const relativeVariability = rmssdMs / meanIbi;
  const score = Math.max(0, Math.min(1, relativeVariability / 0.25));

  return {
    score,
    sdnnMs,
    rmssdMs,
    sampleCount: ibiMs.length,
    reliable: ibiMs.length >= MIN_BEATS_FOR_RELIABLE_SCORE,
  };
}
