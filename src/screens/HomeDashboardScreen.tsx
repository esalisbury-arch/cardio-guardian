import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { RiskBadge } from '../components/RiskBadge';
import { useMonitor } from '../services/monitorContext';
import { CHECK_IN_PROMPT_TIMEOUT_MS } from '../config/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeDashboardScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const monitor = useMonitor();

  useEffect(() => {
    return monitor.onCriticalAlert((triage) => {
      navigation.navigate('EmergencyAlert', { triage });
    });
  }, [monitor, navigation]);

  const { triage, awaitingCheckIn } = monitor;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{t('home.heading')}</Text>
      <RiskBadge level={triage.level} />

      {awaitingCheckIn && (
        <View style={styles.checkInBox}>
          <Text style={styles.checkInTitle}>{t('home.checkIn.title')}</Text>
          <Text style={styles.checkInBody}>
            {t('home.checkIn.body', { seconds: Math.round(CHECK_IN_PROMPT_TIMEOUT_MS / 1000) })}
          </Text>
          <TouchableOpacity style={styles.imOkButton} onPress={monitor.respondToCheckIn}>
            <Text style={styles.imOkButtonText}>{t('home.checkIn.imOk')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.quickActionsGrid}>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('History')}>
            <View style={[styles.quickActionIconBadge, { backgroundColor: 'rgba(47,111,237,0.18)' }]}>
              <Text style={styles.quickActionIcon}>🕘</Text>
            </View>
            <Text style={styles.quickActionText}>{t('home.quickActions.history')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('NearbyHospitals')}>
            <View style={[styles.quickActionIconBadge, { backgroundColor: 'rgba(31,111,67,0.35)' }]}>
              <Text style={styles.quickActionIcon}>🏥</Text>
            </View>
            <Text style={styles.quickActionText}>{t('home.quickActions.nearbyHospitals')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('EmergencyContacts')}>
            <View style={[styles.quickActionIconBadge, { backgroundColor: 'rgba(161,29,29,0.25)' }]}>
              <Text style={styles.quickActionIcon}>🚨</Text>
            </View>
            <Text style={styles.quickActionText}>{t('home.quickActions.emergencyContacts')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Settings')}>
            <View style={[styles.quickActionIconBadge, { backgroundColor: 'rgba(153,153,153,0.18)' }]}>
              <Text style={styles.quickActionIcon}>⚙️</Text>
            </View>
            <Text style={styles.quickActionText}>{t('home.quickActions.settings')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('HeartAttackScreening')}>
        <Text style={styles.secondaryButtonText}>{t('home.heartAttackScreening.title')}</Text>
        <Text style={styles.secondaryButtonSubtext}>{t('home.heartAttackScreening.subtitle')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('StrokeScreening')}>
        <Text style={styles.secondaryButtonText}>{t('home.strokeScreening.title')}</Text>
        <Text style={styles.secondaryButtonSubtext}>{t('home.strokeScreening.subtitle')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48, gap: 18 },
  heading: { fontSize: 26, fontWeight: '800', color: '#fff' },
  checkInBox: { backgroundColor: '#3a2410', borderRadius: 14, padding: 18, gap: 10 },
  checkInTitle: { color: '#ffce9e', fontSize: 17, fontWeight: '700' },
  checkInBody: { color: '#ffe6c9', fontSize: 14, lineHeight: 20 },
  imOkButton: { backgroundColor: '#ffb86b', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  imOkButtonText: { color: '#1a1000', fontWeight: '800', fontSize: 15 },
  secondaryButton: { backgroundColor: '#1c1c1c', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#333' },
  secondaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  secondaryButtonSubtext: { color: '#999', fontSize: 13, marginTop: 4 },
  quickActionsGrid: { gap: 8 },
  quickActionsRow: { flexDirection: 'row', gap: 8 },
  quickAction: {
    flex: 1,
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickActionIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIcon: { fontSize: 14 },
  quickActionText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
