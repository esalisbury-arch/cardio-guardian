// Front-camera skin-color capture for the Pallor Check flow.
//
// Mirrors src/sensors/ppgCamera.ts's pattern: a small native Frame
// Processor Plugin reduces each frame to a mean RGB color (VisionCamera
// runs frame processors on a worklet thread; per-frame pixel averaging
// needs native code to keep up with the camera's frame rate) — see
// android_native_reference/MeanFaceColorPlugin.kt and
// ios_native_reference/MeanFaceColorPlugin.swift for reference
// implementations. The plugin samples the center crop of the frame (where
// a face filling the on-screen guide oval should be) and reports a coarse
// brightness-based "faceDetected" sanity check alongside the mean color —
// not real face detection, see the plugin's own comments — matching what
// src/signal/facialPallorAnalysis.ts expects as input.
//
// This module intentionally has no color-analysis logic of its own — it
// only bridges camera frames to samples.

import { useCallback, useMemo, useRef } from 'react';
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
  VisionCameraProxy,
  type Frame,
} from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { SkinColorSample } from '../types';

// Registered by the native plugin (see android_native_reference / ios_native_reference).
const meanFaceColorPlugin = VisionCameraProxy.initFrameProcessorPlugin('meanFaceColor', {});
// Trained Core ML anemia-risk classifier (ios/VeritaHealth/PallorClassifierPlugin.swift,
// ml/pallor/train.py) — iOS only for now, no Android counterpart exists yet.
const pallorClassifierPlugin = VisionCameraProxy.initFrameProcessorPlugin('classifyPallor', {});

interface RawPallorScore {
  scoreAvailable: boolean;
  pallorModelScore?: number;
}

function meanFaceColor(frame: Frame): Omit<SkinColorSample, 'pallorModelScore'> {
  'worklet';
  if (!meanFaceColorPlugin) {
    throw new Error('meanFaceColor native plugin is not registered — see android_native_reference/');
  }
  return meanFaceColorPlugin.call(frame) as unknown as Omit<SkinColorSample, 'pallorModelScore'>;
}

function classifyPallorRaw(frame: Frame): RawPallorScore | null {
  'worklet';
  // iOS-only plugin (see ios/VeritaHealth/PallorClassifierPlugin.swift) — no Android
  // counterpart exists yet, so this is allowed to simply be unavailable there.
  if (!pallorClassifierPlugin) {
    return null;
  }
  return pallorClassifierPlugin.call(frame) as unknown as RawPallorScore;
}

export interface FaceColorCameraHandle {
  device: ReturnType<typeof useCameraDevice>;
  frameProcessor: ReturnType<typeof useFrameProcessor>;
}

/** @param onSample called (on the JS thread) once per processed frame */
export function useFaceColorCamera(onSample: (sample: SkinColorSample) => void): FaceColorCameraHandle {
  const device = useCameraDevice('front');
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;

  const handleSample = useCallback((sample: Omit<SkinColorSample, 'pallorModelScore'>, modelScore: RawPallorScore | null) => {
    onSampleRef.current({
      ...sample,
      pallorModelScore: modelScore?.scoreAvailable ? modelScore.pallorModelScore ?? null : null,
    });
  }, []);

  const runOnJSSample = useMemo(() => Worklets.createRunOnJS(handleSample), [handleSample]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const sample = meanFaceColor(frame);
      const modelScore = classifyPallorRaw(frame);
      runOnJSSample(sample, modelScore);
    },
    [runOnJSSample]
  );

  return { device, frameProcessor };
}

export async function ensureCameraReady(): Promise<boolean> {
  const status = await Camera.requestCameraPermission();
  return status === 'granted';
}
