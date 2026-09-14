import React from 'react';
import { StyleSheet, View } from 'react-native';

export function ProgressBar({ fraction, color = '#a11d1d' }: { fraction: number; color?: string }) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#2a2a2a',
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
