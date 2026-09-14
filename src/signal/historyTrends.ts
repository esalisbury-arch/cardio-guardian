// Pure trend math over check history. No RN imports on purpose — same
// rationale as the rest of src/signal/*: synchronous plain TypeScript that's
// easy to unit test and audit, kept separate from src/services/history.ts
// (which owns the actual AsyncStorage persistence).

export interface TrendPoint {
  t: number;
  value: number;
}

export interface TrendSummary {
  count: number;
  latest: number | null;
  previous: number | null;
  min: number;
  max: number;
  avg: number;
  /** latest vs previous, using a small relative threshold to call it "flat" rather than noise */
  direction: 'up' | 'down' | 'flat' | 'unknown';
}

const EMPTY_SUMMARY: TrendSummary = {
  count: 0,
  latest: null,
  previous: null,
  min: 0,
  max: 0,
  avg: 0,
  direction: 'unknown',
};

/**
 * Summarizes a series of (timestamp, value) points — order doesn't matter,
 * this sorts by t ascending internally. `latest`/`previous` are the two
 * most recent points by time, which is what a history list cares about
 * ("did the last reading move from the one before it").
 */
export function summarizeTrend(points: TrendPoint[]): TrendSummary {
  if (points.length === 0) return EMPTY_SUMMARY;

  const sorted = [...points].sort((a, b) => a.t - b.t);
  const values = sorted.map((p) => p.value);
  const latest = values[values.length - 1];
  const previous = values.length >= 2 ? values[values.length - 2] : null;

  let direction: TrendSummary['direction'] = 'unknown';
  if (previous !== null) {
    // Relative threshold so tiny float noise (e.g. 71.9 vs 72.0 bpm) isn't
    // reported as a change; a flat reference of 1 avoids dividing by zero
    // when previous is 0.
    const relativeChange = Math.abs(latest - previous) / Math.max(Math.abs(previous), 1);
    if (relativeChange < 0.02) direction = 'flat';
    else direction = latest > previous ? 'up' : 'down';
  }

  return {
    count: values.length,
    latest,
    previous,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((sum, v) => sum + v, 0) / values.length,
    direction,
  };
}
