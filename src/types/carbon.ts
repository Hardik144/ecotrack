/**
 * Core sustainability, calculator, analytics, challenges, and AI chat types for EcoTrack.
 */

export type ActivityCategory = 'transport' | 'electricity' | 'food' | 'lifestyle';

export type ImpactDirection = 'emission' | 'offset';

export type EmissionUnit = 'kg CO₂e';

export type AnalyticsTimeframe = 'daily' | 'weekly' | 'monthly';

export type ElectricityRegionCode =
  | 'global'
  | 'us-avg'
  | 'us-camx'
  | 'uk'
  | 'eu'
  | 'de'
  | 'fr'
  | 'in'
  | 'cn'
  | 'ca'
  | 'au'
  | 'jp'
  | 'custom';

export type TransportMode =
  | 'car'
  | 'motorcycle'
  | 'bus'
  | 'train'
  | 'air'
  | 'walking'
  | 'cycling';

export type CarFuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric';
export type MotorcycleSize = 'average' | 'small' | 'medium' | 'large';
export type BusServiceType = 'city' | 'coach';
export type TrainServiceType = 'national' | 'metro' | 'international';
export type FlightHaulClass =
  | 'domestic'
  | 'short-economy'
  | 'short-business'
  | 'long-economy'
  | 'long-business';
export type CyclingMode = 'conventional' | 'ebike';
export type DistanceUnit = 'km' | 'mi';

export type ElectricityPeriodBasis = 'monthly' | 'daily-average';
export type ElectricityMode = 'grid' | 'solar-offset';

export type VegetarianType = 'vegetarian' | 'vegan';
export type NonVegetarianProteinType = 'mixed' | 'poultry' | 'pork' | 'beef';
export type DairyProductType = 'milk' | 'cheese' | 'mixed';
export type FoodWasteMethod = 'landfill' | 'compost';
export type MassUnit = 'kg' | 'g' | 'lb';

export type WaterHeaterType = 'cold' | 'hot-electric' | 'hot-gas';
export type WaterVolumeUnit = 'L' | 'm3' | 'gal';
export type RecyclingMaterialType =
  | 'mixed'
  | 'paper'
  | 'plastic'
  | 'glass'
  | 'aluminum';

export interface CalculationLineItem {
  key: string;
  title: string;
  category: ActivityCategory;
  direction: ImpactDirection;
  rawAmount: number;
  rawUnit: string;
  activityAmount: number;
  unitLabel: string;
  emissionFactorKg: number;
  emissionsKg: number;
  formulaText: string;
  regionCode?: ElectricityRegionCode | null;
  source: string;
  assumptions: string[];
}

export interface CalculationBatchResult {
  category: ActivityCategory;
  items: CalculationLineItem[];
  totalEmissionsKg: number;
  totalOffsetsKg: number;
  netKg: number;
}

export type ChallengeFrequency = 'daily' | 'weekly';

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

export type CanonicalAchievementBadgeKey =
  | 'first_green_step'
  | 'plastic_free_hero'
  | 'energy_saver'
  | 'eco_warrior'
  | 'carbon_champion';

export type LegacyAchievementBadgeKey =
  | 'first_footprint'
  | 'streak_7'
  | 'plant_pioneer'
  | 'transit_hero'
  | 'grid_optimizer'
  | 'ai_strategist';

export type AchievementBadgeKey =
  | CanonicalAchievementBadgeKey
  | LegacyAchievementBadgeKey;

export type EcoBadgeIcon =
  | 'leaf'
  | 'flame'
  | 'bicycle'
  | 'flash'
  | 'sparkles'
  | 'trophy'
  | 'water'
  | 'bag-handle'
  | 'walk'
  | 'shield-checkmark'
  | 'ribbon';

export interface CarbonActivityPresetItem {
  id: string;
  slug: string;
  userId?: string | null;
  title: string;
  category: ActivityCategory;
  direction: ImpactDirection;
  emissionFactorKg: number;
  unitLabel: string;
  defaultQuantity: number;
  helper?: string;
  isSystem: boolean;
}

export interface CarbonActivity {
  id: string;
  userId: string;
  activityId?: string | null;
  title: string;
  category: ActivityCategory;
  emissionsKg: number;
  direction: ImpactDirection;
  quantity?: number;
  unitLabel?: string;
  emissionFactorKg?: number | null;
  regionCode?: string | null;
  methodologySource?: string | null;
  assumptions?: string | null;
  notes?: string;
  occurredAt: string;
  createdAt: string;
}

export interface DailyEmissionPoint {
  label: string;
  emissionsKg: number;
  targetKg: number;
}

export interface MonthlyComparisonPoint {
  label: string;
  currentKg: number;
  previousKg: number;
}

export interface CategoryBreakdown {
  category: ActivityCategory;
  totalKg: number;
  percentage: number;
}

export interface GreenChallenge {
  id: string;
  slug?: string;
  userChallengeId?: string;
  title: string;
  description: string;
  category: ActivityCategory;
  frequency: ChallengeFrequency;
  difficulty: ChallengeDifficulty;
  periodKey: string;
  co2SavingsKg: number;
  rewardPoints: number;
  progress: number;
  target: number;
  unitLabel: string;
  actionStepsHint?: string | null;
  verificationNote: string;
  joined: boolean;
  completed: boolean;
  completedAt?: string | null;
  lastActionNote?: string | null;
  lastActionAt?: string | null;
  historicalCompletions?: number;
  sortOrder?: number;
}

export interface EcoBadge {
  id: string;
  badgeKey?: AchievementBadgeKey;
  title: string;
  description: string;
  icon: EcoBadgeIcon;
  earned: boolean;
  earnedAt?: string;
  requirementLabel: string;
  pointsBonus?: number;
}

export type RewardSourceType =
  | 'challenge_completion'
  | 'badge_unlock'
  | 'streak_bonus';

export type RewardVerificationType = 'self_attested_action' | 'milestone_rule';

export interface RewardHistoryEntry {
  id: string;
  rewardKey: string;
  sourceType: RewardSourceType;
  challengeId: string | null;
  title: string;
  description: string;
  pointsDelta: number;
  verificationType: RewardVerificationType;
  periodKey: string | null;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  levelTitle: string;
  sustainabilityPoints: number;
  ecoStreakDays: number;
  completedChallenges: number;
  earnedBadges: number;
  isCurrentUser: boolean;
}

export interface SustainabilityProgressSummary {
  totalCompletedChallenges: number;
  activeChallengesCount: number;
  completedTodayCount: number;
  completedThisWeekCount: number;
  earnedBadgesCount: number;
  totalBadgesCount: number;
  ecoStreakDays: number;
  ecoPoints: number;
  levelTitle: string;
  nextLevelTitle: string | null;
  pointsToNextLevel: number;
  levelProgressPct: number;
  totalVerifiedRewardEntries: number;
  co2AvoidedFromChallengesKg: number;
}

export interface ChallengeActionResult {
  userChallengeId: string;
  challengeId: string;
  periodKey: string;
  progress: number;
  targetCount: number;
  status: 'joined' | 'completed';
  pointsAwarded: number;
  newlyCompleted: boolean;
  duplicateBlocked: boolean;
  unlockedBadges: AchievementBadgeKey[];
  totalPoints: number;
  ecoStreakDays: number;
}

export interface VerifiedCalculationCitation {
  label: string;
  formula: string;
  resultKg: number;
  direction: 'emission' | 'offset' | 'savings';
  source: string;
}

export interface AiQuotaStatus {
  remainingWindow: number;
  remainingDaily: number;
  windowLimit: number;
  dailyLimit: number;
}

export interface AiDossierSummary {
  totalRecords: number;
  activeDays30d: number;
  topCategory: ActivityCategory | null;
  topCategorySharePct: number;
  sustainabilityScore: number;
  earnedBadgesCount: number;
  electricityRegion: ElectricityRegionCode;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  createdAt?: string;
  estimatedSavingsKg?: number;
  actionTag?: string;
  calculations?: VerifiedCalculationCitation[];
  suggestedFollowUps?: string[];
  modelUsed?: string;
  interactionId?: string;
  isError?: boolean;
  failedPrompt?: string;
}

export type AnalyticsDateRangePreset =
  | '7d'
  | '30d'
  | '90d'
  | 'month'
  | 'all'
  | 'custom';

export type AnalyticsCategoryFilter = 'all' | ActivityCategory;

export interface AnalyticsDateRange {
  preset: AnalyticsDateRangePreset;
  startKey: string;
  endKey: string;
  label: string;
  dayCount: number;
}

export interface DailyTrendPoint {
  dateKey: string;
  label: string;
  shortDate: string;
  grossKg: number;
  offsetsKg: number;
  netKg: number;
  targetKg: number;
  recordCount: number;
  hasRecords: boolean;
}

export interface WeeklyComparisonBucket {
  weekStartKey: string;
  weekEndKey: string;
  label: string;
  rangeLabel: string;
  grossKg: number;
  offsetsKg: number;
  netKg: number;
  budgetKg: number;
  loggedDays: number;
  recordCount: number;
}

export interface WeeklyComparisonSummary {
  current7dNetKg: number;
  previous7dNetKg: number;
  current7dGrossKg: number;
  current7dOffsetsKg: number;
  deltaKg: number;
  deltaPct: number | null;
  buckets: WeeklyComparisonBucket[];
}

export interface MonthlyComparisonBucket {
  monthKey: string;
  label: string;
  fullLabel: string;
  grossKg: number;
  offsetsKg: number;
  netKg: number;
  loggedDays: number;
  recordCount: number;
  avgDailyNetKg: number;
}

export interface MonthlyComparisonSummary {
  currentMonthNetKg: number;
  previousMonthNetKg: number;
  currentMonthGrossKg: number;
  currentMonthOffsetsKg: number;
  deltaKg: number;
  deltaPct: number | null;
  buckets: MonthlyComparisonBucket[];
}

export interface CategoryBreakdownSlice {
  category: ActivityCategory;
  grossKg: number;
  offsetsKg: number;
  netKg: number;
  sharePct: number;
  recordCount: number;
}

export interface TransportVsElectricityPeriod {
  key: string;
  label: string;
  transportKg: number;
  electricityKg: number;
  transportOffsetKg: number;
  electricityOffsetKg: number;
}

export interface TransportVsElectricitySummary {
  transportGrossKg: number;
  electricityGrossKg: number;
  transportOffsetsKg: number;
  electricityOffsetsKg: number;
  transportNetKg: number;
  electricityNetKg: number;
  transportSharePct: number;
  electricitySharePct: number;
  dominantCategory: 'transport' | 'electricity' | 'tied' | 'none';
  gapKg: number;
  periods: TransportVsElectricityPeriod[];
}

export interface ProgressPoint {
  key: string;
  label: string;
  rangeLabel: string;
  score: number | null;
  avgDailyNetKg: number | null;
  targetKg: number;
  offsetsKg: number;
  loggedDays: number;
}

export interface SustainabilityScoreSummary {
  score: number;
  source: 'activity-derived' | 'profile-baseline';
  tierLabel: string;
  activeDays30d: number;
  avgLoggedDailyNetKg: number;
  budgetAdherencePts: number;
  offsetImpactPts: number;
  consistencyPts: number;
}

export interface MonthlyReport {
  monthKey: string;
  monthLabel: string;
  totalRecords: number;
  loggedDays: number;
  elapsedDays: number;
  grossEmissionsKg: number;
  estimatedAvoidedKg: number;
  netEmissionsKg: number;
  dailyAverageNetKg: number;
  loggedDayAverageNetKg: number;
  budgetTargetMonthlyKg: number;
  daysWithinBudget: number;
  previousMonthNetKg: number | null;
  monthOverMonthDeltaKg: number | null;
  monthOverMonthDeltaPct: number | null;
  highestCategory: CategoryBreakdownSlice | null;
  categories: CategoryBreakdownSlice[];
  topEmitters: CarbonActivity[];
  topOffset: CarbonActivity | null;
  sustainabilityScore: number;
  grade: string;
}

export interface DashboardAnalyticsSnapshot {
  dailyGrossKg: number;
  dailyAvoidedKg: number;
  dailyNetKg: number;
  weeklyGrossKg: number;
  weeklyAvoidedKg: number;
  weeklyNetKg: number;
  monthlyGrossKg: number;
  monthlyAvoidedKg: number;
  monthlyNetKg: number;
  totalAvoidedKg: number;
  totalGrossKg: number;
  totalNetKg: number;
  highestEmissionCategory: CategoryBreakdownSlice | null;
  sustainabilityScore: SustainabilityScoreSummary;
  weeklyComparison: WeeklyComparisonSummary;
  monthlyComparison: MonthlyComparisonSummary;
}
