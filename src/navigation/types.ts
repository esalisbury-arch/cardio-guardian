import { TriageResult } from '../types';

export type RootStackParamList = {
  Home: undefined;
  HeartAttackScreening: undefined;
  StrokeScreening: undefined;
  ActiveCheck: undefined;
  StrokeCheck: undefined;
  FaceCheck: undefined;
  SpeechCheck: undefined;
  EmergencyAlert: { triage: TriageResult };
  Settings: undefined;
  EmergencyContacts: undefined;
  History: undefined;
  NearbyHospitals: undefined;
  PallorCheck: undefined;
};
