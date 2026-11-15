import type {
  ActivityCategory,
  CarbonActivity,
  ChatMessage,
  DashboardAnalyticsSnapshot,
  EcoBadge,
  ElectricityRegionCode,
  GreenChallenge,
} from '../types/carbon';
import type { UserPreferences, UserProfile } from '../types/user';
import { ELECTRICITY_REGION_MAP } from '../constants/emissionFactors';

export interface AssistantContextSummary {
  totalRecords: number;
  activeDays: number;
  topCategory: ActivityCategory | null;
  topCategoryLabel: string;
  sustainabilityScore: number;
  earnedBadgesCount: number;
  totalBadgesCount: number;
  activeChallengesCount: number;
  regionShortLabel: string;
  hasEnoughDataForDeepAnalysis: boolean;
}

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  transport: 'Transport',
  electricity: 'Electricity',
  food: 'Food',
  lifestyle: 'Lifestyle',
};

function formatTimeNow(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Summarizes the exact verified context sent to the Node backend Sustainability Assistant.
 */
export function buildAssistantContextSummary(params: {
  activities: CarbonActivity[];
  dashboardAnalytics: DashboardAnalyticsSnapshot;
  badges: EcoBadge[];
  challenges: GreenChallenge[];
  preferences: UserPreferences;
}): AssistantContextSummary {
  const { activities, dashboardAnalytics, badges, challenges, preferences } = params;
  const topCat = dashboardAnalytics.highestEmissionCategory?.category ?? null;
  const regionCode: ElectricityRegionCode = preferences.electricityRegion ?? 'global';
  const regionShortLabel =
    regionCode === 'custom' && preferences.customElectricityFactorKg !== null
      ? `Custom (${preferences.customElectricityFactorKg.toFixed(2)} kg/kWh)`
      : ELECTRICITY_REGION_MAP[regionCode]?.shortLabel ?? 'Global';

  const earnedBadgesCount = badges.filter((b) => b.earned).length;
  const activeChallengesCount = challenges.filter(
    (c) => c.joined && !c.completed
  ).length;

  return {
    totalRecords: activities.length,
    activeDays: dashboardAnalytics.sustainabilityScore.activeDays30d,
    topCategory: topCat,
    topCategoryLabel: topCat ? CATEGORY_LABELS[topCat] : 'None yet',
    sustainabilityScore: dashboardAnalytics.sustainabilityScore.score,
    earnedBadgesCount,
    totalBadgesCount: badges.length,
    activeChallengesCount,
    regionShortLabel,
    hasEnoughDataForDeepAnalysis: activities.length >= 3,
  };
}

/**
 * Generates contextual starter & follow-up prompts grounded in the user's actual records
 * and covering sustainability concepts, activity analysis, transport, electricity, food, and achievements.
 */
export function buildAssistantSuggestions(params: {
  activities: CarbonActivity[];
  dashboardAnalytics: DashboardAnalyticsSnapshot;
  badges: EcoBadge[];
  preferences: UserPreferences;
}): string[] {
  const { activities, dashboardAnalytics, badges, preferences } = params;
  const suggestions: string[] = [];
  const topCategory = dashboardAnalytics.highestEmissionCategory?.category ?? null;
  const regionShort =
    ELECTRICITY_REGION_MAP[preferences.electricityRegion]?.shortLabel ?? 'Global';

  if (activities.length > 0) {
    suggestions.push('Analyze my recent carbon activities and top emission sources');

    if (topCategory === 'transport') {
      suggestions.push('Compare a 15 km car commute vs. city bus or train');
    } else if (topCategory === 'electricity') {
      suggestions.push(
        `How can I cut 20% of my ${regionShort} electricity emissions?`
      );
    } else if (topCategory === 'food') {
      suggestions.push('How much CO₂e do I save swapping 2 beef meals for plant-based?');
    } else if (topCategory === 'lifestyle') {
      suggestions.push('How much CO₂e does recycling aluminum vs. plastic save?');
    }
  } else {
    suggestions.push('Explain what kg CO₂e means and what daily budget is realistic');
    suggestions.push('Compare 15 km by petrol car vs. city bus and cycling');
  }

  suggestions.push(`Calculate 250 kWh of home electricity on the ${regionShort} grid`);
  suggestions.push('Suggest practical low-carbon dinners for this week');
  suggestions.push('What is radiative forcing in flights and how should I weigh rail vs air?');

  const nextLockedBadge = badges.find((b) => !b.earned);
  if (nextLockedBadge) {
    suggestions.push(`How do I earn the "${nextLockedBadge.title}" badge next?`);
  }

  // Deduplicate while preserving order
  return Array.from(new Set(suggestions)).slice(0, 6);
}

/**
 * Builds an initial calm onboarding message strictly referencing observed app state
 * (used only when persisted chat history is empty).
 */
export function buildWelcomeAssistantMessage(params: {
  user: UserProfile;
  dashboardAnalytics: DashboardAnalyticsSnapshot;
  summary: AssistantContextSummary;
}): ChatMessage {
  const { user, dashboardAnalytics, summary } = params;
  const firstName = user.fullName.trim().split(/\s+/)[0] || 'Explorer';
  const remainingKg = Math.max(
    0,
    Number((user.dailyCarbonBudgetKg - dashboardAnalytics.dailyNetKg).toFixed(1))
  );

  const text =
    summary.totalRecords > 0
      ? `Hi ${firstName}! Your net footprint today is ${dashboardAnalytics.dailyNetKg.toFixed(1)} kg CO₂e (${remainingKg.toFixed(1)} kg remaining in your ${user.dailyCarbonBudgetKg.toFixed(1)} kg target) and your Eco Score is ${summary.sustainabilityScore}/100. Across ${summary.totalRecords} logged activities, ${summary.topCategoryLabel} is currently your largest emission source.\n\nAsk me to analyze your footprint, compare commutes or meals using EcoTrack's verified calculation engine, or explain sustainability concepts.`
      : `Hi ${firstName}! You have ${summary.totalRecords} logged activities so far against your ${user.dailyCarbonBudgetKg.toFixed(1)} kg CO₂e daily budget (Eco Score: ${summary.sustainabilityScore}/100, Grid: ${summary.regionShortLabel}).\n\nAsk me any environmental sustainability question, request commute/electricity/food comparisons backed by EcoTrack's verified factors, or log your first entry in Calculate for personalized insights.`;

  return {
    id: `msg-welcome-${Date.now()}`,
    sender: 'assistant',
    text,
    timestamp: formatTimeNow(),
    actionTag: summary.totalRecords > 0 ? 'Personalized Dossier' : 'Welcome Guide',
    suggestedFollowUps: [
      summary.totalRecords > 0
        ? 'Analyze my major emission sources'
        : 'Explain kg CO₂e and carbon budgets',
      'Compare 15 km petrol car vs. bus',
    ],
  };
}
