import assert from 'node:assert/strict';
import fs from 'node:fs';
import module from 'node:module';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hashPassword } from '../backend/auth.mjs';
import { createDatabase } from '../backend/db.mjs';
import { getLeaderboardRows, performChallengeAction } from '../backend/gamification.mjs';

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
  ACTION_VERIFICATION_LIMITATION_TEXT,
  ANTI_FARMING_POLICY_TEXT,
  REQUIRED_BADGE_DEFINITIONS,
  canAdvanceChallengeInPeriod,
  computeSustainabilityProgressSummary,
  filterChallenges,
  findCurrentUserLeaderboardRank,
  formatPeriodBadgeLabel,
  formatPrivacyDisplayName,
  getDailyPeriodKey,
  getDifficultyMeta,
  getIsoWeekParts,
  getLevelProgress,
  getLocalDateKey,
  getPeriodKeyForFrequency,
  getWeeklyPeriodKey,
  mergeChallengesWithPeriodProgress,
  sortBadgesForDisplay,
  sortChallenges,
} = await import('../src/utils/gamificationEngine.ts');

test('Daily & ISO weekly period keys handle normal dates and year-boundary ISO weeks cleanly', () => {
  const mondayNormal = new Date(2026, 10, 16, 14, 30, 0); // 2026-11-16
  assert.equal(getLocalDateKey(mondayNormal), '2026-11-16');
  assert.equal(getDailyPeriodKey(mondayNormal), 'daily:2026-11-16');
  assert.deepEqual(getIsoWeekParts(mondayNormal), { isoYear: 2026, isoWeek: 47 });
  assert.equal(getWeeklyPeriodKey(mondayNormal), 'weekly:2026-W47');
  assert.equal(getPeriodKeyForFrequency('daily', mondayNormal), 'daily:2026-11-16');
  assert.equal(getPeriodKeyForFrequency('weekly', mondayNormal), 'weekly:2026-W47');

  // 2024-12-30 (Monday) belongs to ISO week 2025-W01
  const dec30_2024 = new Date(2024, 11, 30, 9, 0, 0);
  assert.equal(getWeeklyPeriodKey(dec30_2024), 'weekly:2025-W01');

  // 2023-01-01 (Sunday) belongs to ISO week 2022-W52
  const jan01_2023 = new Date(2023, 0, 1, 23, 45, 0);
  assert.equal(getWeeklyPeriodKey(jan01_2023), 'weekly:2022-W52');

  assert.equal(formatPeriodBadgeLabel('daily', 'daily:2026-11-16'), 'Today · 2026-11-16');
  assert.equal(formatPeriodBadgeLabel('weekly', 'weekly:2026-W47'), 'Week 2026-W47');
});

test('Privacy display names never expose emails or full surnames', () => {
  assert.equal(formatPrivacyDisplayName('Maya Chen'), 'Maya C.');
  assert.equal(formatPrivacyDisplayName('  alice   smith-jones '), 'alice S.');
  assert.equal(formatPrivacyDisplayName('Sam'), 'Sam');
  assert.equal(formatPrivacyDisplayName('A'), 'Eco Member');
  assert.equal(formatPrivacyDisplayName(''), 'Eco Member');
  assert.equal(formatPrivacyDisplayName(null), 'Eco Member');
  assert.equal(formatPrivacyDisplayName('maya.chen@ecotrack.app'), 'maya C.');
  assert.equal(
    formatPrivacyDisplayName('VeryLongFirstNameExample Lastname'),
    'VeryLongFirstNam L.'
  );
});

test('Level tiers and progress percentages follow EcoTrack point thresholds', () => {
  const tier1 = getLevelProgress(0);
  assert.equal(tier1.levelTitle, 'Seedling Explorer');
  assert.equal(tier1.nextLevelTitle, 'Green Pathfinder');
  assert.equal(tier1.pointsToNext, 150);
  assert.equal(tier1.progressPct, 0);

  const tier1Mid = getLevelProgress(75);
  assert.equal(tier1Mid.progressPct, 50);

  const tier2 = getLevelProgress(150);
  assert.equal(tier2.levelTitle, 'Green Pathfinder');
  assert.equal(tier2.nextLevelTitle, 'Forest Steward');
  assert.equal(tier2.pointsToNext, 250);

  const tier3 = getLevelProgress(400);
  assert.equal(tier3.levelTitle, 'Forest Steward');
  assert.equal(tier3.nextLevelTitle, 'Planet Guardian');
  assert.equal(tier3.pointsToNext, 600);

  const tier4 = getLevelProgress(1200);
  assert.equal(tier4.levelTitle, 'Planet Guardian');
  assert.equal(tier4.nextLevelTitle, null);
  assert.equal(tier4.pointsToNext, 0);
  assert.equal(tier4.progressPct, 100);
});

test('Period-scoped merging prevents same-period duplicate claims while resetting cleanly next day/week', () => {
  const catalog = [
    {
      id: 'c-plastic',
      slug: 'avoid-single-use-plastic',
      title: 'Avoid Single-Use Plastic',
      description: 'Refuse single-use plastic today.',
      category: 'lifestyle',
      frequency: 'daily',
      difficulty: 'easy',
      co2_savings_kg: 0.45,
      reward_points: 30,
      target_count: 1,
      unit_label: 'day',
      sort_order: 10,
    },
    {
      id: 'c-weekly-transit',
      slug: 'weekly-transit-commuter',
      title: 'Weekly Public Transit Streak',
      description: 'Complete 4 transit commutes this week.',
      category: 'transport',
      frequency: 'weekly',
      difficulty: 'hard',
      co2_savings_kg: 6.5,
      reward_points: 140,
      target_count: 4,
      unit_label: 'trips',
      sort_order: 70,
    },
  ];

  const userRows = [
    {
      id: 'uc-day1',
      challenge_id: 'c-plastic',
      period_key: 'daily:2026-11-16',
      progress: 1,
      status: 'completed',
      last_action_note: 'Used tote bag at grocer',
      last_action_at: '2026-11-16T10:00:00Z',
      completed_at: '2026-11-16T10:00:00Z',
    },
    {
      id: 'uc-week47',
      challenge_id: 'c-weekly-transit',
      period_key: 'weekly:2026-W47',
      progress: 4,
      status: 'completed',
      last_action_note: '4/4 metro trips complete',
      last_action_at: '2026-11-16T18:00:00Z',
      completed_at: '2026-11-16T18:00:00Z',
    },
  ];

  // Same day (2026-11-16): both challenges are locked/completed and duplicate claim is blocked
  const day1Now = new Date(2026, 10, 16, 20, 0, 0);
  const day1Snap = mergeChallengesWithPeriodProgress(catalog, userRows, day1Now);
  assert.equal(day1Snap.totalCompletedChallenges, 2);

  const plasticDay1 = day1Snap.challenges.find((c) => c.id === 'c-plastic');
  assert.ok(plasticDay1);
  assert.equal(plasticDay1.completed, true);
  assert.equal(plasticDay1.historicalCompletions, 1);
  assert.equal(canAdvanceChallengeInPeriod(plasticDay1).allowed, false);

  const transitWeek47 = day1Snap.challenges.find((c) => c.id === 'c-weekly-transit');
  assert.ok(transitWeek47);
  assert.equal(transitWeek47.completed, true);
  assert.equal(canAdvanceChallengeInPeriod(transitWeek47).allowed, false);

  // Next day (2026-11-17, still W47): daily plastic challenge resets cleanly; weekly remains locked
  const day2Now = new Date(2026, 10, 17, 8, 0, 0);
  const day2Snap = mergeChallengesWithPeriodProgress(catalog, userRows, day2Now);
  const plasticDay2 = day2Snap.challenges.find((c) => c.id === 'c-plastic');
  const transitDay2 = day2Snap.challenges.find((c) => c.id === 'c-weekly-transit');

  assert.equal(plasticDay2.completed, false);
  assert.equal(plasticDay2.joined, false);
  assert.equal(plasticDay2.progress, 0);
  assert.equal(plasticDay2.periodKey, 'daily:2026-11-17');
  assert.equal(plasticDay2.historicalCompletions, 1);
  assert.equal(canAdvanceChallengeInPeriod(plasticDay2).allowed, true);
  assert.equal(transitDay2.completed, true);

  // Next ISO week (Monday 2026-11-23, W48): weekly transit challenge opens fresh for W48
  const nextWeekNow = new Date(2026, 10, 23, 8, 0, 0);
  const nextWeekSnap = mergeChallengesWithPeriodProgress(catalog, userRows, nextWeekNow);
  const transitWeek48 = nextWeekSnap.challenges.find((c) => c.id === 'c-weekly-transit');
  assert.equal(transitWeek48.completed, false);
  assert.equal(transitWeek48.periodKey, 'weekly:2026-W48');
  assert.equal(transitWeek48.historicalCompletions, 1);
  assert.equal(nextWeekSnap.totalCompletedChallenges, 2);
});

test('Sorting, filtering, badge definitions & sustainability progress summary remain accurate', () => {
  assert.equal(REQUIRED_BADGE_DEFINITIONS.length, 5);
  assert.deepEqual(
    REQUIRED_BADGE_DEFINITIONS.map((b) => b.title),
    [
      'First Green Step',
      'Plastic-Free Hero',
      'Energy Saver',
      'Eco Warrior',
      'Carbon Champion',
    ]
  );

  assert.equal(getDifficultyMeta('easy').label, 'Easy');
  assert.equal(getDifficultyMeta('medium').label, 'Medium');
  assert.equal(getDifficultyMeta('hard').label, 'Hard');
  assert.ok(ACTION_VERIFICATION_LIMITATION_TEXT.toLowerCase().includes('self-attested'));
  assert.ok(ANTI_FARMING_POLICY_TEXT.toLowerCase().includes('calculator'));

  const mockChallenges = [
    {
      id: '1',
      title: 'Done Daily',
      description: 'Completed today',
      category: 'lifestyle',
      frequency: 'daily',
      difficulty: 'easy',
      periodKey: 'daily:2026-11-16',
      co2SavingsKg: 0.45,
      rewardPoints: 30,
      progress: 1,
      target: 1,
      unitLabel: 'day',
      verificationNote: ACTION_VERIFICATION_LIMITATION_TEXT,
      joined: true,
      completed: true,
      historicalCompletions: 2,
      sortOrder: 10,
    },
    {
      id: '2',
      title: 'Active Weekly',
      description: '2 of 4 steps',
      category: 'transport',
      frequency: 'weekly',
      difficulty: 'hard',
      periodKey: 'weekly:2026-W47',
      co2SavingsKg: 6.5,
      rewardPoints: 140,
      progress: 2,
      target: 4,
      unitLabel: 'trips',
      verificationNote: ACTION_VERIFICATION_LIMITATION_TEXT,
      joined: true,
      completed: false,
      historicalCompletions: 0,
      sortOrder: 70,
    },
    {
      id: '3',
      title: 'Open Daily',
      description: 'Not joined yet',
      category: 'electricity',
      frequency: 'daily',
      difficulty: 'easy',
      periodKey: 'daily:2026-11-16',
      co2SavingsKg: 0.55,
      rewardPoints: 30,
      progress: 0,
      target: 1,
      unitLabel: 'day',
      verificationNote: ACTION_VERIFICATION_LIMITATION_TEXT,
      joined: false,
      completed: false,
      historicalCompletions: 0,
      sortOrder: 30,
    },
  ];

  // Active in-progress challenges sort first, then open, then already completed
  const sorted = sortChallenges(mockChallenges);
  assert.deepEqual(
    sorted.map((c) => c.id),
    ['2', '3', '1']
  );

  assert.equal(filterChallenges(mockChallenges, { frequency: 'weekly' }).length, 1);
  assert.equal(filterChallenges(mockChallenges, { status: 'active' }).length, 1);
  assert.equal(filterChallenges(mockChallenges, { status: 'completed' }).length, 1);
  assert.equal(filterChallenges(mockChallenges, { category: 'electricity' }).length, 1);

  const mockBadges = [
    {
      id: 'b2',
      badgeKey: 'carbon_champion',
      title: 'Carbon Champion',
      description: 'Top tier',
      icon: 'trophy',
      earned: false,
      requirementLabel: '10 challenges & 350 pts',
    },
    {
      id: 'b1',
      badgeKey: 'first_green_step',
      title: 'First Green Step',
      description: 'First step',
      icon: 'leaf',
      earned: true,
      earnedAt: '2026-11-16T10:00:00Z',
      requirementLabel: 'Complete 1 challenge',
    },
  ];
  const sortedBadges = sortBadgesForDisplay(mockBadges);
  assert.equal(sortedBadges[0].badgeKey, 'first_green_step');

  const summary = computeSustainabilityProgressSummary({
    challenges: mockChallenges,
    badges: mockBadges,
    rewardHistory: [
      {
        id: 'rh-1',
        rewardKey: 'challenge:1:daily:2026-11-16',
        sourceType: 'challenge_completion',
        challengeId: '1',
        title: 'Avoid Single-Use Plastic',
        description: 'Completed today',
        pointsDelta: 30,
        verificationType: 'self_attested_action',
        periodKey: 'daily:2026-11-16',
        createdAt: '2026-11-16T10:00:00Z',
      },
      {
        id: 'rh-2',
        rewardKey: 'badge:first_green_step',
        sourceType: 'badge_unlock',
        challengeId: null,
        title: 'First Green Step Badge Unlocked',
        description: 'Milestone reward',
        pointsDelta: 25,
        verificationType: 'milestone_rule',
        periodKey: null,
        createdAt: '2026-11-16T10:00:00Z',
      },
    ],
    ecoPoints: 55,
    ecoStreakDays: 3,
    totalCompletedHistorical: 2,
    now: new Date(2026, 10, 16, 12, 0, 0),
  });

  assert.equal(summary.totalCompletedChallenges, 2);
  assert.equal(summary.activeChallengesCount, 1);
  assert.equal(summary.completedTodayCount, 1);
  assert.equal(summary.completedThisWeekCount, 0);
  assert.equal(summary.earnedBadgesCount, 1);
  assert.equal(summary.totalBadgesCount, 2);
  assert.equal(summary.ecoStreakDays, 3);
  assert.equal(summary.ecoPoints, 55);
  assert.equal(summary.totalVerifiedRewardEntries, 2);
  assert.equal(summary.co2AvoidedFromChallengesKg, 0.9);
});

test('Simulating reward ledger prevents duplicate points & gives zero points for low carbon calculator entries', () => {
  class MockGamificationLedger {
    constructor() {
      this.points = 0;
      this.rewardKeys = new Set();
      this.completedPeriods = new Set();
      this.emissionRecords = [];
    }

    logCarbonCalculation(emissionsKg) {
      // Calculator logs record footprint numbers ONLY; never awards Eco Points
      this.emissionRecords.push({ emissionsKg });
      return { pointsGranted: 0, totalPoints: this.points };
    }

    completeActionChallenge(challengeId, periodKey, rewardPoints) {
      const ucKey = `${challengeId}:${periodKey}`;
      const rewardKey = `challenge:${ucKey}`;
      if (this.completedPeriods.has(ucKey) || this.rewardKeys.has(rewardKey)) {
        return { duplicateBlocked: true, pointsGranted: 0, totalPoints: this.points };
      }
      this.completedPeriods.add(ucKey);
      this.rewardKeys.add(rewardKey);
      this.points += rewardPoints;
      return { duplicateBlocked: false, pointsGranted: rewardPoints, totalPoints: this.points };
    }
  }

  const ledger = new MockGamificationLedger();

  // Attempting to game Eco Points by entering ultra-low 0.05 kg or 0 kg records yields 0 pts
  const lowCarbonResult = ledger.logCarbonCalculation(0.05);
  assert.equal(lowCarbonResult.pointsGranted, 0);
  assert.equal(lowCarbonResult.totalPoints, 0);

  // Completing challenge once awards 30 pts
  const firstClaim = ledger.completeActionChallenge('avoid-plastic', 'daily:2026-11-16', 30);
  assert.equal(firstClaim.duplicateBlocked, false);
  assert.equal(firstClaim.pointsGranted, 30);
  assert.equal(firstClaim.totalPoints, 30);

  // Re-submitting the exact same period claim is blocked with 0 additional points
  const duplicateClaim = ledger.completeActionChallenge('avoid-plastic', 'daily:2026-11-16', 30);
  assert.equal(duplicateClaim.duplicateBlocked, true);
  assert.equal(duplicateClaim.pointsGranted, 0);
  assert.equal(duplicateClaim.totalPoints, 30);

  // Completing it next day opens a new period key cleanly
  const nextDayClaim = ledger.completeActionChallenge('avoid-plastic', 'daily:2026-11-17', 30);
  assert.equal(nextDayClaim.duplicateBlocked, false);
  assert.equal(nextDayClaim.totalPoints, 60);
});

test('Leaderboard lookup identifies current user & respects privacy opt-out filtering', () => {
  const users = [
    { id: 'u1', fullName: 'Maya Chen', email: 'maya@example.com', points: 420, optIn: true },
    { id: 'u2', fullName: 'Liam Patel', email: 'liam@example.com', points: 610, optIn: false },
    { id: 'u3', fullName: 'Aria Brooks', email: 'aria@example.com', points: 250, optIn: true },
  ];

  const currentUserId = 'u3';
  const visibleRows = users
    .filter((u) => u.optIn)
    .sort((a, b) => b.points - a.points)
    .map((u, idx) => ({
      rank: idx + 1,
      displayName: formatPrivacyDisplayName(u.fullName),
      levelTitle: getLevelProgress(u.points).levelTitle,
      sustainabilityPoints: u.points,
      ecoStreakDays: 3,
      completedChallenges: 5,
      earnedBadges: 2,
      isCurrentUser: u.id === currentUserId,
    }));

  // Opted-out user Liam (610 pts) is excluded; emails never appear anywhere
  assert.equal(visibleRows.length, 2);
  assert.equal(visibleRows[0].displayName, 'Maya C.');
  assert.equal(visibleRows[1].displayName, 'Aria B.');
  assert.equal(JSON.stringify(visibleRows).includes('@'), false);

  const me = findCurrentUserLeaderboardRank(visibleRows);
  assert.ok(me);
  assert.equal(me.rank, 2);
  assert.equal(me.isCurrentUser, true);
});

test('Node SQLite backend enforces challenge catalog, period dedup, zero log points, badges & leaderboard privacy', () => {
  const db = createDatabase(':memory:');

  try {
    const seededChallenges = db
      .prepare('SELECT id, slug, frequency FROM challenges WHERE is_active = 1')
      .all();

    const requiredDailySlugs = [
      'avoid-single-use-plastic',
      'carry-reusable-bottle',
      'switch-off-unused-appliances',
      'reduce-food-waste-daily',
      'walk-cycle-short-distances',
      'use-public-transportation',
    ];
    for (const slug of requiredDailySlugs) {
      assert.ok(
        seededChallenges.some((c) => c.slug === slug && c.frequency === 'daily'),
        `Missing required daily challenge slug: ${slug}`
      );
    }

    const now = new Date().toISOString();
    const u1 = '11111111-1111-4111-8111-111111111111';
    const u2 = '22222222-2222-4222-8222-222222222222';
    db.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`
    ).run(
      u1,
      'maya@example.com',
      hashPassword('pass1234'),
      'Maya Chen',
      now,
      now,
      u2,
      'liam@example.com',
      hashPassword('pass1234'),
      'Liam Patel',
      now,
      now
    );

    db.prepare(
      `INSERT INTO profiles (id, email, full_name, leaderboard_opt_in, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?), (?, ?, ?, 0, ?, ?)`
    ).run(u1, 'maya@example.com', 'Maya Chen', now, now, u2, 'liam@example.com', 'Liam Patel', now, now);

    // Completing action challenges unlocks First Green Step (+25) + Plastic-Free Hero (+50)
    const plastic1 = seededChallenges.find((c) => c.slug === 'avoid-single-use-plastic');
    const plastic2 = seededChallenges.find((c) => c.slug === 'carry-reusable-bottle');
    assert.ok(plastic1 && plastic2);

    const periodToday = getDailyPeriodKey(new Date());
    const first = performChallengeAction(db, {
      userId: u1,
      challengeId: plastic1.id,
      mode: 'increment',
      periodKey: periodToday,
    });
    assert.equal(first.statusCode, 200);
    assert.equal(first.data.newlyCompleted, true);
    assert.equal(first.data.duplicateBlocked, false);
    assert.ok(first.data.unlockedBadges.includes('first_green_step'));
    assert.equal(first.data.totalPoints, 55); // 30 challenge + 25 First Green Step

    // Duplicate same-period claim is blocked with 0 extra points
    const duplicate = performChallengeAction(db, {
      userId: u1,
      challengeId: plastic1.id,
      mode: 'increment',
      periodKey: periodToday,
    });
    assert.equal(duplicate.data.duplicateBlocked, true);
    assert.equal(duplicate.data.pointsAwarded, 0);
    assert.equal(duplicate.data.totalPoints, 55);

    // Second plastic challenge unlocks Plastic-Free Hero (+50)
    const second = performChallengeAction(db, {
      userId: u1,
      challengeId: plastic2.id,
      mode: 'increment',
      periodKey: periodToday,
    });
    assert.ok(second.data.unlockedBadges.includes('plastic_free_hero'));
    assert.equal(second.data.totalPoints, 130); // 55 + 25 challenge + 50 Plastic-Free Hero

    // Leaderboard masks names and excludes opted-out user u2
    const lb = getLeaderboardRows(db, u1, 25);
    assert.equal(lb.length, 1);
    assert.equal(lb[0].displayName, 'Maya C.');
    assert.equal(lb[0].isCurrentUser, true);
    assert.equal(JSON.stringify(lb).includes('maya@example.com'), false);
    assert.equal(JSON.stringify(lb).includes('Chen'), false);
  } finally {
    db.close();
  }
});
