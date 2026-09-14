import { Platform } from 'react-native';
import {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  Permission,
} from 'react-native-permissions';

export type PermissionKey = 'camera' | 'motion' | 'location' | 'sms' | 'microphone' | 'speechRecognition';

function permissionFor(key: PermissionKey): Permission | null {
  switch (key) {
    case 'camera':
      return Platform.select({ ios: PERMISSIONS.IOS.CAMERA, android: PERMISSIONS.ANDROID.CAMERA }) ?? null;
    case 'motion':
      // Android has no runtime permission for the accelerometer. iOS gates
      // continuous motion access behind Motion & Fitness.
      return Platform.select({ ios: PERMISSIONS.IOS.MOTION, android: undefined }) ?? null;
    case 'location':
      return Platform.select({
        ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
        android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      }) ?? null;
    case 'sms':
      // iOS has no programmatic SMS-send permission (Apple requires the
      // native compose UI). Only Android's silent-send path needs this.
      return Platform.select({ android: PERMISSIONS.ANDROID.SEND_SMS, ios: undefined }) ?? null;
    case 'microphone':
      return Platform.select({ ios: PERMISSIONS.IOS.MICROPHONE, android: PERMISSIONS.ANDROID.RECORD_AUDIO }) ?? null;
    case 'speechRecognition':
      // Android's SpeechRecognizer only needs RECORD_AUDIO (handled above);
      // iOS gates on-device dictation behind a separate Speech Recognition
      // permission from the microphone one.
      return Platform.select({ ios: PERMISSIONS.IOS.SPEECH_RECOGNITION, android: undefined }) ?? null;
  }
}

export async function ensurePermission(key: PermissionKey): Promise<boolean> {
  const permission = permissionFor(key);
  if (!permission) return true; // nothing to request on this platform for this key

  const existing = await check(permission);
  if (existing === RESULTS.GRANTED || existing === RESULTS.LIMITED) return true;

  const result = await request(permission);
  return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
}

export async function ensureCoreSensorPermissions(): Promise<{ camera: boolean; motion: boolean; location: boolean }> {
  const [camera, motion, location] = await Promise.all([
    ensurePermission('camera'),
    ensurePermission('motion'),
    ensurePermission('location'),
  ]);
  return { camera, motion, location };
}

export async function ensureSpeechPermissions(): Promise<boolean> {
  const [microphone, speechRecognition] = await Promise.all([
    ensurePermission('microphone'),
    ensurePermission('speechRecognition'),
  ]);
  return microphone && speechRecognition;
}
