import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { RootNavigator } from './navigation/RootNavigator';
import { MonitorProvider } from './services/monitorContext';
import { OnboardingDisclaimerScreen } from './screens/OnboardingDisclaimerScreen';
import { STORAGE_KEYS } from './config/constants';
import { getJson } from './services/storage';
import i18n from './i18n';
import { getSavedLanguage } from './services/language';

export default function App() {
  const [acknowledged, setAcknowledged] = useState<boolean | null>(null);

  useEffect(() => {
    getJson<boolean>(STORAGE_KEYS.disclaimerAcknowledged, false).then(setAcknowledged);
    // i18n itself initializes synchronously with English resources already
    // bundled (see src/i18n/index.ts), so there's no loading-state to gate
    // on here — this just applies a previously saved choice, if any, on
    // top of that default once the async storage read resolves.
    getSavedLanguage().then((lang) => {
      if (lang !== i18n.language) i18n.changeLanguage(lang);
    });
  }, []);

  if (acknowledged === null) {
    return <View style={{ flex: 1, backgroundColor: '#111' }} />;
  }

  if (!acknowledged) {
    return (
      <SafeAreaProvider>
        <OnboardingDisclaimerScreen onAcknowledged={() => setAcknowledged(true)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <MonitorProvider>
        <RootNavigator />
      </MonitorProvider>
    </SafeAreaProvider>
  );
}
