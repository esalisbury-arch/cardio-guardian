import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Coordinates, getCurrentLocation, openEmergencyDialer } from '../services/alertService';
import { openHospitalSearch } from '../services/hospitalLookup';
import { emergencyNumberForRegion } from '../config/emergencyNumbers';
import { getJson } from '../services/storage';
import { STORAGE_KEYS } from '../config/constants';
import { ActionCard } from '../components/ActionCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors, radii, spacing } from '../theme';

type LocationStatus = 'loading' | 'found' | 'unavailable';

export function NearbyHospitalsScreen() {
  const { t } = useTranslation();
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('loading');
  const [emergencyNumber, setEmergencyNumber] = useState('112');

  useEffect(() => {
    getCurrentLocation().then((loc) => {
      setLocation(loc);
      setLocationStatus(loc ? 'found' : 'unavailable');
    });
    getJson<string>(STORAGE_KEYS.emergencyRegion, '').then((region) => setEmergencyNumber(emergencyNumberForRegion(region)));
  }, []);

  const handleSearch = async (kind: 'emergencyRoom' | 'cardiovascular') => {
    const opened = await openHospitalSearch(location, kind);
    if (!opened) {
      Alert.alert(t('nearbyHospitals.couldNotOpenMapsTitle'), t('nearbyHospitals.couldNotOpenMapsBody'));
    }
  };

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.emergencyBox}>
        <Text style={styles.emergencyTitle}>{t('nearbyHospitals.emergencyTitle')}</Text>
        <Text style={styles.emergencyBody}>{t('nearbyHospitals.emergencyBody', { number: emergencyNumber })}</Text>
        <TouchableOpacity style={styles.callButton} onPress={() => openEmergencyDialer(emergencyNumber)}>
          <Text style={styles.callButtonText}>{t('nearbyHospitals.callNow', { number: emergencyNumber })}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.locationStatus}>
        {locationStatus === 'loading' && t('nearbyHospitals.locationLoading')}
        {locationStatus === 'found' && t('nearbyHospitals.locationFound')}
        {locationStatus === 'unavailable' && t('nearbyHospitals.locationUnavailable')}
      </Text>

      <ActionCard
        icon="🚑"
        variant="primary"
        title={t('nearbyHospitals.nearestER.title')}
        subtitle={t('nearbyHospitals.nearestER.subtitle')}
        onPress={() => handleSearch('emergencyRoom')}
      />
      <ActionCard
        icon="🏥"
        title={t('nearbyHospitals.nearestCardio.title')}
        subtitle={t('nearbyHospitals.nearestCardio.subtitle')}
        onPress={() => handleSearch('cardiovascular')}
      />

      <Text style={styles.disclaimer}>{t('nearbyHospitals.disclaimer')}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  emergencyBox: { backgroundColor: colors.dangerSurface, borderRadius: radii.lg, padding: spacing.xl - 6, gap: spacing.sm },
  emergencyTitle: { color: colors.dangerText, fontSize: 16, fontWeight: '700' },
  emergencyBody: { color: colors.dangerTextSoft, fontSize: 14, lineHeight: 20 },
  callButton: { backgroundColor: colors.danger, paddingVertical: 12, borderRadius: radii.sm, alignItems: 'center' },
  callButtonText: { color: colors.textPrimary, fontWeight: '800', fontSize: 15 },
  locationStatus: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  disclaimer: { color: colors.textTertiary, fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: spacing.xs },
});
