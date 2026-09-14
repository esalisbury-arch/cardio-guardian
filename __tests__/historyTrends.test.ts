import { summarizeTrend } from '../src/signal/historyTrends';

describe('summarizeTrend', () => {
  it('returns an empty/unknown summary for no points', () => {
    const result = summarizeTrend([]);
    expect(result.count).toBe(0);
    expect(result.latest).toBeNull();
    expect(result.previous).toBeNull();
    expect(result.direction).toBe('unknown');
  });

  it('has no previous/direction with a single point', () => {
    const result = summarizeTrend([{ t: 1, value: 72 }]);
    expect(result.count).toBe(1);
    expect(result.latest).toBe(72);
    expect(result.previous).toBeNull();
    expect(result.direction).toBe('unknown');
  });

  it('orders by timestamp, not input order', () => {
    const result = summarizeTrend([
      { t: 300, value: 90 },
      { t: 100, value: 70 },
      { t: 200, value: 80 },
    ]);
    expect(result.latest).toBe(90);
    expect(result.previous).toBe(80);
    expect(result.min).toBe(70);
    expect(result.max).toBe(90);
    expect(result.avg).toBeCloseTo(80);
  });

  it('flags a clear rise as "up"', () => {
    const result = summarizeTrend([
      { t: 1, value: 70 },
      { t: 2, value: 90 },
    ]);
    expect(result.direction).toBe('up');
  });

  it('flags a clear drop as "down"', () => {
    const result = summarizeTrend([
      { t: 1, value: 90 },
      { t: 2, value: 70 },
    ]);
    expect(result.direction).toBe('down');
  });

  it('treats a tiny change as "flat" rather than noise', () => {
    const result = summarizeTrend([
      { t: 1, value: 72 },
      { t: 2, value: 72.1 },
    ]);
    expect(result.direction).toBe('flat');
  });

  it('handles a zero previous value without dividing by zero', () => {
    const result = summarizeTrend([
      { t: 1, value: 0 },
      { t: 2, value: 0.005 },
    ]);
    expect(result.direction).toBe('flat');
    expect(Number.isFinite(result.avg)).toBe(true);
  });
});
