import type {
  ActivityCategory,
  ChallengeActionResult,
  ChallengeDifficulty,
  ChallengeFrequency,
  EcoBadge,
  GreenChallenge,
  LeaderboardEntry,
  RewardHistoryEntry,
} from '@/types/carbon';
import {
  getPeriodKeyForFrequency,
  mergeChallengesWithPeriodProgress,
  sortBadgesForDisplay,
} from '@/utils/gamificationEngine';

import { apiRequest } from './apiClient';

interface ChallengeCatalogApiRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: ActivityCategory;
  frequency: ChallengeFrequency;
  difficulty: ChallengeDifficulty;
  co2_savings_kg: number;
  reward_points: number;
  target_count: number;
  unit_label: string;
  action_steps_hint: string;
  verification_note: string;
  sort_order: number;
}

interface UserChallengeApiRow {
  id: string;
  challenge_id: string;
  period_key: string;
  progress: number;
  status: 'joined' | 'completed';
  last_action_note: string | null;
  last_action_at: string | null;
  completed_at: string | null;
}

export interface ChallengesSnapshot {
  challenges: GreenChallenge[];
  totalCompletedChallenges: number;
}

export async function fetchChallengesSnapshot(
  _userId: string,
  now: Date = new Date()
): Promise<ChallengesSnapshot> {
  const res = await apiRequest<{
    catalog: ChallengeCatalogApiRow[];
    userChallenges: UserChallengeApiRow[];
    totalCompletedChallenges: number;
  }>('/api/challenges', { method: 'GET' });

  const catalogRows = res.catalog ?? [];
  const userRows = res.userChallenges ?? [];

  const merged = mergeChallengesWithPeriodProgress(
    catalogRows.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      category: c.category,
      frequency: c.frequency,
      difficulty: c.difficulty,
      co2_savings_kg: Number(c.co2_savings_kg),
      reward_points: Number(c.reward_points),
      target_count: Number(c.target_count),
      unit_label: c.unit_label,
      action_steps_hint: c.action_steps_hint,
      verification_note: c.verification_note,
      sort_order: c.sort_order,
    })),
    userRows.map((u) => ({
      id: u.id,
      challenge_id: u.challenge_id,
      period_key: u.period_key,
      progress: Number(u.progress),
      status: u.status,
      last_action_note: u.last_action_note,
      last_action_at: u.last_action_at,
      completed_at: u.completed_at,
    })),
    now
  );

  return {
    challenges: merged.challenges,
    totalCompletedChallenges: Number(
      res.totalCompletedChallenges ?? merged.totalCompletedChallenges ?? 0
    ),
  };
}

export async function fetchChallengesWithProgress(
  userId: string
): Promise<GreenChallenge[]> {
  const snapshot = await fetchChallengesSnapshot(userId);
  return snapshot.challenges;
}

export async function recordChallengeAction(params: {
  challenge: GreenChallenge;
  mode: 'join' | 'increment';
  actionNote?: string;
  now?: Date;
}): Promise<ChallengeActionResult> {
  const { challenge, mode, actionNote, now = new Date() } = params;
  const periodKey = getPeriodKeyForFrequency(challenge.frequency, now);

  const res = await apiRequest<ChallengeActionResult>(
    `/api/challenges/${encodeURIComponent(challenge.id)}/action`,
    {
      method: 'POST',
      body: {
        mode,
        periodKey,
        actionNote: actionNote?.trim() || null,
      },
    }
  );

  return {
    userChallengeId: res.userChallengeId ?? challenge.userChallengeId ?? '',
    challengeId: res.challengeId ?? challenge.id,
    periodKey: res.periodKey ?? periodKey,
    status: res.status === 'completed' ? 'completed' : 'joined',
    progress: Number(res.progress ?? 0),
    targetCount: Number(res.targetCount ?? challenge.target),
    pointsAwarded: Number(res.pointsAwarded ?? 0),
    newlyCompleted: Boolean(res.newlyCompleted),
    duplicateBlocked: Boolean(res.duplicateBlocked),
    unlockedBadges: Array.isArray(res.unlockedBadges) ? res.unlockedBadges : [],
    totalPoints: Number(res.totalPoints ?? 0),
    ecoStreakDays: Number(res.ecoStreakDays ?? 0),
  };
}

export async function joinUserChallenge(
  _userId: string,
  challenge: GreenChallenge
): Promise<ChallengeActionResult> {
  return recordChallengeAction({ challenge, mode: 'join' });
}

export async function incrementUserChallengeProgress(
  _userId: string,
  challenge: GreenChallenge,
  actionNote?: string
): Promise<ChallengeActionResult> {
  return recordChallengeAction({ challenge, mode: 'increment', actionNote });
}

export async function fetchUserAchievements(
  _userId: string
): Promise<EcoBadge[]> {
  const res = await apiRequest<{ badges: EcoBadge[] }>('/api/achievements', {
    method: 'GET',
  });
  return sortBadgesForDisplay(res.badges ?? []);
}

export async function fetchRewardHistory(
  _userId: string,
  limit = 40
): Promise<RewardHistoryEntry[]> {
  const res = await apiRequest<{ entries: RewardHistoryEntry[] }>(
    `/api/rewards?limit=${encodeURIComponent(String(limit))}`,
    { method: 'GET' }
  );
  return res.entries ?? [];
}

export async function fetchLeaderboard(limit = 25): Promise<LeaderboardEntry[]> {
  const res = await apiRequest<{ entries: LeaderboardEntry[] }>(
    `/api/leaderboard?limit=${encodeURIComponent(String(limit))}`,
    { method: 'GET' }
  );
  return res.entries ?? [];
}
