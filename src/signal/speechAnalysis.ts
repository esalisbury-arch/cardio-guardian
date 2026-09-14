// Speech difficulty screening — the "Speech difficulty" sign in FAST (Face
// drooping, Arm weakness, Speech difficulty, Time to call emergency
// services). Complements src/signal/faceSymmetryAnalysis.ts (Face) and
// src/signal/fingerTapAnalysis.ts (Arm).
//
// Approach: the user reads a fixed test sentence aloud (the Cincinnati
// Prehospital Stroke Scale's phrase — see src/config/constants.ts) while
// on-device speech recognition transcribes it. Two independent signals of
// possible dysarthria (slurred/impaired speech):
//   1. Word error rate — how much the transcript differs from the expected
//      phrase, via word-level edit distance.
//   2. Speech rate — how much longer the attempt took than a normal
//      conversational pace would predict for a phrase this length.
//
// IMPORTANT LIMITATIONS: this is the weakest and most confounded of the
// three FAST signals this app screens for. On-device speech recognition can
// fail for many reasons that have nothing to do with a stroke — background
// noise, an unfamiliar accent, a bad microphone, or simply an unusual
// phrasing choice — and a failed transcription looks identical to a
// genuinely slurred one. This module only ever produces a "flag for
// follow-up" result and never auto-triggers the emergency alert flow (see
// src/signal/triageEngine.ts for the one signature that does, and why).

import { SpeechAttempt, SpeechScreeningResult } from '../types';

const WORD_ERROR_RATE_FLAG_THRESHOLD = 0.4;
const RATE_SLOWDOWN_FLAG_THRESHOLD = 1.6; // 60% longer than expected pace
// Typical conversational reading pace — calibrated for English. Now that
// src/passed/locales/* supplies a test phrase per language (see
// speechCheck.testPhrase), this WPM figure is still a single English-derived
// constant applied to every language's expected duration, since normal
// speaking pace genuinely varies by language. Not yet verified per-language
// — a known gap, same spirit as this module's other documented limitations.
const NORMAL_SPEECH_RATE_WPM = 150;
const WER_WEIGHT = 0.6;
const RATE_WEIGHT = 0.4;

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Classic word-level Levenshtein edit distance. */
function wordEditDistance(a: string[], b: string[]): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[a.length][b.length];
}

export function expectedDurationMsFor(phrase: string): number {
  const wordCount = normalizeWords(phrase).length;
  return (wordCount / NORMAL_SPEECH_RATE_WPM) * 60000;
}

export function analyzeSpeech(expectedPhrase: string, attempt: SpeechAttempt): SpeechScreeningResult {
  const expectedWords = normalizeWords(expectedPhrase);
  const heardWords = normalizeWords(attempt.transcript);
  const expectedDurationMs = expectedDurationMsFor(expectedPhrase);

  if (heardWords.length === 0 || attempt.durationMs <= 0) {
    return {
      level: 'NORMAL',
      reasons: ['No speech was recognized — check your microphone permission and try again in a quiet space'],
      transcript: attempt.transcript,
      wordErrorRate: 0,
      speechDurationMs: attempt.durationMs,
      expectedDurationMs,
      rateSlowdownFactor: 0,
      impairmentScore: 0,
      reliable: false,
    };
  }

  const wordErrorRate = wordEditDistance(expectedWords, heardWords) / expectedWords.length;
  const rateSlowdownFactor = attempt.durationMs / expectedDurationMs;

  const impairmentScore = Math.max(
    0,
    Math.min(
      1,
      WER_WEIGHT * Math.min(1, wordErrorRate / (WORD_ERROR_RATE_FLAG_THRESHOLD * 1.5)) +
        RATE_WEIGHT * Math.min(1, Math.max(0, rateSlowdownFactor - 1) / (RATE_SLOWDOWN_FLAG_THRESHOLD - 1))
    )
  );

  const wordsOff = wordErrorRate >= WORD_ERROR_RATE_FLAG_THRESHOLD;
  const tooSlow = rateSlowdownFactor >= RATE_SLOWDOWN_FLAG_THRESHOLD;

  if (wordsOff || tooSlow) {
    const reasons: string[] = [];
    if (wordsOff) reasons.push('Speech was hard to make out clearly against the expected phrase');
    if (tooSlow) reasons.push('Speech was noticeably slower than a typical reading pace');
    reasons.push('If this is new and comes with face drooping or arm weakness, treat it as a possible stroke and call emergency services now');
    return {
      level: 'LOW',
      reasons,
      transcript: attempt.transcript,
      wordErrorRate,
      speechDurationMs: attempt.durationMs,
      expectedDurationMs,
      rateSlowdownFactor,
      impairmentScore,
      reliable: true,
    };
  }

  return {
    level: 'NORMAL',
    reasons: ['Speech matched the expected phrase at a typical pace'],
    transcript: attempt.transcript,
    wordErrorRate,
    speechDurationMs: attempt.durationMs,
    expectedDurationMs,
    rateSlowdownFactor,
    impairmentScore,
    reliable: true,
  };
}
