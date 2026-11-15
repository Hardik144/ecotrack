import type { ElectricityRegionCode } from '@/types/carbon';
import type { UserPreferences, UserProfile } from '@/types/user';
import { resolveElectricityRegion } from '@/utils/carbonCalculator';
import {
  validateAvatarAsset,
  validateDailyBudget,
  validateFullName,
} from '@/utils/validation';

import { apiRequest, resolveBackendAssetUrl } from './apiClient';

interface ProfileApiResponse {
  profile: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    dailyCarbonBudgetKg: number;
    ecoPoints: number;
    sustainabilityScore: number;
    levelTitle: string;
    ecoStreakDays: number;
    joinedDate: string;
    onboardingCompleted: boolean;
  };
  preferences: {
    notificationsEnabled: boolean;
    weeklyDigestEnabled: boolean;
    leaderboardOptIn: boolean;
    preferredUnit: 'metric' | 'imperial';
    electricityRegion: ElectricityRegionCode;
    customElectricityFactorKg: number | null;
  };
}

export function formatMemberSince(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'EcoTrack Member';
  }
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
}

function mapProfileResponse(res: ProfileApiResponse): {
  profile: UserProfile;
  preferences: UserPreferences;
} {
  return {
    profile: {
      id: res.profile.id,
      fullName: res.profile.fullName,
      email: res.profile.email,
      avatarUrl: resolveBackendAssetUrl(res.profile.avatarUrl),
      createdAt: res.profile.joinedDate,
      memberSince: formatMemberSince(res.profile.joinedDate),
      ecoPoints: Number(res.profile.ecoPoints ?? 0),
      ecoStreakDays: Number(res.profile.ecoStreakDays ?? 0),
      levelTitle: res.profile.levelTitle ?? 'Seedling Explorer',
      dailyCarbonBudgetKg: Number(res.profile.dailyCarbonBudgetKg ?? 12),
      sustainabilityScore: Number(res.profile.sustainabilityScore ?? 50),
      onboardingCompleted: Boolean(res.profile.onboardingCompleted),
    },
    preferences: {
      notificationsEnabled: Boolean(res.preferences.notificationsEnabled),
      weeklyDigestEnabled: Boolean(res.preferences.weeklyDigestEnabled),
      leaderboardOptIn: Boolean(res.preferences.leaderboardOptIn),
      preferredUnit:
        res.preferences.preferredUnit === 'imperial' ? 'imperial' : 'metric',
      electricityRegion: res.preferences.electricityRegion ?? 'global',
      customElectricityFactorKg:
        res.preferences.customElectricityFactorKg !== null &&
        res.preferences.customElectricityFactorKg !== undefined
          ? Number(res.preferences.customElectricityFactorKg)
          : null,
    },
  };
}

export async function fetchOrCreateUserProfile(_params: {
  userId: string;
  email: string;
  fallbackName?: string;
}): Promise<{ profile: UserProfile; preferences: UserPreferences }> {
  const res = await apiRequest<ProfileApiResponse>('/api/profile', {
    method: 'GET',
  });
  return mapProfileResponse(res);
}

export interface ProfileUpdatePatch {
  fullName?: string;
  avatarUrl?: string | null;
  dailyCarbonBudgetKg?: number;
  notificationsEnabled?: boolean;
  weeklyDigestEnabled?: boolean;
  leaderboardOptIn?: boolean;
  preferredUnit?: 'metric' | 'imperial';
  electricityRegion?: ElectricityRegionCode;
  customElectricityFactorKg?: number | null;
  onboardingCompleted?: boolean;
}

export async function updateUserProfile(
  _userId: string,
  patch: ProfileUpdatePatch
): Promise<{ profile: UserProfile; preferences: UserPreferences }> {
  const payload: ProfileUpdatePatch = {};

  if (patch.fullName !== undefined) {
    const check = validateFullName(patch.fullName);
    if (!check.ok || !check.value) {
      throw new Error(check.error ?? 'Invalid display name.');
    }
    payload.fullName = check.value;
  }

  if (patch.avatarUrl !== undefined) {
    payload.avatarUrl = patch.avatarUrl;
  }

  if (patch.dailyCarbonBudgetKg !== undefined) {
    const check = validateDailyBudget(patch.dailyCarbonBudgetKg);
    if (!check.ok || check.value === undefined) {
      throw new Error(check.error ?? 'Invalid daily carbon budget.');
    }
    payload.dailyCarbonBudgetKg = check.value;
  }

  if (patch.notificationsEnabled !== undefined) {
    payload.notificationsEnabled = patch.notificationsEnabled;
  }
  if (patch.weeklyDigestEnabled !== undefined) {
    payload.weeklyDigestEnabled = patch.weeklyDigestEnabled;
  }
  if (patch.leaderboardOptIn !== undefined) {
    payload.leaderboardOptIn = patch.leaderboardOptIn;
  }
  if (patch.preferredUnit !== undefined) {
    payload.preferredUnit = patch.preferredUnit;
  }

  if (patch.electricityRegion !== undefined) {
    const regionCheck = resolveElectricityRegion(
      patch.electricityRegion,
      patch.customElectricityFactorKg
    );
    if (!regionCheck.ok || !regionCheck.data) {
      throw new Error(regionCheck.error ?? 'Invalid regional electricity factor.');
    }
    payload.electricityRegion = patch.electricityRegion;
    if (patch.customElectricityFactorKg !== undefined) {
      payload.customElectricityFactorKg = patch.customElectricityFactorKg;
    }
  } else if (patch.customElectricityFactorKg !== undefined) {
    payload.customElectricityFactorKg = patch.customElectricityFactorKg;
  }

  if (patch.onboardingCompleted !== undefined) {
    payload.onboardingCompleted = patch.onboardingCompleted;
  }

  const res = await apiRequest<ProfileApiResponse>('/api/profile', {
    method: 'PATCH',
    body: payload,
  });
  return mapProfileResponse(res);
}

export async function uploadUserAvatar(
  _userId: string,
  params: {
    base64: string;
    mimeType?: string;
  }
): Promise<{ profile: UserProfile; preferences: UserPreferences }> {
  const approxBytes = Math.ceil((params.base64.length * 3) / 4);
  const validation = validateAvatarAsset(params.mimeType, approxBytes);
  if (!validation.ok) {
    throw new Error(validation.error ?? 'Invalid profile photo.');
  }

  const res = await apiRequest<ProfileApiResponse>('/api/profile/avatar', {
    method: 'POST',
    body: {
      base64: params.base64,
      mimeType: params.mimeType ?? 'image/jpeg',
    },
  });

  return mapProfileResponse(res);
}
