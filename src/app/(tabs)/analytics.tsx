import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  ActivityHistorySection,
  AnalyticsFiltersBar,
  Badge,
  Card,
  CategoryDonutChart,
  DailyTrendChart,
  LoadingState,
  MonthlyComparisonChart,
  MonthlyReportCard,
  PersonalProgressChart,
  ScreenContainer,
  SectionHeader,
  StatTile,
  ThemedText,
  TransportVsElectricityChart,
  WeeklyComparisonChart,
} from '@/components';
import { ACTIVITY_CATEGORIES, Radii, Spacing } from '@/constants';
import { useEcoTrack } from '@/context';
import { useTheme } from '@/hooks';
import {
  ROUTES,
  type ActivityCategory,
  type AnalyticsCategoryFilter,
  type AnalyticsDateRangePreset,
} from '@/types';
import {
  addLocalDays,
  computeCategoryBreakdown,
  computeDailyTrendSeries,
  computeDashboardSummary,
  computeMonthlyComparison,
  computeMonthlyReport,
  computePersonalProgressSeries,
  computeTransportVsElectricity,
  computeWeeklyComparison,
  filterActivities,
  formatCarbonKg,
  resolveAnalyticsDateRange,
  shiftLocalMonthKey,
  toLocalDateKey,
  toLocalMonthKey,
} from '@/utils';

function getCategoryShortLabel(category: ActivityCategory): string {
  return (
    ACTIVITY_CATEGORIES.find((item) => item.key === category)?.shortLabel ??
    category
  );
}

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const {
    user,
    activities,
    challenges,
    totalCompletedChallenges,
    isDataLoading,
    dataError,
    refreshUserData,
  } = useEcoTrack();

  const [referenceNow, setReferenceNow] = useState<Date>(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters state
  const [datePreset, setDatePreset] =
    useState<AnalyticsDateRangePreset>('30d');
  const [categoryFilter, setCategoryFilter] =
    useState<AnalyticsCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const defaultCustomStart = useMemo(
    () => toLocalDateKey(addLocalDays(referenceNow, -29)),
    [referenceNow]
  );
  const defaultCustomEnd = useMemo(
    () => toLocalDateKey(referenceNow),
    [referenceNow]
  );

  const [customStartDraft, setCustomStartDraft] = useState(defaultCustomStart);
  const [customEndDraft, setCustomEndDraft] = useState(defaultCustomEnd);
  const [appliedCustomRange, setAppliedCustomRange] = useState({
    startKey: defaultCustomStart,
    endKey: defaultCustomEnd,
  });
  const [customRangeError, setCustomRangeError] = useState<string | null>(null);

  // Monthly Sustainability Report selector
  const currentMonthKey = useMemo(
    () => toLocalMonthKey(referenceNow),
    [referenceNow]
  );
  const [selectedReportMonthKey, setSelectedReportMonthKey] =
    useState<string>(currentMonthKey);

  const completedChallengesCount = useMemo(
    () =>
      Math.max(
        totalCompletedChallenges,
        challenges.filter((c) => c.completed).length
      ),
    [challenges, totalCompletedChallenges]
  );

  // Resolve active date filter range in local calendar time
  const rangeResolution = useMemo(
    () =>
      resolveAnalyticsDateRange(
        datePreset,
        activities,
        appliedCustomRange,
        referenceNow
      ),
    [activities, appliedCustomRange, datePreset, referenceNow]
  );
  const activeRange = rangeResolution.range;

  // All activities filtered by active Date Range (for category comparisons)
  const dateScopedActivities = useMemo(
    () =>
      filterActivities(activities, {
        range: activeRange,
      }),
    [activities, activeRange]
  );

  // Activities filtered by Category only (used for rolling/calendar KPIs & comparisons)
  const categoryScopedActivities = useMemo(
    () =>
      filterActivities(activities, {
        category: categoryFilter,
      }),
    [activities, categoryFilter]
  );

  // Activities filtered by Date Range + Category + Search (used for Activity History)
  const historyActivities = useMemo(
    () =>
      filterActivities(activities, {
        range: activeRange,
        category: categoryFilter,
        searchQuery,
      }),
    [activeRange, activities, categoryFilter, searchQuery]
  );

  // Core 6 Dashboard Metrics
  const dashboardKpis = useMemo(
    () =>
      computeDashboardSummary(
        activities,
        user.dailyCarbonBudgetKg,
        completedChallengesCount,
        user.sustainabilityScore,
        categoryFilter,
        referenceNow
      ),
    [
      activities,
      categoryFilter,
      completedChallengesCount,
      referenceNow,
      user.dailyCarbonBudgetKg,
      user.sustainabilityScore,
    ]
  );

  // Chart 1: Daily emissions trend (obeys Date Range + Category filters)
  const dailyTrendPoints = useMemo(
    () =>
      computeDailyTrendSeries(
        categoryScopedActivities,
        activeRange,
        user.dailyCarbonBudgetKg
      ),
    [activeRange, categoryScopedActivities, user.dailyCarbonBudgetKg]
  );

  // Chart 2: Weekly comparison (obeys Category filter)
  const weeklySummary = useMemo(
    () =>
      computeWeeklyComparison(
        categoryScopedActivities,
        user.dailyCarbonBudgetKg,
        6,
        referenceNow
      ),
    [categoryScopedActivities, referenceNow, user.dailyCarbonBudgetKg]
  );

  // Chart 3: Monthly comparison (obeys Category filter)
  const monthlySummary = useMemo(
    () => computeMonthlyComparison(categoryScopedActivities, 6, referenceNow),
    [categoryScopedActivities, referenceNow]
  );

  // Chart 4: Category-wise donut breakdown (obeys Date Range; highlights Category filter)
  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(dateScopedActivities),
    [dateScopedActivities]
  );

  // Chart 5: Transportation vs Electricity comparison (obeys Date Range)
  const transportVsElectricity = useMemo(
    () => computeTransportVsElectricity(activities, activeRange),
    [activeRange, activities]
  );

  // Chart 6: Personal progress over time (obeys Category filter)
  const progressSeries = useMemo(
    () =>
      computePersonalProgressSeries(
        categoryScopedActivities,
        user.dailyCarbonBudgetKg,
        completedChallengesCount,
        8,
        referenceNow
      ),
    [
      categoryScopedActivities,
      completedChallengesCount,
      referenceNow,
      user.dailyCarbonBudgetKg,
    ]
  );

  // Monthly Sustainability Report for selected calendar month
  const monthlyReport = useMemo(
    () =>
      computeMonthlyReport(
        activities,
        selectedReportMonthKey,
        user.dailyCarbonBudgetKg,
        completedChallengesCount,
        user.sustainabilityScore,
        referenceNow
      ),
    [
      activities,
      completedChallengesCount,
      referenceNow,
      selectedReportMonthKey,
      user.dailyCarbonBudgetKg,
      user.sustainabilityScore,
    ]
  );

  const selectedMonthRecords = useMemo(
    () =>
      activities.filter(
        (item) => toLocalDateKey(item.occurredAt).slice(0, 7) === selectedReportMonthKey
      ),
    [activities, selectedReportMonthKey]
  );

  const earliestMonthKey = useMemo(() => {
    let earliest = currentMonthKey;
    for (const item of activities) {
      const mKey = toLocalDateKey(item.occurredAt).slice(0, 7);
      if (mKey && mKey < earliest) {
        earliest = mKey;
      }
    }
    const minWindow = shiftLocalMonthKey(currentMonthKey, -11);
    return earliest < minWindow ? earliest : minWindow;
  }, [activities, currentMonthKey]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setReferenceNow(new Date());
    await refreshUserData();
    setIsRefreshing(false);
  };

  const handleSelectDatePreset = (preset: AnalyticsDateRangePreset) => {
    setCustomRangeError(null);
    setDatePreset(preset);
  };

  const handleApplyCustomRange = () => {
    const check = resolveAnalyticsDateRange(
      'custom',
      activities,
      {
        startKey: customStartDraft,
        endKey: customEndDraft,
      },
      referenceNow
    );
    if (!check.ok) {
      setCustomRangeError(check.error ?? 'Invalid date range.');
      return;
    }
    setCustomRangeError(null);
    setAppliedCustomRange({
      startKey: customStartDraft.trim(),
      endKey: customEndDraft.trim(),
    });
  };

  const hasActiveFilters =
    datePreset !== '30d' || categoryFilter !== 'all' || searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setDatePreset('30d');
    setCategoryFilter('all');
    setSearchQuery('');
    setCustomRangeError(null);
  };

  const handleToggleDonutCategory = (category: ActivityCategory) => {
    setCategoryFilter((prev) => (prev === category ? 'all' : category));
  };

  const highestCat = categoryBreakdown.highestCategory;
  const avoidedInWindow = categoryBreakdown.totalOffsetsKg;

  const showInitialLoading = isDataLoading && activities.length === 0;

  return (
    <ScreenContainer
      keyboardAvoiding
      refreshing={isRefreshing}
      onRefresh={() => {
        void handleRefresh();
      }}>
      <Animated.View entering={FadeInDown.duration(260)} style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <ThemedText variant="h1">Sustainability Analytics</ThemedText>
          <ThemedText variant="body" color="textSecondary">
            Live footprint trends, comparisons, and monthly carbon reports.
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh sustainability analytics"
          hitSlop={8}
          onPress={() => {
            void handleRefresh();
          }}
          style={[
            styles.refreshBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}>
          <Ionicons name="refresh-outline" size={18} color={colors.primary} />
        </Pressable>
      </Animated.View>

      {dataError ? (
        <Card
          variant="outlined"
          padding="md"
          style={[
            styles.errorBanner,
            { borderColor: colors.error, backgroundColor: colors.errorSoft },
          ]}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.error} />
          <ThemedText variant="caption" color="error" style={styles.errorText}>
            {dataError}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              void handleRefresh();
            }}>
            <ThemedText variant="label" color="primary">
              Retry
            </ThemedText>
          </Pressable>
        </Card>
      ) : null}

      <Animated.View entering={FadeInDown.delay(40).duration(260)}>
        <AnalyticsFiltersBar
          datePreset={datePreset}
          onSelectDatePreset={handleSelectDatePreset}
          activeRange={activeRange}
          customStartDraft={customStartDraft}
          customEndDraft={customEndDraft}
          onChangeCustomStart={setCustomStartDraft}
          onChangeCustomEnd={setCustomEndDraft}
          onApplyCustomRange={handleApplyCustomRange}
          customRangeError={customRangeError}
          categoryFilter={categoryFilter}
          onSelectCategoryFilter={setCategoryFilter}
          matchingCount={historyActivities.length}
          totalCount={activities.length}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
        />
      </Animated.View>

      {showInitialLoading ? (
        <LoadingState label="Loading activity records and calculating analytics..." />
      ) : (
        <>
          {/* Core 6 Dashboard Metrics */}
          <Animated.View
            entering={FadeInDown.delay(80).duration(260)}
            style={styles.section}>
            <SectionHeader
              title="Key Footprint Metrics"
              subtitle={
                categoryFilter === 'all'
                  ? 'All categories combined • Local calendar time'
                  : `Filtered by ${getCategoryShortLabel(categoryFilter)}`
              }
              actionLabel="Log New"
              onActionPress={() => router.push(ROUTES.calculate)}
            />

            <View style={styles.kpiRow}>
              <StatTile
                label="Daily CO₂"
                value={formatCarbonKg(dashboardKpis.dailyNetKg)}
                helper={`Budget ${user.dailyCarbonBudgetKg.toFixed(1)} kg/day`}
                icon="today-outline"
              />
              <StatTile
                label="Weekly CO₂"
                value={formatCarbonKg(dashboardKpis.weeklyNetKg)}
                helper={
                  weeklySummary.deltaPct !== null
                    ? `${weeklySummary.deltaPct > 0 ? '+' : ''}${weeklySummary.deltaPct}% vs prior 7d`
                    : 'Rolling 7 days'
                }
                icon="calendar-outline"
              />
            </View>

            <View style={styles.kpiRow}>
              <StatTile
                label="Monthly CO₂"
                value={formatCarbonKg(dashboardKpis.monthlyNetKg)}
                helper={
                  monthlySummary.deltaPct !== null
                    ? `${monthlySummary.deltaPct > 0 ? '+' : ''}${monthlySummary.deltaPct}% vs last mo`
                    : 'Current calendar month'
                }
                icon="stats-chart-outline"
              />
              <StatTile
                label="Emissions Avoided"
                value={formatCarbonKg(avoidedInWindow)}
                helper={`${activeRange.label} offsets`}
                icon="leaf-outline"
              />
            </View>

            <View style={styles.kpiRow}>
              <StatTile
                label="Sustainability Score"
                value={`${dashboardKpis.sustainabilityScore.score} / 100`}
                helper={dashboardKpis.sustainabilityScore.tierLabel}
                icon="shield-checkmark-outline"
              />
              <StatTile
                label="Highest Category"
                value={
                  highestCat
                    ? getCategoryShortLabel(highestCat.category)
                    : 'None yet'
                }
                helper={
                  highestCat
                    ? `${highestCat.grossKg.toFixed(1)} kg (${highestCat.sharePct.toFixed(0)}%)`
                    : `No emissions in ${activeRange.label}`
                }
                icon="flame-outline"
              />
            </View>
          </Animated.View>

          {/* Chart 1: Daily Emissions Trend */}
          <Animated.View
            entering={FadeInDown.delay(110).duration(260)}
            style={styles.section}>
            <SectionHeader
              title="1. Daily Emissions Trend"
              subtitle={`Net CO₂e across ${activeRange.label} (${activeRange.dayCount}d)`}
            />
            <DailyTrendChart
              points={dailyTrendPoints}
              dailyBudgetKg={user.dailyCarbonBudgetKg}
              rangeLabel={activeRange.label}
            />
          </Animated.View>

          {/* Chart 2: Weekly Comparison */}
          <Animated.View
            entering={FadeInDown.delay(130).duration(260)}
            style={styles.section}>
            <SectionHeader
              title="2. Weekly Comparison"
              subtitle="Rolling 7-day comparison and 6-week footprint history"
            />
            <WeeklyComparisonChart summary={weeklySummary} />
          </Animated.View>

          {/* Chart 3: Monthly Comparison */}
          <Animated.View
            entering={FadeInDown.delay(150).duration(260)}
            style={styles.section}>
            <SectionHeader
              title="3. Monthly Comparison"
              subtitle="Calendar month-by-month gross, avoided, and net CO₂e"
            />
            <MonthlyComparisonChart
              summary={monthlySummary}
              onSelectMonthForReport={(mKey) => setSelectedReportMonthKey(mKey)}
            />
          </Animated.View>

          {/* Chart 4: Category-wise Donut Chart */}
          <Animated.View
            entering={FadeInDown.delay(170).duration(260)}
            style={styles.section}>
            <SectionHeader
              title="4. Category-Wise Breakdown"
              subtitle={`Tap any slice or row to filter (${activeRange.label})`}
            />
            <CategoryDonutChart
              slices={categoryBreakdown.slices}
              totalGrossKg={categoryBreakdown.totalGrossKg}
              totalOffsetsKg={categoryBreakdown.totalOffsetsKg}
              activeCategoryFilter={categoryFilter}
              onSelectCategory={handleToggleDonutCategory}
            />
          </Animated.View>

          {/* Chart 5: Transportation vs Electricity */}
          <Animated.View
            entering={FadeInDown.delay(190).duration(260)}
            style={styles.section}>
            <SectionHeader
              title="5. Transportation vs Electricity"
              subtitle="Head-to-head comparison between mobility and home power"
            />
            <TransportVsElectricityChart
              summary={transportVsElectricity}
              rangeLabel={activeRange.label}
            />
          </Animated.View>

          {/* Chart 6: Personal Progress Over Time */}
          <Animated.View
            entering={FadeInDown.delay(210).duration(260)}
            style={styles.section}>
            <SectionHeader
              title="6. Personal Progress Over Time"
              subtitle="8-week trajectory of Eco Score and daily CO₂e average"
            />
            <PersonalProgressChart
              points={progressSeries}
              dailyBudgetKg={user.dailyCarbonBudgetKg}
            />
          </Animated.View>

          {/* Monthly Sustainability Reports */}
          <Animated.View
            entering={FadeInDown.delay(230).duration(260)}
            style={styles.section}>
            <SectionHeader
              title="Monthly Sustainability Report"
              subtitle="Audited monthly statement and exportable CSV data"
            />
            <MonthlyReportCard
              report={monthlyReport}
              monthRecords={selectedMonthRecords}
              userName={user.fullName}
              canStepBack={selectedReportMonthKey > earliestMonthKey}
              canStepForward={selectedReportMonthKey < currentMonthKey}
              onStepMonth={(delta) =>
                setSelectedReportMonthKey((prev) => shiftLocalMonthKey(prev, delta))
              }
            />
          </Animated.View>

          {/* Activity History */}
          <Animated.View
            entering={FadeInDown.delay(250).duration(260)}
            style={styles.section}>
            <SectionHeader
              title="Activity History"
              subtitle="Tap any entry to inspect calculation audit, edit, or delete"
              actionLabel="Add New"
              onActionPress={() => router.push(ROUTES.calculate)}
            />
            <View style={styles.historyBadgeRow}>
              <Badge
                label={`Window: ${activeRange.label}`}
                tone="secondary"
              />
              {categoryFilter !== 'all' ? (
                <Badge
                  label={getCategoryShortLabel(categoryFilter)}
                  tone="primary"
                />
              ) : null}
            </View>
            <ActivityHistorySection
              activities={historyActivities}
              searchQuery={searchQuery}
              onChangeSearchQuery={setSearchQuery}
              hasActiveFilters={hasActiveFilters}
              onResetFilters={handleResetFilters}
            />
          </Animated.View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
  },
  section: {
    gap: Spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  historyBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
});
