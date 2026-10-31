import type {
  ActivityCategory,
  CanonicalAchievementBadgeKey,
  ChallengeDifficulty,
  ChallengeFrequency,
  EcoBadge,
  EcoBadgeIcon,
  GreenChallenge,
  LeaderboardEntry,
  RewardHistoryEntry,
  SustainabilityProgressSummary,
} from '../types/carbon';

export const ACTION_VERIFICATION_LIMITATION_TEXT =
  'Challenges are self-attested actions under EcoTrack’s honesty policy. EcoTrack does not verify transit tickets, receipts, smart plugs, or GPS sensors, and rewards are strictly capped at once per daily/weekly period.';

export const ANTI_FARMING_POLICY_TEXT =
  'Logging carbon footprint numbers in the calculator never earns Eco Points—only completed sustainable actions and earned milestone badges grant points.';

export interface BadgeDefinition {
  badgeKey: CanonicalAchievementBadgeKey;
  title: string;
  description: string;
  icon: EcoBadgeIcon;
  requirementLabel: string;
  pointsBonus: number;
  order: number;
}

export const REQUIRED_BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  {
    badgeKey: 'first_green_step',
    title: 'First Green Step',
    description: 'Completed your very first sustainable action challenge in EcoTrack.',
    icon: 'leaf',
    requirementLabel: 'Complete 1 challenge',
    pointsBonus: 25,
    order: 1,
  },
  {
    badgeKey: 'plastic_free_hero',
    title: 'Plastic-Free Hero',
    description: 'Replaced single-use bottles or disposable plastics across 2+ lifestyle challenges.',
    icon: 'water',
    requirementLabel: '2 plastic-free/bottle actions',
    pointsBonus: 50,
    order: 2,
  },
  {
    badgeKey: 'energy_saver',
    title: 'Energy Saver',
    description: 'Cut idle appliance draw across 2+ electricity conservation challenges.',
    icon: 'flash',
    requirementLabel: '2 energy-saving challenges',
    pointsBonus: 50,
    order: 3,
  },
  {
    badgeKey: 'eco_warrior',
    title: 'Eco Warrior',
    description: 'Built consistent sustainable habits by completing 5+ action challenges or a 3-day action streak.',
    icon: 'shield-checkmark',
    requirementLabel: '5 challenges or 3-day streak',
    pointsBonus: 100,
    order: 4,
  },
  {
    badgeKey: 'carbon_champion',
    title: 'Carbon Champion',
    description: 'Reached 10+ completed sustainable challenges and 350+ earned Eco Points.',
    icon: 'trophy',
    requirementLabel: '10 challenges & 350 pts',
    pointsBonus: 150,
    order: 5,
  },
] as const;

const BADGE_ORDER_MAP = new Map<string, number>(
  REQUIRED_BADGE_DEFINITIONS.map((def) => [def.badgeKey, def.order])
);

export const LEVEL_TIERS = [
  { title: 'Seedling Explorer', minPoints: 0, maxPointsExclusive: 150 },
  { title: 'Green Pathfinder', minPoints: 150, maxPointsExclusive: 400 },
  { title: 'Forest Steward', minPoints: 400, maxPointsExclusive: 1000 },
  { title: 'Planet Guardian', minPoints: 1000, maxPointsExclusive: null },
] as const;

export interface LevelProgressInfo {
  levelTitle: string;
  nextLevelTitle: string | null;
  currentThreshold: number;
  nextThreshold: number | null;
  pointsToNext: number;
  progressPct: number;
}

/**
 * Formats YYYY-MM-DD in the user's local calendar timezone so daily reset
 * borders match the user's actual day rather than UTC midnight alone.
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyPeriodKey(date: Date = new Date()): string {
  return `daily:${getLocalDateKey(date)}`;
}

/**
 * Computes ISO-8601 week numbering year and week number from local Y/M/D parts,
 * matching PostgreSQL `to_char(date, 'IYYY-"W"IW')`.
 */
export function getIsoWeekParts(date: Date = new Date()): {
  isoYear: number;
  isoWeek: number;
} {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const isoYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return { isoYear, isoWeek };
}

export function getWeeklyPeriodKey(date: Date = new Date()): string {
  const { isoYear, isoWeek } = getIsoWeekParts(date);
  return `weekly:${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
}

export function getPeriodKeyForFrequency(
  frequency: ChallengeFrequency,
  date: Date = new Date()
): string {
  return frequency === 'weekly'
    ? getWeeklyPeriodKey(date)
    : getDailyPeriodKey(date);
}

/**
 * Produces a privacy-conscious display handle ("Maya C." or "Eco Member")
 * matching SQL `format_privacy_display_name`. Never returns full email addresses.
 */
export function formatPrivacyDisplayName(
  rawName: string | null | undefined
): string {
  const raw = (rawName ?? '').trim();
  const withoutEmailDomain = raw.includes('@')
    ? raw.split('@')[0].replace(/[._-]+/g, ' ')
    : raw;
  const cleaned = withoutEmailDomain.replace(/\s+/g, ' ').trim();

  if (cleaned.length < 2) {
    return 'Eco Member';
  }

  const parts = cleaned.split(' ').filter(Boolean);
  const firstWord = parts[0].slice(0, 16);
  const secondWord = parts[1];

  if (secondWord) {
    return `${firstWord} ${secondWord.charAt(0).toUpperCase()}.`;
  }

  return firstWord;
}

export function getLevelProgress(ecoPoints: number): LevelProgressInfo {
  const safePoints = Math.max(0, Math.round(ecoPoints));

  for (let i = 0; i < LEVEL_TIERS.length; i += 1) {
    const tier = LEVEL_TIERS[i];
    if (
      tier.maxPointsExclusive === null ||
      safePoints < tier.maxPointsExclusive
    ) {
      const nextTier = LEVEL_TIERS[i + 1] ?? null;
      if (!nextTier || tier.maxPointsExclusive === null) {
        return {
          levelTitle: tier.title,
          nextLevelTitle: null,
          currentThreshold: tier.minPoints,
          nextThreshold: null,
          pointsToNext: 0,
          progressPct: 100,
        };
      }

      const span = nextTier.minPoints - tier.minPoints;
      const earnedInTier = safePoints - tier.minPoints;
      const progressPct = Math.max(
        0,
        Math.min(100, Math.round((earnedInTier / span) * 100))
      );

      return {
        levelTitle: tier.title,
        nextLevelTitle: nextTier.title,
        currentThreshold: tier.minPoints,
        nextThreshold: nextTier.minPoints,
        pointsToNext: Math.max(0, nextTier.minPoints - safePoints),
        progressPct,
      };
    }
  }

  return {
    levelTitle: 'Seedling Explorer',
    nextLevelTitle: 'Green Pathfinder',
    currentThreshold: 0,
    nextThreshold: 150,
    pointsToNext: 150,
    progressPct: 0,
  };
}

export function getDifficultyMeta(difficulty: ChallengeDifficulty): {
  label: string;
  tone: 'primary' | 'amber' | 'danger' | 'neutral';
} {
  if (difficulty === 'hard') {
    return { label: 'Hard', tone: 'danger' };
  }
  if (difficulty === 'medium') {
    return { label: 'Medium', tone: 'amber' };
  }
  return { label: 'Easy', tone: 'primary' };
}

export function getFrequencyLabel(frequency: ChallengeFrequency): string {
  return frequency === 'weekly' ? 'Weekly' : 'Daily';
}

export function formatPeriodBadgeLabel(
  frequency: ChallengeFrequency,
  periodKey: string
): string {
  if (frequency === 'weekly') {
    const weekPart = periodKey.replace('weekly:', '');
    return `Week ${weekPart}`;
  }
  const datePart = periodKey.replace('daily:', '');
  return datePart ? `Today · ${datePart}` : 'Today';
}

export function canAdvanceChallengeInPeriod(
  challenge: Pick<GreenChallenge, 'completed' | 'frequency' | 'periodKey'>
): { allowed: boolean; reason?: string } {
  if (challenge.completed) {
    return {
      allowed: false,
      reason:
        challenge.frequency === 'weekly'
          ? `Already completed for ${challenge.periodKey.replace('weekly:', '')}. Points unlock again next week.`
          : 'Already completed today. Eco Points are capped once per day to prevent duplicate claims.',
    };
  }
  return { allowed: true };
}

export type ChallengeStatusFilter = 'all' | 'active' | 'available' | 'completed';

export interface ChallengeFilterOptions {
  frequency?: 'all' | ChallengeFrequency;
  category?: 'all' | ActivityCategory;
  status?: ChallengeStatusFilter;
}

export function filterChallenges(
  challenges: GreenChallenge[],
  options: ChallengeFilterOptions = {}
): GreenChallenge[] {
  const { frequency = 'all', category = 'all', status = 'all' } = options;

  return challenges.filter((challenge) => {
    if (frequency !== 'all' && challenge.frequency !== frequency) {
      return false;
    }
    if (category !== 'all' && challenge.category !== category) {
      return false;
    }
    if (status === 'completed' && !challenge.completed) {
      return false;
    }
    if (status === 'active' && (!challenge.joined || challenge.completed)) {
      return false;
    }
    if (status === 'available' && (challenge.joined || challenge.completed)) {
      return false;
    }
    return true;
  });
}

export function sortChallenges(challenges: GreenChallenge[]): GreenChallenge[] {
  const rankChallenge = (c: GreenChallenge): number => {
    if (c.joined && !c.completed) return 0; // Active in-progress first
    if (!c.completed) return 1; // Available to start next
    return 2; // Already completed in current period
  };

  return [...challenges].sort((a, b) => {
    const statusDiff = rankChallenge(a) - rankChallenge(b);
    if (statusDiff !== 0) return statusDiff;
    const orderDiff = (a.sortOrder ?? 100) - (b.sortOrder ?? 100);
    if (orderDiff !== 0) return orderDiff;
    return a.title.localeCompare(b.title);
  });
}

export function sortBadgesForDisplay(badges: EcoBadge[]): EcoBadge[] {
  return [...badges].sort((a, b) => {
    if (a.earned !== b.earned) {
      return a.earned ? -1 : 1;
    }
    const aOrder = BADGE_ORDER_MAP.get(a.badgeKey ?? '') ?? 99;
    const bOrder = BADGE_ORDER_MAP.get(b.badgeKey ?? '') ?? 99;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.title.localeCompare(b.title);
  });
}

export function computeSustainabilityProgressSummary(params: {
  challenges: GreenChallenge[];
  badges: EcoBadge[];
  rewardHistory: RewardHistoryEntry[];
  ecoPoints: number;
  ecoStreakDays: number;
  totalCompletedHistorical?: number;
  now?: Date;
}): SustainabilityProgressSummary {
  const {
    challenges,
    badges,
    rewardHistory,
    ecoPoints,
    ecoStreakDays,
    totalCompletedHistorical,
    now = new Date(),
  } = params;

  const dailyKey = getDailyPeriodKey(now);
  const weeklyKey = getWeeklyPeriodKey(now);

  const completedTodayCount = challenges.filter(
    (c) => c.frequency === 'daily' && c.periodKey === dailyKey && c.completed
  ).length;

  const completedThisWeekCount = challenges.filter(
    (c) => c.frequency === 'weekly' && c.periodKey === weeklyKey && c.completed
  ).length;

  const activeChallengesCount = challenges.filter(
    (c) => c.joined && !c.completed
  ).length;

  const derivedHistorical = challenges.reduce(
    (sum, c) =>
      sum + Math.max(c.historicalCompletions ?? 0, c.completed ? 1 : 0),
    0
  );

  const totalCompletedChallenges =
    totalCompletedHistorical !== undefined
      ? Math.max(totalCompletedHistorical, derivedHistorical)
      : derivedHistorical;

  const co2AvoidedFromChallengesKg = Number(
    challenges
      .reduce((sum, c) => {
        const completions = Math.max(
          c.historicalCompletions ?? 0,
          c.completed ? 1 : 0
        );
        return sum + completions * c.co2SavingsKg;
      }, 0)
      .toFixed(2)
  );

  const earnedBadgesCount = badges.filter((b) => b.earned).length;
  const levelInfo = getLevelProgress(ecoPoints);

  return {
    totalCompletedChallenges,
    activeChallengesCount,
    completedTodayCount,
    completedThisWeekCount,
    earnedBadgesCount,
    totalBadgesCount: badges.length,
    ecoStreakDays: Math.max(0, ecoStreakDays),
    ecoPoints: Math.max(0, ecoPoints),
    levelTitle: levelInfo.levelTitle,
    nextLevelTitle: levelInfo.nextLevelTitle,
    pointsToNextLevel: levelInfo.pointsToNext,
    levelProgressPct: levelInfo.progressPct,
    totalVerifiedRewardEntries: rewardHistory.length,
    co2AvoidedFromChallengesKg,
  };
}

export function findCurrentUserLeaderboardRank(
  entries: LeaderboardEntry[]
): LeaderboardEntry | null {
  return entries.find((entry) => entry.isCurrentUser) ?? null;
}

export interface ChallengeCatalogRowLike {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: ActivityCategory;
  frequency?: string | null;
  difficulty?: string | null;
  co2_savings_kg: number;
  reward_points: number;
  target_count: number;
  unit_label: string;
  action_steps_hint?: string | null;
  verification_note?: string | null;
  sort_order?: number | null;
}

export interface UserChallengeRowLike {
  id: string;
  challenge_id: string;
  period_key?: string | null;
  progress: number;
  status: string;
  last_action_note?: string | null;
  last_action_at?: string | null;
  completed_at: string | null;
}

/**
 * Merges active catalog rows with period-scoped user_challenges rows.
 * Only rows matching today's daily:YYYY-MM-DD or this week's weekly:YYYY-Wxx
 * period key count toward active completion; prior periods roll into historicalCompletions
 * so daily/weekly resets never inflate duplicate rewards while preserving lifetime totals.
 */
export function mergeChallengesWithPeriodProgress(
  catalog: ChallengeCatalogRowLike[],
  userRows: UserChallengeRowLike[],
  now: Date = new Date()
): {
  challenges: GreenChallenge[];
  totalCompletedChallenges: number;
} {
  const rowsByChallengeId = new Map<string, UserChallengeRowLike[]>();

  for (const row of userRows) {
    const existing = rowsByChallengeId.get(row.challenge_id);
    if (existing) {
      existing.push(row);
    } else {
      rowsByChallengeId.set(row.challenge_id, [row]);
    }
  }

  let totalCompletedAllCatalogs = 0;
  for (const row of userRows) {
    if (row.status === 'completed') {
      totalCompletedAllCatalogs += 1;
    }
  }

  const mapped: GreenChallenge[] = catalog.map((item) => {
    const frequency: ChallengeFrequency =
      item.frequency === 'weekly' ? 'weekly' : 'daily';
    const difficulty: ChallengeDifficulty =
      item.difficulty === 'hard' || item.difficulty === 'medium'
        ? item.difficulty
        : 'easy';
    const currentPeriodKey = getPeriodKeyForFrequency(frequency, now);
    const matchingRows = rowsByChallengeId.get(item.id) ?? [];

    const historicalCompletions = matchingRows.filter(
      (r) => r.status === 'completed'
    ).length;

    const activePeriodRow =
      matchingRows.find((r) => r.period_key === currentPeriodKey) ??
      matchingRows.find((r) => r.period_key === undefined) ??
      null;

    return {
      id: item.id,
      slug: item.slug,
      userChallengeId: activePeriodRow?.id,
      title: item.title,
      description: item.description,
      category: item.category,
      frequency,
      difficulty,
      periodKey: currentPeriodKey,
      co2SavingsKg: Number(item.co2_savings_kg),
      rewardPoints: item.reward_points,
      progress: activePeriodRow?.progress ?? 0,
      target: item.target_count,
      unitLabel: item.unit_label,
      actionStepsHint: item.action_steps_hint ?? null,
      verificationNote:
        item.verification_note?.trim() || ACTION_VERIFICATION_LIMITATION_TEXT,
      joined: Boolean(activePeriodRow),
      completed: activePeriodRow?.status === 'completed',
      completedAt: activePeriodRow?.completed_at ?? null,
      lastActionNote: activePeriodRow?.last_action_note ?? null,
      lastActionAt: activePeriodRow?.last_action_at ?? null,
      historicalCompletions,
      sortOrder: item.sort_order ?? 100,
    };
  });

  return {
    challenges: sortChallenges(mapped),
    totalCompletedChallenges: totalCompletedAllCatalogs,
  };
}
