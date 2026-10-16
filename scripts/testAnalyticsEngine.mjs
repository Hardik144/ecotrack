import assert from 'node:assert/strict';
import fs from 'node:fs';
import module from 'node:module';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Resolve extensionless relative TypeScript imports when executing under Node 24+
module.registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !specifier.endsWith('.ts') &&
      !specifier.endsWith('.js') &&
      !specifier.endsWith('.mjs')
    ) {
      const parentPath = context.parentURL
        ? fileURLToPath(context.parentURL)
        : process.cwd();
      const candidate = new URL(`${specifier}.ts`, pathToFileURL(parentPath));
      if (fs.existsSync(candidate)) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});

const {
  computeCategoryBreakdown,
  computeDailyTrendSeries,
  computeDashboardSummary,
  computeMonthlyComparison,
  computeMonthlyReport,
  computePersonalProgressSeries,
  computeTransportVsElectricity,
  computeWeeklyComparison,
  filterActivities,
  formatActivitiesCsv,
  formatMonthlyReportText,
  listAvailableReportMonths,
  resolveAnalyticsDateRange,
  shiftLocalMonthKey,
  toLocalDateKey,
  toLocalMonthKey,
} = await import('../src/utils/analyticsEngine.ts');

/**
 * Mirrors carbonService.mapEmissionRecordRow so all tests verify
 * calculations directly against realistic database row shapes.
 */
function dbRowToActivity(row) {
  return {
    id: row.id,
    userId: row.user_id,
    activityId: row.activity_id ?? null,
    title: row.title,
    category: row.category,
    emissionsKg: Number(row.emissions_kg),
    direction: row.direction,
    quantity: Number(row.quantity),
    unitLabel: row.unit_label,
    emissionFactorKg:
      row.emission_factor_kg !== null && row.emission_factor_kg !== undefined
        ? Number(row.emission_factor_kg)
        : null,
    regionCode: row.region_code ?? null,
    methodologySource: row.methodology_source ?? null,
    assumptions: row.assumptions ?? null,
    notes: row.notes ?? undefined,
    occurredAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

// Helper to create a local calendar timestamp in the current runtime TZ
function localIso(year, month, day, hour = 10, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function buildSampleDbDataset() {
  const rows = [
    // Today: Nov 15, 2026
    {
      id: 'rec-1',
      user_id: 'user-1',
      title: 'Petrol car commute (20 km)',
      category: 'transport',
      direction: 'emission',
      quantity: '20',
      unit_label: 'km',
      emission_factor_kg: '0.164500',
      emissions_kg: '3.290',
      recorded_at: localIso(2026, 11, 15, 9, 15),
      created_at: localIso(2026, 11, 15, 9, 15),
    },
    {
      id: 'rec-2',
      user_id: 'user-1',
      title: 'Bicycle swap (5 km)',
      category: 'transport',
      direction: 'offset',
      quantity: '5',
      unit_label: 'km',
      emission_factor_kg: '0.164500',
      emissions_kg: '0.823',
      recorded_at: localIso(2026, 11, 15, 18, 0),
      created_at: localIso(2026, 11, 15, 18, 0),
    },
    {
      id: 'rec-3',
      user_id: 'user-1',
      title: 'Evening beef meal',
      category: 'food',
      direction: 'emission',
      quantity: '1',
      unit_label: 'meal',
      emission_factor_kg: '6.200000',
      emissions_kg: '6.200',
      recorded_at: localIso(2026, 11, 15, 20, 0),
      created_at: localIso(2026, 11, 15, 20, 0),
    },
    // Within Current 7d (Nov 12, 2026)
    {
      id: 'rec-4',
      user_id: 'user-1',
      title: 'Home grid electricity (CAMX)',
      category: 'electricity',
      direction: 'emission',
      quantity: '25',
      unit_label: 'kWh',
      emission_factor_kg: '0.184000',
      emissions_kg: '4.600',
      region_code: 'us-camx',
      recorded_at: localIso(2026, 11, 12, 14, 0),
      created_at: localIso(2026, 11, 12, 14, 0),
    },
    // Within Current 7d (Nov 10, 2026) - net negative offset day!
    {
      id: 'rec-5',
      user_id: 'user-1',
      title: 'Mixed Dry Recycling',
      category: 'lifestyle',
      direction: 'offset',
      quantity: '2',
      unit_label: 'kg',
      emission_factor_kg: '3.120000',
      emissions_kg: '6.240',
      recorded_at: localIso(2026, 11, 10, 11, 0),
      created_at: localIso(2026, 11, 10, 11, 0),
    },
    {
      id: 'rec-6',
      user_id: 'user-1',
      title: 'Municipal water + waste',
      category: 'lifestyle',
      direction: 'emission',
      quantity: '2',
      unit_label: 'kg',
      emission_factor_kg: '0.497000',
      emissions_kg: '0.994',
      recorded_at: localIso(2026, 11, 10, 15, 0),
      created_at: localIso(2026, 11, 10, 15, 0),
    },
    // Prior 7d window (Nov 4, 2026 — same November month)
    {
      id: 'rec-7',
      user_id: 'user-1',
      title: 'Regional EV travel (50 km)',
      category: 'transport',
      direction: 'emission',
      quantity: '50',
      unit_label: 'km',
      emissions_kg: '4.005',
      recorded_at: localIso(2026, 11, 4, 16, 0),
      created_at: localIso(2026, 11, 4, 16, 0),
    },
    {
      id: 'rec-8',
      user_id: 'user-1',
      title: 'Home Solar Credit',
      category: 'electricity',
      direction: 'offset',
      quantity: '10',
      unit_label: 'kWh',
      emissions_kg: '1.840',
      recorded_at: localIso(2026, 11, 4, 17, 0),
      created_at: localIso(2026, 11, 4, 17, 0),
    },
    // Previous Calendar Month (Oct 20, 2026)
    {
      id: 'rec-9',
      user_id: 'user-1',
      title: 'October Electricity Bill',
      category: 'electricity',
      direction: 'emission',
      quantity: '100',
      unit_label: 'kWh',
      emissions_kg: '18.400',
      recorded_at: localIso(2026, 10, 20, 12, 0),
      created_at: localIso(2026, 10, 20, 12, 0),
    },
    {
      id: 'rec-10',
      user_id: 'user-1',
      title: 'October Vegetarian Meals',
      category: 'food',
      direction: 'emission',
      quantity: '4',
      unit_label: 'meals',
      emissions_kg: '5.000',
      recorded_at: localIso(2026, 10, 22, 13, 0),
      created_at: localIso(2026, 10, 22, 13, 0),
    },
  ];

  return rows.map(dbRowToActivity);
}

const REFERENCE_NOW = new Date(2026, 10, 15, 21, 0, 0, 0); // Nov 15, 2026 21:00 local

test('dashboard KPIs reconcile identically with DB record sums', () => {
  const activities = buildSampleDbDataset();
  const kpis = computeDashboardSummary(
    activities,
    12.0,
    1,
    50,
    'all',
    REFERENCE_NOW
  );

  // Daily (Nov 15): gross = 3.290 + 6.200 = 9.490; offset = 0.823; net = 8.667
  assert.equal(kpis.dailyGrossKg, 9.49);
  assert.equal(kpis.dailyAvoidedKg, 0.823);
  assert.equal(kpis.dailyNetKg, 8.667);

  // Rolling 7d (Nov 9 .. Nov 15): rec-1..rec-6
  // gross = 3.290 + 6.200 + 4.600 + 0.994 = 15.084
  // offset = 0.823 + 6.240 = 7.063
  // net = 15.084 - 7.063 = 8.021
  assert.equal(kpis.weeklyGrossKg, 15.084);
  assert.equal(kpis.weeklyAvoidedKg, 7.063);
  assert.equal(kpis.weeklyNetKg, 8.021);

  // Previous 7d (Nov 2 .. Nov 8): rec-7 (4.005 emission) + rec-8 (1.840 offset) => 2.165 net
  assert.equal(kpis.weeklyComparison.previous7dNetKg, 2.165);

  // Current month (Nov 2026): rec-1..rec-8
  // gross = 15.084 + 4.005 = 19.089; offset = 7.063 + 1.840 = 8.903; net = 10.186
  assert.equal(kpis.monthlyGrossKg, 19.089);
  assert.equal(kpis.monthlyAvoidedKg, 8.903);
  assert.equal(kpis.monthlyNetKg, 10.186);

  // All-time totals: Nov + Oct (18.400 + 5.000 = 23.400 emission)
  // Total gross = 19.089 + 23.400 = 42.489; total offset = 8.903; total net = 33.586
  assert.equal(kpis.totalGrossKg, 42.489);
  assert.equal(kpis.totalAvoidedKg, 8.903);
  assert.equal(kpis.totalNetKg, 33.586);

  // Highest emission category overall across DB records:
  // electricity = 4.600 + 18.400 = 23.000 kg (highest!)
  // food = 6.200 + 5.000 = 11.200 kg
  // transport = 3.290 + 4.005 = 7.295 kg
  // lifestyle = 0.994 kg
  assert.equal(kpis.highestEmissionCategory?.category, 'electricity');
  assert.equal(kpis.highestEmissionCategory?.grossKg, 23);

  // Activity-derived sustainability score must not equal profile fallback blindly unless math yields 50
  assert.equal(kpis.sustainabilityScore.source, 'activity-derived');
  assert.equal(kpis.sustainabilityScore.activeDays30d, 6);
});

test('daily trend, weekly buckets, monthly comparison, and category donut stay balanced', () => {
  const activities = buildSampleDbDataset();
  const { range } = resolveAnalyticsDateRange('30d', activities, undefined, REFERENCE_NOW);
  assert.equal(range.dayCount, 30);

  const dailyPoints = computeDailyTrendSeries(activities, range, 12);
  assert.equal(dailyPoints.length, 30);

  // Sum of all 30 daily points MUST match the sum of all DB records in that 30d window
  const scoped30d = filterActivities(activities, { range });
  const expectedNetSum = scoped30d.reduce(
    (acc, item) => acc + (item.direction === 'offset' ? -item.emissionsKg : item.emissionsKg),
    0
  );
  const dailySeriesNetSum = dailyPoints.reduce((acc, pt) => acc + pt.netKg, 0);
  assert.equal(Number(dailySeriesNetSum.toFixed(3)), Number(expectedNetSum.toFixed(3)));

  // Check zero-filling on unlogged days (e.g. Nov 13)
  const nov13 = dailyPoints.find((p) => p.dateKey === '2026-11-13');
  assert.ok(nov13);
  assert.equal(nov13.hasRecords, false);
  assert.equal(nov13.netKg, 0);

  // Check Nov 10 signed net (0.994 emission - 6.240 offset = -5.246 net)
  const nov10 = dailyPoints.find((p) => p.dateKey === '2026-11-10');
  assert.ok(nov10);
  assert.equal(nov10.netKg, -5.246);

  // Category Donut percentages on scoped 30d records sum to ~100%
  const donut = computeCategoryBreakdown(scoped30d);
  const pctSum = donut.slices.reduce((sum, s) => sum + s.sharePct, 0);
  assert.ok(Math.abs(pctSum - 100) <= 0.2);

  // Weekly comparison: current week + prior weeks
  const weekly = computeWeeklyComparison(activities, 12, 6, REFERENCE_NOW);
  assert.equal(weekly.buckets.length, 6);
  // Current calendar week (Mon Nov 9 .. Sun Nov 15) matches rolling 7d in this fixture
  const thisWeekBucket = weekly.buckets[weekly.buckets.length - 1];
  assert.equal(thisWeekBucket.weekStartKey, '2026-11-09');
  assert.equal(thisWeekBucket.weekEndKey, '2026-11-15');
  assert.equal(thisWeekBucket.netKg, 8.021);

  // Monthly comparison: Oct net = 23.400, Nov net = 10.186
  const monthly = computeMonthlyComparison(activities, 6, REFERENCE_NOW);
  assert.equal(monthly.buckets.length, 6);
  assert.equal(monthly.previousMonthNetKg, 23.4);
  assert.equal(monthly.currentMonthNetKg, 10.186);
  assert.equal(monthly.deltaKg, -13.21);
});

test('transport vs electricity comparison and personal progress handle missing periods accurately', () => {
  const activities = buildSampleDbDataset();
  const { range } = resolveAnalyticsDateRange('30d', activities, undefined, REFERENCE_NOW);
  const tve = computeTransportVsElectricity(activities, range);

  assert.equal(tve.transportGrossKg, 7.295);
  assert.equal(tve.transportOffsetsKg, 0.823);
  assert.equal(tve.transportNetKg, 6.472);

  assert.equal(tve.electricityGrossKg, 23.0);
  assert.equal(tve.electricityOffsetsKg, 1.84);
  assert.equal(tve.electricityNetKg, 21.16);

  assert.equal(tve.dominantCategory, 'electricity');
  assert.equal(tve.gapKg, 15.705);
  assert.equal(
    Number((tve.transportSharePct + tve.electricitySharePct).toFixed(1)),
    100
  );

  // Personal progress over 8 weeks leaves empty weeks strictly null (no fabricated data)
  const progress = computePersonalProgressSeries(activities, 12, 1, 8, REFERENCE_NOW);
  assert.equal(progress.length, 8);
  assert.equal(progress[0].score, null);
  assert.equal(progress[0].avgDailyNetKg, null);
  assert.equal(progress[0].loggedDays, 0);
  assert.ok(progress[progress.length - 1].score !== null);
  assert.equal(progress[progress.length - 1].loggedDays, 3);
});

test('empty database state & category filtering produce clean zeroes without NaN', () => {
  const emptyKpis = computeDashboardSummary([], 12, 0, 50, 'all', REFERENCE_NOW);
  assert.equal(emptyKpis.dailyNetKg, 0);
  assert.equal(emptyKpis.weeklyNetKg, 0);
  assert.equal(emptyKpis.monthlyNetKg, 0);
  assert.equal(emptyKpis.totalAvoidedKg, 0);
  assert.equal(emptyKpis.highestEmissionCategory, null);
  assert.equal(emptyKpis.sustainabilityScore.score, 50);
  assert.equal(emptyKpis.sustainabilityScore.source, 'profile-baseline');

  const activities = buildSampleDbDataset();
  const foodOnly = computeDashboardSummary(activities, 12, 1, 50, 'food', REFERENCE_NOW);
  assert.equal(foodOnly.dailyGrossKg, 6.2);
  assert.equal(foodOnly.monthlyGrossKg, 6.2);
  assert.equal(foodOnly.totalGrossKg, 11.2);
  assert.equal(foodOnly.highestEmissionCategory?.category, 'food');

  const monthlyEmpty = computeMonthlyComparison([], 6, REFERENCE_NOW);
  assert.equal(monthlyEmpty.deltaPct, null);
});

test('monthly report and CSV export reflect exact database records & MoM math', () => {
  const activities = buildSampleDbDataset();
  const report = computeMonthlyReport(
    activities,
    '2026-11',
    12,
    1,
    50,
    REFERENCE_NOW
  );

  assert.equal(report.monthKey, '2026-11');
  assert.equal(report.totalRecords, 8);
  assert.equal(report.loggedDays, 4); // Nov 4, 10, 12, 15
  assert.equal(report.daysWithinBudget, 4);
  assert.equal(report.grossEmissionsKg, 19.089);
  assert.equal(report.estimatedAvoidedKg, 8.903);
  assert.equal(report.netEmissionsKg, 10.186);
  assert.equal(report.previousMonthNetKg, 23.4);
  assert.equal(report.monthOverMonthDeltaKg, -13.21);
  assert.equal(report.monthOverMonthDeltaPct, -56);
  assert.equal(report.topEmitters[0].id, 'rec-3');
  assert.equal(report.topOffset?.id, 'rec-5');

  const reportText = formatMonthlyReportText(report, 'Alex Rivera');
  assert.ok(reportText.includes('10.19 kg CO₂e'));
  assert.ok(reportText.includes('Evening beef meal'));

  const novRows = activities.filter((a) => toLocalDateKey(a.occurredAt).startsWith('2026-11'));
  const csv = formatActivitiesCsv(novRows);
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 9); // header + 8 November records

  const months = listAvailableReportMonths(activities, REFERENCE_NOW);
  assert.deepEqual(
    months.map((m) => m.monthKey),
    ['2026-11', '2026-10']
  );
  assert.equal(shiftLocalMonthKey('2026-01', -1), '2025-12');
  assert.equal(toLocalMonthKey(REFERENCE_NOW), '2026-11');
});

test('date-only strings, malformed timestamps, custom filters, and activity edits update metrics cleanly', () => {
  // Date-only strings must preserve calendar day even across timezones
  assert.equal(toLocalDateKey('2026-11-15'), '2026-11-15');
  assert.equal(toLocalDateKey('2026-02-31'), '');
  assert.equal(toLocalDateKey('not-a-date'), '');

  // Midnight UTC handling aligns with local runtime calendar
  const sampleUtc = '2026-11-14T22:00:00.000Z';
  const expectedLocalDay = (() => {
    const d = new Date(sampleUtc);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  assert.equal(toLocalDateKey(sampleUtc), expectedLocalDay);

  const activities = buildSampleDbDataset();

  // Invalid custom date range is rejected with error message
  const badRange = resolveAnalyticsDateRange(
    'custom',
    activities,
    { startKey: '2026-11-20', endKey: '2026-11-10' },
    REFERENCE_NOW
  );
  assert.equal(badRange.ok, false);
  assert.ok(badRange.error);

  // Valid custom date range filters strictly
  const goodRange = resolveAnalyticsDateRange(
    'custom',
    activities,
    { startKey: '2026-11-10', endKey: '2026-11-12' },
    REFERENCE_NOW
  );
  assert.equal(goodRange.ok, true);
  assert.equal(goodRange.range.dayCount, 3);
  const filtered = filterActivities(activities, { range: goodRange.range });
  assert.deepEqual(
    filtered.map((r) => r.id).sort(),
    ['rec-4', 'rec-5', 'rec-6']
  );

  // Simulate editing rec-3 (6.2 kg beef -> 0.82 kg vegan) and adding a new 2 kg log
  const mutated = [
    ...activities.map((item) =>
      item.id === 'rec-3'
        ? { ...item, title: 'Whole-plant dinner', emissionsKg: 0.82 }
        : item
    ),
    dbRowToActivity({
      id: 'rec-11',
      user_id: 'user-1',
      title: 'Subway commute',
      category: 'transport',
      direction: 'emission',
      quantity: '10',
      unit_label: 'km',
      emissions_kg: '0.286',
      recorded_at: localIso(2026, 11, 15, 19, 30),
      created_at: localIso(2026, 11, 15, 19, 30),
    }),
  ];

  const updatedKpis = computeDashboardSummary(
    mutated,
    12,
    1,
    50,
    'all',
    REFERENCE_NOW
  );
  // Daily gross was 9.490 - 6.200 + 0.820 + 0.286 = 4.396; net = 4.396 - 0.823 = 3.573
  assert.equal(updatedKpis.dailyGrossKg, 4.396);
  assert.equal(updatedKpis.dailyNetKg, 3.573);
});
