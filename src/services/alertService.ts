// Location lookup and one-tap emergency dialing, used by Nearby Hospitals'
// "having an emergency right now?" call-out.
//
// This used to also carry the emergency-alert SMS/countdown flow triggered
// by the triage engine's old CRITICAL level (passive collapse monitoring +
// no pulse + no check-in response) — that flow was removed along with
// passive collapse monitoring. Placing a call still always ends with the
// OS's native dial screen, requiring one final human tap by policy (Apple
// does not allow a silent call/SMS send), which we mirror on Android by
// default for the same reason.

import { Linking } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
}

export function getCurrentLocation(timeoutMs = 8000): Promise<Coordinates | null> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy ?? null,
        }),
      (err) => {
        console.warn('[alertService] location unavailable', err);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
    );
  });
}

/** Opens the phone dialer pre-filled with the local emergency number. Requires a final tap to place the call. */
export async function openEmergencyDialer(emergencyNumber: string): Promise<boolean> {
  const url = `tel:${emergencyNumber}`;
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) return false;
  await Linking.openURL(url);
  return true;
}
