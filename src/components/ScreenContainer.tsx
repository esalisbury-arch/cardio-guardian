// Standard screen shell: consistent background + edge padding, so no screen
// has to redecide those on its own (see theme.ts's header comment for why
// that mattered in practice — a few screens ended up with an oversized gap
// under their native header from copying the wrong screen's padding).
//
// `noHeader` is only for the couple of screens that hide the native-stack
// header themselves (Home, Onboarding) and so must manually clear the
// status bar/notch — every other screen should omit it.

import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, spacing, NO_HEADER_TOP_PADDING } from '../theme';

interface Props {
  children: React.ReactNode;
  /** This screen hides the native header and needs to clear the status bar itself. */
  noHeader?: boolean;
  /** Most screens scroll (content can exceed one page); a few fixed-layout screens don't. */
  scroll?: boolean;
  contentStyle?: ViewStyle;
}

export function ScreenContainer({ children, noHeader = false, scroll = true, contentStyle }: Props) {
  const content = [styles.content, noHeader && styles.noHeaderTop, contentStyle];

  if (scroll) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={content}>
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.container, ...content]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xl * 2, gap: spacing.lg },
  noHeaderTop: { paddingTop: NO_HEADER_TOP_PADDING },
});
