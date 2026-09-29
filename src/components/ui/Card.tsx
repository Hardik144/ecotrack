import type { PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { Radii, Spacing } from '@/constants/theme';
import { usePressAnimation } from '@/hooks/usePressAnimation';
import { useTheme } from '@/hooks/useTheme';

export type CardVariant = 'elevated' | 'outlined' | 'mint' | 'forest';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends PropsWithChildren {
  variant?: CardVariant;
  padding?: CardPadding;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PADDING_MAP: Record<CardPadding, number> = {
  none: 0,
  sm: Spacing.md,
  md: Spacing.base,
  lg: Spacing.lg,
};

/**
 * Rounded EcoTrack card surface with optional interactive spring press animation.
 */
export function Card({
  children,
  variant = 'elevated',
  padding = 'md',
  onPress,
  accessibilityLabel,
  style,
}: CardProps) {
  const { colors, shadows } = useTheme();
  const isInteractive = typeof onPress === 'function';
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({
    targetScale: 0.985,
    disabled: !isInteractive,
  });

  const variantStyle: ViewStyle = {
    elevated: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    outlined: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mint: {
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    forest: {
      backgroundColor: colors.primary,
      borderWidth: 0,
      ...shadows.md,
    },
  }[variant];

  const contentStyle: StyleProp<ViewStyle> = [
    styles.base,
    variantStyle,
    { padding: PADDING_MAP[padding] },
    style,
  ];

  if (!isInteractive) {
    return <View style={contentStyle}>{children}</View>;
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[contentStyle, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.lg,
    overflow: 'hidden',
  },
});
