// App-wide localization. Deliberately pure-JS (i18next + react-i18next, no
// native module like react-native-localize) — this project's native build
// has already proven fragile (see README's native-plugin notes), so device
// locale auto-detection isn't worth the added native-linking risk. Language
// is instead an explicit user choice, persisted via
// src/services/language.ts and set through Settings.
//
// SCOPE NOTE: this covers all static UI chrome — every screen's titles,
// buttons, instructions, and disclaimers, plus the Speech Check test phrase
// itself (src/i18n/locales/*.json: speechCheck.testPhrase). It does NOT
// (yet) cover the dynamic "reasons" sentences returned by the pure-logic
// signal modules (src/signal/*.ts) — those stay English-only for now. Those
// modules are deliberately RN-free, framework-agnostic TypeScript (see
// README's "Project layout" section), and threading translation keys
// through their return types and unit tests is a larger, separate change.
//
// LANGUAGE-SPECIFIC ACCURACY NOTE: the English Speech Check phrase is the
// actual, validated Cincinnati Prehospital Stroke Scale sentence. Other
// languages' phrases (e.g. Spanish: "Loro viejo no aprende a hablar", an
// idiomatic parallel to the English "you can't teach an old dog new
// tricks") were chosen for natural cadence and similar meaning, but have
// NOT been independently verified against a validated stroke scale in that
// language — review before relying on them clinically, same as every other
// heuristic in this app (see README's Medical & safety disclaimer).

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false }, // React already escapes; avoids double-escaping accented characters
  returnNull: false,
});

export default i18n;
