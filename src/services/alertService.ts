// Emergency response actions once the triage engine returns CRITICAL.
//
// Deliberate design choice: sending an SMS or placing a call always ends
// with the OS's native compose/dial screen, which on iOS requires one final
// human tap by policy (Apple does not allow silent SMS send), and which we
// mirror on Android by default for the same reason: a false-positive CRITICAL
// triage silently texting or calling people is a worse failure mode than
// asking for one tap. The countdown below is the safety-relevant part — it
// gives an unconscious-but-recovering user (or someone nearby) a window to
// cancel — not the send/call action itself. An optional, explicitly opt-in
// Android silent-SMS path is sketched in android_native_reference/ for
// deployments that have made a considered decision to enable it (with
// appropriate consent screens, since it can text emergency contacts and
// dispatch calls without further confirmation).

import { Linking, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { EmergencyContact } from '../types';

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

export function buildAlertMessage(location: Coordinates | null): string {
  const base =
    'Verita Health alert: possible cardiac emergency detected. This person may need urgent help.';
  if (!location) return `${base} Location unavailable.`;
  const mapsUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
  return `${base} Last known location: ${mapsUrl}`;
}

/**
 * Opens the native SMS composer pre-filled with the alert message, addressed
 * to all given contacts. Requires the user (or a bystander) to tap send —
 * see module note above for why that's by design, not a limitation to work
 * around.
 */
export async function openSmsComposer(contacts: EmergencyContact[], message: string): Promise<boolean> {
  if (contacts.length === 0) return false;
  const numbers = contacts.map((c) => c.phone).join(',');
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${numbers}${separator}body=${encodeURIComponent(message)}`;
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) return false;
  await Linking.openURL(url);
  return true;
}

/** Opens the phone dialer pre-filled with the local emergency number. Requires a final tap to place the call. */
export async function openEmergencyDialer(emergencyNumber: string): Promise<boolean> {
  const url = `tel:${emergencyNumber}`;
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) return false;
  await Linking.openURL(url);
  return true;
}

export interface Countdown {
  cancel: () => void;
}

/**
 * Fires `onTick` once per second with remaining ms, then `onExpire` once the
 * duration elapses uncancelled. Returns a handle to cancel early.
 */
export function startCountdown(durationMs: number, onTick: (remainingMs: number) => void, onExpire: () => void): Countdown {
  const startedAt = Date.now();
  let cancelled = false;

  const interval = setInterval(() => {
    if (cancelled) return;
    const remaining = Math.max(0, durationMs - (Date.now() - startedAt));
    onTick(remaining);
    if (remaining <= 0) {
      clearInterval(interval);
      onExpire();
    }
  }, 1000);

  return {
    cancel: () => {
      cancelled = true;
      clearInterval(interval);
    },
  };
}
