import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { ensureSpeechPermissions } from '../sensors/permissions';
import { useSpeechCheck } from '../sensors/speechCheck';
import { analyzeSpeech } from '../signal/speechAnalysis';
import { RiskBadge } from '../components/RiskBadge';
import { appendHistoryEntry, makeHistoryId } from '../services/history';
import { SpeechAttempt, SpeechScreeningResult } from '../types';
import { SPEECH_CHECK_GET_READY_MS } from '../config/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'SpeechCheck'>;

type Phase = 'intro' | 'no-permission' | 'get-ready' | 'listening' | 'done';

export function SpeechCheckScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const testPhrase = t('speechCheck.testPhrase');
  const [phase, setPhase] = useState<Phase>('intro');
  const [result, setResult] = useState<SpeechScreeningResult | null>(null);

  const handleResult = (attempt: SpeechAttempt) => {
    const speechResult = analyzeSpeech(testPhrase, attempt);
    setResult(speechResult);
    setPhase('done');
    appendHistoryEntry({
      id: makeHistoryId(),
      type: 'speech',
      timestamp: Date.now(),
      level: speechResult.level,
      wordErrorRate: speechResult.reliable ? speechResult.wordErrorRate : null,
      rateSlowdownFactor: speechResult.reliable ? speechResult.rateSlowdownFactor : null,
      reliable: speechResult.reliable,
    }).catch((err) => console.warn('[history] failed to save Speech Check result', err));
  };

  const speech = useSpeechCheck(handleResult);
  const [getReadySecondsLeft, setGetReadySecondsLeft] = useState(0);

  const handleStart = async () => {
    const granted = await ensureSpeechPermissions();
    if (!granted) {
      setPhase('no-permission');
      return;
    }
    // A short pause before the mic actually starts listening, so reading
    // the phrase and getting ready doesn't eat into the recognizer's own
    // listening window — tapping "Start listening" used to start the timer
    // immediately, cutting speaking time short for anyone who needed a
    // moment to prepare.
    setGetReadySecondsLeft(Math.ceil(SPEECH_CHECK_GET_READY_MS / 1000));
    setPhase('get-ready');
  };

  useEffect(() => {
    if (phase !== 'get-ready') return;
    if (getReadySecondsLeft <= 0) {
      setPhase('listening');
      speech.start();
      return;
    }
    const timer = setTimeout(() => setGetReadySecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, getReadySecondsLeft]);

  const handleRetry = () => {
    speech.reset();
    setResult(null);
    setPhase('intro');
  };

  if (phase === 'no-permission') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('speechCheck.noPermissionMessage')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'intro') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t('stroke.speechCheck.title')}</Text>
        <Text style={styles.body}>{t('speechCheck.readAloud')}</Text>
        <View style={styles.phraseBox}>
          <Text style={styles.phrase}>"{testPhrase}"</Text>
        </View>
        <Text style={styles.disclaimer}>{t('speechCheck.introDisclaimer')}</Text>
        <TouchableOpacity style={styles.button} onPress={handleStart}>
          <Text style={styles.buttonText}>{t('speechCheck.startListening')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'get-ready') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t('speechCheck.getReadyIn', { seconds: getReadySecondsLeft })}</Text>
        <View style={styles.phraseBox}>
          <Text style={styles.phrase}>"{testPhrase}"</Text>
        </View>
      </View>
    );
  }

  if (phase === 'listening') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t('speechCheck.listening')}</Text>
        <View style={styles.phraseBox}>
          <Text style={styles.phrase}>"{testPhrase}"</Text>
        </View>
        <Text style={styles.liveTranscript}>{speech.partialTranscript || '…'}</Text>
        {speech.status === 'error' && (
          <>
            <Text style={styles.message}>{speech.errorMessage ?? t('speechCheck.somethingWrong')}</Text>
            <TouchableOpacity style={styles.button} onPress={handleRetry}>
              <Text style={styles.buttonText}>{t('common.tryAgain')}</Text>
            </TouchableOpacity>
          </>
        )}
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
            <Text style={styles.detail}>{t('speechCheck.heard', { transcript: result.transcript })}</Text>
            <Text style={styles.detail}>
              {t('speechCheck.wordMatchPace', {
                wordMatch: (100 * (1 - Math.min(1, result.wordErrorRate))).toFixed(0),
                pace: result.rateSlowdownFactor.toFixed(1),
              })}
            </Text>
          </>
        )}
        <Text style={styles.disclaimer}>{t('speechCheck.resultsDisclaimer')}</Text>
        <TouchableOpacity style={styles.button} onPress={handleRetry}>
          <Text style={styles.buttonText}>{t('common.tryAgain')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>{t('common.done')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff' },
  body: { fontSize: 15, color: '#ccc', textAlign: 'center' },
  phraseBox: { backgroundColor: '#1c1c1c', borderRadius: 14, padding: 20 },
  phrase: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center', fontStyle: 'italic' },
  liveTranscript: { color: '#7fa8ff', fontSize: 17, textAlign: 'center', minHeight: 26 },
  message: { color: '#ccc', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  detail: { color: '#999', fontSize: 13, textAlign: 'center' },
  disclaimer: { color: '#888', fontSize: 12, textAlign: 'center', marginTop: 8 },
  button: { backgroundColor: '#2f6fed', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryButton: { borderColor: '#333', borderWidth: 1, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
  secondaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
