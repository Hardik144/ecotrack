import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import type { AppIconName } from '@/constants/config';
import { Radii, Spacing } from '@/constants/theme';
import { usePressAnimation } from '@/hooks/usePressAnimation';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from './ThemedText';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: AppIconName;
  rightIcon?: AppIconName;
  hapticFeedback?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZE_STYLES: Record<ButtonSize, { height: number; paddingHorizontal: number; iconSize: number; fontSize: number }> = {
  sm: { height: 38, paddingHorizontal: Spacing.md, iconSize: 16, fontSize: 13 },
  md: { height: 48, paddingHorizontal: Spacing.lg, iconSize: 18, fontSize: 15 },
  lg: { height: 54, paddingHorizontal: Spacing.xl, iconSize: 20, fontSize: 16 },
};

/**
 * Reusable animated EcoTrack button with Forest Green / Light Green variants,
 * loading state, icon slots, and subtle haptic feedback.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  hapticFeedback = true,
  onPress,
  style,
  ...rest
}: ButtonProps) {
  const { colors, shadows } = useTheme();
  const isDisabled = disabled || loading;
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({
    disabled: isDisabled,
  });

  const sizeMetrics = SIZE_STYLES[size];

  const variantPalette = {
    primary: {
      background: colors.primary,
      pressedBackground: colors.primaryPressed,
      textColor: colors.textOnPrimary,
      borderColor: 'transparent',
      borderWidth: 0,
    },
    secondary: {
      background: colors.secondary,
      pressedBackground: colors.secondaryPressed,
      textColor: colors.textOnSecondary,
      borderColor: 'transparent',
      borderWidth: 0,
    },
    outline: {
      background: colors.surface,
      pressedBackground: colors.surfaceElevated,
      textColor: colors.primary,
      borderColor: colors.borderFocused,
      borderWidth: 1.5,
    },
    ghost: {
      background: 'transparent',
      pressedBackground: colors.surfaceElevated,
      textColor: colors.primary,
      borderColor: 'transparent',
      borderWidth: 0,
    },
  }[variant];

  const handlePress = (event: GestureResponderEvent) => {
    if (isDisabled) return;
    if (hapticFeedback && Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(event);
  };

  return (
    <Animated.View
      style={[
        animatedStyle,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.base,
          {
            minHeight: sizeMetrics.height,
            paddingHorizontal: sizeMetrics.paddingHorizontal,
            backgroundColor: pressed
              ? variantPalette.pressedBackground
              : variantPalette.background,
            borderColor: variantPalette.borderColor,
            borderWidth: variantPalette.borderWidth,
          },
          variant === 'primary' && shadows.sm,
          fullWidth && styles.fullWidth,
          style,
        ]}
        {...rest}>
        {loading ? (
          <ActivityIndicator size="small" color={variantPalette.textColor} />
        ) : (
          <View style={styles.contentRow}>
            {leftIcon ? (
              <Ionicons
                name={leftIcon}
                size={sizeMetrics.iconSize}
                color={variantPalette.textColor}
              />
            ) : null}
            <ThemedText
              variant="button"
              style={{
                color: variantPalette.textColor,
                fontSize: sizeMetrics.fontSize,
              }}>
              {label}
            </ThemedText>
            {rightIcon ? (
              <Ionicons
                name={rightIcon}
                size={sizeMetrics.iconSize}
                color={variantPalette.textColor}
              />
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.55,
  },
});
