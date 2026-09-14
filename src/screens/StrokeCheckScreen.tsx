import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { analyzeFingerTaps, compareHands } from '../signal/fingerTapAnalysis';
import { RiskBadge } from '../components/RiskBadge';
import { ProgressBar } from '../components/ProgressBar';
import { appendHistoryEntry, makeHistoryId } from '../services/history';
import { FingerTapResult, StrokeScreeningResult } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'StrokeCheck'>;

const TEST_DURATION_MS = 10000;

type Phase = 'intro' | 'tapping-left' | 'switch-hands' | 'tapping-right' | 'results';

export function StrokeCheckScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('intro');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [result, setResult] = useState<StrokeScreeningResult | null>(null);

  const tapTimestampsRef = useRef<number[]>([]);
  const leftResultRef = useRef<FingerTapResult | null>(null);
  const phaseStartRef = useRef(0);

  const startTappingPhase = (nextPhase: 'tapping-left' | 'tapping-right') => {
    tapTimestampsRef.current = [];
    setTapCount(0);
    setElapsedMs(0);
    phaseStartRef.current = Date.now();
    setPhase(nextPhase);
  };

  useEffect(() => {
    if (phase !== 'tapping-left' && phase !== 'tapping-right') return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - phaseStartRef.current;
      setElapsedMs(elapsed);

      if (elapsed >= TEST_DURATION_MS) {
        clearInterval(interval);
        const hand = phase === 'tapping-left' ? 'left' : 'right';
        const handResult = analyzeFingerTaps(hand, tapTimestampsRef.current, TEST_DURATION_MS);

        if (hand === 'left') {
          leftResultRef.current = handResult;
          setPhase('switch-hands');
        } else if (leftResultRef.current) {
          const combined = compareHands(leftResultRef.current, handResult);
          setResult(combined);
          setPhase('results');
          appendHistoryEntry({
            id: makeHistoryId(),
            type: 'arm',
            timestamp: Date.now(),
            level: combined.level,
            asymmetryScore: combined.asymmetryScore,
          }).catch((err) => console.warn('[history] failed to save Finger Tap Test result', err));
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [phase]);

  const handleTap = () => {
    tapTimestampsRef.current.push(Date.now());
    setTapCount(tapTimestampsRef.current.length);
  };

  if (phase === 'intro') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t('fingerTap.intro.title')}</Text>
        <Text style={styles.body}>{t('fingerTap.intro.body')}</Text>
        <Text style={styles.disclaimer}>{t('fingerTap.intro.disclaimer')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => startTappingPhase('tapping-left')}>
          <Text style={styles.buttonText}>{t('fingerTap.intro.startLeft')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'switch-hands') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t('fingerTap.changeHands.title')}</Text>
        <Text style={styles.body}>{t('fingerTap.changeHands.body')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => startTappingPhase('tapping-right')}>
          <Text style={styles.buttonText}>{t('fingerTap.changeHands.startRight')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'tapping-left' || phase === 'tapping-right') {
    const hand = phase === 'tapping-left' ? 'left' : 'right';
    return (
      <View style={styles.container}>
        <Text style={styles.handLabel}>{t('fingerTap.tapping.handLabel', { hand: t(`fingerTap.tapping.${hand}`) })}</Text>
        <ProgressBar fraction={elapsedMs / TEST_DURATION_MS} color="#2f6fed" />
        <Text style={styles.countdown}>{Math.max(0, Math.ceil((TEST_DURATION_MS - elapsedMs) / 1000))}s</Text>
        <TouchableOpacity style={styles.tapTarget} onPress={handleTap} activeOpacity={0.7}>
          <Text style={styles.tapTargetText}>{t('fingerTap.tapping.tapButton')}</Text>
        </TouchableOpacity>
        <Text style={styles.tapCount}>{t('fingerTap.tapping.tapCount', { count: tapCount })}</Text>
      </View>
    );
  }

  if (phase === 'results' && result) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t('common.results')}</Text>
        <RiskBadge level={result.level} />
        <View style={styles.resultsRow}>
          <View style={styles.resultsCol}>
            <Text style={styles.resultsLabel}>{t('fingerTap.results.left')}</Text>
            <Text style={styles.resultsValue}>
              {t('fingerTap.results.tapsPerSecond', { rate: result.left.rateHz.toFixed(1) })}
            </Text>
          </View>
          <View style={styles.resultsCol}>
            <Text style={styles.resultsLabel}>{t('fingerTap.results.right')}</Text>
            <Text style={styles.resultsValue}>
              {t('fingerTap.results.tapsPerSecond', { rate: result.right.rateHz.toFixed(1) })}
            </Text>
          </View>
        </View>
        <Text style={styles.body}>{result.reasons.join('. ')}.</Text>
        <Text style={styles.disclaimer}>{t('fingerTap.results.disclaimer')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>{t('common.done')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 },
  center: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff' },
  handLabel: { fontSize: 20, fontWeight: '700', color: '#fff' },
  body: { fontSize: 15, lineHeight: 22, color: '#ccc', textAlign: 'center' },
  disclaimer: { fontSize: 12, lineHeight: 18, color: '#888', textAlign: 'center' },
  countdown: { fontSize: 32, fontWeight: '800', color: '#fff' },
  tapTarget: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#2f6fed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapTargetText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  tapCount: { fontSize: 18, color: '#ccc', fontWeight: '600' },
  resultsRow: { flexDirection: 'row', gap: 32 },
  resultsCol: { alignItems: 'center' },
  resultsLabel: { color: '#999', fontSize: 13 },
  resultsValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  button: { backgroundColor: '#2f6fed', paddingVertical: 16, paddingHorizontal: 28, borderRadius: 12, marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
