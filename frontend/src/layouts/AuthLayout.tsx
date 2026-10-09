import { ReactNode } from 'react';
import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/src/assets/styles/theme';

type AuthLayoutProps = {
  children: ReactNode;
  compact?: boolean;
  scrollable?: boolean;
};

export default function AuthLayout({
  children,
  compact = false,
  scrollable = true,
}: AuthLayoutProps) {
  const content = (
    <View style={[styles.card, compact ? styles.cardCompact : null]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.backgroundTop} />
      <View style={styles.backgroundMid} />
      <View style={styles.backgroundGrid} />
      <View style={styles.backgroundGlow} />
      <View style={styles.backgroundGlowSecondary} />
      <View style={styles.backgroundOrb} />

      {scrollable ? (
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        <View style={styles.content}>{content}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backgroundGlow: {
    backgroundColor: 'rgba(255, 183, 150, 0.30)',
    borderRadius: 220,
    height: 280,
    position: 'absolute',
    right: -70,
    top: 84,
    width: 280,
  },
  backgroundGlowSecondary: {
    backgroundColor: 'rgba(80, 160, 255, 0.18)',
    borderRadius: 240,
    height: 260,
    left: -90,
    position: 'absolute',
    top: 280,
    width: 260,
  },
  backgroundGrid: {
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderRadius: 44,
    bottom: 120,
    left: 20,
    opacity: 0.55,
    position: 'absolute',
    right: 20,
    top: 24,
  },
  backgroundOrb: {
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderRadius: 200,
    height: 180,
    left: '50%',
    marginLeft: -90,
    position: 'absolute',
    top: 118,
    width: 180,
  },
  backgroundMid: {
    backgroundColor: 'rgba(255,255,255,0.50)',
    borderBottomLeftRadius: 72,
    borderBottomRightRadius: 72,
    height: 320,
    left: 20,
    opacity: 0.82,
    position: 'absolute',
    right: 20,
    top: 30,
  },
  backgroundTop: {
    backgroundColor: '#D3E7FA',
    borderBottomLeftRadius: 76,
    borderBottomRightRadius: 76,
    height: 286,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: radius.xl,
    borderColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 28 },
    shadowOpacity: 0.18,
    shadowRadius: 34,
  },
  cardCompact: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: 88,
  },
  safeArea: {
    backgroundColor: '#E9F2FB',
    flex: 1,
  },
});
