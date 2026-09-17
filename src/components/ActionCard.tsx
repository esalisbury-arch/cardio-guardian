// A tappable title+subtitle card. Unifies what used to be a handful of
// near-identical, independently-styled "secondaryButton"/"primaryButton"
// blocks scattered across screens (Home's screening entries, Heart Attack
// Screening's Active Check/Pallor Check, Stroke Screening's three FAST
// checks, Nearby Hospitals' two search buttons) into one component with a
// single visual language.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  onPress: () => void;
  /** 'primary' for the one standout action on a screen (e.g. Nearby Hospitals' ER search); 'secondary' (default) for everything else. */
  variant?: 'primary' | 'secondary';
  /** Optional leading icon (single emoji, matching the rest of the app's icon usage). */
  icon?: string;
}

export function ActionCard({ title, subtitle, onPress, variant = 'secondary', icon }: Props) {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[styles.card, isPrimary ? styles.primary : styles.secondary]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && (
        <View style={styles.iconBadge}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
      )}
      <View style={styles.textColumn}>
        <Text style={[styles.title, isPrimary && styles.titleOnPrimary]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, isPrimary && styles.subtitleOnPrimary]}>{subtitle}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.xl - 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  primary: { backgroundColor: colors.primary },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18 },
  textColumn: { flex: 1 },
  title: { ...typography.cardTitle, color: colors.textPrimary },
  titleOnPrimary: { color: colors.textOnPrimary },
  subtitle: { ...typography.cardSubtitle, color: colors.textSecondary, marginTop: 4 },
  subtitleOnPrimary: { color: 'rgba(255,255,255,0.85)' },
});
