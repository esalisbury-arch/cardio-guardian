// On-device history of completed checks (Active Check, Face Check, Finger
// Tap Test, Speech Check), so results build into a trend instead of
// disappearing the moment the user leaves a results screen. Same pattern as
// emergencyContacts.ts: a thin AsyncStorage-backed list behind a small API,
// with the actual trend math kept elsewhere as pure logic (see
// src/signal/historyTrends.ts) so it's unit-testable without RN.
//
// Local-only by design — nothing here is transmitted anywhere. See
// HistoryScreen's "Clear history" action for how a user wipes it, since
// it's on-device biometric screening data and should be easy to remove.

import { MAX_HISTORY_ENTRIES, STORAGE_KEYS } from '../config/constants';
import { CheckType, HistoryEntry } from '../types';
import { getJson, setJson } from './storage';

export function makeHistoryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** All entries, most recently recorded first. */
export async function listHistory(): Promise<HistoryEntry[]> {
  return getJson<HistoryEntry[]>(STORAGE_KEYS.checkHistory, []);
}

export async function listHistoryByType(type: CheckType): Promise<HistoryEntry[]> {
  const all = await listHistory();
  return all.filter((e) => e.type === type);
}

/**
 * Prepends one entry and enforces MAX_HISTORY_ENTRIES (oldest dropped
 * first). Safe to call without awaiting from a screen's result handler —
 * callers should still attach a `.catch` since AsyncStorage writes can fail
 * (e.g. disk full).
 */
export async function appendHistoryEntry(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const existing = await listHistory();
  const next = [entry, ...existing].slice(0, MAX_HISTORY_ENTRIES);
  await setJson(STORAGE_KEYS.checkHistory, next);
  return next;
}

export async function clearHistory(): Promise<void> {
  await setJson(STORAGE_KEYS.checkHistory, []);
}
