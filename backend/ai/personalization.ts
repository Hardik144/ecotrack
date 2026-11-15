import {
  type ActivityCategory,
  type ElectricityRegionCode,
  ELECTRICITY_REGION_MAP,
} from './factors.ts';
import {
  type EmissionRecordInputRow,
  resolveElectricityRegion,
  summarizeUserAnalyticsWindow,
} from './tools.ts';

export interface ProfileInputRow {
  full_name: string;
  daily_carbon_budget_kg: number;
  sustainability_points: number;
  sustainability_score: number;
  level_title: string;
  eco_streak_days: number;
  preferred_unit: 'metric' | 'imperial';
  electricity_region?: ElectricityRegionCode | null;
  custom_electricity_factor_kg?: number | null;
}

export interface AchievementInputRow {
  badge_key: string;
  title: string;
  description: string;
  requirement_label: string;
  earned: boolean;
}

export interface ChallengeInputRow {
  title: string;
  category: ActivityCategory;
  co2_savings_kg: number;
  progress: number;
  target_count: number;
  unit_label: string;
  status: 'joined' | 'completed' | 'available';
}

export interface DossierSummary {
  totalRecords: number;
  activeDays30d: number;
  topCategory: ActivityCategory | null;
  topCategorySharePct: number;
  sustainabilityScore: number;
  earnedBadgesCount: number;
  electricityRegion: ElectricityRegionCode;
}

export interface PersonalizationDossier {
  firstName: string;
  localDateKey: string;
  timezone: string;
  dailyBudgetKg: number;
  preferredUnit: 'metric' | 'imperial';
  electricityRegion: ElectricityRegionCode;
  electricityRegionLabel: string;
  electricityFactorKgPerKwh: number;
  sustainabilityPoints: number;
  ecoStreakDays: number;
  levelTitle: string;
  sustainabilityScore: number;
  completedChallengesCount: number;
  summary: DossierSummary;
  snapshots: {
    today: ReturnType<typeof summarizeUserAnalyticsWindow>;
    last7d: ReturnType<typeof summarizeUserAnalyticsWindow>;
    thisMonth: ReturnType<typeof summarizeUserAnalyticsWindow>;
    last30d: ReturnType<typeof summarizeUserAnalyticsWindow>;
    allTime: ReturnType<typeof summarizeUserAnalyticsWindow>;
  };
  transportProfile: {
    recordCount: number;
    grossKg: number;
    avoidedKg: number;
    recentEntries: string[];
  };
  electricityProfile: {
    recordCount: number;
    loggedKwhTotal: number;
    grossKg: number;
    solarOffsetKg: number;
    recentEntries: string[];
  };
  foodProfile: {
    recordCount: number;
    grossKg: number;
    plantMealEntries: number;
    redMeatEntries: number;
    recentEntries: string[];
  };
  lifestyleProfile: {
    recordCount: number;
    grossKg: number;
    avoidedKg: number;
    recentEntries: string[];
  };
  earnedBadges: { title: string; description: string }[];
  lockedBadges: { title: string; requirement: string }[];
  activeChallenges: {
    title: string;
    category: ActivityCategory;
    progressLabel: string;
    co2SavingsKg: number;
  }[];
}

function round2(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Number(val.toFixed(2));
}

function formatEntryLine(row: EmissionRecordInputRow): string {
  const sign = row.direction === 'offset' ? '-' : '+';
  const datePart = String(row.recorded_at || '').slice(0, 10);
  return `${row.title} (${row.quantity} ${row.unit_label}, ${sign}${round2(Number(row.emissions_kg) || 0)} kg CO2e on ${datePart})`;
}

export function sanitizeLocalDateKey(raw?: string | null): string {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return raw.trim();
  }
  return new Date().toISOString().slice(0, 10);
}

export function buildPersonalizationDossier(params: {
  profile: ProfileInputRow;
  records: EmissionRecordInputRow[];
  achievements: AchievementInputRow[];
  challenges: ChallengeInputRow[];
  localDateKey?: string | null;
  timezone?: string | null;
}): PersonalizationDossier {
  const localDateKey = sanitizeLocalDateKey(params.localDateKey);
  const timezone =
    typeof params.timezone === 'string' && params.timezone.trim().length > 0
      ? params.timezone.trim().slice(0, 64)
      : 'UTC';

  const rawRegion = params.profile.electricity_region ?? 'global';
  const resolvedRegion = resolveElectricityRegion(
    rawRegion,
    params.profile.custom_electricity_factor_kg ?? null
  );
  const regionCode: ElectricityRegionCode = resolvedRegion.ok
    ? resolvedRegion.regionCode
    : 'global';
  const regionLabel = resolvedRegion.ok
    ? resolvedRegion.label
    : ELECTRICITY_REGION_MAP.global.label;
  const electricityFactorKgPerKwh = resolvedRegion.ok
    ? resolvedRegion.factorKgPerKwh
    : ELECTRICITY_REGION_MAP.global.factorKgPerKwh;

  const completedChallengesCount = params.challenges.filter(
    (c) => c.status === 'completed'
  ).length;
  const dailyBudgetKg = Math.max(2, Number(params.profile.daily_carbon_budget_kg) || 12);
  const profileBaselineScore = Number(params.profile.sustainability_score) || 50;

  const common = {
    localDateKey,
    dailyBudgetKg,
    completedChallengesCount,
    profileBaselineScore,
  };

  // Daily snapshot (startKey == endKey handled via filter over allTime / today dateKey match)
  const todayRecords = params.records.filter(
    (r) => String(r.recorded_at || '').slice(0, 10) === localDateKey
  );
  const todaySummary = summarizeUserAnalyticsWindow(todayRecords, {
    ...common,
    rangePreset: '7d',
  });
  const last7d = summarizeUserAnalyticsWindow(params.records, {
    ...common,
    rangePreset: '7d',
  });
  const thisMonth = summarizeUserAnalyticsWindow(params.records, {
    ...common,
    rangePreset: 'month',
  });
  const last30d = summarizeUserAnalyticsWindow(params.records, {
    ...common,
    rangePreset: '30d',
  });
  const allTime = summarizeUserAnalyticsWindow(params.records, {
    ...common,
    rangePreset: 'all',
  });

  const transportRows = params.records.filter((r) => r.category === 'transport');
  const electricityRows = params.records.filter((r) => r.category === 'electricity');
  const foodRows = params.records.filter((r) => r.category === 'food');
  const lifestyleRows = params.records.filter((r) => r.category === 'lifestyle');

  let loggedKwhTotal = 0;
  for (const row of electricityRows) {
    if (row.unit_label?.toLowerCase() === 'kwh') {
      loggedKwhTotal += Number(row.quantity) || 0;
    }
  }

  let plantMealEntries = 0;
  let redMeatEntries = 0;
  for (const row of foodRows) {
    const lowerTitle = row.title.toLowerCase();
    if (lowerTitle.includes('vegan') || lowerTitle.includes('vegetarian') || lowerTitle.includes('plant')) {
      plantMealEntries += 1;
    } else if (lowerTitle.includes('beef') || lowerTitle.includes('pork') || lowerTitle.includes('red meat')) {
      redMeatEntries += 1;
    }
  }

  const earnedBadges = params.achievements
    .filter((a) => a.earned)
    .map((a) => ({ title: a.title, description: a.description }));
  const lockedBadges = params.achievements
    .filter((a) => !a.earned)
    .map((a) => ({ title: a.title, requirement: a.requirement_label }));

  const activeChallenges = params.challenges
    .filter((c) => c.status === 'joined')
    .map((c) => ({
      title: c.title,
      category: c.category,
      progressLabel: `${c.progress}/${c.target_count} ${c.unit_label}`,
      co2SavingsKg: round2(Number(c.co2_savings_kg) || 0),
    }));

  const topCategory = allTime.highestCategory;
  const topCategorySharePct = topCategory ? allTime.byCategory[topCategory].sharePct : 0;

  const firstName =
    (params.profile.full_name || 'Explorer').trim().split(/\s+/)[0] || 'Explorer';

  return {
    firstName,
    localDateKey,
    timezone,
    dailyBudgetKg: round2(dailyBudgetKg),
    preferredUnit: params.profile.preferred_unit === 'imperial' ? 'imperial' : 'metric',
    electricityRegion: regionCode,
    electricityRegionLabel: regionLabel,
    electricityFactorKgPerKwh,
    sustainabilityPoints: Number(params.profile.sustainability_points) || 0,
    ecoStreakDays: Number(params.profile.eco_streak_days) || 0,
    levelTitle: params.profile.level_title || 'Seedling Explorer',
    sustainabilityScore: last30d.sustainabilityScore,
    completedChallengesCount,
    summary: {
      totalRecords: allTime.recordCount,
      activeDays30d: last30d.activeDays,
      topCategory,
      topCategorySharePct,
      sustainabilityScore: last30d.sustainabilityScore,
      earnedBadgesCount: earnedBadges.length,
      electricityRegion: regionCode,
    },
    snapshots: {
      today: todaySummary,
      last7d,
      thisMonth,
      last30d,
      allTime,
    },
    transportProfile: {
      recordCount: transportRows.length,
      grossKg: allTime.byCategory.transport.grossKg,
      avoidedKg: allTime.byCategory.transport.offsetKg,
      recentEntries: transportRows.slice(0, 5).map(formatEntryLine),
    },
    electricityProfile: {
      recordCount: electricityRows.length,
      loggedKwhTotal: round2(loggedKwhTotal),
      grossKg: allTime.byCategory.electricity.grossKg,
      solarOffsetKg: allTime.byCategory.electricity.offsetKg,
      recentEntries: electricityRows.slice(0, 5).map(formatEntryLine),
    },
    foodProfile: {
      recordCount: foodRows.length,
      grossKg: allTime.byCategory.food.grossKg,
      plantMealEntries,
      redMeatEntries,
      recentEntries: foodRows.slice(0, 5).map(formatEntryLine),
    },
    lifestyleProfile: {
      recordCount: lifestyleRows.length,
      grossKg: allTime.byCategory.lifestyle.grossKg,
      avoidedKg: allTime.byCategory.lifestyle.offsetKg,
      recentEntries: lifestyleRows.slice(0, 5).map(formatEntryLine),
    },
    earnedBadges,
    lockedBadges,
    activeChallenges,
  };
}

export function buildEcoSystemInstruction(dossier: PersonalizationDossier): string {
  const { snapshots, summary } = dossier;
  const hasLogs = summary.totalRecords > 0;

  const lines: string[] = [
    'You are EcoTrack AI, an encouraging, practical, and scientifically accurate Sustainability Coach.',
    '',
    'CORE CAPABILITIES YOU HANDLE:',
    '1. Explain environmental sustainability concepts clearly in everyday language (CO2e, GHG scopes, radiative forcing, grid carbon intensity, lifecycle analysis, methane vs CO2).',
    '2. Analyze the user carbon footprint and activity patterns using ONLY their verified database dossier and deterministic tools.',
    '3. Identify major emission sources across transport, electricity, food, and lifestyle.',
    '4. Recommend practical, prioritized ways to cut emissions with realistic swaps.',
    '5. Suggest eco-friendly transportation (transit, carpooling, rail, EVs on regional grid, cycling, walking).',
    '6. Recommend electricity-saving habits tailored to the user configured regional grid factor and electricity logs.',
    '7. Provide sustainable food suggestions (plant-forward meals, lower-impact proteins, dairy choices, composting food waste).',
    '8. Answer general environmental and climate literacy questions clearly.',
    '',
    'STRICT ANTI-FABRICATION & CALCULATION GROUNDING RULES:',
    '- NEVER invent, estimate in your head, or fabricate any CO2e number, emission factor, or unit conversion.',
    '- WHENEVER the user asks for a carbon calculation, trip/commute comparison, kWh footprint, meal comparison, waste/recycling credit, or percentage reduction plan, YOU MUST CALL the deterministic EcoTrack tools first (`calculate_transport_comparison`, `calculate_electricity_impact`, `calculate_food_comparison`, `calculate_lifestyle_impact`, `get_user_footprint_analytics`, `simulate_reduction_plan`).',
    '- Quote numbers verbatim (rounded consistently to 1-2 decimals matching the tool output) and briefly mention the documented factor source when helpful.',
    '- NEVER claim the user logged activities that are missing from their verified dossier. If a category has 0 records, say honestly that they have not logged that category yet and invite them to calculate/log it in EcoTrack.',
    '- Keep responses practical, clear, structured (short paragraphs + concise bullet points, <= 220 words unless user asks for a deep explanation).',
    '',
    'AUTHENTICATED USER VERIFIED SUSTAINABILITY DOSSIER:',
    `- Member first name: ${dossier.firstName} (Level: ${dossier.levelTitle}, Sustainability Score: ${dossier.sustainabilityScore}/100, Points: ${dossier.sustainabilityPoints}, Streak: ${dossier.ecoStreakDays} days)`,
    `- Daily CO2e target: ${dossier.dailyBudgetKg} kg CO2e | Preferred display unit: ${dossier.preferredUnit} | Active local date: ${dossier.localDateKey} (${dossier.timezone})`,
    `- Configured Electricity Grid: ${dossier.electricityRegionLabel} (${dossier.electricityFactorKgPerKwh} kg CO2e/kWh)`,
    `- Historical Totals: ${summary.totalRecords} records logged | All-Time Gross ${snapshots.allTime.grossKg} kg | Avoided ${snapshots.allTime.avoidedKg} kg | Net ${snapshots.allTime.netKg} kg`,
    `- Today (${dossier.localDateKey}): Gross ${snapshots.today.grossKg} kg, Avoided ${snapshots.today.avoidedKg} kg, Net ${snapshots.today.netKg} kg`,
    `- Rolling 7 Days: Net ${snapshots.last7d.netKg} kg (${snapshots.last7d.activeDays} active days)`,
    `- Current Month: Gross ${snapshots.thisMonth.grossKg} kg, Avoided ${snapshots.thisMonth.avoidedKg} kg, Net ${snapshots.thisMonth.netKg} kg`,
    hasLogs
      ? `- Dominant Gross Emission Category: ${summary.topCategory ?? 'none'} (${summary.topCategorySharePct}%) | Transport vs Electricity gap: Transport ${snapshots.allTime.transportVsElectricity.transportGrossKg} kg vs Electricity ${snapshots.allTime.transportVsElectricity.electricityGrossKg} kg`
      : '- Status: User has 0 carbon emission records logged so far. Focus on helpful onboarding education, sustainability concepts, or tool-backed example comparisons.',
  ];

  if (snapshots.allTime.topEmitters.length > 0) {
    lines.push(
      `- Highest Single Emission Records: ${snapshots.allTime.topEmitters
        .slice(0, 3)
        .map((e) => `${e.title} (${e.emissionsKg} kg on ${e.dateKey})`)
        .join('; ')}`
    );
  }

  lines.push(
    `- Transportation (${dossier.transportProfile.recordCount} logs, ${dossier.transportProfile.grossKg} kg gross, ${dossier.transportProfile.avoidedKg} kg offsets): ${
      dossier.transportProfile.recentEntries.join('; ') || 'No transport logs yet'
    }`,
    `- Electricity (${dossier.electricityProfile.recordCount} logs, ${dossier.electricityProfile.loggedKwhTotal} kWh, ${dossier.electricityProfile.grossKg} kg gross, ${dossier.electricityProfile.solarOffsetKg} kg solar offsets): ${
      dossier.electricityProfile.recentEntries.join('; ') || 'No electricity logs yet'
    }`,
    `- Food (${dossier.foodProfile.recordCount} logs, ${dossier.foodProfile.grossKg} kg gross, ${dossier.foodProfile.plantMealEntries} plant-forward / ${dossier.foodProfile.redMeatEntries} red-meat logs): ${
      dossier.foodProfile.recentEntries.join('; ') || 'No food logs yet'
    }`,
    `- Lifestyle (${dossier.lifestyleProfile.recordCount} logs, ${dossier.lifestyleProfile.grossKg} kg gross, ${dossier.lifestyleProfile.avoidedKg} kg recycling offsets): ${
      dossier.lifestyleProfile.recentEntries.join('; ') || 'No lifestyle logs yet'
    }`,
    `- Achievements: Completed Challenges=${dossier.completedChallengesCount}; Earned Badges=[${
      dossier.earnedBadges.map((b) => b.title).join(', ') || 'None yet'
    }]; Next Badges=[${
      dossier.lockedBadges.map((b) => `${b.title} (${b.requirement})`).join('; ') || 'All earned'
    }]`
  );

  if (dossier.activeChallenges.length > 0) {
    lines.push(
      `- Active Challenges: ${dossier.activeChallenges
        .map((c) => `${c.title} (${c.progressLabel}, saves ${c.co2SavingsKg} kg)`)
        .join('; ')}`
    );
  }

  return lines.join('\n');
}

export function classifyActionTag(
  promptText: string,
  toolsCalled: string[]
): string {
  if (toolsCalled.includes('simulate_reduction_plan')) return 'Reduction Plan';
  if (toolsCalled.includes('calculate_transport_comparison')) return 'Transport Comparison';
  if (toolsCalled.includes('calculate_electricity_impact')) return 'Electricity Strategy';
  if (toolsCalled.includes('calculate_food_comparison')) return 'Low-Carbon Meals';
  if (toolsCalled.includes('calculate_lifestyle_impact')) return 'Lifestyle Impact';
  if (toolsCalled.includes('get_user_footprint_analytics')) return 'Footprint Analysis';

  const lower = promptText.toLowerCase();
  if (/commute|car|bus|train|flight|fly|bike|cycle|walk|transport|ev|drive/.test(lower)) {
    return 'Eco Transport';
  }
  if (/electricity|power|kwh|grid|solar|ac|air conditioning|appliance|energy/.test(lower)) {
    return 'Electricity Guide';
  }
  if (/food|meal|dinner|lunch|beef|meat|vegan|vegetarian|dairy|compost/.test(lower)) {
    return 'Sustainable Food';
  }
  if (/what is|explain|why|how does|co2e|methane|scope|carbon footprint|greenhouse/.test(lower)) {
    return 'Concept Guide';
  }
  if (/badge|achievement|score|challenge|streak|analyze|source|highest/.test(lower)) {
    return 'Personalized Review';
  }
  return 'Eco Coaching';
}

export function buildContextualFollowUps(
  promptText: string,
  dossier: PersonalizationDossier,
  toolsCalled: string[]
): string[] {
  const lower = promptText.toLowerCase();
  const suggestions: string[] = [];

  if (dossier.summary.totalRecords > 0 && !toolsCalled.includes('simulate_reduction_plan')) {
    const targetCat = dossier.summary.topCategory ?? 'all';
    suggestions.push(
      `Build a 20% reduction plan for my ${targetCat === 'all' ? 'footprint' : targetCat}`
    );
  }

  if (!/bus|train|commute|car|bike/.test(lower)) {
    suggestions.push('Compare a 15 km petrol car commute vs. train or bus');
  }
  if (!/electricity|kwh|grid|power/.test(lower)) {
    suggestions.push(
      `How much CO2e is 250 kWh/month on my ${dossier.electricityRegionLabel.split(' ')[0]} grid?`
    );
  }
  if (!/meal|dinner|food|beef|vegan/.test(lower)) {
    suggestions.push('How much CO2e do I save swapping 2 beef meals for plant-based meals?');
  }
  if (dossier.lockedBadges.length > 0 && !/badge|achievement/.test(lower)) {
    suggestions.push(`How can I unlock "${dossier.lockedBadges[0].title}"?`);
  }

  return suggestions.slice(0, 3);
}
