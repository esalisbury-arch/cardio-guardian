import { analyzeFingerTaps, compareHands } from '../src/signal/fingerTapAnalysis';

function evenTaps(count: number, intervalMs: number): number[] {
  return Array.from({ length: count }, (_, i) => i * intervalMs);
}

describe('analyzeFingerTaps', () => {
  it('marks a sparse tap set as unreliable', () => {
    const result = analyzeFingerTaps('left', [0, 500, 1000], 10000);
    expect(result.reliable).toBe(false);
    expect(result.tapCount).toBe(3);
  });

  it('computes rate and near-zero rhythm CV for a perfectly even tapper', () => {
    const taps = evenTaps(20, 200); // 5 taps/sec
    const result = analyzeFingerTaps('right', taps, 10000);
    expect(result.reliable).toBe(true);
    expect(result.rateHz).toBeCloseTo(2, 0); // 20 taps over 10s
    expect(result.rhythmCv).toBeLessThan(0.01);
  });

  it('reports a higher rhythm CV for an uneven tapper', () => {
    const taps = [0, 150, 500, 620, 1300, 1340, 2100, 2150, 3400, 3420];
    const result = analyzeFingerTaps('left', taps, 4000);
    expect(result.reliable).toBe(true);
    expect(result.rhythmCv).toBeGreaterThan(0.3);
  });
});

describe('compareHands', () => {
  it('is NORMAL when both hands tap at similar rates', () => {
    const left = analyzeFingerTaps('left', evenTaps(20, 200), 10000);
    const right = analyzeFingerTaps('right', evenTaps(21, 195), 10000);
    const result = compareHands(left, right);
    expect(result.level).toBe('NORMAL');
    expect(result.asymmetryScore).toBeLessThan(0.25);
  });

  it('flags LOW when one hand taps much slower than the other', () => {
    const left = analyzeFingerTaps('left', evenTaps(20, 200), 10000); // 2 Hz
    const right = analyzeFingerTaps('right', evenTaps(8, 700), 10000); // ~0.8 Hz
    const result = compareHands(left, right);
    expect(result.level).toBe('LOW');
    expect(result.reasons[0]).toContain('right slower');
  });

  it('does not flag when data is unreliable, regardless of raw difference', () => {
    const left = analyzeFingerTaps('left', [0, 400], 10000);
    const right = analyzeFingerTaps('right', evenTaps(20, 200), 10000);
    const result = compareHands(left, right);
    expect(result.level).toBe('NORMAL');
    expect(result.asymmetryScore).toBe(0);
  });
});
