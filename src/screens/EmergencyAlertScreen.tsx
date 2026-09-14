import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { ProgressBar } from '../components/ProgressBar';
import { useMonitor } from '../services/monitorContext';
import { listContacts } from '../services/emergencyContacts';
import {
  buildAlertMessage,
  Coordinates,
  getCurrentLocation,
  openEmergencyDialer,
  openSmsComposer,
  startCountdown,
} from '../services/alertService';
import { emergencyNumberForRegion } from '../config/emergencyNumbers';
import { EMERGENCY_ALERT_COUNTDOWN_MS } from '../config/constants';
import { getJson } from '../services/storage';
import { STORAGE_KEYS } from '../config/constants';
import { EmergencyContact } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'EmergencyAlert'>;

export function EmergencyAlertScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const monitor = useMonitor();
  const { triage } = route.params;
  const [remainingMs, setRemainingMs] = useState(EMERGENCY_ALERT_COUNTDOWN_MS);
  const [status, setStatus] = useState<'counting' | 'sent' | 'cancelled'>('counting');
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [emergencyNumber, setEmergencyNumber] = useState('112');
  const countdownRef = useRef<ReturnType<typeof startCountdown> | null>(null);

  useEffect(() => {
    listContacts().then(setContacts);
    getCurrentLocation().then(setLocation);
    getJson<string>(STORAGE_KEYS.emergencyRegion, '').then((region) =>
      setEmergencyNumber(emergencyNumberForRegion(region))
    );
  }, []);

  useEffect(() => {
    countdownRef.current = startCountdown(
      EMERGENCY_ALERT_COUNTDOWN_MS,
      (remaining) => setRemainingMs(remaining),
      () => notifyContacts()
    );
    return () => countdownRef.current?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notifyContacts = async () => {
    const message = buildAlertMessage(location);
    if (contacts.length > 0) {
      await openSmsComposer(contacts, message);
    }
    setStatus('sent');
  };

  const handleCancel = () => {
    countdownRef.current?.cancel();
    setStatus('cancelled');
    monitor.respondToCheckIn();
    navigation.popToTop();
  };

  const handleCallNow = () => {
    countdownRef.current?.cancel();
    openEmergencyDialer(emergencyNumber);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('emergencyAlert.title')}</Text>
      <Text style={styles.reasons}>{triage.reasons.join('. ')}.</Text>

      {status === 'counting' && (
        <>
          <Text style={styles.countdown}>{Math.ceil(remainingMs / 1000)}s</Text>
          <ProgressBar fraction={1 - remainingMs / EMERGENCY_ALERT_COUNTDOWN_MS} />
          <Text style={styles.body}>
            {contacts.length > 0
              ? t('emergencyAlert.countdownBodyWithCount', { count: contacts.length })
              : t('emergencyAlert.countdownBodyNoCount')}
          </Text>
        </>
      )}

      {status === 'sent' && (
        <Text style={styles.body}>{t('emergencyAlert.sentBody', { number: emergencyNumber })}</Text>
      )}

      <TouchableOpacity style={styles.callButton} onPress={handleCallNow}>
        <Text style={styles.callButtonText}>{t('emergencyAlert.callNow', { number: emergencyNumber })}</Text>
      </TouchableOpacity>

      {status === 'counting' && (
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>{t('emergencyAlert.cancelSafe')}</Text>
        </TouchableOpacity>
      )}

      {status === 'sent' && (
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.popToTop()}>
          <Text style={styles.cancelButtonText}>{t('emergencyAlert.backToHome')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2b0d0d', padding: 24, paddingTop: 72, gap: 18 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  reasons: { color: '#ffd6d6', fontSize: 14 },
  countdown: { color: '#fff', fontSize: 64, fontWeight: '900', textAlign: 'center' },
  body: { color: '#ffe3e3', fontSize: 15, lineHeight: 21 },
  callButton: { backgroundColor: '#fff', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  callButtonText: { color: '#a11d1d', fontSize: 17, fontWeight: '800' },
  cancelButton: { borderColor: '#fff', borderWidth: 1.5, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
