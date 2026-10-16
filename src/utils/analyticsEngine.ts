import type {
  ActivityCategory,
  AnalyticsCategoryFilter,
  AnalyticsDateRange,
  AnalyticsDateRangePreset,
  CarbonActivity,
  CategoryBreakdownSlice,
  DailyTrendPoint,
  DashboardAnalyticsSnapshot,
  MonthlyComparisonBucket,
  MonthlyComparisonSummary,
  MonthlyReport,
  ProgressPoint,
  SustainabilityScoreSummary,
  TransportVsElectricityPeriod,
  TransportVsElectricitySummary,
  WeeklyComparisonBucket,
  WeeklyComparisonSummary,
} from '../types/carbon';

const CATEGORIES_ORDER: readonly ActivityCategory[] = [
  'transport',
  'electricity',
  'food',
  'lifestyle',
];

const CATEGORY_DISPLAY_NAMES: Record<ActivityCategory, string> = {
  transport: 'Transportation',
  electricity: 'Electricity',
  food: 'Food',
  lifestyle: 'Lifestyle',
};

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_REGEX = /^(\d{4})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function roundKg(value: number, decimals = 3): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(decimals));
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Parses an ISO string, YYYY-MM-DD date string, or Date into a valid Date
 * without allowing UTC date-only strings to drift back a day in negative offsets.
 */
export function parseLocalActivityDate(input: Date | string): Date | null {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : new Date(input.getTime());
  }

  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const dateOnly = DATE_ONLY_REGEX.exec(trimmed);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const candidate = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      candidate.getFullYear() !== year ||
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day
    ) {
      return null;
    }
    return candidate;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a Date or ISO timestamp into the local calendar key YYYY-MM-DD.
 */
export function toLocalDateKey(input: Date | string): string {
  const parsed = parseLocalActivityDate(input);
  if (!parsed) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKeyLocal(dateKey: string): Date | null {
  const match = DATE_ONLY_REGEX.exec(dateKey.trim());
  if (!match) return null;
  return parseLocalActivityDate(dateKey.trim());
}

export function addLocalDays(baseDate: Date, deltaDays: number): Date {
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + deltaDays,
    12,
    0,
    0,
    0
  );
}

/**
 * Computes exact integer calendar-day difference (end - start) safely across DST changes.
 */
export function diffLocalDateKeys(startKey: string, endKey: string): number {
  const start = parseDateKeyLocal(startKey);
  const end = parseDateKeyLocal(endKey);
  if (!start || !end) return 0;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / MS_PER_DAY);
}

export function getStartOfLocalWeek(date: Date): Date {
  const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return addLocalDays(date, mondayOffset);
}

export function toLocalMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function shiftLocalMonthKey(monthKey: string, deltaMonths: number): string {
  const match = MONTH_KEY_REGEX.exec(monthKey.trim());
  if (!match) return monthKey;
  const base = new Date(
    Number(match[1]),
    Number(match[2]) - 1 + deltaMonths,
    1,
    12,
    0,
    0,
    0
  );
  return toLocalMonthKey(base);
}

export function getDaysInLocalMonth(monthKey: string): number {
  const match = MONTH_KEY_REGEX.exec(monthKey.trim());
  if (!match) return 30;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return new Date(year, month, 0).getDate();
}

export function formatLocalDateLabel(
  dateKey: string,
  pattern: 'short' | 'weekday' | 'numeric' = 'short'
): string {
  const parsed = parseDateKeyLocal(dateKey);
  if (!parsed) return dateKey;

  if (pattern === 'weekday') {
    return parsed.toLocaleDateString(undefined, { weekday: 'short' });
  }
  if (pattern === 'numeric') {
    const m = String(parsed.getMonth() + 1);
    const d = String(parsed.getDate());
    return `${m}/${d}`;
  }
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatMonthKeyLabel(
  monthKey: string,
  variant: 'short' | 'long' = 'long'
): string {
  const match = MONTH_KEY_REGEX.exec(monthKey.trim());
  if (!match) return monthKey;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1, 12, 0, 0, 0);
  if (variant === 'short') {
    return date.toLocaleDateString(undefined, { month: 'short' });
  }
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function accumulateTotals(items: CarbonActivity[]): {
  grossKg: number;
  offsetsKg: number;
  signedNetKg: number;
  clampedNetKg: number;
  recordCount: number;
  loggedDays: number;
} {
  let gross = 0;
  let offsets = 0;
  const distinctDays = new Set<string>();

  for (const item of items) {
    if (!Number.isFinite(item.emissionsKg) || item.emissionsKg < 0) continue;
    const key = toLocalDateKey(item.occurredAt);
    if (!key) continue;
    distinctDays.add(key);

    if (item.direction === 'offset') {
      offsets += item.emissionsKg;
    } else {
      gross += item.emissionsKg;
    }
  }

  const grossKg = roundKg(gross);
  const offsetsKg = roundKg(offsets);
  const signedNetKg = roundKg(grossKg - offsetsKg);

  return {
    grossKg,
    offsetsKg,
    signedNetKg,
    clampedNetKg: Math.max(0, signedNetKg),
    recordCount: items.length,
    loggedDays: distinctDays.size,
  };
}

/**
 * Resolves a preset or custom date range into bounded local YYYY-MM-DD keys.
 */
export function resolveAnalyticsDateRange(
  preset: AnalyticsDateRangePreset,
  activities: CarbonActivity[],
  customRange?: { startKey?: string; endKey?: string },
  referenceNow: Date = new Date()
): { ok: boolean; range: AnalyticsDateRange; error?: string } {
  const todayLocal = new Date(
    referenceNow.getFullYear(),
    referenceNow.getMonth(),
    referenceNow.getDate(),
    12,
    0,
    0,
    0
  );
  const todayKey = toLocalDateKey(todayLocal);

  if (preset === '7d') {
    const startKey = toLocalDateKey(addLocalDays(todayLocal, -6));
    return {
      ok: true,
      range: {
        preset: '7d',
        startKey,
        endKey: todayKey,
        label: 'Last 7 Days',
        dayCount: 7,
      },
    };
  }

  if (preset === '30d') {
    const startKey = toLocalDateKey(addLocalDays(todayLocal, -29));
    return {
      ok: true,
      range: {
        preset: '30d',
        startKey,
        endKey: todayKey,
        label: 'Last 30 Days',
        dayCount: 30,
      },
    };
  }

  if (preset === '90d') {
    const startKey = toLocalDateKey(addLocalDays(todayLocal, -89));
    return {
      ok: true,
      range: {
        preset: '90d',
        startKey,
        endKey: todayKey,
        label: 'Last 90 Days',
        dayCount: 90,
      },
    };
  }

  if (preset === 'month') {
    const firstOfMonth = new Date(
      todayLocal.getFullYear(),
      todayLocal.getMonth(),
      1,
      12,
      0,
      0,
      0
    );
    const startKey = toLocalDateKey(firstOfMonth);
    return {
      ok: true,
      range: {
        preset: 'month',
        startKey,
        endKey: todayKey,
        label: formatMonthKeyLabel(toLocalMonthKey(todayLocal), 'long'),
        dayCount: diffLocalDateKeys(startKey, todayKey) + 1,
      },
    };
  }

  if (preset === 'all') {
    let minKey = todayKey;
    let maxKey = todayKey;
    let foundAny = false;

    for (const item of activities) {
      const key = toLocalDateKey(item.occurredAt);
      if (!key) continue;
      if (!foundAny || key < minKey) minKey = key;
      if (!foundAny || key > maxKey) maxKey = key;
      foundAny = true;
    }

    if (!foundAny) {
      minKey = toLocalDateKey(addLocalDays(todayLocal, -29));
    } else if (minKey === maxKey) {
      minKey = toLocalDateKey(addLocalDays(parseDateKeyLocal(maxKey) ?? todayLocal, -6));
    }

    const spanDays = clampValue(diffLocalDateKeys(minKey, maxKey) + 1, 1, 730);
    const clampedStartKey =
      diffLocalDateKeys(minKey, maxKey) + 1 > 730
        ? toLocalDateKey(addLocalDays(parseDateKeyLocal(maxKey) ?? todayLocal, -729))
        : minKey;

    return {
      ok: true,
      range: {
        preset: 'all',
        startKey: clampedStartKey,
        endKey: maxKey,
        label: 'All Recorded History',
        dayCount: spanDays,
      },
    };
  }

  // Custom date range validation
  const startKey = customRange?.startKey?.trim() ?? '';
  const endKey = customRange?.endKey?.trim() ?? '';
  const parsedStart = parseDateKeyLocal(startKey);
  const parsedEnd = parseDateKeyLocal(endKey);

  const fallbackRange: AnalyticsDateRange = {
    preset: '30d',
    startKey: toLocalDateKey(addLocalDays(todayLocal, -29)),
    endKey: todayKey,
    label: 'Last 30 Days',
    dayCount: 30,
  };

  if (!parsedStart || !parsedEnd) {
    return {
      ok: false,
      range: fallbackRange,
      error: 'Enter valid start and end dates in YYYY-MM-DD format.',
    };
  }

  if (startKey > endKey) {
    return {
      ok: false,
      range: fallbackRange,
      error: 'Start date must be on or before end date.',
    };
  }

  const dayCount = diffLocalDateKeys(startKey, endKey) + 1;
  if (dayCount > 366) {
    return {
      ok: false,
      range: fallbackRange,
      error: 'Custom date range cannot exceed 366 days.',
    };
  }

  return {
    ok: true,
    range: {
      preset: 'custom',
      startKey,
      endKey,
      label: `${formatLocalDateLabel(startKey)} – ${formatLocalDateLabel(endKey)}`,
      dayCount,
    },
  };
}

/**
 * Filters carbon emission records by local calendar date range, category, and text search.
 */
export function filterActivities(
  activities: CarbonActivity[],
  options: {
    range?: AnalyticsDateRange;
    category?: AnalyticsCategoryFilter;
    searchQuery?: string;
  }
): CarbonActivity[] {
  const category = options.category ?? 'all';
  const query = options.searchQuery?.trim().toLowerCase() ?? '';
  const startKey = options.range?.startKey;
  const endKey = options.range?.endKey;

  return activities.filter((item) => {
    if (category !== 'all' && item.category !== category) {
      return false;
    }

    const dateKey = toLocalDateKey(item.occurredAt);
    if (!dateKey) {
      return false;
    }

    if (startKey && dateKey < startKey) {
      return false;
    }
    if (endKey && dateKey > endKey) {
      return false;
    }

    if (query) {
      const searchable = [
        item.title,
        item.notes ?? '',
        item.methodologySource ?? '',
        item.regionCode ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

function getScoreTierLabel(score: number): string {
  if (score >= 85) return 'Eco Champion';
  if (score >= 70) return 'Strong Progress';
  if (score >= 50) return 'Steady Builder';
  return 'High Impact';
}

function computeScoreFromWindow(
  windowRecords: CarbonActivity[],
  dailyBudgetKg: number,
  completedChallengesCount: number
): Omit<SustainabilityScoreSummary, 'source' | 'tierLabel'> {
  const totals = accumulateTotals(windowRecords);
  if (totals.loggedDays === 0) {
    return {
      score: 0,
      activeDays30d: 0,
      avgLoggedDailyNetKg: 0,
      budgetAdherencePts: 0,
      offsetImpactPts: 0,
      consistencyPts: 0,
    };
  }

  const avgLoggedDailyNetKg = roundKg(totals.signedNetKg / totals.loggedDays, 2);
  const safeBudget = Math.max(dailyBudgetKg, 0.5);
  const ratio = avgLoggedDailyNetKg / safeBudget;

  let budgetAdherencePts: number;
  if (ratio <= 0.5) {
    budgetAdherencePts = 55;
  } else if (ratio <= 1.0) {
    budgetAdherencePts = 55 - ((ratio - 0.5) / 0.5) * 20;
  } else {
    budgetAdherencePts = Math.max(5, 35 - (ratio - 1.0) * 30);
  }
  budgetAdherencePts = Math.round(clampValue(budgetAdherencePts, 0, 55));

  const combinedVolume = totals.grossKg + totals.offsetsKg;
  const offsetShare = combinedVolume > 0 ? totals.offsetsKg / combinedVolume : 0;
  const offsetImpactPts = Math.round(clampValue(offsetShare * 50, 0, 25));

  const consistencyPts =
    Math.min(12, totals.loggedDays) + Math.min(8, Math.max(0, completedChallengesCount) * 2);

  const score = clampValue(
    Math.round(budgetAdherencePts + offsetImpactPts + consistencyPts),
    0,
    100
  );

  return {
    score,
    activeDays30d: totals.loggedDays,
    avgLoggedDailyNetKg,
    budgetAdherencePts,
    offsetImpactPts,
    consistencyPts,
  };
}

/**
 * Computes a transparent, reproducible Sustainability Score (0-100)
 * from the last 30 days of carbon records, falling back to the
 * database profile baseline when no records exist in the window.
 */
export function computeSustainabilityScore(
  activities: CarbonActivity[],
  dailyBudgetKg: number,
  completedChallengesCount: number,
  profileBaselineScore: number,
  referenceNow: Date = new Date()
): SustainabilityScoreSummary {
  const rangeRes = resolveAnalyticsDateRange('30d', activities, undefined, referenceNow);
  const records30d = filterActivities(activities, { range: rangeRes.range });

  if (records30d.length === 0) {
    const baseline = clampValue(Math.round(profileBaselineScore || 50), 0, 100);
    return {
      score: baseline,
      source: 'profile-baseline',
      tierLabel: 'Awaiting Activity Logs',
      activeDays30d: 0,
      avgLoggedDailyNetKg: 0,
      budgetAdherencePts: 0,
      offsetImpactPts: 0,
      consistencyPts: 0,
    };
  }

  const metrics = computeScoreFromWindow(
    records30d,
    dailyBudgetKg,
    completedChallengesCount
  );

  return {
    ...metrics,
    source: 'activity-derived',
    tierLabel: getScoreTierLabel(metrics.score),
  };
}

export function computeCategoryBreakdown(activities: CarbonActivity[]): {
  slices: CategoryBreakdownSlice[];
  totalGrossKg: number;
  totalOffsetsKg: number;
  totalSignedNetKg: number;
  highestCategory: CategoryBreakdownSlice | null;
} {
  const buckets: Record<
    ActivityCategory,
    { gross: number; offsets: number; count: number }
  > = {
    transport: { gross: 0, offsets: 0, count: 0 },
    electricity: { gross: 0, offsets: 0, count: 0 },
    food: { gross: 0, offsets: 0, count: 0 },
    lifestyle: { gross: 0, offsets: 0, count: 0 },
  };

  for (const item of activities) {
    if (!Number.isFinite(item.emissionsKg) || item.emissionsKg < 0) continue;
    const bucket = buckets[item.category];
    if (!bucket) continue;
    bucket.count += 1;
    if (item.direction === 'offset') {
      bucket.offsets += item.emissionsKg;
    } else {
      bucket.gross += item.emissionsKg;
    }
  }

  const totalGrossKg = roundKg(
    CATEGORIES_ORDER.reduce((sum, cat) => sum + buckets[cat].gross, 0)
  );
  const totalOffsetsKg = roundKg(
    CATEGORIES_ORDER.reduce((sum, cat) => sum + buckets[cat].offsets, 0)
  );

  const slices: CategoryBreakdownSlice[] = CATEGORIES_ORDER.map((category) => {
    const grossKg = roundKg(buckets[category].gross);
    const offsetsKg = roundKg(buckets[category].offsets);
    const netKg = roundKg(grossKg - offsetsKg);
    const sharePct =
      totalGrossKg > 0 ? roundKg((grossKg / totalGrossKg) * 100, 1) : 0;

    return {
      category,
      grossKg,
      offsetsKg,
      netKg,
      sharePct,
      recordCount: buckets[category].count,
    };
  }).sort((a, b) => {
    if (b.grossKg !== a.grossKg) return b.grossKg - a.grossKg;
    if (b.offsetsKg !== a.offsetsKg) return b.offsetsKg - a.offsetsKg;
    return CATEGORIES_ORDER.indexOf(a.category) - CATEGORIES_ORDER.indexOf(b.category);
  });

  const highest =
    slices.find((slice) => slice.grossKg > 0) ?? null;

  return {
    slices,
    totalGrossKg,
    totalOffsetsKg,
    totalSignedNetKg: roundKg(totalGrossKg - totalOffsetsKg),
    highestCategory: highest,
  };
}

/**
 * Chart 1: Daily emissions trend with missing-day zero-filling in local time.
 */
export function computeDailyTrendSeries(
  activities: CarbonActivity[],
  range: AnalyticsDateRange,
  dailyBudgetKg: number
): DailyTrendPoint[] {
  const buckets = new Map<
    string,
    { gross: number; offsets: number; count: number }
  >();

  for (const item of activities) {
    if (!Number.isFinite(item.emissionsKg) || item.emissionsKg < 0) continue;
    const key = toLocalDateKey(item.occurredAt);
    if (!key || key < range.startKey || key > range.endKey) continue;

    const entry = buckets.get(key) ?? { gross: 0, offsets: 0, count: 0 };
    entry.count += 1;
    if (item.direction === 'offset') {
      entry.offsets += item.emissionsKg;
    } else {
      entry.gross += item.emissionsKg;
    }
    buckets.set(key, entry);
  }

  const startLocal = parseDateKeyLocal(range.startKey);
  if (!startLocal) return [];

  const points: DailyTrendPoint[] = [];
  const totalDays = clampValue(range.dayCount, 1, 730);
  const useWeekdayLabels = totalDays <= 7;

  for (let offset = 0; offset < totalDays; offset += 1) {
    const current = addLocalDays(startLocal, offset);
    const dateKey = toLocalDateKey(current);
    const bucket = buckets.get(dateKey);
    const grossKg = roundKg(bucket?.gross ?? 0);
    const offsetsKg = roundKg(bucket?.offsets ?? 0);
    const netKg = roundKg(grossKg - offsetsKg);
    const isToday = dateKey === range.endKey && range.preset !== 'custom' && range.preset !== 'all';

    points.push({
      dateKey,
      label: isToday
        ? 'Today'
        : formatLocalDateLabel(dateKey, useWeekdayLabels ? 'weekday' : 'numeric'),
      shortDate: formatLocalDateLabel(dateKey, 'short'),
      grossKg,
      offsetsKg,
      netKg,
      targetKg: dailyBudgetKg,
      recordCount: bucket?.count ?? 0,
      hasRecords: Boolean(bucket && bucket.count > 0),
    });
  }

  return points;
}

/**
 * Chart 2: Week-over-week comparison (current 7d vs previous 7d + N calendar week buckets).
 */
export function computeWeeklyComparison(
  activities: CarbonActivity[],
  dailyBudgetKg: number,
  weeksCount = 6,
  referenceNow: Date = new Date()
): WeeklyComparisonSummary {
  const todayLocal = new Date(
    referenceNow.getFullYear(),
    referenceNow.getMonth(),
    referenceNow.getDate(),
    12,
    0,
    0,
    0
  );

  const current7dStart = toLocalDateKey(addLocalDays(todayLocal, -6));
  const todayKey = toLocalDateKey(todayLocal);
  const prev7dStart = toLocalDateKey(addLocalDays(todayLocal, -13));
  const prev7dEnd = toLocalDateKey(addLocalDays(todayLocal, -7));

  const current7dRecords = filterActivities(activities, {
    range: {
      preset: '7d',
      startKey: current7dStart,
      endKey: todayKey,
      label: 'Current 7d',
      dayCount: 7,
    },
  });
  const previous7dRecords = filterActivities(activities, {
    range: {
      preset: 'custom',
      startKey: prev7dStart,
      endKey: prev7dEnd,
      label: 'Previous 7d',
      dayCount: 7,
    },
  });

  const currentTotals = accumulateTotals(current7dRecords);
  const previousTotals = accumulateTotals(previous7dRecords);
  const deltaKg = roundKg(currentTotals.signedNetKg - previousTotals.signedNetKg, 2);
  const deltaPct =
    Math.abs(previousTotals.signedNetKg) > 0.001
      ? Math.round((deltaKg / Math.abs(previousTotals.signedNetKg)) * 100)
      : null;

  // Build Monday-Sunday local calendar week buckets ending in the week of referenceNow
  const currentWeekMonday = getStartOfLocalWeek(todayLocal);
  const safeWeeks = clampValue(weeksCount, 2, 12);
  const buckets: WeeklyComparisonBucket[] = [];

  for (let i = safeWeeks - 1; i >= 0; i -= 1) {
    const monday = addLocalDays(currentWeekMonday, -i * 7);
    const sunday = addLocalDays(monday, 6);
    const weekStartKey = toLocalDateKey(monday);
    const weekEndKey = toLocalDateKey(sunday);

    const weekItems = filterActivities(activities, {
      range: {
        preset: 'custom',
        startKey: weekStartKey,
        endKey: weekEndKey,
        label: '',
        dayCount: 7,
      },
    });
    const totals = accumulateTotals(weekItems);
    const startLabel = formatLocalDateLabel(weekStartKey, 'short');
    const endLabel = formatLocalDateLabel(weekEndKey, 'short');

    buckets.push({
      weekStartKey,
      weekEndKey,
      label: i === 0 ? 'This Wk' : formatLocalDateLabel(weekStartKey, 'numeric'),
      rangeLabel: `${startLabel} – ${endLabel}`,
      grossKg: totals.grossKg,
      offsetsKg: totals.offsetsKg,
      netKg: totals.signedNetKg,
      budgetKg: roundKg(dailyBudgetKg * 7, 2),
      loggedDays: totals.loggedDays,
      recordCount: totals.recordCount,
    });
  }

  return {
    current7dNetKg: currentTotals.signedNetKg,
    previous7dNetKg: previousTotals.signedNetKg,
    current7dGrossKg: currentTotals.grossKg,
    current7dOffsetsKg: currentTotals.offsetsKg,
    deltaKg,
    deltaPct,
    buckets,
  };
}

/**
 * Chart 3: Calendar month-over-month comparison over the last N months.
 */
export function computeMonthlyComparison(
  activities: CarbonActivity[],
  monthsCount = 6,
  referenceNow: Date = new Date()
): MonthlyComparisonSummary {
  const safeMonths = clampValue(monthsCount, 2, 12);
  const currentMonthKey = toLocalMonthKey(referenceNow);
  const prevMonthKey = shiftLocalMonthKey(currentMonthKey, -1);

  const byMonth = new Map<string, CarbonActivity[]>();
  for (const item of activities) {
    const dateKey = toLocalDateKey(item.occurredAt);
    if (!dateKey) continue;
    const monthKey = dateKey.slice(0, 7);
    const list = byMonth.get(monthKey);
    if (list) list.push(item);
    else byMonth.set(monthKey, [item]);
  }

  const buckets: MonthlyComparisonBucket[] = [];
  for (let i = safeMonths - 1; i >= 0; i -= 1) {
    const monthKey = shiftLocalMonthKey(currentMonthKey, -i);
    const items = byMonth.get(monthKey) ?? [];
    const totals = accumulateTotals(items);

    const elapsedInMonth =
      monthKey === currentMonthKey
        ? referenceNow.getDate()
        : getDaysInLocalMonth(monthKey);

    buckets.push({
      monthKey,
      label: formatMonthKeyLabel(monthKey, 'short'),
      fullLabel: formatMonthKeyLabel(monthKey, 'long'),
      grossKg: totals.grossKg,
      offsetsKg: totals.offsetsKg,
      netKg: totals.signedNetKg,
      loggedDays: totals.loggedDays,
      recordCount: totals.recordCount,
      avgDailyNetKg: roundKg(totals.signedNetKg / Math.max(elapsedInMonth, 1), 2),
    });
  }

  const currentBucket = buckets.find((b) => b.monthKey === currentMonthKey) ?? {
    grossKg: 0,
    offsetsKg: 0,
    netKg: 0,
  };
  const previousBucket = buckets.find((b) => b.monthKey === prevMonthKey) ?? {
    netKg: 0,
  };

  const deltaKg = roundKg(currentBucket.netKg - previousBucket.netKg, 2);
  const deltaPct =
    Math.abs(previousBucket.netKg) > 0.001
      ? Math.round((deltaKg / Math.abs(previousBucket.netKg)) * 100)
      : null;

  return {
    currentMonthNetKg: currentBucket.netKg,
    previousMonthNetKg: previousBucket.netKg,
    currentMonthGrossKg: currentBucket.grossKg,
    currentMonthOffsetsKg: currentBucket.offsetsKg,
    deltaKg,
    deltaPct,
    buckets,
  };
}

/**
 * Chart 5: Dedicated Transportation vs Electricity comparison across sub-periods of the active range.
 */
export function computeTransportVsElectricity(
  activities: CarbonActivity[],
  range: AnalyticsDateRange
): TransportVsElectricitySummary {
  const scoped = filterActivities(activities, { range }).filter(
    (item) => item.category === 'transport' || item.category === 'electricity'
  );

  let transportGross = 0;
  let transportOffsets = 0;
  let electricityGross = 0;
  let electricityOffsets = 0;

  for (const item of scoped) {
    if (!Number.isFinite(item.emissionsKg) || item.emissionsKg < 0) continue;
    if (item.category === 'transport') {
      if (item.direction === 'offset') transportOffsets += item.emissionsKg;
      else transportGross += item.emissionsKg;
    } else if (item.category === 'electricity') {
      if (item.direction === 'offset') electricityOffsets += item.emissionsKg;
      else electricityGross += item.emissionsKg;
    }
  }

  const transportGrossKg = roundKg(transportGross);
  const electricityGrossKg = roundKg(electricityGross);
  const transportOffsetsKg = roundKg(transportOffsets);
  const electricityOffsetsKg = roundKg(electricityOffsets);
  const transportNetKg = roundKg(transportGrossKg - transportOffsetsKg);
  const electricityNetKg = roundKg(electricityGrossKg - electricityOffsetsKg);

  const combinedGross = transportGrossKg + electricityGrossKg;
  const transportSharePct =
    combinedGross > 0 ? roundKg((transportGrossKg / combinedGross) * 100, 1) : 0;
  const electricitySharePct =
    combinedGross > 0 ? roundKg((electricityGrossKg / combinedGross) * 100, 1) : 0;

  let dominantCategory: TransportVsElectricitySummary['dominantCategory'] = 'none';
  if (combinedGross > 0) {
    if (Math.abs(transportGrossKg - electricityGrossKg) < 0.005) {
      dominantCategory = 'tied';
    } else if (transportGrossKg > electricityGrossKg) {
      dominantCategory = 'transport';
    } else {
      dominantCategory = 'electricity';
    }
  }

  // Group into sub-periods (daily <= 14d, weekly <= 112d, monthly > 112d)
  const periodsMap = new Map<
    string,
    {
      label: string;
      transportKg: number;
      electricityKg: number;
      transportOffsetKg: number;
      electricityOffsetKg: number;
    }
  >();

  const mode =
    range.dayCount <= 14 ? 'daily' : range.dayCount <= 112 ? 'weekly' : 'monthly';

  const startLocal = parseDateKeyLocal(range.startKey);
  const endLocal = parseDateKeyLocal(range.endKey);

  if (startLocal && endLocal) {
    if (mode === 'daily') {
      for (let d = 0; d < range.dayCount; d += 1) {
        const cur = addLocalDays(startLocal, d);
        const key = toLocalDateKey(cur);
        periodsMap.set(key, {
          label: formatLocalDateLabel(key, range.dayCount <= 7 ? 'weekday' : 'numeric'),
          transportKg: 0,
          electricityKg: 0,
          transportOffsetKg: 0,
          electricityOffsetKg: 0,
        });
      }
    } else if (mode === 'weekly') {
      let cursor = getStartOfLocalWeek(startLocal);
      const endWeek = getStartOfLocalWeek(endLocal);
      let guard = 0;
      while (toLocalDateKey(cursor) <= toLocalDateKey(endWeek) && guard < 24) {
        const key = toLocalDateKey(cursor);
        periodsMap.set(key, {
          label: formatLocalDateLabel(key, 'numeric'),
          transportKg: 0,
          electricityKg: 0,
          transportOffsetKg: 0,
          electricityOffsetKg: 0,
        });
        cursor = addLocalDays(cursor, 7);
        guard += 1;
      }
    } else {
      let monthCursor = range.startKey.slice(0, 7);
      const endMonth = range.endKey.slice(0, 7);
      let guard = 0;
      while (monthCursor <= endMonth && guard < 24) {
        periodsMap.set(monthCursor, {
          label: formatMonthKeyLabel(monthCursor, 'short'),
          transportKg: 0,
          electricityKg: 0,
          transportOffsetKg: 0,
          electricityOffsetKg: 0,
        });
        monthCursor = shiftLocalMonthKey(monthCursor, 1);
        guard += 1;
      }
    }
  }

  for (const item of scoped) {
    const dateKey = toLocalDateKey(item.occurredAt);
    const parsed = parseDateKeyLocal(dateKey);
    if (!parsed) continue;

    const bucketKey =
      mode === 'daily'
        ? dateKey
        : mode === 'weekly'
          ? toLocalDateKey(getStartOfLocalWeek(parsed))
          : dateKey.slice(0, 7);

    const bucket = periodsMap.get(bucketKey);
    if (!bucket) continue;

    if (item.category === 'transport') {
      if (item.direction === 'offset') bucket.transportOffsetKg += item.emissionsKg;
      else bucket.transportKg += item.emissionsKg;
    } else if (item.category === 'electricity') {
      if (item.direction === 'offset') bucket.electricityOffsetKg += item.emissionsKg;
      else bucket.electricityKg += item.emissionsKg;
    }
  }

  const periods: TransportVsElectricityPeriod[] = Array.from(periodsMap.entries()).map(
    ([key, val]) => ({
      key,
      label: val.label,
      transportKg: roundKg(val.transportKg),
      electricityKg: roundKg(val.electricityKg),
      transportOffsetKg: roundKg(val.transportOffsetKg),
      electricityOffsetKg: roundKg(val.electricityOffsetKg),
    })
  );

  return {
    transportGrossKg,
    electricityGrossKg,
    transportOffsetsKg,
    electricityOffsetsKg,
    transportNetKg,
    electricityNetKg,
    transportSharePct,
    electricitySharePct,
    dominantCategory,
    gapKg: roundKg(Math.abs(transportGrossKg - electricityGrossKg)),
    periods,
  };
}

/**
 * Chart 6: Personal progress trajectory over the past N weeks (score & daily average).
 * Leaves weeks with 0 recorded activities as null rather than inventing data points.
 */
export function computePersonalProgressSeries(
  activities: CarbonActivity[],
  dailyBudgetKg: number,
  completedChallengesCount: number,
  weeksCount = 8,
  referenceNow: Date = new Date()
): ProgressPoint[] {
  const todayLocal = new Date(
    referenceNow.getFullYear(),
    referenceNow.getMonth(),
    referenceNow.getDate(),
    12,
    0,
    0,
    0
  );
  const currentWeekMonday = getStartOfLocalWeek(todayLocal);
  const safeWeeks = clampValue(weeksCount, 2, 16);
  const points: ProgressPoint[] = [];

  for (let i = safeWeeks - 1; i >= 0; i -= 1) {
    const monday = addLocalDays(currentWeekMonday, -i * 7);
    const sunday = addLocalDays(monday, 6);
    const startKey = toLocalDateKey(monday);
    const endKey = toLocalDateKey(sunday);

    const weekItems = filterActivities(activities, {
      range: {
        preset: 'custom',
        startKey,
        endKey,
        label: '',
        dayCount: 7,
      },
    });
    const totals = accumulateTotals(weekItems);
    const scoreSummary =
      totals.loggedDays > 0
        ? computeScoreFromWindow(weekItems, dailyBudgetKg, completedChallengesCount)
        : null;

    points.push({
      key: startKey,
      label: i === 0 ? 'Now' : formatLocalDateLabel(startKey, 'numeric'),
      rangeLabel: `${formatLocalDateLabel(startKey, 'short')} – ${formatLocalDateLabel(endKey, 'short')}`,
      score: scoreSummary ? scoreSummary.score : null,
      avgDailyNetKg:
        totals.loggedDays > 0 ? roundKg(totals.signedNetKg / totals.loggedDays, 2) : null,
      targetKg: dailyBudgetKg,
      offsetsKg: totals.offsetsKg,
      loggedDays: totals.loggedDays,
    });
  }

  return points;
}

/**
 * Computes all 6 core Dashboard KPI metrics + comparisons from real carbon records.
 */
export function computeDashboardSummary(
  activities: CarbonActivity[],
  dailyBudgetKg: number,
  completedChallengesCount: number,
  profileBaselineScore: number,
  categoryFilter: AnalyticsCategoryFilter = 'all',
  referenceNow: Date = new Date()
): DashboardAnalyticsSnapshot {
  const scoped = filterActivities(activities, { category: categoryFilter });

  const todayKey = toLocalDateKey(referenceNow);
  const todayRecords = filterActivities(scoped, {
    range: {
      preset: 'custom',
      startKey: todayKey,
      endKey: todayKey,
      label: 'Today',
      dayCount: 1,
    },
  });
  const dailyTotals = accumulateTotals(todayRecords);

  const weeklyComparison = computeWeeklyComparison(
    scoped,
    dailyBudgetKg,
    6,
    referenceNow
  );
  const monthlyComparison = computeMonthlyComparison(scoped, 6, referenceNow);
  const totalTotals = accumulateTotals(scoped);
  const breakdown = computeCategoryBreakdown(scoped);
  const sustainabilityScore = computeSustainabilityScore(
    activities,
    dailyBudgetKg,
    completedChallengesCount,
    profileBaselineScore,
    referenceNow
  );

  return {
    dailyGrossKg: dailyTotals.grossKg,
    dailyAvoidedKg: dailyTotals.offsetsKg,
    dailyNetKg: dailyTotals.signedNetKg,
    weeklyGrossKg: weeklyComparison.current7dGrossKg,
    weeklyAvoidedKg: weeklyComparison.current7dOffsetsKg,
    weeklyNetKg: weeklyComparison.current7dNetKg,
    monthlyGrossKg: monthlyComparison.currentMonthGrossKg,
    monthlyAvoidedKg: monthlyComparison.currentMonthOffsetsKg,
    monthlyNetKg: monthlyComparison.currentMonthNetKg,
    totalAvoidedKg: totalTotals.offsetsKg,
    totalGrossKg: totalTotals.grossKg,
    totalNetKg: totalTotals.signedNetKg,
    highestEmissionCategory: breakdown.highestCategory,
    sustainabilityScore,
    weeklyComparison,
    monthlyComparison,
  };
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 82) return 'A';
  if (score >= 74) return 'B+';
  if (score >= 65) return 'B';
  if (score >= 52) return 'C';
  return 'D';
}

/**
 * Builds a complete, auditable Monthly Sustainability Report from persisted carbon records.
 */
export function computeMonthlyReport(
  activities: CarbonActivity[],
  monthKey: string,
  dailyBudgetKg: number,
  completedChallengesCount: number,
  profileBaselineScore: number,
  referenceNow: Date = new Date()
): MonthlyReport {
  const normalizedMonthKey = MONTH_KEY_REGEX.test(monthKey)
    ? monthKey
    : toLocalMonthKey(referenceNow);
  const prevMonthKey = shiftLocalMonthKey(normalizedMonthKey, -1);

  const monthRecords: CarbonActivity[] = [];
  const prevMonthRecords: CarbonActivity[] = [];

  for (const item of activities) {
    const key = toLocalDateKey(item.occurredAt);
    if (!key) continue;
    const itemMonth = key.slice(0, 7);
    if (itemMonth === normalizedMonthKey) {
      monthRecords.push(item);
    } else if (itemMonth === prevMonthKey) {
      prevMonthRecords.push(item);
    }
  }

  const monthTotals = accumulateTotals(monthRecords);
  const prevTotals = accumulateTotals(prevMonthRecords);
  const breakdown = computeCategoryBreakdown(monthRecords);

  const currentRealMonthKey = toLocalMonthKey(referenceNow);
  const totalDaysInMonth = getDaysInLocalMonth(normalizedMonthKey);
  const elapsedDays =
    normalizedMonthKey === currentRealMonthKey
      ? Math.max(1, referenceNow.getDate())
      : normalizedMonthKey > currentRealMonthKey
        ? 0
        : totalDaysInMonth;

  // Group month records by local day to compute exact daysWithinBudget
  const dailyNetByDay = new Map<string, number>();
  for (const item of monthRecords) {
    const dayKey = toLocalDateKey(item.occurredAt);
    if (!dayKey) continue;
    const prev = dailyNetByDay.get(dayKey) ?? 0;
    const signed = item.direction === 'offset' ? -item.emissionsKg : item.emissionsKg;
    dailyNetByDay.set(dayKey, prev + signed);
  }

  let daysWithinBudget = 0;
  for (const dayNet of dailyNetByDay.values()) {
    if (dayNet <= dailyBudgetKg) {
      daysWithinBudget += 1;
    }
  }

  const previousMonthNetKg =
    prevMonthRecords.length > 0 ? prevTotals.signedNetKg : null;
  const monthOverMonthDeltaKg =
    previousMonthNetKg !== null
      ? roundKg(monthTotals.signedNetKg - previousMonthNetKg, 2)
      : null;
  const monthOverMonthDeltaPct =
    previousMonthNetKg !== null && Math.abs(previousMonthNetKg) > 0.001
      ? Math.round(((monthTotals.signedNetKg - previousMonthNetKg) / Math.abs(previousMonthNetKg)) * 100)
      : null;

  const scoreMetrics =
    monthRecords.length > 0
      ? computeScoreFromWindow(monthRecords, dailyBudgetKg, completedChallengesCount)
      : null;
  const sustainabilityScore = scoreMetrics
    ? scoreMetrics.score
    : clampValue(Math.round(profileBaselineScore || 50), 0, 100);

  const topEmitters = [...monthRecords]
    .filter((item) => item.direction === 'emission')
    .sort((a, b) => b.emissionsKg - a.emissionsKg)
    .slice(0, 3);

  const topOffset =
    [...monthRecords]
      .filter((item) => item.direction === 'offset')
      .sort((a, b) => b.emissionsKg - a.emissionsKg)[0] ?? null;

  return {
    monthKey: normalizedMonthKey,
    monthLabel: formatMonthKeyLabel(normalizedMonthKey, 'long'),
    totalRecords: monthTotals.recordCount,
    loggedDays: monthTotals.loggedDays,
    elapsedDays,
    grossEmissionsKg: monthTotals.grossKg,
    estimatedAvoidedKg: monthTotals.offsetsKg,
    netEmissionsKg: monthTotals.signedNetKg,
    dailyAverageNetKg:
      elapsedDays > 0 ? roundKg(monthTotals.signedNetKg / elapsedDays, 2) : 0,
    loggedDayAverageNetKg:
      monthTotals.loggedDays > 0
        ? roundKg(monthTotals.signedNetKg / monthTotals.loggedDays, 2)
        : 0,
    budgetTargetMonthlyKg: roundKg(dailyBudgetKg * totalDaysInMonth, 1),
    daysWithinBudget,
    previousMonthNetKg,
    monthOverMonthDeltaKg,
    monthOverMonthDeltaPct,
    highestCategory: breakdown.highestCategory,
    categories: breakdown.slices,
    topEmitters,
    topOffset,
    sustainabilityScore,
    grade: monthRecords.length > 0 ? scoreToGrade(sustainabilityScore) : 'N/A',
  };
}

/**
 * Lists distinct months that have activity data plus the current local month, sorted descending.
 */
export function listAvailableReportMonths(
  activities: CarbonActivity[],
  referenceNow: Date = new Date()
): { monthKey: string; label: string; recordCount: number }[] {
  const counts = new Map<string, number>();
  const currentKey = toLocalMonthKey(referenceNow);
  counts.set(currentKey, 0);

  for (const item of activities) {
    const key = toLocalDateKey(item.occurredAt);
    if (!key) continue;
    const monthKey = key.slice(0, 7);
    counts.set(monthKey, (counts.get(monthKey) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, recordCount]) => ({
      monthKey,
      label: formatMonthKeyLabel(monthKey, 'long'),
      recordCount,
    }));
}

export function formatMonthlyReportText(
  report: MonthlyReport,
  userName: string
): string {
  const lines = [
    `EcoTrack Sustainability Report — ${report.monthLabel}`,
    `Member: ${userName}`,
    `Generated: ${toLocalDateKey(new Date())}`,
    '',
    `Summary (${report.totalRecords} logged activities across ${report.loggedDays} active days):`,
    `- Net Carbon Footprint: ${report.netEmissionsKg.toFixed(2)} kg CO₂e`,
    `- Gross Emissions: ${report.grossEmissionsKg.toFixed(2)} kg CO₂e`,
    `- Estimated Emissions Avoided: ${report.estimatedAvoidedKg.toFixed(2)} kg CO₂e`,
    `- Daily Avg (Logged Days): ${report.loggedDayAverageNetKg.toFixed(2)} kg CO₂e/day`,
    `- Days Within Daily Target: ${report.daysWithinBudget} of ${report.loggedDays}`,
    `- Sustainability Score: ${report.sustainabilityScore}/100 (Grade: ${report.grade})`,
  ];

  if (report.monthOverMonthDeltaKg !== null) {
    const sign = report.monthOverMonthDeltaKg > 0 ? '+' : '';
    const pctText =
      report.monthOverMonthDeltaPct !== null
        ? ` (${report.monthOverMonthDeltaPct > 0 ? '+' : ''}${report.monthOverMonthDeltaPct}%)`
        : '';
    lines.push(
      `- Month-over-Month Change: ${sign}${report.monthOverMonthDeltaKg.toFixed(2)} kg CO₂e${pctText}`
    );
  }

  lines.push('', 'Category Breakdown:');
  for (const slice of report.categories) {
    lines.push(
      `- ${CATEGORY_DISPLAY_NAMES[slice.category]}: ${slice.grossKg.toFixed(2)} kg (${slice.sharePct.toFixed(1)}%) | Avoided: ${slice.offsetsKg.toFixed(2)} kg`
    );
  }

  if (report.topEmitters.length > 0) {
    lines.push('', 'Highest-Impact Entries:');
    report.topEmitters.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.title} (${toLocalDateKey(item.occurredAt)}) — ${item.emissionsKg.toFixed(2)} kg CO₂e`
      );
    });
  }

  return lines.join('\n');
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatActivitiesCsv(activities: CarbonActivity[]): string {
  const header = [
    'Date (Local)',
    'Timestamp (UTC)',
    'Title',
    'Category',
    'Direction',
    'Quantity',
    'Unit',
    'Emission Factor (kg/unit)',
    'CO2e (kg)',
    'Region',
    'Source',
    'Notes',
  ].join(',');

  const rows = activities.map((item) =>
    [
      toLocalDateKey(item.occurredAt),
      item.occurredAt,
      item.title,
      item.category,
      item.direction,
      item.quantity !== undefined ? String(item.quantity) : '',
      item.unitLabel ?? '',
      item.emissionFactorKg !== null && item.emissionFactorKg !== undefined
        ? String(item.emissionFactorKg)
        : '',
      item.emissionsKg.toFixed(3),
      item.regionCode ?? '',
      item.methodologySource ?? '',
      item.notes ?? '',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [header, ...rows].join('\n');
}
