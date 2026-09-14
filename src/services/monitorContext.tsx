// Ties together passive collapse monitoring, the last known pulse reading,
// the "are you OK?" check-in prompt, and the triage engine into one place
// the UI can subscribe to.
//
// Reality check this module encodes deliberately: the phone cannot run
// camera-based PPG continuously in the background (see src/sensors/motion.ts
// and README "Background monitoring limitations"), so there usually is no
// live pulse reading at the moment a collapse is detected. Rather than
// pretend otherwise, CRITICAL is reachable via collapse + unresponsiveness
// alone when no recent Active Check pulse reading exists — see
// src/signal/triageEngine.ts's pulseAbsent logic. Doing an Active Check
// shortly before or after does not block that path; it only adds
// information (e.g. a recent regular pulse can prevent needless anxiety by
// keeping the level at WARNING instead of escalating a stale collapse).

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CollapseDetector } from '../signal/collapseDetector';
import { computeTriage } from '../signal/triageEngine';
import { startMotionStream, stopMotionStream } from '../sensors/motion';
import { CHECK_IN_PROMPT_TIMEOUT_MS } from '../config/constants';
import { CollapseEvent, IrregularityResult, PulseReading, RiskLevel, TriageResult } from '../types';
import type { Subscription } from 'rxjs';

interface MonitorState {
  isPassiveMonitoringOn: boolean;
  latestPulse: PulseReading | null;
  latestIrregularity: IrregularityResult | null;
  collapseEvent: CollapseEvent | null;
  awaitingCheckIn: boolean;
  triage: TriageResult;
}

interface MonitorApi extends MonitorState {
  startPassiveMonitoring: () => void;
  stopPassiveMonitoring: () => void;
  reportActiveCheckReading: (pulse: PulseReading, irregularity: IrregularityResult) => void;
  respondToCheckIn: () => void;
  onCriticalAlert: (handler: (result: TriageResult) => void) => () => void;
}

const MonitorContext = createContext<MonitorApi | null>(null);

const NORMAL_TRIAGE: TriageResult = { level: 'NORMAL', reasons: ['No collapse or irregularity detected'], triggerEmergencyFlow: false };

export function MonitorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MonitorState>({
    isPassiveMonitoringOn: false,
    latestPulse: null,
    latestIrregularity: null,
    collapseEvent: null,
    awaitingCheckIn: false,
    triage: NORMAL_TRIAGE,
  });

  const detectorRef = useRef(new CollapseDetector());
  const subscriptionRef = useRef<Subscription | null>(null);
  const evaluateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkInTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const criticalListenersRef = useRef<Set<(result: TriageResult) => void>>(new Set());
  const stateRef = useRef(state);
  stateRef.current = state;

  const emitCritical = useCallback((result: TriageResult) => {
    criticalListenersRef.current.forEach((fn) => fn(result));
  }, []);

  const recomputeAndSet = useCallback(
    (userResponded: boolean | null) => {
      const { latestPulse, latestIrregularity, collapseEvent } = stateRef.current;
      const result = computeTriage({
        pulse: latestPulse,
        irregularity: latestIrregularity,
        collapse: collapseEvent,
        userResponded,
        now: Date.now(),
      });
      setState((s) => ({ ...s, triage: result, awaitingCheckIn: userResponded === null && collapseEvent !== null }));
      if (result.triggerEmergencyFlow) emitCritical(result);
      return result;
    },
    [emitCritical]
  );

  const clearCheckInTimeout = useCallback(() => {
    if (checkInTimeoutRef.current) {
      clearTimeout(checkInTimeoutRef.current);
      checkInTimeoutRef.current = null;
    }
  }, []);

  const startPassiveMonitoring = useCallback(() => {
    if (subscriptionRef.current) return; // already running
    detectorRef.current.reset();

    subscriptionRef.current = startMotionStream((sample) => {
      detectorRef.current.addSample(sample);
    });

    evaluateIntervalRef.current = setInterval(() => {
      const event = detectorRef.current.evaluate(Date.now());
      if (event && !stateRef.current.collapseEvent) {
        setState((s) => ({ ...s, collapseEvent: event }));
        recomputeAndSet(null); // enters WARNING, starts the check-in prompt

        clearCheckInTimeout();
        checkInTimeoutRef.current = setTimeout(() => {
          recomputeAndSet(false); // no response in time
        }, CHECK_IN_PROMPT_TIMEOUT_MS);
      }
    }, 500);

    setState((s) => ({ ...s, isPassiveMonitoringOn: true }));
  }, [clearCheckInTimeout, recomputeAndSet]);

  const stopPassiveMonitoring = useCallback(() => {
    stopMotionStream(subscriptionRef.current);
    subscriptionRef.current = null;
    if (evaluateIntervalRef.current) clearInterval(evaluateIntervalRef.current);
    evaluateIntervalRef.current = null;
    clearCheckInTimeout();
    detectorRef.current.reset();
    setState((s) => ({ ...s, isPassiveMonitoringOn: false, collapseEvent: null, awaitingCheckIn: false, triage: NORMAL_TRIAGE }));
  }, [clearCheckInTimeout]);

  const reportActiveCheckReading = useCallback((pulse: PulseReading, irregularity: IrregularityResult) => {
    setState((s) => ({ ...s, latestPulse: pulse, latestIrregularity: irregularity }));
  }, []);

  const respondToCheckIn = useCallback(() => {
    clearCheckInTimeout();
    recomputeAndSet(true);
    detectorRef.current.reset();
    setState((s) => ({ ...s, collapseEvent: null }));
  }, [clearCheckInTimeout, recomputeAndSet]);

  const onCriticalAlert = useCallback((handler: (result: TriageResult) => void) => {
    criticalListenersRef.current.add(handler);
    return () => criticalListenersRef.current.delete(handler);
  }, []);

  useEffect(() => stopPassiveMonitoring, [stopPassiveMonitoring]);

  const api: MonitorApi = {
    ...state,
    startPassiveMonitoring,
    stopPassiveMonitoring,
    reportActiveCheckReading,
    respondToCheckIn,
    onCriticalAlert,
  };

  return <MonitorContext.Provider value={api}>{children}</MonitorContext.Provider>;
}

export function useMonitor(): MonitorApi {
  const ctx = useContext(MonitorContext);
  if (!ctx) throw new Error('useMonitor must be used within a MonitorProvider');
  return ctx;
}

export type { RiskLevel };
