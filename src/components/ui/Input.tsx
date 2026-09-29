import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { AppIconName } from '@/constants/config';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from './ThemedText';

export interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  errorText?: string;
  leftIcon?: AppIconName;
  rightAdornment?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Reusable rounded form input with animated focus border, icon slots,
 * helper/error messaging, and light/dark theme tokens.
 */
export function Input({
  label,
  helperText,
  errorText,
  leftIcon,
  rightAdornment,
  containerStyle,
  multiline = false,
  editable = true,
  onFocus,
  onBlur,
  style,
  ...rest
}: InputProps) {
  const { colors, typography } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  const hasError = Boolean(errorText);

  const animatedBorderStyle = useAnimatedStyle(() => {
    const progress = focusAnim.get();
    const borderColor = hasError
      ? colors.error
      : interpolateColor(
          progress,
          [0, 1],
          [colors.border, colors.borderFocused]
        );

    return {
      borderColor,
      borderWidth: progress > 0.5 || hasError ? 1.5 : 1,
    };
  }, [colors.border, colors.borderFocused, colors.error, hasError]);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <ThemedText variant="label" color="textSecondary" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}

      <Animated.View
        style={[
          styles.inputContainer,
          {
            backgroundColor: editable ? colors.surface : colors.surfaceElevated,
            minHeight: multiline ? 96 : 50,
            alignItems: multiline ? 'flex-start' : 'center',
          },
          animatedBorderStyle,
        ]}>
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={18}
            color={isFocused ? colors.primary : colors.textMuted}
            style={multiline ? styles.leftIconMultiline : undefined}
          />
        ) : null}

        <TextInput
          editable={editable}
          multiline={multiline}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            focusAnim.set(withTiming(1, { duration: 150 }));
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            focusAnim.set(withTiming(0, { duration: 150 }));
            onBlur?.(e);
          }}
          style={[
            styles.input,
            typography.body,
            { color: colors.text },
            multiline && styles.multilineInput,
            style,
          ]}
          {...rest}
        />

        {rightAdornment ? (
          <View style={styles.rightAdornment}>{rightAdornment}</View>
        ) : null}
      </Animated.View>

      {errorText ? (
        <ThemedText variant="caption" color="error" style={styles.feedback}>
          {errorText}
        </ThemedText>
      ) : helperText ? (
        <ThemedText variant="caption" color="textMuted" style={styles.feedback}>
          {helperText}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.xs,
  },
  label: {
    marginLeft: Spacing.xxs,
  },
  inputContainer: {
    flexDirection: 'row',
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  leftIconMultiline: {
    marginTop: Spacing.md,
  },
  rightAdornment: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedback: {
    marginLeft: Spacing.xxs,
  },
});
