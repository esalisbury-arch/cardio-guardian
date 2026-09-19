// Shared types for Verita Health. Kept dependency-free so signal/*.ts
// stays importable from plain Node (tests) as well as React Native.

export interface TimedSample {
  /** ms since epoch */
  t: number;
  /** sample value (unit depends on source) */
  v: number;
}

export type SignalQuality = 'no-signal' | 'poor' | 'fair' | 'good';

export interface PulseReading {
  bpm: number | null;
  /** consecutive inter-beat intervals in ms, most recent last */
  ibiMs: number[];
  quality: SignalQuality;
  /** 0 (no perfusion / no finger) .. 1 (strong clean pulsatile signal) */
  confidence: number;
}

export interface IrregularityResult {
  /** 0 (perfectly regular) .. 1 (highly irregular / AFib-like) */
  score: number;
  sdnnMs: number;
  rmssdMs: number;
  sampleCount: number;
  /** true only once enough beats have been collected to trust the score */
  reliable: boolean;
}

export type RiskLevel = 'NORMAL' | 'LOW';

export interface TriageInput {
  pulse: PulseReading | null;
  irregularity: IrregularityResult | null;
}

export interface TriageResult {
  level: RiskLevel;
  reasons: string[];
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

export type Hand = 'left' | 'right';

export interface FingerTapResult {
  hand: Hand;
  tapCount: number;
  durationMs: number;
  /** taps per second */
  rateHz: number;
  /** mean gap between consecutive taps, ms */
  meanIntervalMs: number;
  /** coefficient of variation of inter-tap intervals — higher = less rhythmic */
  rhythmCv: number;
  /** false if too few taps were registered to trust rate/rhythm figures */
  reliable: boolean;
}

export interface StrokeScreeningResult {
  level: 'NORMAL' | 'LOW';
  reasons: string[];
  left: FingerTapResult;
  right: FingerTapResult;
  /** 0 (symmetric) .. 1 (highly asymmetric) */
  asymmetryScore: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * One frame's worth of facial landmark points, already adapted from
 * whatever the native detector (Vision on iOS, ML Kit on Android) returns
 * into a single normalized shape. Any point can be null if the detector
 * couldn't locate it in that frame (occlusion, blink, face turned away).
 */
export interface FaceLandmarkFrame {
  faceDetected: boolean;
  leftEyeCenter: Point | null;
  rightEyeCenter: Point | null;
  leftEyeTop: Point | null;
  leftEyeBottom: Point | null;
  rightEyeTop: Point | null;
  rightEyeBottom: Point | null;
  leftMouthCorner: Point | null;
  rightMouthCorner: Point | null;
  /**
   * 0..1 output of the trained facial-asymmetry classifier (ml/face/train.py), or null
   * when unavailable (Android has no counterpart plugin yet, or the native call failed).
   * See FacialAsymmetryClassifierPlugin.swift for the model's data-provenance caveats —
   * it's a Bell's-palsy-trained proxy, not a stroke-specific classifier.
   */
  asymmetryModelScore: number | null;
}

export interface FaceSymmetryResult {
  level: 'NORMAL' | 'LOW';
  reasons: string[];
  /** mouth-corner droop asymmetry, normalized by interocular distance */
  mouthAsymmetry: number;
  /** eyelid-aperture asymmetry, normalized by interocular distance */
  eyeAsymmetry: number;
  /** 0 (symmetric) .. 1 (highly asymmetric) */
  asymmetryScore: number;
  /** median trained-model score across the burst, or null if the model was unavailable every frame */
  modelConfidence: number | null;
  /** number of frames with a fully-detected face used in the result */
  sampleCount: number;
  reliable: boolean;
}

export type CheckType = 'active' | 'face' | 'arm' | 'speech' | 'pallor';

interface HistoryEntryBase {
  id: string;
  /** ms since epoch, when the check completed */
  timestamp: number;
}

export interface ActiveCheckHistoryEntry extends HistoryEntryBase {
  type: 'active';
  bpm: number | null;
  quality: SignalQuality;
  /** null when too few beats were captured to trust the irregularity score */
  irregularityScore: number | null;
  /** irregularityScore >= IRREGULARITY_WARNING_THRESHOLD (see triageEngine.ts) */
  flagged: boolean;
}

export interface FaceCheckHistoryEntry extends HistoryEntryBase {
  type: 'face';
  level: 'NORMAL' | 'LOW';
  /** null when the burst wasn't reliable (face lost, too few good frames) */
  asymmetryScore: number | null;
  /** median trained-model score across the burst, or null if unreliable/unavailable — see FaceSymmetryResult */
  modelConfidence: number | null;
  reliable: boolean;
}

export interface ArmCheckHistoryEntry extends HistoryEntryBase {
  type: 'arm';
  level: 'NORMAL' | 'LOW';
  asymmetryScore: number;
}

export interface SpeechCheckHistoryEntry extends HistoryEntryBase {
  type: 'speech';
  level: 'NORMAL' | 'LOW';
  /** null when the attempt wasn't reliable (e.g. recognition failed outright) */
  wordErrorRate: number | null;
  rateSlowdownFactor: number | null;
  reliable: boolean;
}

export interface PallorCheckHistoryEntry extends HistoryEntryBase {
  type: 'pallor';
  level: 'NORMAL' | 'LOW';
  /** null when unreliable, or when this capture was saved as a new baseline instead of compared */
  rednessDrop: number | null;
  /** median trained-model score across the burst, or null if unreliable/unavailable — see PallorResult */
  modelConfidence: number | null;
  reliable: boolean;
  savedAsBaseline: boolean;
}

/**
 * One completed check, persisted locally (see src/services/history.ts) so
 * Active Check / Face Check / Finger Tap Test / Speech Check results build
 * up into a trend instead of vanishing the moment the user leaves the
 * results screen. Deliberately a small, typed summary of each result — not
 * the raw signal (no ibiMs arrays, no landmark frames, no transcripts) — to
 * keep on-device storage bounded and avoid holding onto more biometric
 * detail than the trend view actually needs.
 */
export type HistoryEntry =
  | ActiveCheckHistoryEntry
  | FaceCheckHistoryEntry
  | ArmCheckHistoryEntry
  | SpeechCheckHistoryEntry
  | PallorCheckHistoryEntry;

/** One frame's worth of mean color from the center of the camera view (see src/sensors/faceColorCamera.ts). */
export interface SkinColorSample {
  r: number;
  g: number;
  b: number;
  /** Coarse brightness sanity check, not real face detection — see MeanFaceColorPlugin native reference. */
  faceDetected: boolean;
  /**
   * 0..1 output of the trained anemia-risk classifier (ml/pallor/train.py), or null when
   * unavailable (Android has no counterpart plugin yet, or the native call failed). See
   * PallorClassifierPlugin.swift for the model's data-provenance caveats — a small research
   * dataset, not a validated diagnostic model.
   */
  pallorModelScore: number | null;
}

/** A user's saved "normal" skin color, captured once in good lighting, that later Pallor Checks compare against. */
export interface PallorBaseline {
  r: number;
  g: number;
  b: number;
  capturedAt: number;
}

export interface PallorResult {
  level: 'NORMAL' | 'LOW';
  reasons: string[];
  /** baseline normalized-redness minus current normalized-redness; positive = paler than baseline */
  rednessDrop: number;
  /** current r / (r+g+b), 0..1 */
  normalizedRedness: number;
  /** median trained-model score across the burst, or null if unreliable/unavailable */
  modelConfidence: number | null;
  sampleCount: number;
  reliable: boolean;
  /** true when there was no baseline yet and this capture was saved as the new one instead of being scored */
  savedAsBaseline: boolean;
}

/** What the on-device speech recognizer produced for one attempt at the test phrase. */
export interface SpeechAttempt {
  transcript: string;
  durationMs: number;
}

export interface SpeechScreeningResult {
  level: 'NORMAL' | 'LOW';
  reasons: string[];
  transcript: string;
  /** fraction of words that differ from the expected phrase, via word-level edit distance */
  wordErrorRate: number;
  speechDurationMs: number;
  expectedDurationMs: number;
  /** actual / expected duration — 1.0 is normal pace, higher is slower */
  rateSlowdownFactor: number;
  /** 0 (matches expectations) .. 1 (highly impaired-sounding) */
  impairmentScore: number;
  reliable: boolean;
}
