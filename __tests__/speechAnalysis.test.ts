import { analyzeSpeech, expectedDurationMsFor } from '../src/signal/speechAnalysis';

const PHRASE = "You can't teach an old dog new tricks"; // 8 words

describe('expectedDurationMsFor', () => {
  it('computes a duration proportional to word count at a normal pace', () => {
    expect(expectedDurationMsFor(PHRASE)).toBeCloseTo(3200, 0); // 8 words / 150 wpm
  });
});

describe('analyzeSpeech', () => {
  it('is unreliable when nothing was transcribed', () => {
    const result = analyzeSpeech(PHRASE, { transcript: '', durationMs: 4000 });
    expect(result.reliable).toBe(false);
    expect(result.level).toBe('NORMAL');
  });

  it('is NORMAL for an exact match at a typical pace', () => {
    const result = analyzeSpeech(PHRASE, { transcript: PHRASE, durationMs: 3200 });
    expect(result.reliable).toBe(true);
    expect(result.level).toBe('NORMAL');
    expect(result.wordErrorRate).toBe(0);
    expect(result.rateSlowdownFactor).toBeCloseTo(1, 1);
  });

  it('tolerates a single minor word difference at a typical pace', () => {
    const result = analyzeSpeech(PHRASE, {
      transcript: "You can't teach an old dog knew tricks", // "new" -> "knew"
      durationMs: 3200,
    });
    expect(result.level).toBe('NORMAL');
    expect(result.wordErrorRate).toBeCloseTo(1 / 8, 2);
  });

  it('flags LOW when the transcript diverges heavily from the expected phrase', () => {
    const result = analyzeSpeech(PHRASE, {
      transcript: 'ewe kant teesh uh owl dawg noo tips',
      durationMs: 3200,
    });
    expect(result.reliable).toBe(true);
    expect(result.level).toBe('LOW');
    expect(result.wordErrorRate).toBeGreaterThanOrEqual(0.4);
  });

  it('flags LOW for a correct but much slower than expected attempt', () => {
    const result = analyzeSpeech(PHRASE, { transcript: PHRASE, durationMs: 6000 });
    expect(result.level).toBe('LOW');
    expect(result.wordErrorRate).toBe(0);
    expect(result.rateSlowdownFactor).toBeGreaterThan(1.6);
  });
});
