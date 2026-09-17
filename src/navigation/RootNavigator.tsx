import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from './types';
import { HomeDashboardScreen } from '../screens/HomeDashboardScreen';
import { ActiveCheckScreen } from '../screens/ActiveCheckScreen';
import { StrokeCheckScreen } from '../screens/StrokeCheckScreen';
import { FaceCheckScreen } from '../screens/FaceCheckScreen';
import { SpeechCheckScreen } from '../screens/SpeechCheckScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { EmergencyContactsScreen } from '../screens/EmergencyContactsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { NearbyHospitalsScreen } from '../screens/NearbyHospitalsScreen';
import { PallorCheckScreen } from '../screens/PallorCheckScreen';
import { HeartAttackScreeningScreen } from '../screens/HeartAttackScreeningScreen';
import { StrokeScreeningScreen } from '../screens/StrokeScreeningScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  // Reading `t` here (rather than passing static strings) is what makes
  // these header titles re-render when the language changes — react-i18next
  // subscribes any component using useTranslation() to language-change
  // events, and this component owns all of them.
  const { t } = useTranslation();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#111' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#111' },
          // Without this, iOS's native-stack falls back to the literal,
          // untranslated word "Back" whenever the previous screen's title is
          // too long to fit next to the chevron (e.g. Spanish's longer
          // screen titles) — this keeps the back button itself localized
          // regardless of how long the previous title is.
          headerBackTitle: t('common.back'),
        }}
      >
        <Stack.Screen name="Home" component={HomeDashboardScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="HeartAttackScreening"
          component={HeartAttackScreeningScreen}
          options={{ title: t('home.heartAttackScreening.title') }}
        />
        <Stack.Screen
          name="StrokeScreening"
          component={StrokeScreeningScreen}
          options={{ title: t('home.strokeScreening.title') }}
        />
        <Stack.Screen name="ActiveCheck" component={ActiveCheckScreen} options={{ title: t('heartAttack.runActiveCheck.title') }} />
        <Stack.Screen name="StrokeCheck" component={StrokeCheckScreen} options={{ title: t('stroke.fingerTap.title') }} />
        <Stack.Screen name="FaceCheck" component={FaceCheckScreen} options={{ title: t('stroke.faceCheck.title') }} />
        <Stack.Screen name="SpeechCheck" component={SpeechCheckScreen} options={{ title: t('stroke.speechCheck.title') }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('home.quickActions.settings') }} />
        <Stack.Screen
          name="EmergencyContacts"
          component={EmergencyContactsScreen}
          options={{ title: t('emergencyContacts.heading') }}
        />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: t('home.quickActions.history') }} />
        <Stack.Screen
          name="NearbyHospitals"
          component={NearbyHospitalsScreen}
          options={{ title: t('home.quickActions.nearbyHospitals') }}
        />
        <Stack.Screen name="PallorCheck" component={PallorCheckScreen} options={{ title: t('heartAttack.pallorCheck.title') }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
