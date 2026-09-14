import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useFaceLandmarkCamera, ensureCameraReady } from '../sensors/faceLandmarkCamera';
import { aggregateFaceSymmetry } from '../signal/faceSymmetryAnalysis';
import { RiskBadge } from '../components/RiskBadge';
import { ProgressBar } from '../components/ProgressBar';
import { appendHistoryEntry, makeHistoryId } from '../services/history';
import { FACE_CHECK_DURATION_MS } from '../config/constants';
import { FaceLandmarkFrame, FaceSymmetryResult } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'FaceCheck'>;

type Phase = 'requesting-permission' | 'no-permission' | 'checking' | 'done';

export function FaceCheckScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('requesting-permission');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<FaceSymmetryResult | null>(null);

  const framesRef = useRef<FaceLandmarkFrame[]>([]);

  const handleFrame = (frame: FaceLandmarkFrame) => {
    framesRef.current.push(frame);
  };

  const { device, frameProcessor } = useFaceLandmarkCamera(handleFrame);

  useEffect(() => {
    ensureCameraReady().then((granted) => setPhase(granted ? 'checking' : 'no-permission'));
  }, []);

  useEffect(() => {
    // Also gate on `device`: without it there's no real camera frame ever
    // coming in, so this would otherwise still fire on a timer and silently
    // write a meaningless "not enough signal" entry to history purely
    // because time passed, not because a check actually ran.
    if (phase !== 'checking' || !device) return;
    framesRef.current = [];
    const startedAt = Date.now();

    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setElapsedMs(elapsed);

      if (elapsed >= FACE_CHECK_DURATION_MS) {
        clearInterval(tick);
        const faceResult = aggregateFaceSymmetry(framesRef.current);
        setResult(faceResult);
        setPhase('done');
        appendHistoryEntry({
          id: makeHistoryId(),
          type: 'face',
          timestamp: Date.now(),
          level: faceResult.level,
          asymmetryScore: faceResult.reliable ? faceResult.asymmetryScore : null,
          reliable: faceResult.reliable,
        }).catch((err) => console.warn('[history] failed to save Face Check result', err));
      }
    }, 100);

    return () => clearInterval(tick);
  }, [phase, device]);

  if (phase === 'no-permission') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('faceCheck.noPermissionMessage')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'requesting-permission') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('common.preparingCamera')}</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('faceCheck.noCameraMessage')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'done' && result) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t('common.results')}</Text>
        <RiskBadge level={result.level} />
        {!result.reliable ? (
          <Text style={styles.message}>{result.reasons[0]}</Text>
        ) : (
          <>
            <Text style={styles.message}>{result.reasons.join('. ')}.</Text>
            <Text style={styles.detail}>
              {t('faceCheck.detail', { mouth: result.mouthAsymmetry.toFixed(3), eye: result.eyeAsymmetry.toFixed(3) })}
            </Text>
          </>
        )}
        <Text style={styles.disclaimer}>{t('faceCheck.disclaimer')}</Text>
        {result.reliable ? (
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>{t('common.done')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={() => setPhase('checking')}>
            <Text style={styles.buttonText}>{t('common.tryAgain')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive frameProcessor={frameProcessor} />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.faceGuide} />
      </View>
      <View style={styles.bottomBar}>
        <Text style={styles.instruction}>{t('faceCheck.instruction')}</Text>
        <ProgressBar fraction={elapsedMs / FACE_CHECK_DURATION_MS} color="#2f6fed" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  faceGuide: {
    width: 220,
    height: 280,
    borderRadius: 140,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: 'rgba(0,0,0,0.55)', gap: 14 },
  instruction: { color: '#fff', fontSize: 15, textAlign: 'center' },
  center: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff' },
  message: { color: '#ccc', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  detail: { color: '#999', fontSize: 13 },
  disclaimer: { color: '#888', fontSize: 12, textAlign: 'center', marginTop: 8 },
  button: { backgroundColor: '#2f6fed', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
