// Facial symmetry screening — the "Face drooping" sign in FAST (Face
// drooping, Arm weakness, Speech difficulty, Time to call emergency
// services). Complements src/signal/fingerTapAnalysis.ts (Arm weakness).
//
// Approach: from a short burst of facial-landmark frames (mouth corners,
// eye contours), measure how far each mouth corner droops below the eye
// line and how open each eye is, normalized by interocular distance so it
// doesn't matter how close the face is to the camera. Compare left vs
// right. A meaningful, consistent asymmetry across many frames — not just
// one blink or a head tilt — is the flag.
//
// IMPORTANT LIMITATIONS: this is a screening heuristic, not a diagnosis.
// Resting facial asymmetry is common and normal in many people; lighting,
// camera angle, and head pose all affect landmark accuracy; and central
// facial palsy (stroke), Bell's palsy, and old injuries can all produce
// asymmetry this can't tell apart. It only ever produces a "flag for
// follow-up" result — like fingerTapAnalysis.ts, it deliberately never
// auto-triggers the emergency alert flow on its own (see
// src/signal/triageEngine.ts for the one signature that does, and why).

import { FaceLandmarkFrame, FaceSymmetryResult, Point } from '../types';

const MOUTH_ASYMMETRY_FLAG_THRESHOLD = 0.06;
const EYE_ASYMMETRY_FLAG_THRESHOLD = 0.04;
const MIN_VALID_FRAMES = 10;
const MOUTH_WEIGHT = 0.7;
const EYE_WEIGHT = 0.3;

interface FrameScore {
  mouthAsymmetry: number;
  eyeAsymmetry: number;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Scores a single frame. Returns null if the face (or a needed landmark)
 * wasn't detected in this frame — those frames are simply dropped rather
 * than treated as "symmetric", so a blink doesn't quietly dilute a real
 * asymmetry.
 */
export function scoreFrame(frame: FaceLandmarkFrame): FrameScore | null {
  const {
    faceDetected,
    leftEyeCenter,
    rightEyeCenter,
    leftEyeTop,
    leftEyeBottom,
    rightEyeTop,
    rightEyeBottom,
    leftMouthCorner,
    rightMouthCorner,
  } = frame;

  if (
    !faceDetected ||
    !leftEyeCenter ||
    !rightEyeCenter ||
    !leftEyeTop ||
    !leftEyeBottom ||
    !rightEyeTop ||
    !rightEyeBottom ||
    !leftMouthCorner ||
    !rightMouthCorner
  ) {
    return null;
  }

  const interocular = distance(leftEyeCenter, rightEyeCenter);
  if (interocular === 0) return null;

  const eyeLineY = (leftEyeCenter.y + rightEyeCenter.y) / 2;
  const leftMouthDrop = (leftMouthCorner.y - eyeLineY) / interocular;
  const rightMouthDrop = (rightMouthCorner.y - eyeLineY) / interocular;
  const mouthAsymmetry = Math.abs(leftMouthDrop - rightMouthDrop);

  const leftEyeOpenness = distance(leftEyeTop, leftEyeBottom) / interocular;
  const rightEyeOpenness = distance(rightEyeTop, rightEyeBottom) / interocular;
  const eyeAsymmetry = Math.abs(leftEyeOpenness - rightEyeOpenness);

  return { mouthAsymmetry, eyeAsymmetry };
}

/** Aggregates a burst of frames (e.g. ~4s of camera frames) into one result. */
export function aggregateFaceSymmetry(frames: FaceLandmarkFrame[]): FaceSymmetryResult {
  const scores = frames.map(scoreFrame).filter((s): s is FrameScore => s !== null);

  if (scores.length < MIN_VALID_FRAMES) {
    return {
      level: 'NORMAL',
      reasons: ['Not enough clear frames of your face to assess symmetry — try again with better lighting, facing the camera directly'],
      mouthAsymmetry: 0,
      eyeAsymmetry: 0,
      asymmetryScore: 0,
      sampleCount: scores.length,
      reliable: false,
    };
  }

  // Median, not mean — robust against a handful of noisy/blink frames.
  const mouthAsymmetry = median(scores.map((s) => s.mouthAsymmetry));
  const eyeAsymmetry = median(scores.map((s) => s.eyeAsymmetry));

  const asymmetryScore = Math.max(
    0,
    Math.min(
      1,
      MOUTH_WEIGHT * Math.min(1, mouthAsymmetry / (MOUTH_ASYMMETRY_FLAG_THRESHOLD * 2)) +
        EYE_WEIGHT * Math.min(1, eyeAsymmetry / (EYE_ASYMMETRY_FLAG_THRESHOLD * 2))
    )
  );

  if (mouthAsymmetry >= MOUTH_ASYMMETRY_FLAG_THRESHOLD || eyeAsymmetry >= EYE_ASYMMETRY_FLAG_THRESHOLD) {
    return {
      level: 'LOW',
      reasons: [
        'Facial asymmetry detected around the mouth or eyes — if this is new and comes with arm ' +
          'weakness or slurred speech, treat it as a possible stroke and call emergency services now',
      ],
      mouthAsymmetry,
      eyeAsymmetry,
      asymmetryScore,
      sampleCount: scores.length,
      reliable: true,
    };
  }

  return {
    level: 'NORMAL',
    reasons: ['Face appears roughly symmetric'],
    mouthAsymmetry,
    eyeAsymmetry,
    asymmetryScore,
    sampleCount: scores.length,
    reliable: true,
  };
}
