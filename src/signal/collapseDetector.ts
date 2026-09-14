// Collapse (sudden fall/loss-of-posture) detection from accelerometer data.
//
// Heuristic model: a real collapse tends to look like (1) a short, sharp
// deviation from resting gravity (the fall/impact), immediately followed by
// (2) a sustained period of near-zero motion (the person is down and not
// moving the phone). Neither signal alone is specific enough — a dropped
// phone alone, or someone sitting down quickly alone, will each trigger only
// one half of the pattern.
//
// Units: samples are expected in g (1g = resting gravity when still).
// src/sensors/motion.ts is responsible for converting raw accelerometer
// output (commonly m/s^2) into g before calling this module.

import { AccelSample, CollapseEvent } from '../types';

const GRAVITY_G = 1.0;
const IMPACT_DELTA_G = 1.8; // |magnitude - 1g| at/above this = candidate impact
const STILLNESS_WINDOW_MS = 8000; // sustained non-movement required to confirm collapse
const STILLNESS_STD_G = 0.08; // magnitude std dev below this counts as "still"
const BUFFER_MS = 20000;

function magnitude(s: AccelSample): number {
  return Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length);
}

export function findImpactIndex(samples: AccelSample[]): number | null {
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(magnitude(samples[i]) - GRAVITY_G) >= IMPACT_DELTA_G) return i;
  }
  return null;
}

function confidenceFor(impactMag: number, stillnessStd: number): number {
  const impactSeverity = Math.max(0, Math.min(1, (Math.abs(impactMag - GRAVITY_G) - IMPACT_DELTA_G) / IMPACT_DELTA_G));
  const stillnessQuality = Math.max(0, Math.min(1, 1 - stillnessStd / STILLNESS_STD_G));
  return Math.max(0, Math.min(1, 0.4 + 0.3 * impactSeverity + 0.3 * stillnessQuality));
}

/**
 * Pure evaluation over a buffered window of accelerometer samples.
 * Returns a CollapseEvent once an impact is followed by
 * STILLNESS_WINDOW_MS of near-zero motion, otherwise null.
 */
export function evaluateCollapse(samples: AccelSample[], nowT: number): CollapseEvent | null {
  if (samples.length < 10) return null;

  const impactIdx = findImpactIndex(samples);
  if (impactIdx === null) return null;

  const impactSample = samples[impactIdx];
  const impactMag = magnitude(impactSample);
  const after = samples.filter((s) => s.t > impactSample.t);
  if (after.length < 5) return null;

  const mags = after.map(magnitude);
  const stillnessStd = std(mags);
  const elapsedSinceImpact = after[after.length - 1].t - impactSample.t;
  const isStill = stillnessStd < STILLNESS_STD_G;

  if (isStill && elapsedSinceImpact >= STILLNESS_WINDOW_MS) {
    return {
      detectedAt: nowT,
      impactMagnitudeG: impactMag,
      stillnessMs: elapsedSinceImpact,
      confidence: confidenceFor(impactMag, stillnessStd),
    };
  }
  return null;
}

export class CollapseDetector {
  private buffer: AccelSample[] = [];
  private latchedEvent: CollapseEvent | null = null;

  addSample(sample: AccelSample): void {
    this.buffer.push(sample);
    const cutoff = sample.t - BUFFER_MS;
    while (this.buffer.length > 0 && this.buffer[0].t < cutoff) this.buffer.shift();
  }

  /** Evaluate current buffer. Fires an event at most once per collapse until reset(). */
  evaluate(nowT: number): CollapseEvent | null {
    if (this.latchedEvent) return this.latchedEvent;
    const event = evaluateCollapse(this.buffer, nowT);
    if (event) this.latchedEvent = event;
    return event;
  }

  /** Call after the user cancels/resolves an alert to resume watching for new events. */
  reset(): void {
    this.buffer = [];
    this.latchedEvent = null;
  }
}
