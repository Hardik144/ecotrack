import crypto from 'node:crypto';
import {
  createAssistantHandler,
  DEFAULT_GEMINI_MODEL,
  RATE_LIMIT_POLICY,
} from './ai/handler.ts';

function checkAndRecordSqliteRateLimit(
  db,
  userId,
  modelUsed,
  windowSeconds = RATE_LIMIT_POLICY.windowSeconds,
  maxWindowRequests = RATE_LIMIT_POLICY.maxWindowRequests,
  maxDailyRequests = RATE_LIMIT_POLICY.maxDailyRequests
) {
  const now = new Date();
  const nowIso = now.toISOString();
  const windowCutoffIso = new Date(now.getTime() - windowSeconds * 1000).toISOString();
  const dayCutoffIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    const windowRows = db
      .prepare(
        `SELECT created_at
           FROM ai_request_logs
          WHERE user_id = ? AND created_at >= ?
          ORDER BY created_at ASC`
      )
      .all(userId, windowCutoffIso);

    const dailyRows = db
      .prepare(
        `SELECT created_at
           FROM ai_request_logs
          WHERE user_id = ? AND created_at >= ?
          ORDER BY created_at ASC`
      )
      .all(userId, dayCutoffIso);

    const windowCount = windowRows.length;
    const dailyCount = dailyRows.length;

    if (windowCount >= maxWindowRequests || dailyCount >= maxDailyRequests) {
      let retryAfterSeconds = 60;
      if (windowCount >= maxWindowRequests && windowRows[0]?.created_at) {
        const oldestMs = new Date(windowRows[0].created_at).getTime();
        retryAfterSeconds = Math.max(
          1,
          Math.ceil((oldestMs + windowSeconds * 1000 - now.getTime()) / 1000)
        );
      } else if (dailyCount >= maxDailyRequests && dailyRows[0]?.created_at) {
        const oldestMs = new Date(dailyRows[0].created_at).getTime();
        retryAfterSeconds = Math.max(
          60,
          Math.ceil((oldestMs + 24 * 60 * 60 * 1000 - now.getTime()) / 1000)
        );
      }

      db.exec('COMMIT');
      return {
        allowed: false,
        retryAfterSeconds,
        remainingWindow: Math.max(0, maxWindowRequests - windowCount),
        remainingDaily: Math.max(0, maxDailyRequests - dailyCount),
        windowLimit: maxWindowRequests,
        dailyLimit: maxDailyRequests,
      };
    }

    db.prepare(
      `INSERT INTO ai_request_logs (id, user_id, model_used, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(crypto.randomUUID(), userId, modelUsed, nowIso);

    db.exec('COMMIT');

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingWindow: Math.max(0, maxWindowRequests - (windowCount + 1)),
      remainingDaily: Math.max(0, maxDailyRequests - (dailyCount + 1)),
      windowLimit: maxWindowRequests,
      dailyLimit: maxDailyRequests,
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

async function callGeminiInteractionsRest(apiKey, params) {
  const payload = {
    model: params.model,
    input: params.input,
    ...(params.system_instruction
      ? { system_instruction: params.system_instruction }
      : {}),
    ...(params.tools ? { tools: params.tools } : {}),
    ...(params.store !== undefined ? { store: params.store } : {}),
    ...(params.generation_config
      ? { generation_config: params.generation_config }
      : {}),
  };

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/interactions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    }
  );

  const rawText = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const errMsg =
      parsed?.error?.message ||
      parsed?.message ||
      `Gemini API error (${response.status})`;
    console.error('[Gemini API Error]:', errMsg, JSON.stringify(parsed));
    throw new Error(errMsg);
  }

  return parsed ?? {};
}

export function createNodeAssistantHandler(options) {
  const { db, verifyAccessToken, getGeminiApiKey, geminiModel, callGeminiImpl } =
    options;

  return createAssistantHandler({
    getGeminiApiKey,
    getModelName: () => geminiModel || DEFAULT_GEMINI_MODEL,

    authenticateUser: async (authHeader) => {
      if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return null;
      }
      const token = authHeader.slice(7).trim();
      const verified = verifyAccessToken(token);
      if (!verified?.userId) return null;
      return { userId: verified.userId };
    },

    checkAndRecordRateLimit: async (_authHeader, userId, modelUsed) => {
      return checkAndRecordSqliteRateLimit(db, userId, modelUsed);
    },

    fetchUserContextData: async (_authHeader, userId) => {
      const rawProfile = db
        .prepare(
          `SELECT full_name, daily_carbon_budget_kg, sustainability_points,
                  sustainability_score, level_title, eco_streak_days,
                  preferred_unit, electricity_region, custom_electricity_factor_kg
             FROM profiles
            WHERE id = ?`
        )
        .get(userId);

      if (!rawProfile) {
        throw new Error('User profile could not be loaded.');
      }

      const rawRecords = db
        .prepare(
          `SELECT id, title, category, direction, quantity, unit_label,
                  emissions_kg, emission_factor_kg, region_code,
                  methodology_source, recorded_at
             FROM carbon_emission_records
            WHERE user_id = ?
            ORDER BY recorded_at DESC
            LIMIT 250`
        )
        .all(userId);

      const rawAchievements = db
        .prepare(
          `SELECT badge_key, title, description, requirement_label, earned
             FROM achievements
            WHERE user_id = ?`
        )
        .all(userId);

      const rawChallenges = db
        .prepare(
          `SELECT uc.progress, uc.status,
                  c.title, c.category, c.co2_savings_kg, c.target_count, c.unit_label
             FROM user_challenges uc
             JOIN challenges c ON c.id = uc.challenge_id
            WHERE uc.user_id = ?`
        )
        .all(userId);

      return {
        profile: {
          full_name: rawProfile.full_name ?? 'Eco Explorer',
          daily_carbon_budget_kg: Number(rawProfile.daily_carbon_budget_kg ?? 12),
          sustainability_points: Number(rawProfile.sustainability_points ?? 0),
          sustainability_score: Number(rawProfile.sustainability_score ?? 50),
          level_title: rawProfile.level_title ?? 'Seedling Explorer',
          eco_streak_days: Number(rawProfile.eco_streak_days ?? 0),
          preferred_unit:
            rawProfile.preferred_unit === 'imperial' ? 'imperial' : 'metric',
          electricity_region: rawProfile.electricity_region ?? 'global',
          custom_electricity_factor_kg:
            rawProfile.custom_electricity_factor_kg !== null &&
            rawProfile.custom_electricity_factor_kg !== undefined
              ? Number(rawProfile.custom_electricity_factor_kg)
              : null,
        },
        records: rawRecords.map((row) => ({
          id: row.id,
          title: row.title,
          category: row.category,
          direction: row.direction,
          quantity: Number(row.quantity),
          unit_label: row.unit_label,
          emissions_kg: Number(row.emissions_kg),
          emission_factor_kg:
            row.emission_factor_kg !== null ? Number(row.emission_factor_kg) : null,
          region_code: row.region_code ?? null,
          methodology_source: row.methodology_source ?? null,
          recorded_at: row.recorded_at,
        })),
        achievements: rawAchievements.map((a) => ({
          badge_key: a.badge_key,
          title: a.title,
          description: a.description,
          requirement_label: a.requirement_label,
          earned: Boolean(a.earned),
        })),
        challenges: rawChallenges.map((uc) => ({
          title: uc.title ?? 'Eco Challenge',
          category: uc.category ?? 'lifestyle',
          co2_savings_kg: Number(uc.co2_savings_kg ?? 1),
          progress: Number(uc.progress ?? 0),
          target_count: Number(uc.target_count ?? 1),
          unit_label: uc.unit_label ?? 'steps',
          status: uc.status === 'completed' ? 'completed' : 'joined',
        })),
      };
    },

    persistChatTurn: async (_authHeader, turn) => {
      const now = Date.now();
      const userTime = new Date(now).toISOString();
      const assistantTime = new Date(now + 1).toISOString();
      const userMsgId = crypto.randomUUID();
      const assistantMsgId = crypto.randomUUID();

      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(
          `INSERT INTO ai_chat_messages (id, user_id, role, content, created_at)
           VALUES (?, ?, 'user', ?, ?)`
        ).run(userMsgId, turn.userId, turn.userPrompt, userTime);

        db.prepare(
          `INSERT INTO ai_chat_messages (
            id, user_id, role, content, action_tag, estimated_savings_kg,
            calculations, suggested_follow_ups, model_used, interaction_id, created_at
          ) VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          assistantMsgId,
          turn.userId,
          turn.assistantReply,
          turn.actionTag ?? null,
          turn.estimatedSavingsKg ?? null,
          JSON.stringify(turn.calculations ?? []),
          JSON.stringify(turn.suggestedFollowUps ?? []),
          turn.modelUsed ?? null,
          turn.interactionId ?? null,
          assistantTime
        );

        db.exec('COMMIT');
        return { assistantMessageId: assistantMsgId };
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    callGemini: callGeminiImpl ?? callGeminiInteractionsRest,
  });
}

export function getChatHistoryRows(db, userId, limit = 80) {
  return db
    .prepare(
      `SELECT id, role, content, action_tag, estimated_savings_kg,
              calculations, suggested_follow_ups, model_used, created_at
         FROM ai_chat_messages
        WHERE user_id = ?
        ORDER BY created_at ASC
        LIMIT ?`
    )
    .all(userId, limit)
    .map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      action_tag: row.action_tag,
      estimated_savings_kg:
        row.estimated_savings_kg !== null ? Number(row.estimated_savings_kg) : null,
      calculations: safeJsonParseArray(row.calculations),
      suggested_follow_ups: safeJsonParseArray(row.suggested_follow_ups),
      model_used: row.model_used,
      created_at: row.created_at,
    }));
}

function safeJsonParseArray(raw) {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
