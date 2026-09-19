// Front-camera facial landmark capture for the Face Check flow.
//
// Mirrors src/sensors/ppgCamera.ts's pattern: a small native Frame
// Processor Plugin does the actual per-frame ML work (VisionCamera runs
// frame processors on a worklet thread, and neither Apple's Vision
// framework nor Google's ML Kit are callable directly from JS) — see
// android_native_reference/FaceLandmarksPlugin.kt (ML Kit Face Detection)
// and ios_native_reference/FaceLandmarksPlugin.swift (Vision framework,
// system-provided, no extra dependency) for reference implementations.
//
// The plugin returns a flat record of numbers/booleans (the type
// VisionCameraProxy plugins are documented to support), which this module
// adapts into the nested `FaceLandmarkFrame` shape
// src/signal/faceSymmetryAnalysis.ts expects. No analysis happens here.

import { useCallback, useMemo, useRef } from 'react';
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
  VisionCameraProxy,
  type Frame,
} from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { FaceLandmarkFrame, Point } from '../types';

// Registered by the native plugin (see android_native_reference / ios_native_reference).
const faceLandmarksPlugin = VisionCameraProxy.initFrameProcessorPlugin('detectFaceLandmarks', {});
// Trained Core ML facial-asymmetry classifier (ios/VeritaHealth/FacialAsymmetryClassifierPlugin.swift,
// ml/face/train.py) — iOS only for now, no Android counterpart exists yet.
const facialAsymmetryClassifierPlugin = VisionCameraProxy.initFrameProcessorPlugin('classifyFacialAsymmetry', {});

interface RawFaceLandmarkFrame {
  faceDetected: boolean;
  leftEyeCenterX?: number;
  leftEyeCenterY?: number;
  rightEyeCenterX?: number;
  rightEyeCenterY?: number;
  leftEyeTopX?: number;
  leftEyeTopY?: number;
  leftEyeBottomX?: number;
  leftEyeBottomY?: number;
  rightEyeTopX?: number;
  rightEyeTopY?: number;
  rightEyeBottomX?: number;
  rightEyeBottomY?: number;
  leftMouthCornerX?: number;
  leftMouthCornerY?: number;
  rightMouthCornerX?: number;
  rightMouthCornerY?: number;
}

interface RawFacialAsymmetryScore {
  scoreAvailable: boolean;
  asymmetryModelScore?: number;
}

function point(x: number | undefined, y: number | undefined): Point | null {
  return x === undefined || y === undefined ? null : { x, y };
}

function toFaceLandmarkFrame(raw: RawFaceLandmarkFrame, modelScore: RawFacialAsymmetryScore | null): FaceLandmarkFrame {
  return {
    faceDetected: raw.faceDetected,
    leftEyeCenter: point(raw.leftEyeCenterX, raw.leftEyeCenterY),
    rightEyeCenter: point(raw.rightEyeCenterX, raw.rightEyeCenterY),
    leftEyeTop: point(raw.leftEyeTopX, raw.leftEyeTopY),
    leftEyeBottom: point(raw.leftEyeBottomX, raw.leftEyeBottomY),
    rightEyeTop: point(raw.rightEyeTopX, raw.rightEyeTopY),
    rightEyeBottom: point(raw.rightEyeBottomX, raw.rightEyeBottomY),
    leftMouthCorner: point(raw.leftMouthCornerX, raw.leftMouthCornerY),
    rightMouthCorner: point(raw.rightMouthCornerX, raw.rightMouthCornerY),
    asymmetryModelScore: modelScore?.scoreAvailable ? modelScore.asymmetryModelScore ?? null : null,
  };
}

function detectFaceLandmarksRaw(frame: Frame): RawFaceLandmarkFrame {
  'worklet';
  if (!faceLandmarksPlugin) {
    throw new Error('detectFaceLandmarks native plugin is not registered — see android_native_reference/ and ios_native_reference/');
  }
  return faceLandmarksPlugin.call(frame) as unknown as RawFaceLandmarkFrame;
}

function classifyFacialAsymmetryRaw(frame: Frame): RawFacialAsymmetryScore | null {
  'worklet';
  // iOS-only plugin (see ios/VeritaHealth/FacialAsymmetryClassifierPlugin.swift) — no
  // Android counterpart exists yet, so this is allowed to simply be unavailable there.
  if (!facialAsymmetryClassifierPlugin) {
    return null;
  }
  return facialAsymmetryClassifierPlugin.call(frame) as unknown as RawFacialAsymmetryScore;
}

export interface FaceLandmarkCameraHandle {
  device: ReturnType<typeof useCameraDevice>;
  frameProcessor: ReturnType<typeof useFrameProcessor>;
}

/** @param onFrame called (on the JS thread) once per processed frame with the adapted landmarks */
export function useFaceLandmarkCamera(onFrame: (frame: FaceLandmarkFrame) => void): FaceLandmarkCameraHandle {
  const device = useCameraDevice('front');
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const handleFrame = useCallback((raw: RawFaceLandmarkFrame, modelScore: RawFacialAsymmetryScore | null) => {
    onFrameRef.current(toFaceLandmarkFrame(raw, modelScore));
  }, []);

  const runOnJSFrame = useMemo(() => Worklets.createRunOnJS(handleFrame), [handleFrame]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const raw = detectFaceLandmarksRaw(frame);
      const modelScore = classifyFacialAsymmetryRaw(frame);
      runOnJSFrame(raw, modelScore);
    },
    [runOnJSFrame]
  );

  return { device, frameProcessor };
}

export async function ensureCameraReady(): Promise<boolean> {
  const status = await Camera.requestCameraPermission();
  return status === 'granted';
}
