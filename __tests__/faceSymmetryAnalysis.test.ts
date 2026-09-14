import { aggregateFaceSymmetry, scoreFrame } from '../src/signal/faceSymmetryAnalysis';
import { FaceLandmarkFrame } from '../src/types';

function baseFrame(overrides: Partial<FaceLandmarkFrame> = {}): FaceLandmarkFrame {
  // A roughly frontal face, eyes 0.3 apart (normalized units), symmetric
  // mouth corners and eye apertures by default.
  return {
    faceDetected: true,
    leftEyeCenter: { x: 0.35, y: 0.4 },
    rightEyeCenter: { x: 0.65, y: 0.4 },
    leftEyeTop: { x: 0.35, y: 0.38 },
    leftEyeBottom: { x: 0.35, y: 0.42 },
    rightEyeTop: { x: 0.65, y: 0.38 },
    rightEyeBottom: { x: 0.65, y: 0.42 },
    leftMouthCorner: { x: 0.4, y: 0.65 },
    rightMouthCorner: { x: 0.6, y: 0.65 },
    ...overrides,
  };
}

function repeat<T>(value: T, n: number): T[] {
  return Array.from({ length: n }, () => value);
}

describe('scoreFrame', () => {
  it('returns null when the face was not detected', () => {
    expect(scoreFrame(baseFrame({ faceDetected: false }))).toBeNull();
  });

  it('returns null when a required landmark is missing', () => {
    expect(scoreFrame(baseFrame({ leftMouthCorner: null }))).toBeNull();
  });

  it('scores near-zero asymmetry for a symmetric frame', () => {
    const score = scoreFrame(baseFrame());
    expect(score).not.toBeNull();
    expect(score!.mouthAsymmetry).toBeCloseTo(0, 5);
    expect(score!.eyeAsymmetry).toBeCloseTo(0, 5);
  });

  it('detects mouth-corner droop asymmetry', () => {
    // right corner sags well below the eye line relative to the left
    const score = scoreFrame(baseFrame({ rightMouthCorner: { x: 0.6, y: 0.75 } }));
    expect(score!.mouthAsymmetry).toBeGreaterThan(0.1);
  });

  it('detects eye-openness asymmetry (partial ptosis-like closure)', () => {
    const score = scoreFrame(baseFrame({ rightEyeTop: { x: 0.65, y: 0.395 } })); // eye mostly closed
    expect(score!.eyeAsymmetry).toBeGreaterThan(0.02);
  });
});

describe('aggregateFaceSymmetry', () => {
  it('is unreliable with too few valid frames', () => {
    const result = aggregateFaceSymmetry(repeat(baseFrame(), 3));
    expect(result.reliable).toBe(false);
    expect(result.level).toBe('NORMAL');
  });

  it('is NORMAL for a consistently symmetric face', () => {
    const result = aggregateFaceSymmetry(repeat(baseFrame(), 20));
    expect(result.reliable).toBe(true);
    expect(result.level).toBe('NORMAL');
  });

  it('flags LOW for a consistently drooping mouth corner', () => {
    const droopy = baseFrame({ rightMouthCorner: { x: 0.6, y: 0.78 } });
    const result = aggregateFaceSymmetry(repeat(droopy, 20));
    expect(result.reliable).toBe(true);
    expect(result.level).toBe('LOW');
    expect(result.mouthAsymmetry).toBeGreaterThan(0);
  });

  it('ignores occasional undetected frames (e.g. blinks) rather than treating them as symmetric', () => {
    const droopy = baseFrame({ rightMouthCorner: { x: 0.6, y: 0.78 } });
    const blink = baseFrame({ faceDetected: false });
    const frames = [...repeat(droopy, 15), ...repeat(blink, 10)];
    const result = aggregateFaceSymmetry(frames);
    expect(result.sampleCount).toBe(15);
    expect(result.level).toBe('LOW');
  });
});
