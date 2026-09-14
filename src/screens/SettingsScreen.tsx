import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { STORAGE_KEYS } from '../config/constants';
import { getJson, setJson } from '../services/storage';
import { emergencyNumberForRegion } from '../config/emergencyNumbers';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../passed';
import { saveLanguage } from '../services/language';

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const [region, setRegion] = useState('');

  useEffect(() => {
    getJson<string>(STORAGE_KEYS.emergencyRegion, '').then(setRegion);
  }, []);

  const handleChange = async (value: string) => {
    const upper = value.toUpperCase().slice(0, 2);
    setRegion(upper);
    await setJson(STORAGE_KEYS.emergencyRegion, upper);
  };

  const handleLanguageChange = async (code: LanguageCode) => {
    await i18n.changeLanguage(code);
    await saveLanguage(code);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('settings.regionLabel')}</Text>
      <TextInput
        style={styles.input}
        value={region}
        onChangeText={handleChange}
        placeholder={t('settings.regionPlaceholder')}
        placeholderTextColor="#666"
        autoCapitalize="characters"
        maxLength={2}
      />
      <Text style={styles.hint}>{t('settings.regionHint', { number: emergencyNumberForRegion(region) })}</Text>

      <Text style={[styles.label, styles.languageLabel]}>{t('settings.languageLabel')}</Text>
      <View style={styles.languageRow}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.languageChip, i18n.language === lang.code && styles.languageChipActive]}
            onPress={() => handleLanguageChange(lang.code)}
          >
            <Text style={[styles.languageChipText, i18n.language === lang.code && styles.languageChipTextActive]}>
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 24, paddingTop: 64, gap: 12 },
  label: { color: '#fff', fontSize: 15, fontWeight: '700' },
  input: { backgroundColor: '#1c1c1c', color: '#fff', fontSize: 18, padding: 14, borderRadius: 10 },
  hint: { color: '#999', fontSize: 13, lineHeight: 19 },
  languageLabel: { marginTop: 16 },
  languageRow: { flexDirection: 'row', gap: 10 },
  languageChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#333',
  },
  languageChipActive: { backgroundColor: '#2f6fed', borderColor: '#2f6fed' },
  languageChipText: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  languageChipTextActive: { color: '#fff' },
});
