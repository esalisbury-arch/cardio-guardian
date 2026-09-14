import { PpgSignalProcessor, detectPeaks, bandpassFilter } from '../src/signal/ppgProcessor';
import { TimedSample } from '../src/types';

function synthesizePpg(bpm: number, durationMs: number, sampleRateHz = 30, noise = 0.3): TimedSample[] {
  const freqHz = bpm / 60;
  const samples: TimedSample[] = [];
  const dtMs = 1000 / sampleRateHz;
  for (let t = 0; t < durationMs; t += dtMs) {
    const baseline = 128 + 3 * Math.sin((2 * Math.PI * t) / 4000); // slow lighting drift
    const pulse = 6 * Math.sin(2 * Math.PI * freqHz * (t / 1000));
    const jitter = (Math.random() - 0.5) * noise;
    samples.push({ t, v: baseline + pulse + jitter });
  }
  return samples;
}

describe('bandpassFilter + detectPeaks', () => {
  it('recovers approximately correct beat count from a synthetic 72bpm signal', () => {
    const durationMs = 10000;
    const samples = synthesizePpg(72, durationMs);
    const filtered = bandpassFilter(samples);
    const peaks = detectPeaks(filtered);

    const expectedBeats = (72 / 60) * (durationMs / 1000);
    expect(peaks.length).toBeGreaterThan(expectedBeats - 3);
    expect(peaks.length).toBeLessThan(expectedBeats + 3);
  });
});

describe('PpgSignalProcessor', () => {
  it('reports no-signal before enough samples are buffered', () => {
    const proc = new PpgSignalProcessor();
    proc.addSample(0, 128);
    proc.addSample(33, 129);
    const reading = proc.getReading();
    expect(reading.quality).toBe('no-signal');
    expect(reading.bpm).toBeNull();
  });

  it('estimates BPM within a reasonable tolerance for a clean synthetic signal', () => {
    const proc = new PpgSignalProcessor();
    const samples = synthesizePpg(80, 12000, 30, 0.1);
    for (const s of samples) proc.addSample(s.t, s.v);

    const reading = proc.getReading();
    expect(reading.bpm).not.toBeNull();
    expect(reading.bpm as number).toBeGreaterThanOrEqual(70);
    expect(reading.bpm as number).toBeLessThanOrEqual(90);
    expect(['fair', 'good']).toContain(reading.quality);
  });

  it('reports no-signal for flat (no finger present) input', () => {
    const proc = new PpgSignalProcessor();
    for (let t = 0; t < 5000; t += 33) proc.addSample(t, 200 + (Math.random() - 0.5) * 0.05);
    const reading = proc.getReading();
    expect(reading.quality).toBe('no-signal');
  });
});
