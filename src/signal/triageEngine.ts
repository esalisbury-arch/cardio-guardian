// Pulse-irregularity triage.
//
// Scope (deliberately narrow): flags a reliably irregular pulse rhythm from
// Active Check for follow-up. This used to also fuse in passive collapse
// detection (accelerometer impact + stillness) and an on-screen "are you
// OK?" check-in prompt to reach a CRITICAL level that auto-triggered the
// emergency alert flow — that whole path was removed along with passive
// collapse monitoring (see git history / README if you need the old
// version), since irregularity alone was never enough to justify an
// automatic alert on its own. This is a screening aid, not a diagnostic or
// FDA-cleared medical device; it can miss real emergencies and can
// false-positive. It does not replace calling emergency services yourself
// when in doubt.

import { RiskLevel, TriageInput, TriageResult } from '../types';

// Exported so other pure-logic and UI code (e.g. history trend flags) uses
// the exact same cutoff instead of a second hardcoded copy of "0.6".
export const IRREGULARITY_WARNING_THRESHOLD = 0.6;

export function computeTriage(input: TriageInput): TriageResult {
  const { irregularity } = input;
  const reasons: string[] = [];

  if (irregularity && irregularity.reliable && irregularity.score >= IRREGULARITY_WARNING_THRESHOLD) {
    reasons.push(`Irregular pulse rhythm flagged (score ${irregularity.score.toFixed(2)}) — consider medical evaluation`);
    return { level: 'LOW', reasons };
  }

  reasons.push('No irregularity detected');
  return { level: 'NORMAL', reasons };
}

export function levelSeverityRank(level: RiskLevel): number {
  return { NORMAL: 0, LOW: 1 }[level];
}
