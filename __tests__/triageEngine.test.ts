import { computeTriage } from '../src/signal/triageEngine';
import { CollapseEvent, IrregularityResult, PulseReading, TriageInput } from '../src/types';

const now = 1_000_000;

const goodPulse: PulseReading = { bpm: 72, ibiMs: [820, 830, 815], quality: 'good', confidence: 0.9 };
const noPulse: PulseReading = { bpm: null, ibiMs: [], quality: 'no-signal', confidence: 0 };
const calmRhythm: IrregularityResult = { score: 0.1, sdnnMs: 20, rmssdMs: 15, sampleCount: 20, reliable: true };
const chaoticRhythm: IrregularityResult = { score: 0.8, sdnnMs: 200, rmssdMs: 180, sampleCount: 20, reliable: true };
const collapseEvent: CollapseEvent = { detectedAt: now, impactMagnitudeG: 3.1, stillnessMs: 9000, confidence: 0.8 };

function baseInput(overrides: Partial<TriageInput>): TriageInput {
  return {
    pulse: goodPulse,
    irregularity: calmRhythm,
    collapse: null,
    userResponded: null,
    now,
    ...overrides,
  };
}

describe('computeTriage', () => {
  it('is NORMAL with a clean pulse and no collapse', () => {
    const result = computeTriage(baseInput({}));
    expect(result.level).toBe('NORMAL');
    expect(result.triggerEmergencyFlow).toBe(false);
  });

  it('flags LOW for a reliably irregular rhythm with no collapse', () => {
    const result = computeTriage(baseInput({ irregularity: chaoticRhythm }));
    expect(result.level).toBe('LOW');
    expect(result.triggerEmergencyFlow).toBe(false);
  });

  it('is WARNING while awaiting a check-in response after collapse', () => {
    const result = computeTriage(baseInput({ collapse: collapseEvent, userResponded: null }));
    expect(result.level).toBe('WARNING');
    expect(result.triggerEmergencyFlow).toBe(false);
  });

  it('downgrades to LOW if the user responds after a collapse', () => {
    const result = computeTriage(baseInput({ collapse: collapseEvent, userResponded: true, pulse: noPulse }));
    expect(result.level).toBe('LOW');
    expect(result.triggerEmergencyFlow).toBe(false);
  });

  it('stays WARNING (not CRITICAL) if no response but a pulse is still present', () => {
    const result = computeTriage(baseInput({ collapse: collapseEvent, userResponded: false, pulse: goodPulse }));
    expect(result.level).toBe('WARNING');
    expect(result.triggerEmergencyFlow).toBe(false);
  });

  it('is CRITICAL only when collapse + no pulse + no response all coincide', () => {
    const result = computeTriage(baseInput({ collapse: collapseEvent, userResponded: false, pulse: noPulse }));
    expect(result.level).toBe('CRITICAL');
    expect(result.triggerEmergencyFlow).toBe(true);
  });
});
