import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { STORAGE_KEYS } from '../config/constants';
import { getJson, setJson } from '../services/storage';
import { emergencyNumberForRegion } from '../config/emergencyNumbers';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../passed';
import { saveLanguage } from '../services/language';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors, radii, spacing } from '../theme';

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
    <ScreenContainer scroll={false} contentStyle={styles.content}>
      <Text style={styles.label}>{t('settings.regionLabel')}</Text>
      <TextInput
        style={styles.input}
        value={region}
        onChangeText={handleChange}
        placeholder={t('settings.regionPlaceholder')}
        placeholderTextColor={colors.textMuted}
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  label: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, fontSize: 18, padding: 14, borderRadius: radii.sm },
  hint: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  languageLabel: { marginTop: spacing.lg - 2 },
  languageRow: { flexDirection: 'row', gap: 10 },
  languageChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  languageChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  languageChipText: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  languageChipTextActive: { color: colors.textPrimary },
});
