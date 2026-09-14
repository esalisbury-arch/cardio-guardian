// Sensor-fusion triage engine.
//
// Scope (deliberately narrow): this build targets one signature —
// suspected sudden cardiac arrest — built from three independent signals
// that are each individually weak but, combined, are a reasonable proxy for
// "person has collapsed and shows no pulse":
//
//   1. Collapse event (accelerometer: impact + sustained stillness)
//   2. Absent/undetectable pulse (camera PPG signal quality == no-signal)
//   3. No response to an on-screen "are you OK?" prompt within its timeout
//
// CRITICAL (which triggers the emergency alert flow) requires ALL THREE.
// Any one or two alone produce a lower, non-emergency level — the app
// should never auto-alert on a single ambiguous signal. This is a screening
// aid, not a diagnostic or FDA-cleared medical device; it can miss real
// emergencies and can false-positive. It does not replace calling emergency
// services yourself when in doubt.

import { RiskLevel, TriageInput, TriageResult } from '../types';

// Exported so other pure-logic and UI code (e.g. history trend flags) uses
// the exact same cutoff instead of a second hardcoded copy of "0.6".
export const IRREGULARITY_WARNING_THRESHOLD = 0.6;

export function computeTriage(input: TriageInput): TriageResult {
  const { pulse, irregularity, collapse, userResponded } = input;
  const reasons: string[] = [];

  const pulseAbsent = !pulse || pulse.quality === 'no-signal' || pulse.bpm === null;

  if (collapse) {
    reasons.push(
      `Collapse pattern detected (impact ${collapse.impactMagnitudeG.toFixed(1)}g, ` +
        `${Math.round(collapse.stillnessMs / 1000)}s stillness)`
    );

    if (userResponded === true) {
      reasons.push('User responded to check-in prompt');
      return { level: 'LOW', reasons, triggerEmergencyFlow: false };
    }

    if (userResponded === null) {
      reasons.push('Awaiting response to on-screen check-in prompt');
      return { level: 'WARNING', reasons, triggerEmergencyFlow: false };
    }

    // userResponded === false: prompt timed out with no response.
    if (pulseAbsent) {
      reasons.push('No pulse detected and no response — emergency criteria met');
      return { level: 'CRITICAL', reasons, triggerEmergencyFlow: true };
    }

    reasons.push('Pulse still detected despite no response to prompt');
    return { level: 'WARNING', reasons, triggerEmergencyFlow: false };
  }

  if (irregularity && irregularity.reliable && irregularity.score >= IRREGULARITY_WARNING_THRESHOLD) {
    reasons.push(`Irregular pulse rhythm flagged (score ${irregularity.score.toFixed(2)}) — consider medical evaluation`);
    return { level: 'LOW', reasons, triggerEmergencyFlow: false };
  }

  reasons.push('No collapse or irregularity detected');
  return { level: 'NORMAL', reasons, triggerEmergencyFlow: false };
}

export function levelSeverityRank(level: RiskLevel): number {
  return { NORMAL: 0, LOW: 1, WARNING: 2, CRITICAL: 3 }[level];
}
