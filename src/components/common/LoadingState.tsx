import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Card } from '@/components/ui/Card';
import { ThemedText } from '@/components/ui/ThemedText';

export interface LoadingStateProps {
  label?: string;
  compact?: boolean;
}

/**
 * Branded skeleton / loading surface for async calculations or transitions.
 */
export function LoadingState({
  label = 'Loading sustainability insights...',
  compact = false,
}: LoadingStateProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.set(
      withRepeat(
        withSequence(
          withTiming(0.9, { duration: 650 }),
          withTiming(0.45, { duration: 650 })
        ),
        -1,
        true
      )
    );
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
  }));

  if (compact) {
    return (
      <View style={styles.compactRow}>
        <ActivityIndicator size="small" color={colors.primary} />
        <ThemedText variant="caption" color="textSecondary">
          {label}
        </ThemedText>
      </View>
    );
  }

  return (
    <Card variant="outlined" padding="lg" style={styles.card}>
      <View style={styles.headerRow}>
        <ActivityIndicator size="small" color={colors.primary} />
        <ThemedText variant="bodyMedium" color="textSecondary">
          {label}
        </ThemedText>
      </View>
      <Animated.View style={[styles.skeletonStack, pulseStyle]}>
        <View
          style={[
            styles.skeletonBar,
            styles.barWide,
            { backgroundColor: colors.surfaceElevated },
          ]}
        />
        <View
          style={[
            styles.skeletonBar,
            styles.barMedium,
            { backgroundColor: colors.surfaceElevated },
          ]}
        />
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  card: {
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  skeletonStack: {
    gap: Spacing.sm,
  },
  skeletonBar: {
    height: 12,
    borderRadius: Radii.pill,
  },
  barWide: {
    width: '90%',
  },
  barMedium: {
    width: '62%',
  },
});
