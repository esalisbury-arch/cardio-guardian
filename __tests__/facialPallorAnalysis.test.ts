import { aggregateSkinColor, comparePallor, normalizedRedness } from '../src/signal/facialPallorAnalysis';
import { PallorBaseline, SkinColorSample } from '../src/types';

function makeSamples(count: number, color: { r: number; g: number; b: number }, faceDetected = true): SkinColorSample[] {
  return Array.from({ length: count }, () => ({ ...color, faceDetected }));
}

describe('normalizedRedness', () => {
  it('computes r / (r+g+b)', () => {
    expect(normalizedRedness({ r: 150, g: 100, b: 100 })).toBeCloseTo(150 / 350);
  });

  it('returns 0 for a fully black sample instead of dividing by zero', () => {
    expect(normalizedRedness({ r: 0, g: 0, b: 0 })).toBe(0);
  });
});

describe('aggregateSkinColor', () => {
  it('drops frames where a face was not plausibly detected', () => {
    const samples: SkinColorSample[] = [
      ...makeSamples(5, { r: 200, g: 150, b: 130 }, true),
      ...makeSamples(5, { r: 5, g: 5, b: 5 }, false), // e.g. covered lens / no light
    ];
    const result = aggregateSkinColor(samples);
    expect(result.sampleCount).toBe(5);
    expect(result.r).toBeCloseTo(200);
  });

  it('uses the median so a couple of noisy frames do not skew the result', () => {
    const samples: SkinColorSample[] = [
      ...makeSamples(9, { r: 200, g: 150, b: 130 }),
      { r: 0, g: 0, b: 0, faceDetected: true }, // one wild outlier
    ];
    const result = aggregateSkinColor(samples);
    expect(result.r).toBeCloseTo(200);
  });
});

describe('comparePallor', () => {
  const baselineColor: PallorBaseline = { r: 200, g: 150, b: 130, capturedAt: 0 };

  it('flags as unreliable when too few valid frames were captured', () => {
    const result = comparePallor(baselineColor, makeSamples(3, { r: 150, g: 150, b: 150 }));
    expect(result.reliable).toBe(false);
    expect(result.savedAsBaseline).toBe(false);
  });

  it('saves the capture as a new baseline when none exists yet, without scoring it', () => {
    const result = comparePallor(null, makeSamples(15, { r: 180, g: 150, b: 140 }));
    expect(result.savedAsBaseline).toBe(true);
    expect(result.level).toBe('NORMAL');
    expect(result.reliable).toBe(true);
  });

  it('reports NORMAL when current color is close to baseline', () => {
    const result = comparePallor(baselineColor, makeSamples(15, { r: 199, g: 151, b: 130 }));
    expect(result.level).toBe('NORMAL');
    expect(result.savedAsBaseline).toBe(false);
  });

  it('flags LOW when normalized redness drops well below baseline (paler)', () => {
    // Baseline redness = 200/480 ≈ 0.417. A much less-red, more blue/grey
    // color simulates the "pale/ashen" shift.
    const paleSamples = makeSamples(15, { r: 140, g: 150, b: 150 }); // redness ≈ 140/440 ≈ 0.318
    const result = comparePallor(baselineColor, paleSamples);
    expect(result.level).toBe('LOW');
    expect(result.rednessDrop).toBeGreaterThan(0);
  });

  it('does not flag a slight, sub-threshold redness drop', () => {
    const slightlyLessRed = makeSamples(15, { r: 194, g: 152, b: 132 });
    const result = comparePallor(baselineColor, slightlyLessRed);
    expect(result.level).toBe('NORMAL');
  });
});
