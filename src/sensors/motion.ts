// Accelerometer stream -> g-normalized samples for the collapse detector.
//
// Platform note: this only runs reliably while the app is in the
// foreground. iOS suspends third-party background sensor access almost
// entirely (no background accelerometer streaming for regular apps), and
// Android will kill the JS thread in the background unless the app runs a
// foreground service (see README "Background monitoring limitations").
// Treat continuous passive monitoring as a foreground feature; the
// finger-on-camera Active Check (src/sensors/ppgCamera.ts) is the reliable,
// user-initiated fallback that works regardless of background restrictions.

import { accelerometer, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';
import type { Subscription } from 'rxjs';
import { AccelSample } from '../types';

const EARTH_GRAVITY_MS2 = 9.80665;
const UPDATE_INTERVAL_MS = 20; // 50Hz, matches collapseDetector's sampling assumptions

export function startMotionStream(onSample: (sample: AccelSample) => void): Subscription {
  setUpdateIntervalForType(SensorTypes.accelerometer, UPDATE_INTERVAL_MS);

  return accelerometer.subscribe({
    next: ({ x, y, z, timestamp }) => {
      onSample({
        t: timestamp,
        x: x / EARTH_GRAVITY_MS2,
        y: y / EARTH_GRAVITY_MS2,
        z: z / EARTH_GRAVITY_MS2,
      });
    },
    error: (err) => {
      // Surface to caller via console; UI layer decides how to degrade
      // (e.g. fall back to Active Check only).
      console.warn('[motion] accelerometer stream error', err);
    },
  });
}

export function stopMotionStream(subscription: Subscription | null): void {
  subscription?.unsubscribe();
}
