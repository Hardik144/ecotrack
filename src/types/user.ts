import type { ElectricityRegionCode } from './carbon';

/**
 * User profile, preferences, and authentication state types.
 */

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  createdAt: string;
  memberSince: string;
  dailyCarbonBudgetKg: number;
  ecoStreakDays: number;
  sustainabilityScore: number;
  ecoPoints: number;
  levelTitle: string;
  onboardingCompleted: boolean;
}

export interface UserPreferences {
  notificationsEnabled: boolean;
  weeklyDigestEnabled: boolean;
  leaderboardOptIn: boolean;
  preferredUnit: 'metric' | 'imperial';
  electricityRegion: ElectricityRegionCode;
  customElectricityFactorKg: number | null;
}
