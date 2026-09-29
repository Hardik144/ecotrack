import {
  Animation,
  Colors,
  Layout,
  Radii,
  Shadows,
  Spacing,
  Typography,
  type ColorSchemeName,
  type ThemeColors,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

export interface AppTheme {
  colorScheme: ColorSchemeName;
  isDark: boolean;
  colors: ThemeColors;
  typography: typeof Typography;
  spacing: typeof Spacing;
  radii: typeof Radii;
  shadows: typeof Shadows;
  animation: typeof Animation;
  layout: typeof Layout;
}

export function useTheme(): AppTheme {
  const rawScheme = useColorScheme();
  const colorScheme: ColorSchemeName = rawScheme === 'dark' ? 'dark' : 'light';

  return {
    colorScheme,
    isDark: colorScheme === 'dark',
    colors: Colors[colorScheme],
    typography: Typography,
    spacing: Spacing,
    radii: Radii,
    shadows: Shadows,
    animation: Animation,
    layout: Layout,
  };
}
