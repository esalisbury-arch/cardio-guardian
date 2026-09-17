import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { clearSymptomOnset, getSymptomOnset, setSymptomOnsetNow } from '../services/symptomTimer';
import { ActionCard } from '../components/ActionCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors, radii, spacing, typography } from '../theme';

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
    <ScreenContainer>
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

      <ActionCard
        icon="🙂"
        title={t('stroke.faceCheck.title')}
        subtitle={t('stroke.faceCheck.subtitle')}
        onPress={() => navigation.navigate('FaceCheck')}
      />
      <ActionCard
        icon="👆"
        title={t('stroke.fingerTap.title')}
        subtitle={t('stroke.fingerTap.subtitle')}
        onPress={() => navigation.navigate('StrokeCheck')}
      />
      <ActionCard
        icon="🗣️"
        title={t('stroke.speechCheck.title')}
        subtitle={t('stroke.speechCheck.subtitle')}
        onPress={() => navigation.navigate('SpeechCheck')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  intro: { ...typography.intro, color: colors.textSecondary },
  timerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl - 4,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: spacing.sm,
  },
  timerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  timerSubtitle: { color: colors.primaryMuted, fontSize: 13, fontWeight: '600' },
  timerBody: { color: '#ccc', fontSize: 14, lineHeight: 20 },
  timerStartButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  timerStartButtonText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 15 },
  timerCardActive: {
    backgroundColor: colors.dangerSurface,
    borderRadius: radii.lg,
    padding: spacing.xl - 4,
    gap: 6,
    alignItems: 'center',
  },
  timerTitleActive: { color: colors.dangerText, fontSize: 18, fontWeight: '800', alignSelf: 'flex-start' },
  timerElapsedLabel: { color: '#ffb3b3', fontSize: 13, fontWeight: '600', marginTop: spacing.xs },
  timerElapsed: { color: colors.textPrimary, fontSize: 44, fontWeight: '900', letterSpacing: 1 },
  timerHint: { color: colors.dangerTextSoft, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: spacing.xs },
  timerResetButton: {
    borderColor: colors.textPrimary,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  timerResetButtonText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
});
