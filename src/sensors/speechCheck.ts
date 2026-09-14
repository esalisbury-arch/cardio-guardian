// Speech capture for the Speech Check flow, via @react-native-voice/voice —
// a thin wrapper around each platform's built-in on-device speech
// recognizer (iOS: SFSpeechRecognizer, Android: SpeechRecognizer). No audio
// is stored or sent anywhere by this app; recognition happens through the
// OS's own speech APIs the same way dictation does.
//
// Maintenance note: @react-native-voice/voice is in maintenance mode and
// its own README points people toward `expo-speech-recognition` as the
// actively-developed successor. That package is built on the Expo Modules
// API, which would pull in `expo` + `expo-modules-core` and their
// autolinking setup — real architectural weight for a bare RN project like
// this one, just for a single feature. @react-native-voice/voice still
// works, still receives updates, and uses the same plain-RN autolinking as
// every other native dependency here, so that's what this module uses. If
// this feature grows into something more central, revisit that tradeoff.
//
// This module intentionally has no signal-processing logic of its own — it
// only bridges recognized speech + timing to src/signal/speechAnalysis.ts.

import { useCallback, useEffect, useRef, useState } from 'react';
import Voice, { SpeechErrorEvent, SpeechResultsEvent } from '@react-native-voice/voice';
import { SpeechAttempt } from '../types';
import { SPEECH_CHECK_MAX_DURATION_MS } from '../config/constants';

export type SpeechCheckStatus = 'idle' | 'listening' | 'done' | 'error';

export interface SpeechCheckHandle {
  status: SpeechCheckStatus;
  partialTranscript: string;
  errorMessage: string | null;
  start: () => Promise<void>;
  reset: () => void;
}

export function useSpeechCheck(onResult: (attempt: SpeechAttempt) => void): SpeechCheckHandle {
  const [status, setStatus] = useState<SpeechCheckStatus>('idle');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startedAtRef = useRef(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs (not state) so the once-registered Voice.* handlers below always
  // see the latest values instead of closing over stale state from the
  // render that first set them up.
  const partialTranscriptRef = useRef('');
  const finishedRef = useRef(false);

  const clearSafetyTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const finish = useCallback((transcript: string) => {
    if (finishedRef.current) return; // onSpeechResults and the onSpeechEnd fallback can both fire
    finishedRef.current = true;
    clearSafetyTimeout();
    setStatus('done');
    onResultRef.current({ transcript, durationMs: Date.now() - startedAtRef.current });
  }, [clearSafetyTimeout]);

  useEffect(() => {
    // Temporary diagnostic logging (__DEV__-only) — Speech Check has had
    // repeated reports of the recognizer seeming to cut off/not capture
    // audio, and none of the timing-related fixes so far have resolved it.
    // These trace every native event so the actual sequence/timing can be
    // read from the Metro log instead of guessed at. Remove once resolved.
    Voice.onSpeechStart = () => {
      if (__DEV__) console.log('[speechCheck] onSpeechStart');
    };
    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      const value = e.value?.[0] ?? '';
      if (__DEV__) console.log('[speechCheck] onSpeechPartialResults', JSON.stringify(e.value));
      partialTranscriptRef.current = value;
      setPartialTranscript(value);
    };
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (__DEV__) console.log('[speechCheck] onSpeechResults', JSON.stringify(e.value));
      finish(e.value?.[0] ?? '');
    };
    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      if (__DEV__) console.log('[speechCheck] onSpeechError', JSON.stringify(e.error));
      clearSafetyTimeout();
      setStatus('error');
      setErrorMessage(e.error?.message ?? 'Speech recognition failed');
    };
    Voice.onSpeechEnd = () => {
      if (__DEV__) console.log('[speechCheck] onSpeechEnd, partial so far:', JSON.stringify(partialTranscriptRef.current));
      // onSpeechEnd typically fires *before* the more-accurate final
      // onSpeechResults (transcription takes a moment after audio capture
      // stops). Give it a short grace period to arrive and win — `finish`
      // is idempotent, so if onSpeechResults lands first this becomes a
      // no-op. If it never arrives (nothing confidently recognized on some
      // platforms/locales), fall back to the last partial transcript
      // rather than hanging forever.
      setTimeout(() => {
        if (__DEV__) console.log('[speechCheck] grace period elapsed, finishing with:', JSON.stringify(partialTranscriptRef.current));
        finish(partialTranscriptRef.current);
      }, 1000);
    };

    return () => {
      clearSafetyTimeout();
      Voice.destroy().then(Voice.removeAllListeners).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    setPartialTranscript('');
    setErrorMessage(null);
    setStatus('listening');
    partialTranscriptRef.current = '';
    finishedRef.current = false;
    startedAtRef.current = Date.now();

    try {
      if (__DEV__) console.log('[speechCheck] calling Voice.start');
      await Voice.start('en-US');
      if (__DEV__) console.log('[speechCheck] Voice.start resolved');
    } catch (err) {
      if (__DEV__) console.log('[speechCheck] Voice.start threw', err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Could not start speech recognition');
      return;
    }

    clearSafetyTimeout();
    timeoutRef.current = setTimeout(() => {
      if (__DEV__) console.log('[speechCheck] safety timeout fired, calling Voice.stop');
      Voice.stop().catch(() => undefined);
    }, SPEECH_CHECK_MAX_DURATION_MS);
  }, [clearSafetyTimeout]);

  const reset = useCallback(() => {
    clearSafetyTimeout();
    setStatus('idle');
    setPartialTranscript('');
    setErrorMessage(null);
  }, [clearSafetyTimeout]);

  return { status, partialTranscript, errorMessage, start, reset };
}

export async function ensureSpeechAvailable(): Promise<boolean> {
  try {
    const available = await Voice.isAvailable();
    return available === 1;
  } catch {
    return false;
  }
}
