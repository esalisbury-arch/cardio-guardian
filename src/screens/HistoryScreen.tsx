import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { RiskBadge } from '../components/RiskBadge';
import { TrendSparkline } from '../components/TrendSparkline';
import { clearHistory, listHistory } from '../services/history';
import { summarizeTrend, TrendPoint } from '../signal/historyTrends';
import { CheckType, HistoryEntry } from '../types';

// Mirrors the app's two screening categories (see HomeDashboardScreen,
// HeartAttackScreeningScreen, StrokeScreeningScreen) instead of listing
// every individual check type as its own top-level filter — Active Check,
// Finger Tap Test, and Speech Check all get their own trend card once a
// category is picked (see CATEGORY_CHECKS below), so nothing here is lost,
// it's just grouped by what the checks are actually screening for.
type Category = 'heart' | 'stroke';
type FilterKey = 'all' | Category;

const CATEGORY_OF: Record<CheckType, Category> = {
  active: 'heart',
  pallor: 'heart',
  face: 'stroke',
  arm: 'stroke',
  speech: 'stroke',
};

const CATEGORY_CHECKS: Record<Category, CheckType[]> = {
  heart: ['active', 'pallor'],
  stroke: ['face', 'arm', 'speech'],
};

function getFilters(t: TFunction): { key: FilterKey; label: string }[] {
  return [
    { key: 'all', label: t('history.filters.all') },
    { key: 'heart', label: t('history.filters.heartAttack') },
    { key: 'stroke', label: t('history.filters.stroke') },
  ];
}

function typeLabel(t: TFunction, type: CheckType): string {
  return t(`history.typeLabels.${type}`);
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The single number each entry type contributes to its own trend line, or null if this reading wasn't reliable. */
function trendValue(entry: HistoryEntry): number | null {
  switch (entry.type) {
    case 'active':
      return entry.bpm;
    case 'face':
      return entry.asymmetryScore === null ? null : entry.asymmetryScore * 100;
    case 'arm':
      return entry.asymmetryScore * 100;
    case 'speech':
      return entry.wordErrorRate === null ? null : entry.wordErrorRate * 100;
    case 'pallor':
      return entry.rednessDrop === null ? null : entry.rednessDrop * 100;
  }
}

function detailLine(t: TFunction, entry: HistoryEntry): string {
  switch (entry.type) {
    case 'active': {
      const bpm = entry.bpm !== null ? t('activeCheck.resultBpm', { bpm: entry.bpm }) : t('history.noPulseDetected');
      const irregularity =
        entry.irregularityScore !== null
          ? t('history.irregularity', { score: entry.irregularityScore.toFixed(2) }) +
            (entry.flagged ? t('history.flagged') : '')
          : '';
      return t('history.bpmQualitySignal', { bpm, quality: t(`signalQuality.${entry.quality}`) }) + irregularity;
    }
    case 'face':
      return entry.reliable && entry.asymmetryScore !== null
        ? t('history.asymmetry', { value: (entry.asymmetryScore * 100).toFixed(0) })
        : t('history.notEnoughSignal');
    case 'arm':
      return t('history.asymmetry', { value: (entry.asymmetryScore * 100).toFixed(0) });
    case 'speech':
      return entry.reliable && entry.wordErrorRate !== null && entry.rateSlowdownFactor !== null
        ? t('history.wordMatchPace', {
            wordMatch: (100 * (1 - Math.min(1, entry.wordErrorRate))).toFixed(0),
            pace: entry.rateSlowdownFactor.toFixed(1),
          })
        : t('history.notEnoughSignal');
    case 'pallor':
      if (entry.savedAsBaseline) return t('history.savedAsBaseline');
      return entry.reliable && entry.rednessDrop !== null
        ? t(entry.rednessDrop >= 0 ? 'history.rednessLower' : 'history.rednessHigher', {
            value: Math.abs(entry.rednessDrop * 100).toFixed(1),
          })
        : t('history.notEnoughSignal');
  }
}

function entryLevel(entry: HistoryEntry): 'NORMAL' | 'LOW' | null {
  if (entry.type === 'active') return entry.flagged ? 'LOW' : 'NORMAL';
  return entry.level;
}

/** Builds a trend series for one check type from the full entry list — kept per-type since BPM, asymmetry %, and word-error % aren't comparable on one chart. */
function trendSeriesFor(entries: HistoryEntry[], type: CheckType): TrendPoint[] {
  return entries
    .filter((e) => e.type === type)
    .map((e) => ({ t: e.timestamp, value: trendValue(e) }))
    .filter((p): p is TrendPoint => p.value !== null)
    .sort((a, b) => a.t - b.t);
}

export function HistoryScreen() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');

  const reload = useCallback(() => {
    listHistory().then(setEntries);
  }, []);

  // Refresh every time this screen comes into focus, so a check you just ran
  // shows up immediately without needing a manual pull-to-refresh.
  useFocusEffect(reload);

  const handleClear = () => {
    Alert.alert(t('history.clearConfirmTitle'), t('history.clearConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('history.clear'),
        style: 'destructive',
        onPress: async () => {
          await clearHistory();
          reload();
        },
      },
    ]);
  };

  const filtered = filter === 'all' ? entries : entries.filter((e) => CATEGORY_OF[e.type] === filter);

  // Trend cards, one per check type in the selected category (empty for "All" — too
  // heterogeneous a mix of BPM/percentages to plot meaningfully on one chart).
  const trendCards =
    filter === 'all'
      ? []
      : CATEGORY_CHECKS[filter]
          .map((type) => ({ type, series: trendSeriesFor(entries, type) }))
          .filter((c) => c.series.length > 0)
          .map((c) => ({ ...c, summary: summarizeTrend(c.series) }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.filterRow}>
        {getFilters(t).map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {trendCards.map(({ type, series, summary }) => (
        <View key={type} style={styles.card}>
          <Text style={styles.trendCardTitle}>{typeLabel(t, type)}</Text>
          <TrendSparkline values={series.map((p) => p.value)} />
          <Text style={styles.trendSummary}>
            {t('history.trendSummary', {
              latest: summary.latest?.toFixed(1),
              avg: summary.avg.toFixed(1),
              min: summary.min.toFixed(1),
              max: summary.max.toFixed(1),
            })}
            {summary.direction === 'up' && t('history.trendingUp')}
            {summary.direction === 'down' && t('history.trendingDown')}
          </Text>
        </View>
      ))}

      {filtered.length === 0 ? (
        <Text style={styles.empty}>{t('history.empty')}</Text>
      ) : (
        filtered.map((entry) => {
          const level = entryLevel(entry);
          return (
            <View key={entry.id} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowType}>{typeLabel(t, entry.type)}</Text>
                {level && <RiskBadge level={level} />}
              </View>
              <Text style={styles.rowDetail}>{detailLine(t, entry)}</Text>
              <Text style={styles.rowTime}>{formatTimestamp(entry.timestamp)}</Text>
            </View>
          );
        })
      )}

      {entries.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>{t('history.clearHistory')}</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.disclaimer}>{t('history.disclaimer')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  content: { padding: 24, paddingBottom: 48, gap: 14 },
  filterRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#1c1c1c', borderWidth: 1, borderColor: '#333' },
  chipActive: { backgroundColor: '#2f6fed', borderColor: '#2f6fed' },
  chipText: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  card: { backgroundColor: '#1c1c1c', borderRadius: 14, padding: 18, gap: 12 },
  trendCardTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  trendSummary: { color: '#999', fontSize: 13 },
  empty: { color: '#999', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 24 },
  row: { backgroundColor: '#1c1c1c', borderRadius: 14, padding: 16, gap: 4 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowType: { color: '#fff', fontSize: 15, fontWeight: '700' },
  rowDetail: { color: '#ccc', fontSize: 14 },
  rowTime: { color: '#888', fontSize: 12, marginTop: 2 },
  clearButton: { borderColor: '#a11d1d', borderWidth: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  clearButtonText: { color: '#ff6b6b', fontWeight: '700', fontSize: 15 },
  disclaimer: { color: '#666', fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 4 },
});
