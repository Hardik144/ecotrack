import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * EcoTrack Design System Tokens
 *
 * Brand Anchor Colors:
 * - Primary (Forest Green): #166534
 * - Secondary (Light Green): #DCFCE7
 * - Background (Off-white): #F8FAF7
 */
export const Palette = {
  forest900: '#0F3D22',
  forest800: '#14532D',
  forest700: '#166534', // Primary Brand
  forest600: '#15803D',
  forest500: '#22C55E',
  mint200: '#BBF7D0',
  mint100: '#DCFCE7', // Secondary Brand
  mint50: '#ECFDF5',
  offWhite: '#F8FAF7', // Primary Canvas Background
  white: '#FFFFFF',
  sage100: '#F1F5EE',
  sage200: '#E2EAE0',
  sage300: '#C5D5C1',
  ink900: '#102116',
  ink700: '#334B3B',
  ink500: '#5C7363',
  ink400: '#7D9283',
  amber600: '#D97706',
  amber100: '#FEF3C7',
  red600: '#DC2626',
  red100: '#FEE2E2',
  sky600: '#0284C7',
  sky100: '#E0F2FE',
  // Dark mode neutrals
  night950: '#09120C',
  night900: '#111E16',
  night800: '#1A2C21',
  night700: '#263D2E',
  nightText: '#EEF5F0',
  nightMuted: '#99B2A2',
} as const;

export interface ThemeColors {
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  secondary: string;
  secondaryPressed: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderFocused: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  textOnSecondary: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  error: string;
  errorSoft: string;
  info: string;
  infoSoft: string;
  tabBarBackground: string;
  tabBarBorder: string;
  tabIconInactive: string;
  shadowColor: string;
}

export const Colors: Record<'light' | 'dark', ThemeColors> = {
  light: {
    primary: Palette.forest700,
    primaryPressed: Palette.forest800,
    primarySoft: Palette.mint100,
    secondary: Palette.mint100,
    secondaryPressed: Palette.mint200,
    background: Palette.offWhite,
    surface: Palette.white,
    surfaceElevated: Palette.sage100,
    surfaceMuted: Palette.mint50,
    border: Palette.sage200,
    borderFocused: Palette.forest700,
    text: Palette.ink900,
    textSecondary: Palette.ink700,
    textMuted: Palette.ink500,
    textOnPrimary: Palette.white,
    textOnSecondary: Palette.forest800,
    success: Palette.forest600,
    successSoft: Palette.mint100,
    warning: Palette.amber600,
    warningSoft: Palette.amber100,
    error: Palette.red600,
    errorSoft: Palette.red100,
    info: Palette.sky600,
    infoSoft: Palette.sky100,
    tabBarBackground: Palette.white,
    tabBarBorder: Palette.sage200,
    tabIconInactive: Palette.ink400,
    shadowColor: Palette.forest900,
  },
  dark: {
    primary: Palette.forest500,
    primaryPressed: Palette.forest600,
    primarySoft: Palette.night700,
    secondary: Palette.night800,
    secondaryPressed: Palette.night700,
    background: Palette.night950,
    surface: Palette.night900,
    surfaceElevated: Palette.night800,
    surfaceMuted: Palette.night800,
    border: Palette.night700,
    borderFocused: Palette.forest500,
    text: Palette.nightText,
    textSecondary: Palette.nightMuted,
    textMuted: Palette.ink400,
    textOnPrimary: Palette.night950,
    textOnSecondary: Palette.mint100,
    success: Palette.forest500,
    successSoft: Palette.night700,
    warning: '#FBBF24',
    warningSoft: '#3D2E0B',
    error: '#F87171',
    errorSoft: '#3F1616',
    info: '#38BDF8',
    infoSoft: '#0E2D3F',
    tabBarBackground: Palette.night900,
    tabBarBorder: Palette.night700,
    tabIconInactive: Palette.ink400,
    shadowColor: '#000000',
  },
};

export type ColorSchemeName = keyof typeof Colors;
export type ThemeColorKey = keyof ThemeColors;

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  android: {
    sans: 'sans-serif',
    rounded: 'sans-serif-medium',
    mono: 'monospace',
  },
  default: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    rounded: '"SF Pro Rounded", Inter, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
});

export const Typography: Record<
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'subtitle'
  | 'body'
  | 'bodyMedium'
  | 'caption'
  | 'label'
  | 'button'
  | 'mono',
  TextStyle
> = {
  display: {
    fontFamily: Fonts.sans,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  h1: {
    fontFamily: Fonts.sans,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  h2: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  h3: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodyMedium: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  caption: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  button: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  mono: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 9999,
} as const;

export const Shadows: Record<'sm' | 'md' | 'lg', ViewStyle> = {
  sm: {
    shadowColor: Palette.forest900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: Palette.forest900,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: Palette.forest900,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const Animation = {
  springConfig: {
    damping: 18,
    stiffness: 240,
    mass: 0.7,
  },
  pressScale: 0.97,
  enterDurationMs: 280,
} as const;

export const Layout = {
  maxContentWidth: 720,
  screenPaddingHorizontal: Spacing.lg,
  tabBarHeight: Platform.select({ ios: 84, android: 68, default: 66 }) ?? 68,
} as const;
