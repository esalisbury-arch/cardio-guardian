import { analyzeIrregularity } from '../src/signal/hrvAnalysis';

describe('analyzeIrregularity', () => {
  it('scores a perfectly regular rhythm near zero', () => {
    const ibis = Array(20).fill(800); // 75bpm, no variability
    const result = analyzeIrregularity(ibis);
    expect(result.score).toBeLessThan(0.05);
    expect(result.reliable).toBe(true);
  });

  it('scores a chaotic rhythm highly', () => {
    const base = [700, 1100, 650, 1200, 600, 1300, 680, 1150, 720, 1250, 640, 1180, 710, 1050];
    const result = analyzeIrregularity(base);
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('marks short samples as unreliable regardless of score', () => {
    const result = analyzeIrregularity([800, 810, 790]);
    expect(result.reliable).toBe(false);
  });

  it('returns a zero score for too few intervals', () => {
    const result = analyzeIrregularity([800]);
    expect(result.score).toBe(0);
    expect(result.sampleCount).toBe(1);
  });
});
