import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { ActionCard } from '../components/ActionCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'StrokeScreening'>;

export function StrokeScreeningScreen({ navigation }: Props) {
  const { t } = useTranslation();

  return (
    <ScreenContainer>
      <Text style={styles.intro}>{t('stroke.intro')}</Text>

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
});
