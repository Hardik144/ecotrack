import crypto from 'node:crypto';
import { computeLevelTitle, seedUserAchievements, withTransaction } from './db.mjs';

const PLASTIC_SLUGS = new Set([
  'avoid-single-use-plastic',
  'carry-reusable-bottle',
  'weekly-plastic-free-sprint',
  'zero-single-use-week',
]);

export function formatPrivacyDisplayName(rawName) {
  let cleaned = typeof rawName === 'string' ? rawName.trim() : '';
  if (!cleaned) return 'Eco Member';

  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@')[0].replace(/[._-]+/g, ' ').trim();
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 'Eco Member';

  const first = tokens[0].slice(0, 16);
  if (tokens.length === 1) {
    return first.length >= 2 ? first : 'Eco Member';
  }

  const lastInitial = tokens[tokens.length - 1].replace(/[^A-Za-z0-9]/g, '').charAt(0);
  if (!lastInitial) {
    return first.length >= 2 ? first : 'Eco Member';
  }

  return `${first} ${lastInitial.toUpperCase()}.`;
}

export function getIsoWeekPartsUtc(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoYear: d.getUTCFullYear(), isoWeek };
}

export function getDefaultPeriodKey(frequency, now = new Date()) {
  if (frequency === 'weekly') {
    const { isoYear, isoWeek } = getIsoWeekPartsUtc(now);
    return `weekly:${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
  }
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `daily:${yyyy}-${mm}-${dd}`;
}

export function isValidPeriodKeyForFrequency(frequency, periodKey, now = new Date()) {
  if (typeof periodKey !== 'string') return false;
  if (frequency === 'daily') {
    const match = /^daily:(\d{4})-(\d{2})-(\d{2})$/.exec(periodKey);
    if (!match) return false;
    const candidateMs = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!Number.isFinite(candidateMs)) return false;
    const diffDays = Math.abs(candidateMs - now.getTime()) / 86400000;
    return diffDays <= 2.5;
  }

  const match = /^weekly:(\d{4})-W(\d{2})$/.exec(periodKey);
  if (!match) return false;
  const isoWeek = Number(match[2]);
  return isoWeek >= 1 && isoWeek <= 53;
}

function getPreviousDateString(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const prev = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) - 1));
  const y = prev.getUTCFullYear();
  const m = String(prev.getUTCMonth() + 1).padStart(2, '0');
  const d = String(prev.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extractActionDateKey(frequency, periodKey, now = new Date()) {
  if (frequency === 'daily' && periodKey.startsWith('daily:')) {
    return periodKey.slice(6);
  }
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function grantRewardOnce(db, params) {
  const {
    userId,
    rewardKey,
    sourceType,
    challengeId,
    title,
    description,
    pointsDelta,
    periodKey,
    nowIso,
  } = params;

  const insertRes = db
    .prepare(
      `INSERT OR IGNORE INTO reward_history (
        id, user_id, reward_key, source_type, challenge_id,
        title, description, points_delta, verification_type, period_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'self_attested', ?, ?)`
    )
    .run(
      crypto.randomUUID(),
      userId,
      rewardKey,
      sourceType,
      challengeId ?? null,
      title.trim().slice(0, 140),
      description.trim().slice(0, 360),
      pointsDelta,
      periodKey ?? null,
      nowIso
    );

  if (insertRes.changes > 0) {
    db.prepare(
      `UPDATE profiles
         SET sustainability_points = sustainability_points + ?,
             sustainability_score = MIN(100, sustainability_score + 1),
             updated_at = ?
       WHERE id = ?`
    ).run(pointsDelta, nowIso, userId);
    return true;
  }

  return false;
}

export function evaluateAndUnlockBadges(db, userId, nowIso) {
  seedUserAchievements(db, userId);

  const completedRows = db
    .prepare(
      `SELECT uc.challenge_id, c.slug, c.category
         FROM user_challenges uc
         JOIN challenges c ON c.id = uc.challenge_id
        WHERE uc.user_id = ? AND uc.status = 'completed'`
    )
    .all(userId);

  const totalCompleted = completedRows.length;
  const plasticCompleted = completedRows.filter((r) => PLASTIC_SLUGS.has(r.slug)).length;
  const energyCompleted = completedRows.filter((r) => r.category === 'electricity').length;

  const profileRow = db
    .prepare('SELECT eco_streak_days, sustainability_points FROM profiles WHERE id = ?')
    .get(userId);
  const currentStreak = Number(profileRow?.eco_streak_days ?? 0);
  const currentPoints = Number(profileRow?.sustainability_points ?? 0);

  const lockedBadges = db
    .prepare(
      `SELECT badge_key, title, points_bonus
         FROM achievements
        WHERE user_id = ? AND earned = 0
        ORDER BY created_at ASC`
    )
    .all(userId);

  const unlockedKeys = [];
  let bonusPointsAwarded = 0;

  for (const badge of lockedBadges) {
    const qualifies =
      (badge.badge_key === 'first_green_step' && totalCompleted >= 1) ||
      (badge.badge_key === 'plastic_free_hero' && plasticCompleted >= 2) ||
      (badge.badge_key === 'energy_saver' && energyCompleted >= 2) ||
      (badge.badge_key === 'eco_warrior' &&
        (totalCompleted >= 5 || currentStreak >= 3)) ||
      (badge.badge_key === 'carbon_champion' &&
        totalCompleted >= 10 &&
        currentPoints >= 350);

    if (!qualifies) continue;

    const unlockRes = db
      .prepare(
        `UPDATE achievements
            SET earned = 1,
                earned_at = COALESCE(earned_at, ?)
          WHERE user_id = ? AND badge_key = ? AND earned = 0`
      )
      .run(nowIso, userId, badge.badge_key);

    if (unlockRes.changes > 0) {
      unlockedKeys.push(badge.badge_key);
      if (Number(badge.points_bonus) > 0) {
        const granted = grantRewardOnce(db, {
          userId,
          rewardKey: `badge:${badge.badge_key}`,
          sourceType: 'badge_unlock',
          challengeId: null,
          title: `Badge Unlocked: ${badge.title}`,
          description: `Milestone achievement (${badge.badge_key})`,
          pointsDelta: Number(badge.points_bonus),
          periodKey: null,
          nowIso,
        });
        if (granted) {
          bonusPointsAwarded += Number(badge.points_bonus);
        }
      }
    }
  }

  return { unlockedKeys, bonusPointsAwarded };
}

export function performChallengeAction(db, params) {
  const { userId, challengeId, mode, actionNote, periodKey: rawPeriodKey } = params;

  if (mode !== 'join' && mode !== 'increment') {
    return { statusCode: 400, error: 'Action mode must be "join" or "increment".' };
  }

  const challenge = db
    .prepare('SELECT * FROM challenges WHERE id = ? AND is_active = 1')
    .get(challengeId);
  if (!challenge) {
    return { statusCode: 404, error: 'Challenge not found or no longer active.' };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const periodKey = rawPeriodKey?.trim() || getDefaultPeriodKey(challenge.frequency, now);

  if (!isValidPeriodKeyForFrequency(challenge.frequency, periodKey, now)) {
    return {
      statusCode: 400,
      error: `Invalid periodKey "${periodKey}" for ${challenge.frequency} challenge.`,
    };
  }

  const cleanedNote =
    typeof actionNote === 'string' && actionNote.trim()
      ? actionNote.trim().slice(0, 240)
      : null;

  return withTransaction(db, () => {
    const existing = db
      .prepare(
        `SELECT id, progress, status
           FROM user_challenges
          WHERE user_id = ? AND challenge_id = ? AND period_key = ?`
      )
      .get(userId, challengeId, periodKey);

    const profileBefore = db
      .prepare(
        'SELECT sustainability_points, eco_streak_days, last_action_date FROM profiles WHERE id = ?'
      )
      .get(userId);

    if (existing && existing.status === 'completed') {
      return {
        statusCode: 200,
        data: {
          userChallengeId: existing.id,
          challengeId,
          periodKey,
          status: 'completed',
          progress: Number(existing.progress),
          targetCount: Number(challenge.target_count),
          pointsAwarded: 0,
          newlyCompleted: false,
          duplicateBlocked: true,
          unlockedBadges: [],
          totalPoints: Number(profileBefore?.sustainability_points ?? 0),
          ecoStreakDays: Number(profileBefore?.eco_streak_days ?? 0),
        },
      };
    }

    if (mode === 'join') {
      let userChallengeId = existing?.id ?? crypto.randomUUID();
      if (!existing) {
        db.prepare(
          `INSERT INTO user_challenges (
            id, user_id, challenge_id, period_key, progress, status,
            last_action_note, last_action_at, joined_at, updated_at
          ) VALUES (?, ?, ?, ?, 0, 'joined', ?, ?, ?, ?)`
        ).run(
          userChallengeId,
          userId,
          challengeId,
          periodKey,
          cleanedNote,
          cleanedNote ? nowIso : null,
          nowIso,
          nowIso
        );
      }

      return {
        statusCode: 200,
        data: {
          userChallengeId,
          challengeId,
          periodKey,
          status: 'joined',
          progress: existing ? Number(existing.progress) : 0,
          targetCount: Number(challenge.target_count),
          pointsAwarded: 0,
          newlyCompleted: false,
          duplicateBlocked: false,
          unlockedBadges: [],
          totalPoints: Number(profileBefore?.sustainability_points ?? 0),
          ecoStreakDays: Number(profileBefore?.eco_streak_days ?? 0),
        },
      };
    }

    // mode === 'increment'
    const currentProgress = existing ? Number(existing.progress) : 0;
    const nextProgress = Math.min(Number(challenge.target_count), currentProgress + 1);
    const isNowCompleted = nextProgress >= Number(challenge.target_count);
    const nextStatus = isNowCompleted ? 'completed' : 'joined';
    const activeUserChallengeId = existing?.id ?? crypto.randomUUID();

    if (existing) {
      db.prepare(
        `UPDATE user_challenges
            SET progress = ?,
                status = ?,
                last_action_note = COALESCE(?, last_action_note),
                last_action_at = ?,
                completed_at = CASE WHEN ? THEN COALESCE(completed_at, ?) ELSE completed_at END,
                updated_at = ?
          WHERE id = ?`
      ).run(
        nextProgress,
        nextStatus,
        cleanedNote,
        nowIso,
        isNowCompleted ? 1 : 0,
        nowIso,
        nowIso,
        activeUserChallengeId
      );
    } else {
      db.prepare(
        `INSERT INTO user_challenges (
          id, user_id, challenge_id, period_key, progress, status,
          last_action_note, last_action_at, joined_at, completed_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        activeUserChallengeId,
        userId,
        challengeId,
        periodKey,
        nextProgress,
        nextStatus,
        cleanedNote,
        nowIso,
        nowIso,
        isNowCompleted ? nowIso : null,
        nowIso
      );
    }

    // Update streak once per distinct local action date when making real challenge progress
    const actionDateKey = extractActionDateKey(challenge.frequency, periodKey, now);
    const prevDateKey = getPreviousDateString(actionDateKey);
    const lastActionDate = profileBefore?.last_action_date ?? null;
    let nextStreak = Number(profileBefore?.eco_streak_days ?? 0);

    if (!lastActionDate) {
      nextStreak = Math.max(1, nextStreak);
    } else if (lastActionDate === actionDateKey) {
      nextStreak = Math.max(1, nextStreak);
    } else if (prevDateKey && lastActionDate === prevDateKey) {
      nextStreak = nextStreak + 1;
    } else if (actionDateKey > lastActionDate) {
      nextStreak = 1;
    }

    db.prepare(
      `UPDATE profiles
          SET eco_streak_days = ?,
              last_action_date = CASE
                WHEN last_action_date IS NULL OR ? > last_action_date THEN ?
                ELSE last_action_date
              END,
              updated_at = ?
        WHERE id = ?`
    ).run(nextStreak, actionDateKey, actionDateKey, nowIso, userId);

    let challengePointsAwarded = 0;
    let badgeBonusAwarded = 0;
    let unlockedBadges = [];

    if (isNowCompleted) {
      const granted = grantRewardOnce(db, {
        userId,
        rewardKey: `challenge:${challengeId}:${periodKey}`,
        sourceType: 'challenge_completion',
        challengeId,
        title: `Completed: ${challenge.title}`,
        description: `${challenge.frequency} challenge (${periodKey})`,
        pointsDelta: Number(challenge.reward_points),
        periodKey,
        nowIso,
      });

      if (granted) {
        challengePointsAwarded = Number(challenge.reward_points);
      }

      const badgeRes = evaluateAndUnlockBadges(db, userId, nowIso);
      unlockedBadges = badgeRes.unlockedKeys;
      badgeBonusAwarded = badgeRes.bonusPointsAwarded;
    }

    const profileAfter = db
      .prepare('SELECT sustainability_points, eco_streak_days FROM profiles WHERE id = ?')
      .get(userId);
    const totalPoints = Number(profileAfter?.sustainability_points ?? 0);
    const finalLevel = computeLevelTitle(totalPoints);

    db.prepare('UPDATE profiles SET level_title = ?, updated_at = ? WHERE id = ?').run(
      finalLevel,
      nowIso,
      userId
    );

    return {
      statusCode: 200,
      data: {
        userChallengeId: activeUserChallengeId,
        challengeId,
        periodKey,
        status: nextStatus,
        progress: nextProgress,
        targetCount: Number(challenge.target_count),
        pointsAwarded: challengePointsAwarded + badgeBonusAwarded,
        newlyCompleted: isNowCompleted,
        duplicateBlocked: false,
        unlockedBadges,
        totalPoints,
        ecoStreakDays: Number(profileAfter?.eco_streak_days ?? nextStreak),
      },
    };
  });
}

export function getLeaderboardRows(db, currentUserId, limit = 25) {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(Number(limit) || 25)));

  const rows = db
    .prepare(
      `SELECT
        p.id,
        p.full_name,
        p.sustainability_points,
        p.eco_streak_days,
        p.level_title,
        (
          SELECT COUNT(*)
            FROM user_challenges uc
           WHERE uc.user_id = p.id AND uc.status = 'completed'
        ) AS completed_challenges,
        (
          SELECT COUNT(*)
            FROM achievements a
           WHERE a.user_id = p.id AND a.earned = 1
        ) AS earned_badges
      FROM profiles p
      WHERE p.leaderboard_opt_in = 1
      ORDER BY p.sustainability_points DESC,
               completed_challenges DESC,
               p.eco_streak_days DESC,
               p.created_at ASC
      LIMIT ?`
    )
    .all(safeLimit);

  return rows.map((row, idx) => ({
    rank: idx + 1,
    displayName: formatPrivacyDisplayName(row.full_name),
    levelTitle: row.level_title ?? 'Seedling Explorer',
    sustainabilityPoints: Number(row.sustainability_points ?? 0),
    ecoStreakDays: Number(row.eco_streak_days ?? 0),
    completedChallenges: Number(row.completed_challenges ?? 0),
    earnedBadges: Number(row.earned_badges ?? 0),
    isCurrentUser: row.id === currentUserId,
  }));
}
