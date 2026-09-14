import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useMonitor } from '../services/monitorContext';

type Props = NativeStackScreenProps<RootStackParamList, 'HeartAttackScreening'>;

export function HeartAttackScreeningScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const monitor = useMonitor();
  const { latestPulse, isPassiveMonitoringOn } = monitor;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>{t('heartAttack.intro')}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('heartAttack.lastPulseReading.title')}</Text>
        <Text style={styles.cardBody}>
          {latestPulse?.bpm
            ? t('heartAttack.lastPulseReading.value', { bpm: latestPulse.bpm, quality: latestPulse.quality })
            : t('heartAttack.lastPulseReading.empty')}
        </Text>
      </View>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('ActiveCheck')}>
        <Text style={styles.secondaryButtonText}>{t('heartAttack.runActiveCheck.title')}</Text>
        <Text style={styles.secondaryButtonSubtext}>{t('heartAttack.runActiveCheck.subtitle')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('PallorCheck')}>
        <Text style={styles.secondaryButtonText}>{t('heartAttack.pallorCheck.title')}</Text>
        <Text style={styles.secondaryButtonSubtext}>{t('heartAttack.pallorCheck.subtitle')}</Text>
      </TouchableOpacity>

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>{t('heartAttack.passiveMonitoring.title')}</Text>
          <Text style={styles.toggleSubtitle}>{t('heartAttack.passiveMonitoring.subtitle')}</Text>
        </View>
        <Switch
          value={isPassiveMonitoringOn}
          onValueChange={(v) => (v ? monitor.startPassiveMonitoring() : monitor.stopPassiveMonitoring())}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  content: { padding: 24, paddingBottom: 48, gap: 18 },
  intro: { color: '#999', fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: '#1c1c1c', borderRadius: 14, padding: 18 },
  cardTitle: { color: '#999', fontSize: 13, marginBottom: 6 },
  cardBody: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#1c1c1c', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#333' },
  secondaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  secondaryButtonSubtext: { color: '#999', fontSize: 13, marginTop: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c1c1c', borderRadius: 14, padding: 16 },
  toggleTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  toggleSubtitle: { color: '#999', fontSize: 12, marginTop: 2 },
});
