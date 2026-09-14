import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useFaceColorCamera, ensureCameraReady } from '../sensors/faceColorCamera';
import { aggregateSkinColor, comparePallor } from '../signal/facialPallorAnalysis';
import { RiskBadge } from '../components/RiskBadge';
import { ProgressBar } from '../components/ProgressBar';
import { clearSkinToneBaseline, getSkinToneBaseline, saveSkinToneBaseline } from '../services/skinToneBaseline';
import { appendHistoryEntry, makeHistoryId } from '../services/history';
import { PALLOR_CHECK_DURATION_MS } from '../config/constants';
import { PallorBaseline, PallorResult, SkinColorSample } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PallorCheck'>;

type Phase = 'requesting-permission' | 'no-permission' | 'checking' | 'done';

export function PallorCheckScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('requesting-permission');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<PallorResult | null>(null);
  // null = still loading from storage; keeps the "first time" instruction from flashing incorrectly.
  const [hasBaseline, setHasBaseline] = useState<boolean | null>(null);

  const samplesRef = useRef<SkinColorSample[]>([]);
  const baselineRef = useRef<PallorBaseline | null>(null);

  const handleSample = (sample: SkinColorSample) => {
    samplesRef.current.push(sample);
  };

  const { device, frameProcessor } = useFaceColorCamera(handleSample);

  useEffect(() => {
    ensureCameraReady().then((granted) => setPhase(granted ? 'checking' : 'no-permission'));
    getSkinToneBaseline().then((baseline) => {
      baselineRef.current = baseline;
      setHasBaseline(baseline !== null);
    });
  }, []);

  useEffect(() => {
    // Also gate on `device`: without it there's no real camera frame ever
    // coming in, so this would otherwise still fire on a timer and silently
    // write a meaningless "not enough signal" entry to history purely
    // because time passed, not because a check actually ran.
    if (phase !== 'checking' || !device) return;
    samplesRef.current = [];
    const startedAt = Date.now();

    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setElapsedMs(elapsed);

      if (elapsed >= PALLOR_CHECK_DURATION_MS) {
        clearInterval(tick);
        const pallorResult = comparePallor(baselineRef.current, samplesRef.current);
        setResult(pallorResult);
        setPhase('done');

        if (pallorResult.savedAsBaseline) {
          const aggregate = aggregateSkinColor(samplesRef.current);
          const newBaseline: PallorBaseline = { r: aggregate.r, g: aggregate.g, b: aggregate.b, capturedAt: Date.now() };
          baselineRef.current = newBaseline;
          setHasBaseline(true);
          saveSkinToneBaseline(newBaseline).catch((err) => console.warn('[skinToneBaseline] failed to save', err));
        }

        appendHistoryEntry({
          id: makeHistoryId(),
          type: 'pallor',
          timestamp: Date.now(),
          level: pallorResult.level,
          rednessDrop: pallorResult.reliable && !pallorResult.savedAsBaseline ? pallorResult.rednessDrop : null,
          reliable: pallorResult.reliable,
          savedAsBaseline: pallorResult.savedAsBaseline,
        }).catch((err) => console.warn('[history] failed to save Pallor Check result', err));
      }
    }, 100);

    return () => clearInterval(tick);
  }, [phase, device]);

  const handleRecapture = () => {
    clearSkinToneBaseline().catch((err) => console.warn('[skinToneBaseline] failed to clear', err));
    baselineRef.current = null;
    setHasBaseline(false);
    setResult(null);
    setPhase('checking');
  };

  if (phase === 'no-permission') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('pallorCheck.noPermissionMessage')}</Text>
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
        <Text style={styles.message}>{t('pallorCheck.noCameraMessage')}</Text>
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
            {!result.savedAsBaseline && (
              <Text style={styles.detail}>
                {t(result.rednessDrop >= 0 ? 'pallorCheck.detailLower' : 'pallorCheck.detailHigher', {
                  value: Math.abs(result.rednessDrop * 100).toFixed(1),
                })}
              </Text>
            )}
          </>
        )}
        <Text style={styles.disclaimer}>{t('pallorCheck.disclaimer')}</Text>
        {result.reliable && !result.savedAsBaseline && (
          <TouchableOpacity style={styles.secondaryButton} onPress={handleRecapture}>
            <Text style={styles.secondaryButtonText}>{t('pallorCheck.recaptureBaseline')}</Text>
          </TouchableOpacity>
        )}
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
        <Text style={styles.instruction}>
          {hasBaseline === false ? t('pallorCheck.instructionFirstTime') : t('pallorCheck.instructionNormal')}
        </Text>
        <ProgressBar fraction={elapsedMs / PALLOR_CHECK_DURATION_MS} color="#2f6fed" />
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
  secondaryButton: { borderColor: '#333', borderWidth: 1, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, marginTop: 4 },
  secondaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
