// Nearest cardiovascular-care lookup.
//
// Deliberately does not embed a hospital directory or call a Places API
// with an API key. The phone's own Maps app already has live, accurate
// hospital data (open now, distance, reviews) that a bundled static list
// could never keep current — and it avoids adding a third-party network
// dependency/API key to what is otherwise a fully on-device app. Same
// "hand off to the OS's own UI" pattern as alertService.ts's SMS composer
// and dialer: build a maps search URL and let Linking open it.
//
// Two search kinds, not one — and that split is a deliberate safety choice,
// not just a UX nicety: a real cardiac emergency should go to the NEAREST
// emergency room, full stop, not a specifically cardiac-branded facility
// that might be further away and cost time that matters. "cardiovascular"
// is for the non-emergency case — following up on a flagged (LOW) Active
// Check irregularity result with a cardiology-capable facility, not a
// call-emergency-services-now situation. See NearbyHospitalsScreen for how
// the UI keeps that distinction visible rather than presenting both as
// equivalent options.

import { Linking, Platform } from 'react-native';
import { Coordinates } from './alertService';

export type HospitalSearchKind = 'emergencyRoom' | 'cardiovascular';

const SEARCH_QUERY: Record<HospitalSearchKind, string> = {
  emergencyRoom: 'Emergency Room',
  cardiovascular: 'Cardiovascular Hospital',
};

/** Platform-native maps search URL, biased toward `location` when available. */
export function buildHospitalSearchUrl(location: Coordinates | null, kind: HospitalSearchKind): string {
  const query = SEARCH_QUERY[kind];
  if (Platform.OS === 'ios') {
    const base = `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
    return location ? `${base}&sll=${location.latitude},${location.longitude}&z=12` : base;
  }
  // Android's documented `geo:` intent scheme biases the search around
  // lat,lng when given a real fix; "0,0" with no fix just searches globally,
  // which most map apps then narrow using the device's own location anyway.
  const coords = location ? `${location.latitude},${location.longitude}` : '0,0';
  return `geo:${coords}?q=${encodeURIComponent(query)}`;
}

/** Universal web fallback (Google Maps search) for the rare case nothing on-device can open the native scheme. */
function buildWebFallbackUrl(location: Coordinates | null, kind: HospitalSearchKind): string {
  const query = SEARCH_QUERY[kind] + (location ? ` near ${location.latitude},${location.longitude}` : '');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Opens the device's maps app on a search for nearby hospitals of the given
 * kind. Returns false only if neither the native scheme nor the web
 * fallback could be opened (e.g. no browser at all) — callers should show a
 * message rather than fail silently.
 */
export async function openHospitalSearch(location: Coordinates | null, kind: HospitalSearchKind): Promise<boolean> {
  const primary = buildHospitalSearchUrl(location, kind);
  if (await Linking.canOpenURL(primary)) {
    await Linking.openURL(primary);
    return true;
  }
  const fallback = buildWebFallbackUrl(location, kind);
  if (await Linking.canOpenURL(fallback)) {
    await Linking.openURL(fallback);
    return true;
  }
  return false;
}
