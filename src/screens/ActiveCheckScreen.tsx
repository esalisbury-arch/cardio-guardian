import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { usePpgCamera, ensureCameraReady } from '../sensors/ppgCamera';
import { PpgSignalProcessor } from '../signal/ppgProcessor';
import { analyzeIrregularity } from '../signal/hrvAnalysis';
import { IRREGULARITY_WARNING_THRESHOLD } from '../signal/triageEngine';
import { ProgressBar } from '../components/ProgressBar';
import { useMonitor } from '../services/monitorContext';
import { appendHistoryEntry, makeHistoryId } from '../services/history';
import { ACTIVE_CHECK_DURATION_MS } from '../config/constants';
import { IrregularityResult, PulseReading } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveCheck'>;

type Phase = 'requesting-permission' | 'no-permission' | 'reading' | 'done';

export function ActiveCheckScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const monitor = useMonitor();
  const processorRef = useRef(new PpgSignalProcessor());
  const [phase, setPhase] = useState<Phase>('requesting-permission');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveReading, setLiveReading] = useState<PulseReading | null>(null);
  const [finalResult, setFinalResult] = useState<{ pulse: PulseReading; irregularity: IrregularityResult } | null>(null);

  const handleSample = (t: number, redMean: number) => {
    processorRef.current.addSample(t, redMean);
  };

  const { device, frameProcessor } = usePpgCamera(handleSample);

  useEffect(() => {
    ensureCameraReady().then((granted) => setPhase(granted ? 'reading' : 'no-permission'));
  }, []);

  useEffect(() => {
    // Also gate on `device`: without it there's no real camera frame ever
    // coming in, so this would otherwise still fire on a timer and silently
    // write a meaningless "no pulse detected" entry to history purely
    // because time passed, not because a check actually ran.
    if (phase !== 'reading' || !device) return;
    const startedAt = Date.now();
    processorRef.current = new PpgSignalProcessor();

    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setElapsedMs(elapsed);
      setLiveReading(processorRef.current.getReading());

      if (elapsed >= ACTIVE_CHECK_DURATION_MS) {
        clearInterval(tick);
        const pulse = processorRef.current.getReading();
        const irregularity = analyzeIrregularity(pulse.ibiMs);
        setFinalResult({ pulse, irregularity });
        monitor.reportActiveCheckReading(pulse, irregularity);
        appendHistoryEntry({
          id: makeHistoryId(),
          type: 'active',
          timestamp: Date.now(),
          bpm: pulse.bpm,
          quality: pulse.quality,
          irregularityScore: irregularity.reliable ? irregularity.score : null,
          flagged: irregularity.reliable && irregularity.score >= IRREGULARITY_WARNING_THRESHOLD,
        }).catch((err) => console.warn('[history] failed to save Active Check result', err));
        setPhase('done');
      }
    }, 250);

    return () => clearInterval(tick);
  }, [phase, monitor, device]);

  if (phase === 'no-permission') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('activeCheck.noPermissionMessage')}</Text>
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
        <Text style={styles.message}>{t('activeCheck.noCameraMessage')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'done' && finalResult) {
    const { pulse, irregularity } = finalResult;
    return (
      <View style={styles.center}>
        <Text style={styles.resultBpm}>
          {pulse.bpm ? t('activeCheck.resultBpm', { bpm: pulse.bpm }) : t('activeCheck.resultNoPulse')}
        </Text>
        <Text style={styles.message}>{t('activeCheck.signalQuality', { quality: t(`signalQuality.${pulse.quality}`) })}</Text>
        {irregularity.reliable && (
          <Text style={styles.message}>
            {t('activeCheck.irregularityScore', { score: irregularity.score.toFixed(2) })}{' '}
            {irregularity.score >= IRREGULARITY_WARNING_THRESHOLD
              ? t('activeCheck.irregularityFlagged')
              : t('activeCheck.irregularityNormal')}
          </Text>
        )}
        <Text style={styles.disclaimer}>{t('activeCheck.disclaimer')}</Text>
        {irregularity.reliable && irregularity.score >= IRREGULARITY_WARNING_THRESHOLD && (
          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('NearbyHospitals')}>
            <Text style={styles.buttonText}>{t('activeCheck.findNearbyCare')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secondaryDoneButton} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>{t('common.done')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive torch="on" frameProcessor={frameProcessor} />
      <View style={styles.overlay}>
        <Text style={styles.instruction}>{t('activeCheck.instruction')}</Text>
        <ProgressBar fraction={elapsedMs / ACTIVE_CHECK_DURATION_MS} color="#2f6fed" />
        <Text style={styles.liveBpm}>
          {liveReading?.bpm ? t('activeCheck.resultBpm', { bpm: liveReading.bpm }) : t('activeCheck.reading')}
        </Text>
        <Text style={styles.liveQuality}>{t(`signalQuality.${liveReading?.quality ?? 'no-signal'}`)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: 'rgba(0,0,0,0.55)', gap: 14 },
  instruction: { color: '#fff', fontSize: 15, textAlign: 'center' },
  liveBpm: { color: '#fff', fontSize: 40, fontWeight: '800', textAlign: 'center' },
  liveQuality: { color: '#bbb', fontSize: 13, textAlign: 'center' },
  message: { color: '#ccc', fontSize: 15, textAlign: 'center' },
  resultBpm: { color: '#fff', fontSize: 44, fontWeight: '800' },
  disclaimer: { color: '#888', fontSize: 12, textAlign: 'center', marginTop: 8 },
  button: { backgroundColor: '#2f6fed', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryDoneButton: {
    borderColor: '#333',
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginTop: 8,
  },
});
