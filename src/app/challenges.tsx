import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
  ScreenContainer,
  SectionHeader,
  ThemedText,
} from '@/components';
import { Radii, Spacing } from '@/constants/theme';
import { useEcoTrack } from '@/context/EcoTrackContext';
import { useTheme } from '@/hooks/useTheme';
import type {
  ActivityCategory,
  ChallengeFrequency,
  EcoBadge,
  GreenChallenge,
  RewardHistoryEntry,
} from '@/types';
import {
  ACTION_VERIFICATION_LIMITATION_TEXT,
  ANTI_FARMING_POLICY_TEXT,
  canAdvanceChallengeInPeriod,
  filterChallenges,
  findCurrentUserLeaderboardRank,
  formatPeriodBadgeLabel,
  formatPrivacyDisplayName,
  formatShortDate,
  getDifficultyMeta,
  getFrequencyLabel,
  REQUIRED_BADGE_DEFINITIONS,
  sortBadgesForDisplay,
} from '@/utils';

type HubTab = 'challenges' | 'badges' | 'rewards' | 'leaderboard';
type IoniconName = ComponentProps<typeof Ionicons>['name'];

function isValidHubTab(value: string | undefined): value is HubTab {
  return (
    value === 'challenges' ||
    value === 'badges' ||
    value === 'rewards' ||
    value === 'leaderboard'
  );
}

const CATEGORY_FILTER_OPTIONS: {
  id: 'all' | ActivityCategory;
  label: string;
}[] = [
  { id: 'all', label: 'All' },
  { id: 'transport', label: 'Transport' },
  { id: 'electricity', label: 'Electricity' },
  { id: 'food', label: 'Food' },
  { id: 'lifestyle', label: 'Lifestyle' },
];

const FREQUENCY_FILTER_OPTIONS: {
  id: 'all' | ChallengeFrequency;
  label: string;
}[] = [
  { id: 'all', label: 'All Cadences' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
];

function getCategoryLabel(category: ActivityCategory): string {
  switch (category) {
    case 'transport':
      return 'Transport';
    case 'electricity':
      return 'Electricity';
    case 'food':
      return 'Food';
    case 'lifestyle':
      return 'Lifestyle';
  }
}

function getRewardSourceLabel(sourceType: RewardHistoryEntry['sourceType']): string {
  switch (sourceType) {
    case 'badge_unlock':
      return 'Badge Bonus';
    case 'streak_bonus':
      return 'Streak Bonus';
    case 'challenge_completion':
    default:
      return 'Action Challenge';
  }
}

function getVerificationLabel(
  verificationType: RewardHistoryEntry['verificationType']
): string {
  return verificationType === 'milestone_rule'
    ? 'Milestone Verified'
    : 'Self-Attested Action';
}

export default function ChallengesScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const {
    user,
    preferences,
    challenges,
    badges,
    rewardHistory,
    leaderboard,
    isLeaderboardLoading,
    leaderboardError,
    sustainabilityProgress,
    lastRewardNotice,
    clearLastRewardNotice,
    isDataLoading,
    refreshUserData,
    refreshLeaderboard,
    joinChallenge,
    incrementChallengeProgress,
    togglePreference,
  } = useEcoTrack();

  const paramTab: HubTab = isValidHubTab(params.tab) ? params.tab : 'challenges';
  const [tabOverride, setTabOverride] = useState<{
    forParam: string | undefined;
    tab: HubTab;
  } | null>(null);

  const activeTab: HubTab =
    tabOverride && tabOverride.forParam === params.tab
      ? tabOverride.tab
      : paramTab;

  const setActiveTab = (nextTab: HubTab) => {
    setTabOverride({ forParam: params.tab, tab: nextTab });
  };

  const [frequencyFilter, setFrequencyFilter] = useState<
    'all' | ChallengeFrequency
  >('all');
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | ActivityCategory
  >('all');
  const [busyChallengeId, setBusyChallengeId] = useState<string | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [showPolicyDetails, setShowPolicyDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);

  const visibleChallenges = useMemo(
    () =>
      filterChallenges(challenges, {
        frequency: frequencyFilter,
        category: categoryFilter,
      }),
    [categoryFilter, challenges, frequencyFilter]
  );

  const displayBadges = useMemo<EcoBadge[]>(() => {
    if (badges.length > 0) {
      return sortBadgesForDisplay(badges);
    }
    return REQUIRED_BADGE_DEFINITIONS.map((def) => ({
      id: def.badgeKey,
      badgeKey: def.badgeKey,
      title: def.title,
      description: def.description,
      icon: def.icon,
      earned: false,
      requirementLabel: def.requirementLabel,
      pointsBonus: def.pointsBonus,
    }));
  }, [badges]);

  const myLeaderboardEntry = useMemo(
    () => findCurrentUserLeaderboardRank(leaderboard),
    [leaderboard]
  );

  const totalRewardLedgerPoints = useMemo(
    () => rewardHistory.reduce((sum, entry) => sum + entry.pointsDelta, 0),
    [rewardHistory]
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setActionError(null);
    await refreshUserData();
    setIsRefreshing(false);
  };

  const handleJoin = async (challenge: GreenChallenge) => {
    setBusyChallengeId(challenge.id);
    setActionError(null);
    const res = await joinChallenge(challenge.id);
    setBusyChallengeId(null);
    if (!res.ok && res.error) {
      setActionError(res.error);
    }
  };

  const handleLogStep = async (challenge: GreenChallenge) => {
    const guard = canAdvanceChallengeInPeriod(challenge);
    if (!guard.allowed) {
      setActionError(guard.reason ?? 'Already completed for this period.');
      return;
    }

    setBusyChallengeId(challenge.id);
    setActionError(null);
    const noteText = noteDrafts[challenge.id]?.trim();
    const res = await incrementChallengeProgress(
      challenge.id,
      noteText ? noteText : undefined
    );
    setBusyChallengeId(null);

    if (!res.ok && res.error) {
      setActionError(res.error);
      return;
    }

    setExpandedNoteId(null);
    setNoteDrafts((prev) => {
      const next = { ...prev };
      delete next[challenge.id];
      return next;
    });
  };

  const handleToggleLeaderboardOptIn = async () => {
    setIsUpdatingPrivacy(true);
    setActionError(null);
    const res = await togglePreference('leaderboardOptIn');
    setIsUpdatingPrivacy(false);
    if (!res.ok && res.error) {
      setActionError(res.error);
    }
  };

  return (
    <ScreenContainer
      edges={['top', 'bottom']}
      keyboardAvoiding
      refreshing={isRefreshing}
      onRefresh={() => {
        void handleRefresh();
      }}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>

        <View style={styles.headerTitleGroup}>
          <ThemedText variant="h2">Challenges & Rewards</ThemedText>
          <ThemedText variant="caption" color="textMuted">
            Daily & weekly sustainable habits, badges & rankings
          </ThemedText>
        </View>
      </View>

      {/* Sustainability Progress Hero */}
      <Animated.View entering={FadeInDown.duration(260)}>
        <Card variant="forest" padding="lg" style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroLevelBlock}>
              <View style={styles.heroTierPill}>
                <Ionicons name="trophy" size={14} color={colors.secondary} />
                <ThemedText
                  variant="label"
                  style={{ color: colors.secondary }}>
                  {sustainabilityProgress.levelTitle}
                </ThemedText>
              </View>
              <ThemedText variant="h2" color="textOnPrimary">
                {sustainabilityProgress.ecoPoints} Eco Points
              </ThemedText>
            </View>

            <View style={styles.streakPill}>
              <Ionicons name="flame" size={16} color="#FDE68A" />
              <ThemedText
                variant="label"
                style={{ color: colors.textOnPrimary }}>
                {sustainabilityProgress.ecoStreakDays}d streak
              </ThemedText>
            </View>
          </View>

          {/* Progress toward next tier */}
          <View style={styles.levelProgressSection}>
            <View style={styles.levelLabelsRow}>
              <ThemedText
                variant="caption"
                style={{ color: colors.secondary }}>
                {sustainabilityProgress.nextLevelTitle
                  ? `${sustainabilityProgress.pointsToNextLevel} pts to ${sustainabilityProgress.nextLevelTitle}`
                  : 'Highest sustainability tier unlocked'}
              </ThemedText>
              <ThemedText
                variant="label"
                style={{ color: colors.textOnPrimary }}>
                {sustainabilityProgress.levelProgressPct}%
              </ThemedText>
            </View>
            <View style={styles.heroTrack}>
              <View
                style={[
                  styles.heroFill,
                  { width: `${sustainabilityProgress.levelProgressPct}%` },
                ]}
              />
            </View>
          </View>

          {/* 4 Sustainability Progress Metrics */}
          <View style={styles.heroMetricsRow}>
            <View style={styles.heroMetricItem}>
              <ThemedText variant="h3" color="textOnPrimary">
                {sustainabilityProgress.totalCompletedChallenges}
              </ThemedText>
              <ThemedText
                variant="caption"
                style={{ color: colors.secondary }}>
                Completed
              </ThemedText>
            </View>

            <View style={styles.heroMetricDivider} />

            <View style={styles.heroMetricItem}>
              <ThemedText variant="h3" color="textOnPrimary">
                {sustainabilityProgress.earnedBadgesCount}/
                {sustainabilityProgress.totalBadgesCount}
              </ThemedText>
              <ThemedText
                variant="caption"
                style={{ color: colors.secondary }}>
                Badges
              </ThemedText>
            </View>

            <View style={styles.heroMetricDivider} />

            <View style={styles.heroMetricItem}>
              <ThemedText variant="h3" color="textOnPrimary">
                {sustainabilityProgress.completedTodayCount}
              </ThemedText>
              <ThemedText
                variant="caption"
                style={{ color: colors.secondary }}>
                Done Today
              </ThemedText>
            </View>

            <View style={styles.heroMetricDivider} />

            <View style={styles.heroMetricItem}>
              <ThemedText variant="h3" color="textOnPrimary">
                {sustainabilityProgress.co2AvoidedFromChallengesKg.toFixed(1)}kg
              </ThemedText>
              <ThemedText
                variant="caption"
                style={{ color: colors.secondary }}>
                Est. Saved
              </ThemedText>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* Reward / Duplicate Guard Notice */}
      {lastRewardNotice ? (
        <Card
          variant="mint"
          padding="sm"
          style={styles.feedbackCard}>
          <Ionicons
            name="checkmark-circle"
            size={18}
            color={colors.success}
          />
          <ThemedText
            variant="caption"
            color="text"
            style={styles.feedbackText}>
            {lastRewardNotice}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss reward notice"
            onPress={clearLastRewardNotice}
            hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </Card>
      ) : null}

      {actionError ? (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: colors.errorSoft, borderColor: colors.error },
          ]}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <ThemedText
            variant="caption"
            color="error"
            style={styles.feedbackText}>
            {actionError}
          </ThemedText>
        </View>
      ) : null}

      {/* Honest Verification Limitation Disclosure */}
      <Card variant="outlined" padding="md" style={styles.policyCard}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowPolicyDetails((prev) => !prev)}
          style={styles.policyHeader}>
          <View style={styles.policyTitleRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={colors.primary}
            />
            <ThemedText variant="label" color="primary">
              Verification & Fair Points Policy
            </ThemedText>
          </View>
          <Ionicons
            name={showPolicyDetails ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
        </Pressable>

        <ThemedText variant="caption" color="textSecondary">
          Eco Points are awarded only for completed sustainable actions and
          earned badges—never for entering lower numbers in the calculator.
        </ThemedText>

        {showPolicyDetails ? (
          <View
            style={[
              styles.policyExpanded,
              { borderTopColor: colors.border },
            ]}>
            <ThemedText variant="caption" color="textMuted">
              • {ACTION_VERIFICATION_LIMITATION_TEXT}
            </ThemedText>
            <ThemedText variant="caption" color="textMuted">
              • {ANTI_FARMING_POLICY_TEXT}
            </ThemedText>
          </View>
        ) : null}
      </Card>

      {/* Hub Navigation Tabs */}
      <View
        style={[
          styles.tabRow,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}>
        {(
          [
            { key: 'challenges', label: 'Challenges' },
            { key: 'badges', label: 'Badges' },
            { key: 'rewards', label: 'Rewards' },
            { key: 'leaderboard', label: 'Rankings' },
          ] as { key: HubTab; label: string }[]
        ).map((item) => {
          const selected = activeTab === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setActiveTab(item.key)}
              style={[
                styles.tabBtn,
                selected && { backgroundColor: colors.primary },
              ]}>
              <ThemedText
                variant="label"
                numberOfLines={1}
                style={{
                  color: selected ? colors.textOnPrimary : colors.textSecondary,
                }}>
                {item.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {isDataLoading && challenges.length === 0 ? (
        <LoadingState label="Syncing challenges, badges & rankings..." />
      ) : null}

      {/* TAB 1: DAILY & WEEKLY CHALLENGES */}
      {activeTab === 'challenges' ? (
        <View style={styles.sectionStack}>
          {/* Frequency & Category Filter Bars */}
          <View style={styles.filterGroup}>
            <View style={styles.chipRow}>
              {FREQUENCY_FILTER_OPTIONS.map((opt) => {
                const selected = frequencyFilter === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setFrequencyFilter(opt.id)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: selected
                          ? colors.primary
                          : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}>
                    <ThemedText
                      variant="label"
                      style={{
                        color: selected ? colors.textOnPrimary : colors.text,
                      }}>
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.chipRow}>
              {CATEGORY_FILTER_OPTIONS.map((opt) => {
                const selected = categoryFilter === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setCategoryFilter(opt.id)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: selected
                          ? colors.secondary
                          : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}>
                    <ThemedText
                      variant="caption"
                      style={{
                        color: selected
                          ? colors.textOnSecondary
                          : colors.textSecondary,
                        fontWeight: selected ? '600' : '400',
                      }}>
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <SectionHeader
            title={`Sustainable Challenges (${visibleChallenges.length})`}
            subtitle="Single-claim protection active per day or ISO week"
          />

          {visibleChallenges.length === 0 ? (
            <EmptyState
              icon="filter-outline"
              title="No matching challenges"
              description="Adjust your cadence or category filters to see active daily and weekly green challenges."
              actionLabel="Reset Filters"
              onActionPress={() => {
                setFrequencyFilter('all');
                setCategoryFilter('all');
              }}
            />
          ) : (
            visibleChallenges.map((challenge, idx) => {
              const pct = Math.min(
                100,
                Math.round((challenge.progress / Math.max(1, challenge.target)) * 100)
              );
              const isBusy = busyChallengeId === challenge.id;
              const diffMeta = getDifficultyMeta(challenge.difficulty);
              const periodLabel = formatPeriodBadgeLabel(
                challenge.frequency,
                challenge.periodKey
              );
              const isNoteExpanded = expandedNoteId === challenge.id;

              return (
                <Animated.View
                  key={challenge.id}
                  entering={FadeInDown.delay(idx * 40).duration(220)}>
                  <Card
                    variant={challenge.completed ? 'mint' : 'elevated'}
                    padding="md"
                    style={styles.challengeCard}>
                    {/* Meta Tags */}
                    <View style={styles.challengeMetaRow}>
                      <View style={styles.badgeCluster}>
                        <Badge
                          label={getCategoryLabel(challenge.category)}
                          tone="secondary"
                        />
                        <Badge
                          label={getFrequencyLabel(challenge.frequency)}
                          tone="neutral"
                        />
                        <Badge
                          label={diffMeta.label}
                          tone={
                            diffMeta.tone === 'amber'
                              ? 'warning'
                              : diffMeta.tone === 'danger'
                                ? 'error'
                                : 'success'
                          }
                        />
                      </View>
                      <ThemedText variant="label" color="primary">
                        +{challenge.rewardPoints} pts
                      </ThemedText>
                    </View>

                    {/* Title & Description */}
                    <View style={styles.challengeTitleBlock}>
                      <ThemedText variant="h3">{challenge.title}</ThemedText>
                      <ThemedText variant="body" color="textSecondary">
                        {challenge.description}
                      </ThemedText>
                    </View>

                    {/* Action Step & Verification Limitation */}
                    {challenge.actionStepsHint ? (
                      <View
                        style={[
                          styles.hintBox,
                          { backgroundColor: colors.surfaceElevated },
                        ]}>
                        <Ionicons
                          name="footsteps-outline"
                          size={15}
                          color={colors.primary}
                        />
                        <ThemedText
                          variant="caption"
                          color="textSecondary"
                          style={styles.flex1}>
                          {challenge.actionStepsHint}
                        </ThemedText>
                      </View>
                    ) : null}

                    {/* Progress Bar & Period Metadata */}
                    <View style={styles.progressSection}>
                      <View style={styles.progressLabels}>
                        <ThemedText variant="caption" color="textMuted">
                          {challenge.progress}/{challenge.target}{' '}
                          {challenge.unitLabel} · {periodLabel}
                        </ThemedText>
                        <ThemedText variant="label" color="textSecondary">
                          ~{challenge.co2SavingsKg.toFixed(2)} kg CO₂e saved
                        </ThemedText>
                      </View>

                      <View
                        style={[
                          styles.track,
                          { backgroundColor: colors.surfaceElevated },
                        ]}>
                        <View
                          style={[
                            styles.fill,
                            {
                              width: `${pct}%`,
                              backgroundColor: challenge.completed
                                ? colors.success
                                : colors.primary,
                            },
                          ]}
                        />
                      </View>

                      <View style={styles.subMetaRow}>
                        <ThemedText variant="caption" color="textMuted">
                          {challenge.verificationNote}
                        </ThemedText>
                        {(challenge.historicalCompletions ?? 0) > 0 ? (
                          <ThemedText variant="label" color="primary">
                            Completed {challenge.historicalCompletions}× overall
                          </ThemedText>
                        ) : null}
                      </View>

                      {challenge.lastActionNote ? (
                        <ThemedText variant="caption" color="textSecondary">
                          Note: “{challenge.lastActionNote}”
                        </ThemedText>
                      ) : null}
                    </View>

                    {/* Optional Self-Attestation Reflection Note */}
                    {challenge.joined && !challenge.completed ? (
                      <View style={styles.noteSection}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            setExpandedNoteId(
                              isNoteExpanded ? null : challenge.id
                            )
                          }
                          style={styles.noteToggle}>
                          <Ionicons
                            name={
                              isNoteExpanded
                                ? 'chevron-up-outline'
                                : 'create-outline'
                            }
                            size={15}
                            color={colors.primary}
                          />
                          <ThemedText variant="caption" color="primary">
                            {isNoteExpanded
                              ? 'Hide action note'
                              : 'Add brief note about what you did (optional)'}
                          </ThemedText>
                        </Pressable>

                        {isNoteExpanded ? (
                          <Input
                            placeholder="e.g. Brought steel tumbler & tote bag to market"
                            maxLength={140}
                            value={noteDrafts[challenge.id] ?? ''}
                            onChangeText={(text) =>
                              setNoteDrafts((prev) => ({
                                ...prev,
                                [challenge.id]: text,
                              }))
                            }
                          />
                        ) : null}
                      </View>
                    ) : null}

                    {/* Action CTA */}
                    {challenge.completed ? (
                      <Button
                        label={`Completed (${periodLabel}) · +${challenge.rewardPoints} pts Claimed`}
                        variant="outline"
                        size="sm"
                        fullWidth
                        disabled
                        leftIcon="checkmark-circle"
                      />
                    ) : challenge.joined ? (
                      <Button
                        label={
                          challenge.target > 1
                            ? `Log Action Step (${challenge.progress + 1}/${challenge.target})`
                            : `Complete Action (+${challenge.rewardPoints} pts)`
                        }
                        variant="primary"
                        size="sm"
                        fullWidth
                        loading={isBusy}
                        leftIcon="checkmark-done-outline"
                        onPress={() => {
                          void handleLogStep(challenge);
                        }}
                      />
                    ) : (
                      <Button
                        label={`Start ${getFrequencyLabel(challenge.frequency)} Challenge`}
                        variant="secondary"
                        size="sm"
                        fullWidth
                        loading={isBusy}
                        leftIcon="add-circle-outline"
                        onPress={() => {
                          void handleJoin(challenge);
                        }}
                      />
                    )}
                  </Card>
                </Animated.View>
              );
            })
          )}
        </View>
      ) : null}

      {/* TAB 2: ACHIEVEMENT BADGES */}
      {activeTab === 'badges' ? (
        <View style={styles.sectionStack}>
          <SectionHeader
            title={`Achievement Badges (${sustainabilityProgress.earnedBadgesCount}/${displayBadges.length})`}
            subtitle="Unlocked strictly from completed sustainable challenges and streaks"
          />

          <View style={styles.badgesGrid}>
            {displayBadges.map((badge, idx) => (
              <Animated.View
                key={badge.id}
                entering={FadeInDown.delay(idx * 45).duration(220)}
                style={styles.badgeCardWrap}>
                <Card
                  variant={badge.earned ? 'mint' : 'outlined'}
                  padding="md"
                  style={styles.badgeCard}>
                  <View style={styles.badgeCardTop}>
                    <View
                      style={[
                        styles.badgeIconCircle,
                        {
                          backgroundColor: badge.earned
                            ? colors.primary
                            : colors.surfaceElevated,
                        },
                      ]}>
                      <Ionicons
                        name={badge.icon as IoniconName}
                        size={22}
                        color={
                          badge.earned ? colors.textOnPrimary : colors.textMuted
                        }
                      />
                    </View>

                    <Badge
                      label={badge.earned ? 'Earned' : 'Locked'}
                      tone={badge.earned ? 'success' : 'neutral'}
                    />
                  </View>

                  <ThemedText variant="h3">{badge.title}</ThemedText>
                  <ThemedText variant="caption" color="textSecondary">
                    {badge.description}
                  </ThemedText>

                  <View style={styles.badgeFooter}>
                    <ThemedText variant="label" color="primary">
                      {badge.requirementLabel}
                    </ThemedText>
                    {badge.pointsBonus ? (
                      <ThemedText variant="label" color="textMuted">
                        +{badge.pointsBonus} pts
                      </ThemedText>
                    ) : null}
                  </View>

                  {badge.earned && badge.earnedAt ? (
                    <ThemedText variant="caption" color="success">
                      Unlocked {formatShortDate(badge.earnedAt)}
                    </ThemedText>
                  ) : null}
                </Card>
              </Animated.View>
            ))}
          </View>
        </View>
      ) : null}

      {/* TAB 3: REWARD LEDGER & DUPLICATE PROTECTION */}
      {activeTab === 'rewards' ? (
        <View style={styles.sectionStack}>
          <SectionHeader
            title="Eco Points Reward History"
            subtitle="Immutable ledger protecting against duplicate same-period point claims"
          />

          <Card variant="mint" padding="md" style={styles.ledgerSummaryCard}>
            <View style={styles.ledgerSummaryCol}>
              <ThemedText variant="h2" color="primary">
                {user.ecoPoints}
              </ThemedText>
              <ThemedText variant="caption" color="textSecondary">
                Total Eco Points
              </ThemedText>
            </View>
            <View style={styles.ledgerSummaryCol}>
              <ThemedText variant="h2">{rewardHistory.length}</ThemedText>
              <ThemedText variant="caption" color="textSecondary">
                Verified Grants
              </ThemedText>
            </View>
            <View style={styles.ledgerSummaryCol}>
              <ThemedText variant="h2">+{totalRewardLedgerPoints}</ThemedText>
              <ThemedText variant="caption" color="textSecondary">
                Ledger Total
              </ThemedText>
            </View>
          </Card>

          {rewardHistory.length === 0 ? (
            <EmptyState
              icon="ribbon-outline"
              title="No Eco Points rewarded yet"
              description="Complete a daily or weekly sustainable challenge to earn your first verified Eco Points entry."
              actionLabel="Browse Challenges"
              onActionPress={() => setActiveTab('challenges')}
            />
          ) : (
            rewardHistory.map((entry) => (
              <Card
                key={entry.id}
                variant="elevated"
                padding="md"
                style={styles.rewardRowCard}>
                <View style={styles.rewardTopRow}>
                  <View style={styles.badgeCluster}>
                    <Badge
                      label={getRewardSourceLabel(entry.sourceType)}
                      tone={
                        entry.sourceType === 'badge_unlock'
                          ? 'warning'
                          : 'secondary'
                      }
                    />
                    <Badge
                      label={getVerificationLabel(entry.verificationType)}
                      tone="neutral"
                    />
                  </View>
                  <Badge label={`+${entry.pointsDelta} pts`} tone="success" />
                </View>

                <ThemedText variant="bodyMedium">{entry.title}</ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  {entry.description}
                </ThemedText>

                <View style={styles.rewardMetaFooter}>
                  <ThemedText variant="caption" color="textMuted">
                    {formatShortDate(entry.createdAt)}
                  </ThemedText>
                  {entry.periodKey ? (
                    <ThemedText variant="caption" color="textMuted">
                      Period: {entry.periodKey}
                    </ThemedText>
                  ) : null}
                </View>
              </Card>
            ))
          )}
        </View>
      ) : null}

      {/* TAB 4: PRIVACY-CONSCIOUS COMMUNITY LEADERBOARD */}
      {activeTab === 'leaderboard' ? (
        <View style={styles.sectionStack}>
          <SectionHeader
            title="Community Leaderboard"
            subtitle="Ranked purely by verified sustainable action & badge points"
            actionLabel={isLeaderboardLoading ? 'Refreshing...' : 'Refresh'}
            onActionPress={() => {
              void refreshLeaderboard();
            }}
          />

          {/* Privacy Controls */}
          <Card variant="outlined" padding="md" style={styles.privacyCard}>
            <View style={styles.privacyHeaderRow}>
              <View style={styles.flex1}>
                <ThemedText variant="bodyMedium">
                  Show My Progress on Leaderboard
                </ThemedText>
                <ThemedText variant="caption" color="textMuted">
                  {preferences.leaderboardOptIn
                    ? `Displayed safely as “${formatPrivacyDisplayName(user.fullName)}” — emails and private logs are never shared.`
                    : 'Your account is currently hidden from community rankings.'}
                </ThemedText>
              </View>
              <Switch
                value={preferences.leaderboardOptIn}
                onValueChange={() => {
                  void handleToggleLeaderboardOptIn();
                }}
                disabled={isUpdatingPrivacy}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>

            {myLeaderboardEntry ? (
              <View
                style={[
                  styles.myRankBanner,
                  { backgroundColor: colors.secondary },
                ]}>
                <Ionicons name="podium-outline" size={18} color={colors.primary} />
                <ThemedText variant="label" color="textOnSecondary">
                  Your Rank: #{myLeaderboardEntry.rank} ·{' '}
                  {myLeaderboardEntry.displayName} ·{' '}
                  {myLeaderboardEntry.sustainabilityPoints} pts
                </ThemedText>
              </View>
            ) : null}
          </Card>

          {leaderboardError ? (
            <EmptyState
              icon="lock-closed-outline"
              title="Community leaderboard unavailable"
              description={leaderboardError}
              actionLabel="Retry Sync"
              onActionPress={() => {
                void refreshLeaderboard();
              }}
            />
          ) : isLeaderboardLoading && leaderboard.length === 0 ? (
            <LoadingState label="Loading opted-in EcoTrack rankings..." />
          ) : leaderboard.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No opted-in rankings yet"
              description="Complete a sustainable action challenge while opted in to appear on the community leaderboard."
              actionLabel="Go to Challenges"
              onActionPress={() => setActiveTab('challenges')}
            />
          ) : (
            leaderboard.map((entry) => (
              <Card
                key={`${entry.rank}-${entry.displayName}-${entry.sustainabilityPoints}`}
                variant={entry.isCurrentUser ? 'mint' : 'elevated'}
                padding="md"
                style={styles.leaderRowCard}>
                <View style={styles.leaderLeft}>
                  <View
                    style={[
                      styles.rankCircle,
                      {
                        backgroundColor:
                          entry.rank === 1
                            ? colors.warningSoft
                            : entry.rank <= 3
                              ? colors.secondary
                              : colors.surfaceElevated,
                      },
                    ]}>
                    <ThemedText
                      variant="label"
                      style={{
                        color:
                          entry.rank === 1 ? colors.warning : colors.primary,
                      }}>
                      #{entry.rank}
                    </ThemedText>
                  </View>

                  <View style={styles.flex1}>
                    <View style={styles.leaderNameRow}>
                      <ThemedText variant="bodyMedium" numberOfLines={1}>
                        {entry.displayName}
                      </ThemedText>
                      {entry.isCurrentUser ? (
                        <Badge label="You" tone="primary" />
                      ) : null}
                    </View>
                    <ThemedText variant="caption" color="textMuted">
                      {entry.levelTitle} · {entry.completedChallenges} done ·{' '}
                      {entry.earnedBadges} badges · {entry.ecoStreakDays}d streak
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.leaderPointsBox}>
                  <ThemedText variant="h3" color="primary">
                    {entry.sustainabilityPoints}
                  </ThemedText>
                  <ThemedText variant="caption" color="textMuted">
                    pts
                  </ThemedText>
                </View>
              </Card>
            ))
          )}
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    flex: 1,
    gap: Spacing.xxs,
  },
  heroCard: {
    gap: Spacing.md,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  heroLevelBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  heroTierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs + 1,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(220, 252, 231, 0.16)',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  levelProgressSection: {
    gap: Spacing.xs,
  },
  levelLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroTrack: {
    height: 8,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  heroFill: {
    height: '100%',
    borderRadius: Radii.pill,
    backgroundColor: '#BBF7D0',
  },
  heroMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
  },
  heroMetricItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  heroMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(220, 252, 231, 0.22)',
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  feedbackText: {
    flex: 1,
  },
  policyCard: {
    gap: Spacing.xs,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  policyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  policyExpanded: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    padding: Spacing.xs,
    borderRadius: Radii.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  tabBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  sectionStack: {
    gap: Spacing.md,
  },
  filterGroup: {
    gap: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  challengeCard: {
    gap: Spacing.md,
  },
  challengeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  badgeCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    flex: 1,
  },
  challengeTitleBlock: {
    gap: Spacing.xs,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radii.sm,
  },
  flex1: {
    flex: 1,
  },
  progressSection: {
    gap: Spacing.xs,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radii.pill,
  },
  subMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  noteSection: {
    gap: Spacing.sm,
  },
  noteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  badgeCardWrap: {
    width: '47%',
    flexGrow: 1,
    minWidth: 155,
  },
  badgeCard: {
    flex: 1,
    gap: Spacing.sm,
  },
  badgeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 'auto',
    paddingTop: Spacing.xs,
  },
  ledgerSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  ledgerSummaryCol: {
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  rewardRowCard: {
    gap: Spacing.xs,
  },
  rewardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rewardMetaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xxs,
  },
  privacyCard: {
    gap: Spacing.sm,
  },
  privacyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  myRankBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
  },
  leaderRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  leaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rankCircle: {
    width: 38,
    height: 38,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  leaderPointsBox: {
    alignItems: 'flex-end',
  },
});
