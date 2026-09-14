import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Minimal bar-chart sparkline built from plain Views (same approach as
 * ProgressBar.tsx) — deliberately not pulling in a charting dependency for
 * one small trend strip. `values` is chronological, oldest first.
 */
export function TrendSparkline({
  values,
  color = '#2f6fed',
  height = 56,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // flat series: avoid dividing by zero, render equal bars

  return (
    <View style={[styles.row, { height }]}>
      {values.map((v, i) => {
        const fraction = (v - min) / range;
        const barHeight = Math.max(4, fraction * height);
        return <View key={i} style={[styles.bar, { height: barHeight, backgroundColor: color }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bar: { flex: 1, borderRadius: 3, minWidth: 3 },
});
