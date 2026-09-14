import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { STORAGE_KEYS } from '../config/constants';
import { setJson } from '../services/storage';
import { ensureCoreSensorPermissions } from '../sensors/permissions';

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

      <Text style={styles.paragraph}>{t('onboarding.p1')}</Text>

      <Text style={styles.paragraph}>{t('onboarding.p2')}</Text>

      <Text style={styles.paragraph}>{t('onboarding.p3')}</Text>

      <Text style={styles.paragraph}>{t('onboarding.p4')}</Text>

      <TouchableOpacity style={styles.button} onPress={handleContinue} disabled={requesting}>
        <Text style={styles.buttonText}>
          {requesting ? t('onboarding.requestingPermissions') : t('onboarding.continueButton')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 20 },
  paragraph: { fontSize: 15, lineHeight: 22, color: '#ccc', marginBottom: 16 },
  button: { backgroundColor: '#2f6fed', paddingVertical: 16, borderRadius: 12, marginTop: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
