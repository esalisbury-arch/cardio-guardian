// Persists the user's chosen app language. Same thin-wrapper pattern as
// skinToneBaseline.ts / emergencyContacts.ts. Language itself is applied by
// calling i18n.changeLanguage() (see src/passed/index.ts and SettingsScreen)
// — this module only owns remembering the choice across app launches.

import { STORAGE_KEYS } from '../config/constants';
import { DEFAULT_LANGUAGE, LanguageCode } from '../passed';
import { getJson, setJson } from './storage';

export async function getSavedLanguage(): Promise<LanguageCode> {
  return getJson<LanguageCode>(STORAGE_KEYS.language, DEFAULT_LANGUAGE);
}

export async function saveLanguage(code: LanguageCode): Promise<void> {
  await setJson(STORAGE_KEYS.language, code);
}
