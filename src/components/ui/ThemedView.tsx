import { View, type ViewProps } from 'react-native';

import type { ThemeColorKey } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export interface ThemedViewProps extends ViewProps {
  surfaceColor?: ThemeColorKey;
}

/**
 * Surface container bound to EcoTrack's theme color tokens.
 */
export function ThemedView({
  surfaceColor = 'background',
  style,
  ...rest
}: ThemedViewProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[{ backgroundColor: colors[surfaceColor] }, style]}
      {...rest}
    />
  );
}
