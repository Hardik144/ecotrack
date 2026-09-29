import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';

import {
  Badge,
  Button,
  Card,
  ScreenContainer,
  ThemedText,
} from '@/components';
import { ONBOARDING_SLIDES, Radii, Spacing } from '@/constants';
import { useEcoTrack } from '@/context';
import { useTheme } from '@/hooks';
import { ROUTES } from '@/types';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { isAuthenticated, completeOnboarding } = useEcoTrack();
  const [stepIndex, setStepIndex] = useState(0);

  const totalSteps = ONBOARDING_SLIDES.length;
  const activeSlide = ONBOARDING_SLIDES[stepIndex];
  const isLastStep = stepIndex === totalSteps - 1;

  const finishOnboarding = () => {
    if (isAuthenticated) {
      void completeOnboarding();
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(ROUTES.home);
      }
      return;
    }
    router.replace(ROUTES.login);
  };

  return (
    <ScreenContainer scrollable edges={['top', 'bottom']}>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <Badge label={`Step ${stepIndex + 1} of ${totalSteps}`} tone="secondary" />
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={finishOnboarding}>
            <ThemedText variant="label" color="textMuted">
              Skip
            </ThemedText>
          </Pressable>
        </View>

        <Animated.View
          key={activeSlide.id}
          entering={FadeInRight.duration(240)}
          style={styles.slideBody}>
          <View
            style={[
              styles.illustrationCard,
              { backgroundColor: colors.secondary },
            ]}>
            <View
              style={[
                styles.outerHalo,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <View
                style={[
                  styles.innerIconCircle,
                  { backgroundColor: colors.primary },
                ]}>
                <Ionicons
                  name={activeSlide.icon}
                  size={44}
                  color={colors.textOnPrimary}
                />
              </View>
            </View>

            <View
              style={[
                styles.floatingChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <Ionicons
                name={activeSlide.accentIcon}
                size={16}
                color={colors.primary}
              />
              <ThemedText variant="label" color="primary">
                {activeSlide.badge}
              </ThemedText>
            </View>
          </View>

          <View style={styles.copySection}>
            <ThemedText variant="h1" style={styles.centerText}>
              {activeSlide.title}
            </ThemedText>
            <ThemedText
              variant="body"
              color="textSecondary"
              style={styles.centerText}>
              {activeSlide.description}
            </ThemedText>
          </View>

          <Card variant="elevated" padding="md" style={styles.highlightsCard}>
            {activeSlide.highlights.map((point) => (
              <View key={point} style={styles.highlightRow}>
                <View
                  style={[
                    styles.checkBadge,
                    { backgroundColor: colors.secondary },
                  ]}>
                  <Ionicons name="checkmark" size={14} color={colors.primary} />
                </View>
                <ThemedText variant="bodyMedium" style={styles.highlightText}>
                  {point}
                </ThemedText>
              </View>
            ))}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(220)} style={styles.footer}>
          <View style={styles.dotsRow}>
            {ONBOARDING_SLIDES.map((slide, idx) => {
              const active = idx === stepIndex;
              return (
                <Pressable
                  key={slide.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to step ${idx + 1}`}
                  onPress={() => setStepIndex(idx)}
                  style={[
                    styles.dot,
                    {
                      width: active ? 26 : 8,
                      backgroundColor: active ? colors.primary : colors.border,
                    },
                  ]}
                />
              );
            })}
          </View>

          <View style={styles.buttonRow}>
            {stepIndex > 0 ? (
              <View style={styles.halfBtn}>
                <Button
                  label="Back"
                  variant="outline"
                  fullWidth
                  leftIcon="arrow-back"
                  onPress={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                />
              </View>
            ) : null}

            <View style={stepIndex > 0 ? styles.halfBtn : styles.fullBtn}>
              <Button
                label={isLastStep ? 'Get Started' : 'Next'}
                variant="primary"
                size="lg"
                fullWidth
                rightIcon={isLastStep ? 'leaf' : 'arrow-forward'}
                onPress={() => {
                  if (isLastStep) {
                    finishOnboarding();
                  } else {
                    setStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
                  }
                }}
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'space-between',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slideBody: {
    gap: Spacing.lg,
  },
  illustrationCard: {
    borderRadius: Radii.xl,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  outerHalo: {
    width: 120,
    height: 120,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerIconCircle: {
    width: 86,
    height: 86,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  copySection: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  centerText: {
    textAlign: 'center',
  },
  highlightsCard: {
    gap: Spacing.md,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightText: {
    flex: 1,
  },
  footer: {
    gap: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
  },
  dot: {
    height: 8,
    borderRadius: Radii.pill,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  halfBtn: {
    flex: 1,
  },
  fullBtn: {
    flex: 1,
  },
});
