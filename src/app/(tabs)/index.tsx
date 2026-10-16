import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ListRowItem,
  LoadingState,
  ProgressBar,
  ScreenContainer,
  SectionHeader,
  StatTile,
  ThemedText,
} from '@/components';
import {
  ACTIVITY_CATEGORIES,
  DAILY_GREEN_TIPS,
  Radii,
  Spacing,
  type AppIconName,
} from '@/constants';
import { useEcoTrack } from '@/context';
import { useTheme } from '@/hooks';
import { ROUTES, type ActivityCategory } from '@/types';
import {
  calculateBudgetProgress,
  formatCarbonKg,
  formatShortDate,
} from '@/utils';

function getGreetingPrefix(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getCategoryIcon(category: ActivityCategory): AppIconName {
  return (
    ACTIVITY_CATEGORIES.find((item) => item.key === category)?.icon ??
    'leaf-outline'
  );
}

function getCategoryLabel(category: ActivityCategory): string {
  return (
    ACTIVITY_CATEGORIES.find((item) => item.key === category)?.shortLabel ??
    category
  );
}

export default function HomeDashboardScreen() {
  const { colors } = useTheme();
  const {
    user,
    activities,
    challenges,
    sustainabilityProgress,
    todayNetKg,
    weeklyNetKg,
    dashboardAnalytics,
    isDataLoading,
    dataError,
    refreshUserData,
  } = useEcoTrack();

  const [tipIndex, setTipIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeTip = DAILY_GREEN_TIPS[tipIndex];
  const budgetProgress = calculateBudgetProgress(
    Math.max(0, todayNetKg),
    user.dailyCarbonBudgetKg
  );
  const firstName = user.fullName.split(' ')[0] || 'Explorer';
  const activeChallengesCount = challenges.filter(
    (c) => c.joined && !c.completed
  ).length;

  const isWithinBudget = todayNetKg <= user.dailyCarbonBudgetKg;
  const recentActivities = activities.slice(0, 4);
  const highestCategory = dashboardAnalytics.highestEmissionCategory;
  const scoreSummary = dashboardAnalytics.sustainabilityScore;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUserData();
    setIsRefreshing(false);
  };

  const quickActions: {
    label: string;
    subtitle: string;
    icon: AppIconName;
    onPress: () => void;
  }[] = [
    {
      label: 'Log Travel',
      subtitle: 'Car, transit, bike',
      icon: 'car-outline',
      onPress: () =>
        router.push({
          pathname: '/(tabs)/calculate',
          params: { category: 'transport' },
        }),
    },
    {
      label: 'Home Energy',
      subtitle: 'Grid, AC, solar',
      icon: 'flash-outline',
      onPress: () =>
        router.push({
          pathname: '/(tabs)/calculate',
          params: { category: 'electricity' },
        }),
    },
    {
      label: 'Challenges',
      subtitle: `${activeChallengesCount} active`,
      icon: 'trophy-outline',
      onPress: () => router.push(ROUTES.challenges),
    },
    {
      label: 'Ask AI',
      subtitle: 'Carbon coach',
      icon: 'sparkles-outline',
      onPress: () => router.push(ROUTES.assistant),
    },
  ];

  const showInitialLoading = isDataLoading && activities.length === 0;

  return (
    <ScreenContainer
      refreshing={isRefreshing}
      onRefresh={() => {
        void handleRefresh();
      }}>
      <Animated.View entering={FadeInDown.duration(260)} style={styles.headerRow}>
        <View style={styles.greetingBlock}>
          <ThemedText variant="caption" color="textMuted">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </ThemedText>
          <ThemedText variant="h1">
            {getGreetingPrefix()}, {firstName}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open streak and challenges"
          onPress={() => router.push(ROUTES.challenges)}>
          <Badge
            label={`${user.ecoStreakDays}d streak`}
            tone="secondary"
            icon="flame"
          />
        </Pressable>
      </Animated.View>

      {dataError ? (
        <Card
          variant="outlined"
          padding="md"
          style={[styles.syncBanner, { borderColor: colors.warning }]}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
          <ThemedText variant="caption" color="textSecondary" style={styles.syncText}>
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

      {showInitialLoading ? (
        <LoadingState label="Loading your sustainability dashboard..." />
      ) : (
        <>
          <Animated.View entering={FadeInDown.delay(60).duration(280)}>
            <Card variant="forest" padding="lg" style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroTextGroup}>
                  <ThemedText
                    variant="label"
                    style={{ color: colors.secondary, opacity: 0.9 }}>
                    DAILY CO₂ EMISSIONS
                  </ThemedText>
                  <ThemedText
                    variant="display"
                    style={{ color: colors.textOnPrimary }}>
                    {formatCarbonKg(todayNetKg)}
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.heroPill,
                    { backgroundColor: 'rgba(220, 252, 231, 0.16)' },
                  ]}>
                  <Ionicons
                    name={isWithinBudget ? 'checkmark-circle' : 'alert-circle'}
                    size={15}
                    color={colors.secondary}
                  />
                  <ThemedText variant="label" style={{ color: colors.secondary }}>
                    {isWithinBudget ? 'Below Target' : 'Over Budget'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.budgetSection}>
                <View style={styles.budgetLabels}>
                  <ThemedText
                    variant="caption"
                    style={{ color: colors.secondary, opacity: 0.9 }}>
                    Daily budget progress (Gross {dashboardAnalytics.dailyGrossKg.toFixed(1)} kg • Saved {dashboardAnalytics.dailyAvoidedKg.toFixed(1)} kg)
                  </ThemedText>
                  <ThemedText variant="label" style={{ color: colors.textOnPrimary }}>
                    {formatCarbonKg(Math.max(0, todayNetKg), { includeUnit: false })} /{' '}
                    {formatCarbonKg(user.dailyCarbonBudgetKg)}
                  </ThemedText>
                </View>
                <ProgressBar
                  progress={budgetProgress}
                  trackColor="rgba(255, 255, 255, 0.22)"
                  fillColor={colors.secondary}
                />
              </View>

              <View style={styles.heroActions}>
                <Button
                  label="Calculate Activity"
                  variant="secondary"
                  size="sm"
                  leftIcon="calculator-outline"
                  onPress={() => router.push(ROUTES.calculate)}
                />
                <Button
                  label="Open Analytics"
                  variant="outline"
                  size="sm"
                  leftIcon="bar-chart-outline"
                  onPress={() => router.push(ROUTES.analytics)}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.secondary,
                  }}
                />
              </View>
            </Card>
          </Animated.View>

          {/* Sustainability Progress Overview */}
          <Animated.View
            entering={FadeInDown.delay(90).duration(270)}
            style={styles.sectionBlock}>
            <SectionHeader
              title="Sustainability Progress"
              subtitle={`${sustainabilityProgress.levelTitle} · ${sustainabilityProgress.ecoPoints} Eco Pts`}
              actionLabel="Challenges Hub"
              onActionPress={() => router.push(ROUTES.challenges)}
            />

            <Card variant="mint" padding="md" style={styles.progressCard}>
              <View style={styles.progressTopRow}>
                <Badge
                  label={sustainabilityProgress.levelTitle}
                  tone="primary"
                  icon="leaf"
                />
                <ThemedText variant="caption" color="textSecondary">
                  {sustainabilityProgress.nextLevelTitle
                    ? `${sustainabilityProgress.pointsToNextLevel} pts to ${sustainabilityProgress.nextLevelTitle}`
                    : 'Top Eco Tier Reached'}
                </ThemedText>
              </View>

              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: colors.surface },
                ]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${sustainabilityProgress.levelProgressPct}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>

              <View style={styles.progressGrid}>
                <View style={styles.progressStatCell}>
                  <ThemedText variant="h3" color="primary">
                    {sustainabilityProgress.totalCompletedChallenges}
                  </ThemedText>
                  <ThemedText variant="caption" color="textMuted">
                    Completed
                  </ThemedText>
                </View>

                <View style={styles.progressStatCell}>
                  <ThemedText variant="h3" color="primary">
                    {sustainabilityProgress.earnedBadgesCount}/
                    {sustainabilityProgress.totalBadgesCount}
                  </ThemedText>
                  <ThemedText variant="caption" color="textMuted">
                    Badges
                  </ThemedText>
                </View>

                <View style={styles.progressStatCell}>
                  <ThemedText variant="h3" color="primary">
                    {sustainabilityProgress.ecoStreakDays}d
                  </ThemedText>
                  <ThemedText variant="caption" color="textMuted">
                    Streak
                  </ThemedText>
                </View>

                <View style={styles.progressStatCell}>
                  <ThemedText variant="h3" color="primary">
                    {sustainabilityProgress.ecoPoints}
                  </ThemedText>
                  <ThemedText variant="caption" color="textMuted">
                    Eco Pts
                  </ThemedText>
                </View>
              </View>

              <View style={styles.heroActions}>
                <Button
                  label="Daily & Weekly Challenges"
                  variant="primary"
                  size="sm"
                  leftIcon="trophy-outline"
                  onPress={() => router.push(ROUTES.challenges)}
                />
                <Button
                  label="Leaderboard"
                  variant="outline"
                  size="sm"
                  leftIcon="podium-outline"
                  onPress={() =>
                    router.push({
                      pathname: '/challenges',
                      params: { tab: 'leaderboard' },
                    })
                  }
                />
              </View>
            </Card>
          </Animated.View>

          {/* Remaining 5 Core Dashboard KPIs from persisted carbon records */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(280)}
            style={styles.kpiSection}>
            <View style={styles.statsGrid}>
              <StatTile
                label="Weekly CO₂"
                value={formatCarbonKg(weeklyNetKg)}
                helper={
                  dashboardAnalytics.weeklyComparison.deltaPct !== null
                    ? `${dashboardAnalytics.weeklyComparison.deltaPct > 0 ? '+' : ''}${dashboardAnalytics.weeklyComparison.deltaPct}% vs prior 7d`
                    : '7-day net CO₂e'
                }
                icon="calendar-outline"
                onPress={() => router.push(ROUTES.analytics)}
              />
              <StatTile
                label="Monthly CO₂"
                value={formatCarbonKg(dashboardAnalytics.monthlyNetKg)}
                helper={
                  dashboardAnalytics.monthlyComparison.deltaPct !== null
                    ? `${dashboardAnalytics.monthlyComparison.deltaPct > 0 ? '+' : ''}${dashboardAnalytics.monthlyComparison.deltaPct}% vs last month`
                    : 'Current calendar month'
                }
                icon="stats-chart-outline"
                onPress={() => router.push(ROUTES.analytics)}
              />
            </View>

            <View style={styles.statsGrid}>
              <StatTile
                label="Emissions Avoided"
                value={formatCarbonKg(dashboardAnalytics.monthlyAvoidedKg)}
                helper={`Total ${dashboardAnalytics.totalAvoidedKg.toFixed(1)} kg saved`}
                icon="leaf-outline"
                onPress={() => router.push(ROUTES.analytics)}
              />
              <StatTile
                label="Eco Score"
                value={`${scoreSummary.score} / 100`}
                helper={scoreSummary.tierLabel}
                icon="shield-checkmark-outline"
                onPress={() => router.push(ROUTES.analytics)}
              />
            </View>

            <StatTile
              label="Highest Emission Category"
              value={
                highestCategory
                  ? `${getCategoryLabel(highestCategory.category)} (${highestCategory.grossKg.toFixed(1)} kg)`
                  : 'No emissions recorded yet'
              }
              helper={
                highestCategory
                  ? `${highestCategory.sharePct.toFixed(0)}% of your recorded gross CO₂e`
                  : 'Log an activity to identify top emission drivers'
              }
              icon={
                highestCategory
                  ? getCategoryIcon(highestCategory.category)
                  : 'pie-chart-outline'
              }
              onPress={() => router.push(ROUTES.analytics)}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(140).duration(280)}
            style={styles.sectionBlock}>
            <SectionHeader title="Quick Actions" />
            <View style={styles.quickGrid}>
              {quickActions.map((action) => (
                <Card
                  key={action.label}
                  variant="elevated"
                  padding="md"
                  onPress={action.onPress}
                  accessibilityLabel={action.label}
                  style={styles.quickCard}>
                  <View
                    style={[
                      styles.quickIconWrap,
                      { backgroundColor: colors.secondary },
                    ]}>
                    <Ionicons name={action.icon} size={20} color={colors.primary} />
                  </View>
                  <ThemedText variant="bodyMedium">{action.label}</ThemedText>
                  <ThemedText variant="caption" color="textMuted">
                    {action.subtitle}
                  </ThemedText>
                </Card>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(180).duration(280)}>
            <Card variant="mint" padding="md" style={styles.tipCard}>
              <View style={styles.tipTopRow}>
                <Badge label="Daily Green Tip" tone="primary" icon="bulb-outline" />
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() =>
                    setTipIndex((prev) => (prev + 1) % DAILY_GREEN_TIPS.length)
                  }>
                  <ThemedText variant="label" color="primary">
                    Next tip
                  </ThemedText>
                </Pressable>
              </View>
              <ThemedText variant="h3" style={{ color: colors.textOnSecondary }}>
                {activeTip.title}
              </ThemedText>
              <ThemedText
                variant="caption"
                style={{ color: colors.textOnSecondary, opacity: 0.9 }}>
                {activeTip.description}
              </ThemedText>
              <Badge label={activeTip.savingsLabel} tone="success" icon="leaf" />
            </Card>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(220).duration(280)}
            style={styles.sectionBlock}>
            <SectionHeader
              title="Recent Activities"
              subtitle="Tap any entry to inspect, modify, or delete"
              actionLabel="See Analytics"
              onActionPress={() => router.push(ROUTES.analytics)}
            />

            {recentActivities.length === 0 ? (
              <EmptyState
                icon="leaf-outline"
                title="No activities logged yet"
                description="Log your first commute, electricity use, or meal to start calculating your daily footprint."
                actionLabel="Open Calculator"
                onActionPress={() => router.push(ROUTES.calculate)}
              />
            ) : (
              <View style={styles.activityList}>
                {recentActivities.map((item) => {
                  const signedValue =
                    item.direction === 'offset'
                      ? `-${item.emissionsKg.toFixed(1)} kg saved`
                      : `+${item.emissionsKg.toFixed(1)} kg CO₂e`;

                  return (
                    <ListRowItem
                      key={item.id}
                      icon={getCategoryIcon(item.category)}
                      title={item.title}
                      subtitle={`${getCategoryLabel(item.category)} • ${formatShortDate(item.occurredAt)}`}
                      trailing={signedValue}
                      onPress={() => router.push(ROUTES.activityDetail(item.id))}
                    />
                  );
                })}
              </View>
            )}
          </Animated.View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  greetingBlock: {
    flex: 1,
    gap: Spacing.xxs,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  syncText: {
    flex: 1,
  },
  heroCard: {
    gap: Spacing.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  heroTextGroup: {
    gap: Spacing.xs,
    flex: 1,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 1,
    borderRadius: Radii.pill,
  },
  budgetSection: {
    gap: Spacing.sm,
  },
  budgetLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  kpiSection: {
    gap: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  sectionBlock: {
    gap: Spacing.md,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  quickCard: {
    width: '47%',
    minWidth: 145,
    flexGrow: 1,
    gap: Spacing.xs,
  },
  quickIconWrap: {
    width: 38,
    height: 38,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxs,
  },
  tipCard: {
    gap: Spacing.sm,
  },
  tipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressCard: {
    gap: Spacing.md,
  },
  progressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radii.pill,
  },
  progressGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  progressStatCell: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  activityList: {
    gap: Spacing.sm,
  },
});
