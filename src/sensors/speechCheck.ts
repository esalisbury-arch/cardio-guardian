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
//
// SEGMENT CHAINING — why this file is more than "call start, wait for
// result": @react-native-voice/voice's iOS bridge (Voice.m) doesn't
// implement true continuous multi-utterance recognition. Each
// SFSpeechRecognitionTask is single-shot — the instant it reports one
// isFinal result, that task is permanently done; no more callbacks ever
// arrive for it, no matter how long taskHint's silence tolerance nominally
// allows. In practice this meant the whole Speech Check phrase was getting
// cut to just its first word or two, because the recognizer would finalize
// a short opening segment (e.g. "You") well before the speaker got further
// into the sentence, and that was mistaken for the complete answer.
// The fix: treat each native isFinal as one *segment* of a longer answer,
// not the whole answer. The instant one segment ends, immediately start a
// fresh recognition task and concatenate its result onto what's
// accumulated so far — from the user's perspective this reads as one
// continuous listening session, chained transparently under the hood.
// Chaining stops (and the accumulated text is reported as the final
// answer) once genuine silence is detected — two consecutive empty
// segments in a row — or the overall safety-timeout budget runs out.

import { useCallback, useEffect, useRef, useState } from 'react';
import Voice, { SpeechErrorEvent, SpeechResultsEvent } from '@react-native-voice/voice';
import { SpeechAttempt } from '../types';
import { SPEECH_CHECK_MAX_DURATION_MS } from '../config/constants';

// SFSpeechRecognizer has a well-documented quirk: on the first use after a
// fresh app launch (sometimes the first couple of uses), the recognizer can
// fail to initialize — recognitionTaskWithRequest's resultHandler fires with
// an error like "Failed to initialize recognizer" almost immediately after
// onSpeechStart, before any audio is ever captured. Retrying with no other
// change reliably succeeds. This is not a permission problem (permission is
// already confirmed granted by ensureSpeechPermissions before start() below
// is ever called), so it's safe to retry automatically rather than making
// the user manually tap "Try again" a few times.
const MAX_AUTO_RETRIES = 2; // up to 3 total attempts before surfacing a hard error

// How many back-to-back *empty* segments mean "the user has actually
// stopped talking" rather than "the recognizer just cut an early segment
// short." Two in a row is a deliberate compromise: one empty segment can
// still just be mic/route warm-up (see the AVAudioEngine note below), but
// two in a row on top of already having some accumulated speech is a much
// stronger silence signal.
const MAX_CONSECUTIVE_EMPTY_SEGMENTS = 2;

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

  const startedAtRef = useRef(0); // when the *overall* attempt began (across all chained segments)
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs (not state) so the once-registered Voice.* handlers below always
  // see the latest values instead of closing over stale state from the
  // render that first set them up.
  const currentSegmentRef = useRef(''); // this native segment's own growing transcript
  const accumulatedTranscriptRef = useRef(''); // concatenation of all completed segments
  const consecutiveEmptySegmentsRef = useRef(0);
  const finishedRef = useRef(false);
  const retryCountRef = useRef(0);
  // Bumped by every attemptStart() call. onSpeechEnd's 1s-delayed fallback
  // (below) captures the session id live at schedule time and checks it
  // when it fires — if a retry/chain step has since started a new segment,
  // the id has moved on and the stale callback no-ops instead of ending the
  // *new* segment early with leftover data from the one that just finished.
  const sessionIdRef = useRef(0);
  // start() is declared below (after the Voice.* handlers, since they need
  // to call back into it) but attemptStartRef lets the handlers call the
  // latest version without a circular reference.
  const attemptStartRef = useRef<() => void>(() => undefined);

  const clearSafetyTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Called once a native segment has genuinely ended (via onSpeechEnd,
  // after its grace period — see below). Decides whether to chain another
  // segment or report the accumulated transcript as the final answer.
  const handleSegmentEnd = useCallback(
    (segmentTranscript: string) => {
      if (finishedRef.current) return;

      const trimmed = segmentTranscript.trim();
      if (trimmed.length === 0) {
        consecutiveEmptySegmentsRef.current += 1;
      } else {
        consecutiveEmptySegmentsRef.current = 0;
        accumulatedTranscriptRef.current = `${accumulatedTranscriptRef.current} ${trimmed}`.trim();
      }

      const elapsedOverall = Date.now() - startedAtRef.current;
      const remainingBudget = SPEECH_CHECK_MAX_DURATION_MS - elapsedOverall;
      // Two empty segments in a row that come *after* we've already heard
      // something is a strong genuine-silence signal. Two empty segments
      // with nothing accumulated yet, though, still falls through to the
      // ordinary retry-budget check below (MAX_AUTO_RETRIES) rather than
      // silently reporting an empty result — see attemptStart's own
      // empty-first-segment handling.
      const genuinelySilent =
        accumulatedTranscriptRef.current.length > 0 &&
        consecutiveEmptySegmentsRef.current >= MAX_CONSECUTIVE_EMPTY_SEGMENTS;
      const outOfBudget = remainingBudget <= 500; // not enough time left to bother chaining another segment
      const outOfRetries = accumulatedTranscriptRef.current.length === 0 && retryCountRef.current >= MAX_AUTO_RETRIES;

      if (!genuinelySilent && !outOfBudget && !outOfRetries) {
        if (accumulatedTranscriptRef.current.length === 0) {
          retryCountRef.current += 1;
        } else {
          // A new segment is starting clean, not retrying a failed one —
          // give it its own fresh init-retry budget. Without this, retries
          // spent getting *earlier* segments off the ground silently ate
          // into the budget for every later segment too, so a single early
          // hiccup could leave a later chain link with zero retries left —
          // any transient init failure there would immediately report
          // whatever had been captured so far (often just the first word)
          // instead of retrying that one segment.
          retryCountRef.current = 0;
        }
        if (__DEV__) {
          console.log(
            '[speechCheck] segment ended, chaining another. accumulated so far:',
            JSON.stringify(accumulatedTranscriptRef.current),
            'remaining budget ms:',
            remainingBudget,
          );
        }
        setTimeout(() => attemptStartRef.current(), 200);
        return;
      }

      finishedRef.current = true;
      clearSafetyTimeout();
      setStatus('done');
      if (__DEV__) console.log('[speechCheck] finishing with:', JSON.stringify(accumulatedTranscriptRef.current));
      onResultRef.current({ transcript: accumulatedTranscriptRef.current, durationMs: elapsedOverall });
    },
    [clearSafetyTimeout],
  );

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
      currentSegmentRef.current = value;
      setPartialTranscript(`${accumulatedTranscriptRef.current} ${value}`.trim());
    };
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      // Despite the name, @react-native-voice/voice's iOS bridge fires this
      // on *every* recognition callback — interim updates included, not
      // only the truly final one (see Voice.m's resultHandler: it calls
      // sendResult, which fires onSpeechResults unconditionally, on every
      // invocation regardless of result.isFinal; isFinal is only exposed
      // via the separate onSpeechRecognized event, which nothing here
      // listens to). Track the latest value for this segment like
      // onSpeechPartialResults instead of finalizing here — onSpeechEnd
      // (which fires exactly once, when this segment is actually done) is
      // what hands the value to handleSegmentEnd.
      const value = e.value?.[0] ?? '';
      if (__DEV__) console.log('[speechCheck] onSpeechResults (interim or final)', JSON.stringify(e.value));
      currentSegmentRef.current = value;
      setPartialTranscript(`${accumulatedTranscriptRef.current} ${value}`.trim());
    };
    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      if (__DEV__) console.log('[speechCheck] onSpeechError', JSON.stringify(e.error));
      clearSafetyTimeout();
      if (retryCountRef.current < MAX_AUTO_RETRIES) {
        retryCountRef.current += 1;
        if (__DEV__) console.log(`[speechCheck] auto-retrying (attempt ${retryCountRef.current + 1}/${MAX_AUTO_RETRIES + 1})`);
        // A short delay gives the native side a moment to finish tearing
        // down the failed attempt before starting a new one.
        setTimeout(() => attemptStartRef.current(), 250);
        return;
      }
      if (accumulatedTranscriptRef.current.length > 0) {
        // We already captured *something* real across earlier chained
        // segments before this one errored out — report that instead of
        // discarding it as a hard failure.
        finishedRef.current = true;
        setStatus('done');
        onResultRef.current({ transcript: accumulatedTranscriptRef.current, durationMs: Date.now() - startedAtRef.current });
        return;
      }
      setStatus('error');
      setErrorMessage(e.error?.message ?? 'Speech recognition failed');
    };
    Voice.onSpeechEnd = () => {
      if (__DEV__) console.log('[speechCheck] onSpeechEnd, segment so far:', JSON.stringify(currentSegmentRef.current));
      // onSpeechEnd typically fires *before* the more-accurate final
      // onSpeechResults for this segment (transcription takes a moment
      // after audio capture stops). Give it a short grace period to arrive
      // and win. If it never arrives, fall back to the last partial value
      // for this segment rather than hanging forever.
      const mySession = sessionIdRef.current;
      setTimeout(() => {
        if (sessionIdRef.current !== mySession) {
          // A retry/chain step already started a new segment in the
          // meantime — this callback belongs to the segment that just
          // ended, not the current one. Acting on it now would end the
          // *new* segment early using leftover data from the old one.
          if (__DEV__) console.log('[speechCheck] grace period elapsed but a newer segment is in progress, ignoring');
          return;
        }
        if (__DEV__) console.log('[speechCheck] grace period elapsed, ending segment with:', JSON.stringify(currentSegmentRef.current));
        handleSegmentEnd(currentSegmentRef.current);
      }, 1000);
    };

    return () => {
      clearSafetyTimeout();
      Voice.destroy().then(Voice.removeAllListeners).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Starts (or re-starts, when chaining) exactly one native recognition
  // segment. Doesn't touch accumulatedTranscriptRef/errorMessage — those
  // persist across chained segments and are only reset by start() itself,
  // the true user-initiated fresh attempt.
  const attemptStart = useCallback(async () => {
    sessionIdRef.current += 1;
    finishedRef.current = false;
    currentSegmentRef.current = '';

    try {
      if (__DEV__) console.log('[speechCheck] calling Voice.start');
      await Voice.start('en-US');
      if (__DEV__) console.log('[speechCheck] Voice.start resolved');
    } catch (err) {
      if (__DEV__) console.log('[speechCheck] Voice.start threw', err);
      if (retryCountRef.current < MAX_AUTO_RETRIES) {
        retryCountRef.current += 1;
        if (__DEV__) console.log(`[speechCheck] auto-retrying after throw (attempt ${retryCountRef.current + 1}/${MAX_AUTO_RETRIES + 1})`);
        setTimeout(() => attemptStartRef.current(), 250);
        return;
      }
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Could not start speech recognition');
      return;
    }

    // The *overall* safety timeout spans the whole chained attempt, not
    // just this one segment — only (re)armed the first time, not on every
    // chain step, so it can't be pushed out indefinitely by fast segments.
    if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        if (__DEV__) console.log('[speechCheck] safety timeout fired, calling Voice.stop');
        Voice.stop().catch(() => undefined);
      }, SPEECH_CHECK_MAX_DURATION_MS);
    }
  }, []);

  attemptStartRef.current = attemptStart;

  const start = useCallback(async () => {
    setPartialTranscript('');
    setErrorMessage(null);
    setStatus('listening');
    currentSegmentRef.current = '';
    accumulatedTranscriptRef.current = '';
    consecutiveEmptySegmentsRef.current = 0;
    retryCountRef.current = 0;
    clearSafetyTimeout();
    startedAtRef.current = Date.now();
    await attemptStart();
  }, [attemptStart, clearSafetyTimeout]);

  const reset = useCallback(() => {
    clearSafetyTimeout();
    retryCountRef.current = 0;
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
