import { computeTriage } from '../src/signal/triageEngine';
import { IrregularityResult, PulseReading, TriageInput } from '../src/types';

const goodPulse: PulseReading = { bpm: 72, ibiMs: [820, 830, 815], quality: 'good', confidence: 0.9 };
const calmRhythm: IrregularityResult = { score: 0.1, sdnnMs: 20, rmssdMs: 15, sampleCount: 20, reliable: true };
const chaoticRhythm: IrregularityResult = { score: 0.8, sdnnMs: 200, rmssdMs: 180, sampleCount: 20, reliable: true };

function baseInput(overrides: Partial<TriageInput>): TriageInput {
  return {
    pulse: goodPulse,
    irregularity: calmRhythm,
    ...overrides,
  };
}

describe('computeTriage', () => {
  it('is NORMAL with a clean, regular pulse', () => {
    const result = computeTriage(baseInput({}));
    expect(result.level).toBe('NORMAL');
  });

  it('is NORMAL when there is no irregularity reading at all', () => {
    const result = computeTriage(baseInput({ irregularity: null }));
    expect(result.level).toBe('NORMAL');
  });

  it('flags LOW for a reliably irregular rhythm', () => {
    const result = computeTriage(baseInput({ irregularity: chaoticRhythm }));
    expect(result.level).toBe('LOW');
  });

  it('does not flag an irregular score unless it is marked reliable', () => {
    const result = computeTriage(baseInput({ irregularity: { ...chaoticRhythm, reliable: false } }));
    expect(result.level).toBe('NORMAL');
  });
});
