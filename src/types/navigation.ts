/**
 * Centralized route definitions for Expo Router typed navigation.
 */

export const ROUTES = {
  home: '/(tabs)',
  calculate: '/(tabs)/calculate',
  analytics: '/(tabs)/analytics',
  assistant: '/(tabs)/assistant',
  profile: '/(tabs)/profile',
  challenges: '/challenges',
  onboarding: '/onboarding',
  login: '/(auth)/login',
  register: '/(auth)/register',
  forgotPassword: '/(auth)/forgot-password',
  resetPassword: '/reset-password',
  activityDetail: (id: string) => `/activity/${id}` as const,
} as const;

export type TabRouteName = 'index' | 'calculate' | 'analytics' | 'assistant' | 'profile';
