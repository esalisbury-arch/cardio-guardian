import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RiskLevel } from '../types';
import { colors, radii } from '../theme';

const COLORS: Record<RiskLevel, { bg: string; fg: string; labelKey: string }> = {
  NORMAL: { bg: colors.normal, fg: colors.normalText, labelKey: 'riskBadge.normal' },
  LOW: { bg: colors.low, fg: colors.lowText, labelKey: 'riskBadge.low' },
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
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
  },
});
