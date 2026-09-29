import { Text, type TextProps } from 'react-native';

import type { ThemeColorKey, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export type TextVariant = keyof typeof Typography;

export interface ThemedTextProps extends TextProps {
  variant?: TextVariant;
  color?: ThemeColorKey;
}

/**
 * Typography component bound to EcoTrack's theme palette and type scale.
 */
export function ThemedText({
  variant = 'body',
  color = 'text',
  style,
  ...rest
}: ThemedTextProps) {
  const { colors, typography } = useTheme();

  return (
    <Text
      style={[typography[variant], { color: colors[color] }, style]}
      {...rest}
    />
  );
}
