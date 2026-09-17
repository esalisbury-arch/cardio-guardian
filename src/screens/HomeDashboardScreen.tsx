import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { RiskBadge } from '../components/RiskBadge';
import { ActionCard } from '../components/ActionCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { useMonitor } from '../services/monitorContext';
import { colors, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeDashboardScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { triage } = useMonitor();

  return (
    <ScreenContainer noHeader>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{t('home.heading')}</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>
      <RiskBadge level={triage.level} />

      {/* The two screenings are this app's entire reason to exist — they get
          top billing, ahead of the utility links below (History, Nearby
          Hospitals, Emergency Contacts), which used to sit above them. */}
      <View style={styles.primaryGroup}>
        <ActionCard
          icon="❤️"
          title={t('home.heartAttackScreening.title')}
          subtitle={t('home.heartAttackScreening.subtitle')}
          onPress={() => navigation.navigate('HeartAttackScreening')}
        />
        <ActionCard
          icon="🧠"
          title={t('home.strokeScreening.title')}
          subtitle={t('home.strokeScreening.subtitle')}
          onPress={() => navigation.navigate('StrokeScreening')}
        />
      </View>

      <View style={styles.resourcesSection}>
        <Text style={styles.sectionLabel}>{t('home.resourcesLabel')}</Text>
        <View style={styles.resourcesRow}>
          <TouchableOpacity style={styles.resource} onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
            <Text style={styles.resourceIcon}>🕘</Text>
            <Text style={styles.resourceText}>{t('home.quickActions.history')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resource}
            onPress={() => navigation.navigate('NearbyHospitals')}
            activeOpacity={0.7}
          >
            <Text style={styles.resourceIcon}>🏥</Text>
            <Text style={styles.resourceText}>{t('home.quickActions.nearbyHospitals')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resource}
            onPress={() => navigation.navigate('EmergencyContacts')}
            activeOpacity={0.7}
          >
            <Text style={styles.resourceIcon}>🚨</Text>
            <Text style={styles.resourceText}>{t('home.quickActions.emergencyContacts')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { ...typography.title, color: colors.textPrimary },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { fontSize: 16 },
  primaryGroup: { gap: spacing.md },
  resourcesSection: { gap: spacing.sm, marginTop: spacing.sm },
  sectionLabel: { ...typography.sectionLabel, color: colors.textSecondary },
  resourcesRow: { flexDirection: 'row', gap: spacing.sm },
  resource: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorderSubtle,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  resourceIcon: { fontSize: 18 },
  resourceText: { color: colors.textPrimary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
