import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RiskLevel } from '../types';

const COLORS: Record<RiskLevel, { bg: string; fg: string; labelKey: string }> = {
  NORMAL: { bg: '#1f6f43', fg: '#eafff2', labelKey: 'riskBadge.normal' },
  LOW: { bg: '#8a6d1a', fg: '#fff8e6', labelKey: 'riskBadge.low' },
  WARNING: { bg: '#a35a12', fg: '#fff3e6', labelKey: 'riskBadge.warning' },
  CRITICAL: { bg: '#a11d1d', fg: '#ffecec', labelKey: 'riskBadge.critical' },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const { t } = useTranslation();
  const c = COLORS[level];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{t(c.labelKey)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
  },
});
