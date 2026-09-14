// Photoplethysmography (PPG) signal processing.
//
// Input is a stream of mean red-channel intensity samples taken from camera
// frames while the user's fingertip covers the lens with the torch on. Each
// heartbeat changes blood volume under the skin, which shows up as a small
// periodic dip/rise in red-channel intensity. This module turns that raw
// stream into beat-to-beat intervals and a BPM estimate.
//
// This is a *screening* signal, not a clinical PPG/ECG. It has no FDA
// clearance and should never be presented to the user as a diagnosis.

import { PulseReading, SignalQuality, TimedSample } from '../types';

const MIN_IBI_MS = 300; // 200 bpm cap, rejects double-detections
const MAX_IBI_MS = 2000; // 30 bpm floor, beyond this we call it signal loss
const SLOW_WINDOW_MS = 1000; // baseline wander window (removes DC/lighting drift)
const FAST_WINDOW_MS = 120; // smoothing window (removes camera/sensor noise)
const BUFFER_MS = 12000; // how much history we keep

function movingAverage(samples: TimedSample[], atIndex: number, windowMs: number): number {
  const centerT = samples[atIndex].t;
  let sum = 0;
  let count = 0;
  for (let i = atIndex; i >= 0; i--) {
    if (centerT - samples[i].t > windowMs / 2) break;
    sum += samples[i].v;
    count++;
  }
  for (let i = atIndex + 1; i < samples.length; i++) {
    if (samples[i].t - centerT > windowMs / 2) break;
    sum += samples[i].v;
    count++;
  }
  return count > 0 ? sum / count : samples[atIndex].v;
}

/** Bandpass = fast (smoothed) signal minus slow (baseline) signal. */
export function bandpassFilter(samples: TimedSample[]): TimedSample[] {
  return samples.map((s, i) => ({
    t: s.t,
    v: movingAverage(samples, i, FAST_WINDOW_MS) - movingAverage(samples, i, SLOW_WINDOW_MS),
  }));
}

function std(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Adaptive-threshold peak detection with a refractory period.
 * Returns timestamps (ms) of detected pulse peaks.
 */
export function detectPeaks(filtered: TimedSample[]): number[] {
  if (filtered.length < 5) return [];

  const amplitude = std(filtered.map((s) => s.v));
  if (amplitude === 0) return [];
  const threshold = amplitude * 0.4; // require a meaningful excursion, tolerant of weak perfusion

  const peaks: number[] = [];
  let lastPeakT = -Infinity;

  for (let i = 1; i < filtered.length - 1; i++) {
    const { t, v } = filtered[i];
    const isLocalMax = v > filtered[i - 1].v && v >= filtered[i + 1].v;
    if (isLocalMax && v > threshold && t - lastPeakT >= MIN_IBI_MS) {
      peaks.push(t);
      lastPeakT = t;
    }
  }
  return peaks;
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function ibisFromPeaks(peaks: number[]): number[] {
  const ibis: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const gap = peaks[i] - peaks[i - 1];
    if (gap >= MIN_IBI_MS && gap <= MAX_IBI_MS) ibis.push(gap);
  }
  return ibis;
}

function classifyQuality(ibis: number[], amplitude: number): { quality: SignalQuality; confidence: number } {
  if (ibis.length < 3 || amplitude < 0.5) return { quality: 'no-signal', confidence: 0 };

  const meanIbi = ibis.reduce((a, b) => a + b, 0) / ibis.length;
  const cv = std(ibis) / meanIbi; // coefficient of variation of beat spacing

  // A very jittery beat-to-beat spacing usually means the detector is
  // tracking motion artifact / poor contact rather than a real pulse.
  if (cv > 0.35) return { quality: 'poor', confidence: 0.2 };
  if (cv > 0.15) return { quality: 'fair', confidence: 0.55 };
  return { quality: 'good', confidence: 0.9 };
}

export class PpgSignalProcessor {
  private buffer: TimedSample[] = [];

  /** Push one camera-frame sample: mean red-channel intensity 0-255 at time t (ms). */
  addSample(t: number, redChannelMean: number): void {
    this.buffer.push({ t, v: redChannelMean });
    const cutoff = t - BUFFER_MS;
    while (this.buffer.length > 0 && this.buffer[0].t < cutoff) this.buffer.shift();
  }

  reset(): void {
    this.buffer = [];
  }

  get sampleCount(): number {
    return this.buffer.length;
  }

  /** Compute the current pulse reading from buffered samples. */
  getReading(): PulseReading {
    if (this.buffer.length < 30) {
      return { bpm: null, ibiMs: [], quality: 'no-signal', confidence: 0 };
    }

    const filtered = bandpassFilter(this.buffer);
    const amplitude = std(filtered.map((s) => s.v));
    const peaks = detectPeaks(filtered);
    const ibis = ibisFromPeaks(peaks);
    const { quality, confidence } = classifyQuality(ibis, amplitude);

    if (quality === 'no-signal' || ibis.length < 3) {
      return { bpm: null, ibiMs: ibis, quality, confidence };
    }

    const bpm = Math.round(60000 / median(ibis));
    return { bpm, ibiMs: ibis, quality, confidence };
  }
}
