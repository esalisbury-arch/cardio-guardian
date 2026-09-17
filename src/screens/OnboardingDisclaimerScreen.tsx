import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { STORAGE_KEYS } from '../config/constants';
import { setJson } from '../services/storage';
import { ensureCoreSensorPermissions } from '../sensors/permissions';
import { colors, radii, spacing, NO_HEADER_TOP_PADDING } from '../theme';

// Each onboarding paragraph gets a small leading icon and its own card —
// same four sentences as before (still one translation key per paragraph,
// no content change), just broken into visually distinct, scannable
// sections instead of one unbroken wall of text.
const SECTIONS: { icon: string; key: 'p1' | 'p2' | 'p3' | 'p4' }[] = [
  { icon: '📋', key: 'p1' },
  { icon: '🚑', key: 'p2' },
  { icon: '🔐', key: 'p3' },
  { icon: '📵', key: 'p4' },
];

export function OnboardingDisclaimerScreen({ onAcknowledged }: { onAcknowledged: () => void }) {
  const { t } = useTranslation();
  const [requesting, setRequesting] = useState(false);

  const handleContinue = async () => {
    setRequesting(true);
    await ensureCoreSensorPermissions();
    await setJson(STORAGE_KEYS.disclaimerAcknowledged, true);
    setRequesting(false);
    onAcknowledged();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('onboarding.title')}</Text>

      {SECTIONS.map(({ icon, key }) => (
        <View key={key} style={styles.section}>
          <Text style={styles.sectionIcon}>{icon}</Text>
          <Text style={styles.paragraph}>{t(`onboarding.${key}`)}</Text>
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={handleContinue} disabled={requesting}>
        <Text style={styles.buttonText}>
          {requesting ? t('onboarding.requestingPermissions') : t('onboarding.continueButton')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: NO_HEADER_TOP_PADDING, paddingBottom: spacing.xl * 2, gap: spacing.md },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  section: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  sectionIcon: { fontSize: 20 },
  paragraph: { flex: 1, fontSize: 14, lineHeight: 21, color: '#ccc' },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  buttonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '700' },
});
