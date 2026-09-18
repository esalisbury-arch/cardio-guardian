export const ACTIVE_CHECK_DURATION_MS = 20_000; // finger-on-camera read duration
export const FACE_CHECK_DURATION_MS = 4_000; // front-camera facial symmetry burst
export const PALLOR_CHECK_DURATION_MS = 5_000; // front-camera skin-color burst

// The Speech Check test phrase now lives per-language in src/passed/locales/*
// (key: speechCheck.testPhrase) instead of here, so it switches with the
// app's language setting — see that directory's README note on the English
// phrase being the actual, validated Cincinnati Prehospital Stroke Scale
// sentence, and other languages' phrases being idiomatic equivalents that
// have NOT been independently verified against a clinical scale in that
// language.
// 5s was tried and measured too tight: live device logs showed the phrase
// itself takes close to 5s to say, so recognition was hitting this ceiling
// right as (or just before) the speaker finished — cutting the last word or
// two on a normal-paced read. 8s gives reliable margin.
export const SPEECH_CHECK_MAX_DURATION_MS = 8_000; // safety cutoff if recognition never ends
export const SPEECH_CHECK_GET_READY_MS = 3_000; // pause before listening starts, so it doesn't eat into speaking time
export const IRREGULARITY_FOLLOWUP_COOLDOWN_MS = 6 * 60 * 60 * 1000; // avoid nagging repeatedly in one sitting

// Cap on-device check history so AsyncStorage doesn't grow unbounded on a
// phone that runs a check every day for years. Oldest entries drop off once
// this is exceeded (see src/services/history.ts).
export const MAX_HISTORY_ENTRIES = 200;

export const STORAGE_KEYS = {
  emergencyContacts: '@veritahealth/emergency_contacts',
  emergencyRegion: '@veritahealth/emergency_region',
  disclaimerAcknowledged: '@veritahealth/disclaimer_acknowledged',
  checkHistory: '@veritahealth/check_history',
  skinToneBaseline: '@veritahealth/skin_tone_baseline',
  language: '@veritahealth/language',
} as const;
