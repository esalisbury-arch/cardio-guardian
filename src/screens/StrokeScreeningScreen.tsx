import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { clearSymptomOnset, getSymptomOnset, setSymptomOnsetNow } from '../services/symptomTimer';

type Props = NativeStackScreenProps<RootStackParamList, 'StrokeScreening'>;

/** HH:MM:SS — deliberately digits-and-colons only, no words, so it needs no translation and reads like a stopwatch. */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function StrokeScreeningScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [onset, setOnset] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    getSymptomOnset().then(setOnset);
  }, []);

  useEffect(() => {
    if (onset === null) return;
    // Elapsed is always recomputed from the stored onset timestamp, never
    // incremented locally — so it can't drift even if this screen (or the
    // whole app) was backgrounded for hours between ticks.
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [onset]);

  const handleStart = async () => {
    const startedAt = await setSymptomOnsetNow();
    setOnset(startedAt);
    setNow(Date.now());
  };

  const handleReset = () => {
    Alert.alert(t('stroke.timer.resetConfirmTitle'), t('stroke.timer.resetConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('stroke.timer.resetButton'),
        style: 'destructive',
        onPress: async () => {
          await clearSymptomOnset();
          setOnset(null);
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>{t('stroke.intro')}</Text>

      {onset === null ? (
        <View style={styles.timerCard}>
          <Text style={styles.timerTitle}>{t('stroke.timer.title')}</Text>
          <Text style={styles.timerSubtitle}>{t('stroke.timer.subtitle')}</Text>
          <Text style={styles.timerBody}>{t('stroke.timer.notStartedBody')}</Text>
          <TouchableOpacity style={styles.timerStartButton} onPress={handleStart}>
            <Text style={styles.timerStartButtonText}>{t('stroke.timer.startButton')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.timerCardActive}>
          <Text style={styles.timerTitleActive}>{t('stroke.timer.title')}</Text>
          <Text style={styles.timerElapsedLabel}>{t('stroke.timer.elapsedLabel')}</Text>
          <Text style={styles.timerElapsed}>{formatElapsed(now - onset)}</Text>
          <Text style={styles.timerHint}>{t('stroke.timer.elapsedHint')}</Text>
          <TouchableOpacity style={styles.timerResetButton} onPress={handleReset}>
            <Text style={styles.timerResetButtonText}>{t('stroke.timer.resetButton')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('FaceCheck')}>
        <Text style={styles.secondaryButtonText}>{t('stroke.faceCheck.title')}</Text>
        <Text style={styles.secondaryButtonSubtext}>{t('stroke.faceCheck.subtitle')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('StrokeCheck')}>
        <Text style={styles.secondaryButtonText}>{t('stroke.fingerTap.title')}</Text>
        <Text style={styles.secondaryButtonSubtext}>{t('stroke.fingerTap.subtitle')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('SpeechCheck')}>
        <Text style={styles.secondaryButtonText}>{t('stroke.speechCheck.title')}</Text>
        <Text style={styles.secondaryButtonSubtext}>{t('stroke.speechCheck.subtitle')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  content: { padding: 24, paddingBottom: 48, gap: 18 },
  intro: { color: '#999', fontSize: 13, lineHeight: 19 },
  secondaryButton: { backgroundColor: '#1c1c1c', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#333' },
  secondaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  secondaryButtonSubtext: { color: '#999', fontSize: 13, marginTop: 4 },
  timerCard: { backgroundColor: '#1c1c1c', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#333', gap: 10 },
  timerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  timerSubtitle: { color: '#7fa8ff', fontSize: 13, fontWeight: '600' },
  timerBody: { color: '#ccc', fontSize: 14, lineHeight: 20 },
  timerStartButton: { backgroundColor: '#2f6fed', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  timerStartButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  timerCardActive: { backgroundColor: '#3a1414', borderRadius: 14, padding: 20, gap: 6, alignItems: 'center' },
  timerTitleActive: { color: '#ffd6d6', fontSize: 18, fontWeight: '800', alignSelf: 'flex-start' },
  timerElapsedLabel: { color: '#ffb3b3', fontSize: 13, fontWeight: '600', marginTop: 4 },
  timerElapsed: { color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: 1 },
  timerHint: { color: '#ffe3e3', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 4 },
  timerResetButton: { borderColor: '#fff', borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12, marginTop: 10, alignSelf: 'stretch', alignItems: 'center' },
  timerResetButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
