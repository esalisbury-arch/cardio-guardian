import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useMonitor } from '../services/monitorContext';
import { ActionCard } from '../components/ActionCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors, radii, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'HeartAttackScreening'>;

export function HeartAttackScreeningScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { latestPulse } = useMonitor();

  return (
    <ScreenContainer>
      <Text style={styles.intro}>{t('heartAttack.intro')}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('heartAttack.lastPulseReading.title')}</Text>
        <Text style={styles.cardBody}>
          {latestPulse?.bpm
            ? t('heartAttack.lastPulseReading.value', { bpm: latestPulse.bpm, quality: latestPulse.quality })
            : t('heartAttack.lastPulseReading.empty')}
        </Text>
      </View>

      <ActionCard
        icon="🫀"
        title={t('heartAttack.runActiveCheck.title')}
        subtitle={t('heartAttack.runActiveCheck.subtitle')}
        onPress={() => navigation.navigate('ActiveCheck')}
      />
      <ActionCard
        icon="🩺"
        title={t('heartAttack.pallorCheck.title')}
        subtitle={t('heartAttack.pallorCheck.subtitle')}
        onPress={() => navigation.navigate('PallorCheck')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  intro: { ...typography.intro, color: colors.textSecondary },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xl - 6 },
  cardTitle: { color: colors.textSecondary, fontSize: 13, marginBottom: 6 },
  cardBody: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
});
