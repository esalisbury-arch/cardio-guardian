// Camera-based PPG capture for the Active Check flow.
//
// The user covers the rear camera + torch with a fingertip. Each frame is
// reduced to a single "mean red-channel intensity" number by a small native
// Frame Processor Plugin (VisionCamera runs frame processors on a worklet
// thread for performance; per-frame pixel reduction needs native code to
// keep up with the camera's frame rate — see
// android_native_reference/MeanRedChannelPlugin.kt and
// ios_native_reference/MeanRedChannelPlugin.swift for reference
// implementations you wire up per VisionCamera's "Frame Processor Plugins"
// guide). That single number per frame is exactly what
// src/signal/ppgProcessor.ts expects as input.
//
// This module intentionally has no signal-processing logic of its own — it
// only bridges camera frames to timestamped samples.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
  VisionCameraProxy,
  type Frame,
} from 'react-native-vision-camera';
// VisionCamera v4 frame processors run on their own worklet runtime
// (react-native-worklets-core), not react-native-reanimated's runOnJS.
import { Worklets } from 'react-native-worklets-core';

// Registered by the native plugin (see android_native_reference / ios_native_reference).
const meanRedChannelPlugin = VisionCameraProxy.initFrameProcessorPlugin('meanRedChannel', {});

function meanRedChannel(frame: Frame): number {
  'worklet';
  if (!meanRedChannelPlugin) {
    throw new Error('meanRedChannel native plugin is not registered — see android_native_reference/');
  }
  return meanRedChannelPlugin.call(frame) as number;
}

export interface PpgCameraHandle {
  device: ReturnType<typeof useCameraDevice>;
  isTorchOn: boolean;
  frameProcessor: ReturnType<typeof useFrameProcessor>;
}

/**
 * @param onSample called (on the JS thread) once per processed frame with
 *                  (timestampMs, meanRedChannel0to255)
 */
export function usePpgCamera(onSample: (t: number, redMean: number) => void): PpgCameraHandle {
  const device = useCameraDevice('back');
  const [isTorchOn, setTorchOn] = useState(true);
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;

  const handleSample = useCallback((redMean: number) => {
    onSampleRef.current(Date.now(), redMean);
  }, []);

  const runOnJSSample = useMemo(() => Worklets.createRunOnJS(handleSample), [handleSample]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const redMean = meanRedChannel(frame);
      runOnJSSample(redMean);
    },
    [runOnJSSample]
  );

  useEffect(() => {
    setTorchOn(device?.hasTorch ?? false);
  }, [device]);

  return { device, isTorchOn, frameProcessor };
}

export async function ensureCameraReady(): Promise<boolean> {
  const status = await Camera.requestCameraPermission();
  return status === 'granted';
}
