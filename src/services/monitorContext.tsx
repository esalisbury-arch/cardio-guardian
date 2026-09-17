// Tracks the last known pulse reading and irregularity status from Active
// Check, and exposes the resulting triage level to the UI (the home
// screen's risk badge, and the "last pulse reading" card on Heart Attack
// Screening).
//
// This used to also run passive collapse monitoring (accelerometer-based
// fall detection) and an "are you OK?" check-in prompt that could
// auto-trigger an emergency alert — that whole path was removed along with
// passive collapse monitoring, since pulse irregularity alone was never
// enough on its own to justify an automatic alert (see triageEngine.ts).

import React, { createContext, useCallback, useContext, useState } from 'react';
import { computeTriage } from '../signal/triageEngine';
import { IrregularityResult, PulseReading, TriageResult } from '../types';

interface MonitorState {
  latestPulse: PulseReading | null;
  latestIrregularity: IrregularityResult | null;
  triage: TriageResult;
}

interface MonitorApi extends MonitorState {
  reportActiveCheckReading: (pulse: PulseReading, irregularity: IrregularityResult) => void;
}

const MonitorContext = createContext<MonitorApi | null>(null);

const NORMAL_TRIAGE: TriageResult = { level: 'NORMAL', reasons: ['No irregularity detected'] };

export function MonitorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MonitorState>({
    latestPulse: null,
    latestIrregularity: null,
    triage: NORMAL_TRIAGE,
  });

  const reportActiveCheckReading = useCallback((pulse: PulseReading, irregularity: IrregularityResult) => {
    setState((s) => ({ ...s, latestPulse: pulse, latestIrregularity: irregularity, triage: computeTriage({ pulse, irregularity }) }));
  }, []);

  const api: MonitorApi = { ...state, reportActiveCheckReading };

  return <MonitorContext.Provider value={api}>{children}</MonitorContext.Provider>;
}

export function useMonitor(): MonitorApi {
  const ctx = useContext(MonitorContext);
  if (!ctx) throw new Error('useMonitor must be used within a MonitorProvider');
  return ctx;
}
