// Shared design tokens for Verita Health's dark UI.
//
// Before this existed, every screen's StyleSheet redefined the same handful
// of colors/spacing values independently (e.g. the background `#111` and
// card `#1c1c1c` appeared, slightly inconsistently, in a dozen files; some
// screens used `padding: 24` for their outer container, others `padding:
// 24, paddingTop: 64` even when a native header was already present, adding
// an oversized gap under the title). Centralizing them here doesn't change
// what anything looks like on its own — it just gives every screen the same
// source of truth, so future changes and new screens stay consistent by
// construction instead of by remembering to copy the right hex code.

export const colors = {
  // Surfaces
  background: '#111111',
  surface: '#1c1c1c',
  surfaceBorder: '#333333',
  surfaceBorderSubtle: '#2a2a2a',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#999999',
  textTertiary: '#888888',
  textMuted: '#666666',
  textOnPrimary: '#ffffff',

  // Brand / primary action
  primary: '#2f6fed',
  primaryMuted: '#7fa8ff',
  primarySurface: 'rgba(47,111,237,0.18)',

  // Status
  normal: '#1f6f43',
  normalText: '#eafff2',
  low: '#8a6d1a',
  lowText: '#fff8e6',

  // Danger / emergency
  danger: '#a11d1d',
  dangerSurface: '#3a1414',
  dangerText: '#ffd6d6',
  dangerTextSoft: '#ffe3e3',
  dangerAccent: '#ff6b6b',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
} as const;

export const radii = {
  sm: 10,
  md: 12,
  lg: 14,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 26, fontWeight: '800' as const },
  sectionLabel: { fontSize: 13, fontWeight: '700' as const },
  cardTitle: { fontSize: 18, fontWeight: '800' as const },
  cardSubtitle: { fontSize: 13 },
  body: { fontSize: 15, lineHeight: 21 },
  intro: { fontSize: 13, lineHeight: 19 },
  caption: { fontSize: 12, lineHeight: 17 },
};

// Standard screen edge padding. Screens rendered *with* a native-stack
// header (the common case) should only ever need `padding: spacing.xl`
// (see ScreenContainer) — this constant exists for the few screens that
// hide the header themselves (Home, Onboarding) and so must manually clear
// the status bar/notch.
export const NO_HEADER_TOP_PADDING = 64;
