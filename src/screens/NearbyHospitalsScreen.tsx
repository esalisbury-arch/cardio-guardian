import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Coordinates, getCurrentLocation, openEmergencyDialer } from '../services/alertService';
import { openHospitalSearch } from '../services/hospitalLookup';
import { emergencyNumberForRegion } from '../config/emergencyNumbers';
import { getJson } from '../services/storage';
import { STORAGE_KEYS } from '../config/constants';

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
    <View style={styles.container}>
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

      <TouchableOpacity style={styles.primaryButton} onPress={() => handleSearch('emergencyRoom')}>
        <Text style={styles.primaryButtonText}>{t('nearbyHospitals.nearestER.title')}</Text>
        <Text style={styles.primaryButtonSubtext}>{t('nearbyHospitals.nearestER.subtitle')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => handleSearch('cardiovascular')}>
        <Text style={styles.secondaryButtonText}>{t('nearbyHospitals.nearestCardio.title')}</Text>
        <Text style={styles.secondaryButtonSubtext}>{t('nearbyHospitals.nearestCardio.subtitle')}</Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>{t('nearbyHospitals.disclaimer')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 24, paddingTop: 32, gap: 18 },
  emergencyBox: { backgroundColor: '#3a1414', borderRadius: 14, padding: 18, gap: 10 },
  emergencyTitle: { color: '#ffd6d6', fontSize: 16, fontWeight: '700' },
  emergencyBody: { color: '#ffe3e3', fontSize: 14, lineHeight: 20 },
  callButton: { backgroundColor: '#a11d1d', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  callButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  locationStatus: { color: '#999', fontSize: 12, lineHeight: 17 },
  primaryButton: { backgroundColor: '#2f6fed', borderRadius: 14, padding: 20 },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  primaryButtonSubtext: { color: '#dce6ff', fontSize: 13, marginTop: 4 },
  secondaryButton: { backgroundColor: '#1c1c1c', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#333' },
  secondaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  secondaryButtonSubtext: { color: '#999', fontSize: 13, marginTop: 4 },
  disclaimer: { color: '#888', fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 4 },
});
