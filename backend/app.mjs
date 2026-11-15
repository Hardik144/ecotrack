import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  extractBearerToken,
  generateResetCode,
  hashPassword,
  hashResetCode,
  signAuthToken,
  signAvatarResourceUrl,
  signRecoveryToken,
  verifyAuthToken,
  verifyAvatarSignature,
  verifyPassword,
} from './auth.mjs';
import { createDatabase, computeLevelTitle, seedUserAchievements, withTransaction } from './db.mjs';
import { createNodeAssistantHandler, getChatHistoryRows } from './ai.mjs';
import { getLeaderboardRows, performChallengeAction } from './gamification.mjs';

const VALID_CATEGORIES = new Set(['transport', 'electricity', 'food', 'lifestyle']);
const VALID_DIRECTIONS = new Set(['emission', 'offset']);
const VALID_REGIONS = new Set([
  'global',
  'us-avg',
  'us-camx',
  'uk',
  'eu',
  'de',
  'fr',
  'in',
  'cn',
  'ca',
  'au',
  'jp',
  'custom',
]);
const ALLOWED_AVATAR_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
};

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function readRawBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('Request body too large.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJsonBody(req, maxBytes = 1024 * 1024) {
  const raw = await readRawBody(req, maxBytes);
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected JSON object.');
    }
    return parsed;
  } catch {
    throw Object.assign(new Error('Invalid JSON request payload.'), { statusCode: 400 });
  }
}

function isValidEmail(email) {
  return (
    typeof email === 'string' &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

function resolveProfileAvatarUrl(rawAvatarUrl, jwtSecret) {
  if (!rawAvatarUrl) return null;
  if (rawAvatarUrl.startsWith('avatar://')) {
    const rel = rawAvatarUrl.slice('avatar://'.length);
    return signAvatarResourceUrl(rel, jwtSecret, 3600);
  }
  return rawAvatarUrl;
}

function formatProfilePayload(row, jwtSecret) {
  const avatarUrl = resolveProfileAvatarUrl(row.avatar_url, jwtSecret);
  const customFactor =
    row.custom_electricity_factor_kg !== null &&
    row.custom_electricity_factor_kg !== undefined
      ? Number(row.custom_electricity_factor_kg)
      : null;

  return {
    profile: {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      avatarUrl,
      dailyCarbonBudgetKg: Number(row.daily_carbon_budget_kg),
      ecoPoints: Number(row.sustainability_points),
      sustainabilityScore: Number(row.sustainability_score),
      levelTitle: row.level_title,
      ecoStreakDays: Number(row.eco_streak_days),
      joinedDate: row.created_at,
      onboardingCompleted: Boolean(row.onboarding_completed),
    },
    preferences: {
      notificationsEnabled: Boolean(row.notifications_enabled),
      weeklyDigestEnabled: Boolean(row.weekly_digest_enabled),
      leaderboardOptIn: Boolean(row.leaderboard_opt_in),
      preferredUnit: row.preferred_unit === 'imperial' ? 'imperial' : 'metric',
      electricityRegion: VALID_REGIONS.has(row.electricity_region)
        ? row.electricity_region
        : 'global',
      customElectricityFactorKg: customFactor,
    },
  };
}

function mapCarbonRecordRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    activity_id: row.activity_id ?? null,
    title: row.title,
    category: row.category,
    direction: row.direction,
    quantity: Number(row.quantity),
    unit_label: row.unit_label,
    emission_factor_kg: Number(row.emission_factor_kg),
    emissions_kg: Number(row.emissions_kg),
    region_code: row.region_code ?? null,
    methodology_source: row.methodology_source ?? null,
    assumptions: row.assumptions ?? null,
    notes: row.notes ?? null,
    recorded_at: row.recorded_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateEmissionItem(raw) {
  const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
  if (title.length < 2 || title.length > 140) {
    return { error: 'Activity title must be between 2 and 140 characters.' };
  }

  const category = raw?.category;
  if (!VALID_CATEGORIES.has(category)) {
    return { error: 'Category must be transport, electricity, food, or lifestyle.' };
  }

  const direction = raw?.direction ?? 'emission';
  if (!VALID_DIRECTIONS.has(direction)) {
    return { error: 'Direction must be emission or offset.' };
  }

  const quantity = Number(raw?.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
    return { error: 'Quantity must be a positive number up to 1,000,000.' };
  }

  const unitLabel = typeof raw?.unitLabel === 'string' ? raw.unitLabel.trim() : '';
  if (!unitLabel || unitLabel.length > 30) {
    return { error: 'Unit label is required (max 30 chars).' };
  }

  const emissionFactorKg = Number(raw?.emissionFactorKg);
  if (
    !Number.isFinite(emissionFactorKg) ||
    emissionFactorKg < 0 ||
    emissionFactorKg > 1000
  ) {
    return { error: 'Emission factor must be between 0 and 1000 kg CO2e/unit.' };
  }

  const emissionsKg = Number(raw?.emissionsKg);
  if (!Number.isFinite(emissionsKg) || emissionsKg < 0) {
    return { error: 'Emissions total must be zero or positive.' };
  }

  let recordedAt = new Date().toISOString();
  if (raw?.recordedAt) {
    const parsed = new Date(raw.recordedAt);
    if (Number.isNaN(parsed.getTime())) {
      return { error: 'recordedAt must be a valid ISO timestamp.' };
    }
    recordedAt = parsed.toISOString();
  }

  return {
    value: {
      activityId: typeof raw?.activityId === 'string' && raw.activityId ? raw.activityId : null,
      title,
      category,
      direction,
      quantity: Math.round(quantity * 1000) / 1000,
      unitLabel,
      emissionFactorKg: Math.round(emissionFactorKg * 1_000_000) / 1_000_000,
      emissionsKg: Math.round(emissionsKg * 1000) / 1000,
      regionCode:
        typeof raw?.regionCode === 'string' && raw.regionCode.trim()
          ? raw.regionCode.trim().slice(0, 32)
          : null,
      methodologySource:
        typeof raw?.methodologySource === 'string' && raw.methodologySource.trim()
          ? raw.methodologySource.trim().slice(0, 120)
          : null,
      assumptions:
        typeof raw?.assumptions === 'string' && raw.assumptions.trim()
          ? raw.assumptions.trim().slice(0, 400)
          : null,
      notes:
        typeof raw?.notes === 'string' && raw.notes.trim()
          ? raw.notes.trim().slice(0, 500)
          : null,
      recordedAt,
    },
  };
}

function removeStoredAvatarFile(uploadsDir, rawAvatarUrl) {
  if (!rawAvatarUrl || !rawAvatarUrl.startsWith('avatar://')) return;
  const rel = rawAvatarUrl.slice('avatar://'.length);
  const resolvedRoot = path.resolve(uploadsDir);
  const candidate = path.resolve(resolvedRoot, rel);
  if (candidate.startsWith(`${resolvedRoot}${path.sep}`)) {
    fs.rmSync(candidate, { force: true });
  }
}

export function createBackendApp(config) {
  const db = createDatabase(config.dbPath);
  let uploadsRoot = path.resolve(config.uploadsDir);
  try {
    fs.mkdirSync(uploadsRoot, { recursive: true });
  } catch {
    uploadsRoot = path.resolve(process.cwd(), 'backend', 'uploads', 'avatars');
    try {
      fs.mkdirSync(uploadsRoot, { recursive: true });
    } catch {
      uploadsRoot = path.resolve(os.tmpdir(), 'ecotrack', 'uploads', 'avatars');
      fs.mkdirSync(uploadsRoot, { recursive: true });
    }
  }

  const assistantHandler = createNodeAssistantHandler({
    db,
    verifyAccessToken: (token) => verifyAuthToken(token, config.jwtSecret, ['access']),
    getGeminiApiKey: config.getGeminiApiKey,
    geminiModel: config.geminiModel,
    callGeminiImpl: config.callGeminiImpl,
  });

  function requireAuth(req, res, allowedScopes = ['access']) {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      sendJson(res, 401, { code: 'UNAUTHORIZED', error: 'Authentication required.' });
      return null;
    }
    const decoded = verifyAuthToken(token, config.jwtSecret, allowedScopes);
    if (!decoded) {
      sendJson(res, 401, {
        code: 'INVALID_TOKEN',
        error: 'Session expired or invalid. Please sign in again.',
      });
      return null;
    }

    const userRow = db
      .prepare('SELECT id, email, full_name FROM users WHERE id = ?')
      .get(decoded.userId);
    if (!userRow) {
      sendJson(res, 401, {
        code: 'USER_NOT_FOUND',
        error: 'Account could not be verified. Please sign in again.',
      });
      return null;
    }

    return {
      userId: userRow.id,
      email: userRow.email,
      fullName: userRow.full_name,
      scope: decoded.scope,
    };
  }

  function ensureProfileRow(userId) {
    let row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(userId);
    if (row) return row;

    const userRow = db
      .prepare('SELECT id, email, full_name, created_at FROM users WHERE id = ?')
      .get(userId);
    if (!userRow) return null;

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO profiles (id, email, full_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(userRow.id, userRow.email, userRow.full_name, userRow.created_at || now, now);
    seedUserAchievements(db, userId);

    row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(userId);
    return row;
  }

  async function handleRequest(req, res) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    const reqUrl = new URL(req.url || '/', 'http://localhost');
    const pathname = reqUrl.pathname;

    try {
      // 1. Health Check
      if (req.method === 'GET' && pathname === '/api/health') {
        const key = config.getGeminiApiKey();
        sendJson(res, 200, {
          ok: true,
          service: 'ecotrack-node-backend',
          version: '1.0.0',
          geminiConfigured: Boolean(key && key.trim() && !key.includes('your-gemini')),
        });
        return;
      }

      // 2. Auth Routes
      if (req.method === 'POST' && pathname === '/api/auth/register') {
        const body = await readJsonBody(req);
        const rawFullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
        const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';

        if (rawFullName.length < 2 || rawFullName.length > 120) {
          sendJson(res, 400, {
            code: 'INVALID_NAME',
            error: 'Full name must be between 2 and 120 characters.',
          });
          return;
        }
        if (!isValidEmail(rawEmail)) {
          sendJson(res, 400, {
            code: 'INVALID_EMAIL',
            error: 'Please enter a valid email address.',
          });
          return;
        }
        if (password.length < 6 || password.length > 128) {
          sendJson(res, 400, {
            code: 'INVALID_PASSWORD',
            error: 'Password must be between 6 and 128 characters.',
          });
          return;
        }

        const existing = db
          .prepare('SELECT id FROM users WHERE email = ?')
          .get(rawEmail);
        if (existing) {
          sendJson(res, 409, {
            code: 'EMAIL_EXISTS',
            error: 'An account with this email already exists. Try signing in instead.',
          });
          return;
        }

        const userId = crypto.randomUUID();
        const now = new Date().toISOString();
        const passwordHash = hashPassword(password);

        withTransaction(db, () => {
          db.prepare(
            `INSERT INTO users (id, email, password_hash, full_name, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).run(userId, rawEmail, passwordHash, rawFullName, now, now);

          db.prepare(
            `INSERT INTO profiles (id, email, full_name, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`
          ).run(userId, rawEmail, rawFullName, now, now);

          seedUserAchievements(db, userId);
        });

        const { token, expiresAt } = signAuthToken(
          { userId, email: rawEmail },
          config.jwtSecret
        );
        const profileRow = db.prepare('SELECT * FROM profiles WHERE id = ?').get(userId);
        const formatted = formatProfilePayload(profileRow, config.jwtSecret);

        sendJson(res, 201, {
          ok: true,
          session: {
            accessToken: token,
            expiresAt,
            user: {
              id: userId,
              email: rawEmail,
              fullName: rawFullName,
            },
          },
          ...formatted,
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJsonBody(req);
        const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';

        if (!isValidEmail(rawEmail) || !password) {
          sendJson(res, 400, {
            code: 'INVALID_CREDENTIALS',
            error: 'Email and password are required.',
          });
          return;
        }

        const userRow = db
          .prepare('SELECT id, email, password_hash, full_name FROM users WHERE email = ?')
          .get(rawEmail);

        if (!userRow || !verifyPassword(password, userRow.password_hash)) {
          sendJson(res, 401, {
            code: 'INVALID_CREDENTIALS',
            error: 'Invalid email or password. Double-check your credentials and try again.',
          });
          return;
        }

        const profileRow = ensureProfileRow(userRow.id);
        const { token, expiresAt } = signAuthToken(
          { userId: userRow.id, email: userRow.email },
          config.jwtSecret
        );
        const formatted = formatProfilePayload(profileRow, config.jwtSecret);

        sendJson(res, 200, {
          ok: true,
          session: {
            accessToken: token,
            expiresAt,
            user: {
              id: userRow.id,
              email: userRow.email,
              fullName: profileRow.full_name,
            },
          },
          ...formatted,
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/auth/me') {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;
        sendJson(res, 200, {
          user: {
            id: auth.userId,
            email: auth.email,
            fullName: auth.fullName,
          },
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/auth/logout') {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/auth/forgot-password') {
        const body = await readJsonBody(req);
        const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (!isValidEmail(rawEmail)) {
          sendJson(res, 400, {
            code: 'INVALID_EMAIL',
            error: 'Please enter a valid email address.',
          });
          return;
        }

        const userRow = db
          .prepare('SELECT id, email FROM users WHERE email = ?')
          .get(rawEmail);

        let recoveryCode = null;
        let expiresAt = null;

        if (userRow) {
          const now = new Date();
          expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
          recoveryCode = generateResetCode();
          const codeHash = hashResetCode(recoveryCode);

          withTransaction(db, () => {
            db.prepare(
              `UPDATE password_resets
                  SET used_at = ?
                WHERE user_id = ? AND used_at IS NULL`
            ).run(now.toISOString(), userRow.id);

            db.prepare(
              `INSERT INTO password_resets (id, user_id, code_hash, expires_at, created_at)
               VALUES (?, ?, ?, ?, ?)`
            ).run(crypto.randomUUID(), userRow.id, codeHash, expiresAt, now.toISOString());
          });
        }

        const responsePayload = {
          ok: true,
          message:
            config.nodeEnv !== 'production' && recoveryCode
              ? 'Local recovery code generated cleanly (no SMTP server needed in local Node mode).'
              : 'If an account matches that email address, password reset instructions have been issued.',
        };

        if (config.nodeEnv !== 'production' && recoveryCode) {
          responsePayload.recoveryCode = recoveryCode;
          responsePayload.expiresAt = expiresAt;
        }

        sendJson(res, 200, responsePayload);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/auth/verify-recovery') {
        const body = await readJsonBody(req);
        const code = typeof body.code === 'string' ? body.code.trim() : '';
        if (!code || code.length < 4) {
          sendJson(res, 400, {
            code: 'INVALID_RECOVERY_CODE',
            error: 'Recovery code is missing or invalid.',
          });
          return;
        }

        const codeHash = hashResetCode(code);
        const nowIso = new Date().toISOString();

        const resetRow = db
          .prepare(
            `SELECT pr.id, pr.user_id, pr.expires_at, u.email, u.full_name
               FROM password_resets pr
               JOIN users u ON u.id = pr.user_id
              WHERE pr.code_hash = ? AND pr.used_at IS NULL AND pr.expires_at > ?
              ORDER BY pr.created_at DESC
              LIMIT 1`
          )
          .get(codeHash, nowIso);

        if (!resetRow) {
          sendJson(res, 400, {
            code: 'EXPIRED_RECOVERY_CODE',
            error: 'This password reset code is invalid or expired. Request a new reset code.',
          });
          return;
        }

        const recoveryToken = signRecoveryToken(
          { userId: resetRow.user_id, email: resetRow.email },
          config.jwtSecret
        );

        sendJson(res, 200, {
          ok: true,
          session: {
            accessToken: recoveryToken.token,
            expiresAt: recoveryToken.expiresAt,
            user: {
              id: resetRow.user_id,
              email: resetRow.email,
              fullName: resetRow.full_name,
            },
          },
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/auth/update-password') {
        const auth = requireAuth(req, res, ['access', 'password_recovery']);
        if (!auth) return;

        const body = await readJsonBody(req);
        const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
        if (newPassword.length < 6 || newPassword.length > 128) {
          sendJson(res, 400, {
            code: 'INVALID_PASSWORD',
            error: 'New password must be between 6 and 128 characters.',
          });
          return;
        }

        const nowIso = new Date().toISOString();
        const passwordHash = hashPassword(newPassword);

        withTransaction(db, () => {
          db.prepare(
            'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
          ).run(passwordHash, nowIso, auth.userId);

          db.prepare(
            'UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL'
          ).run(nowIso, auth.userId);
        });

        const fresh = signAuthToken(
          { userId: auth.userId, email: auth.email },
          config.jwtSecret
        );

        sendJson(res, 200, {
          ok: true,
          message: 'Your password has been updated cleanly.',
          session: {
            accessToken: fresh.token,
            expiresAt: fresh.expiresAt,
            user: {
              id: auth.userId,
              email: auth.email,
              fullName: auth.fullName,
            },
          },
        });
        return;
      }

      // 3. Profile & Avatar Routes
      if (req.method === 'GET' && pathname === '/api/profile') {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;
        const row = ensureProfileRow(auth.userId);
        sendJson(res, 200, formatProfilePayload(row, config.jwtSecret));
        return;
      }

      if (req.method === 'PATCH' && pathname === '/api/profile') {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;

        const body = await readJsonBody(req);
        const current = ensureProfileRow(auth.userId);
        const updates = [];
        const params = [];

        if (body.fullName !== undefined) {
          const trimmedName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
          if (trimmedName.length < 2 || trimmedName.length > 120) {
            sendJson(res, 400, {
              code: 'INVALID_NAME',
              error: 'Full name must be between 2 and 120 characters.',
            });
            return;
          }
          updates.push('full_name = ?');
          params.push(trimmedName);
        }

        if (body.avatarUrl === null) {
          removeStoredAvatarFile(uploadsRoot, current.avatar_url);
          updates.push('avatar_url = ?');
          params.push(null);
        }

        if (body.dailyCarbonBudgetKg !== undefined) {
          const budget = Number(body.dailyCarbonBudgetKg);
          if (!Number.isFinite(budget) || budget <= 0 || budget > 500) {
            sendJson(res, 400, {
              code: 'INVALID_BUDGET',
              error: 'Daily budget must be between 0.1 and 500 kg CO2e.',
            });
            return;
          }
          updates.push('daily_carbon_budget_kg = ?');
          params.push(Math.round(budget * 100) / 100);
        }

        if (body.notificationsEnabled !== undefined) {
          updates.push('notifications_enabled = ?');
          params.push(body.notificationsEnabled ? 1 : 0);
        }
        if (body.weeklyDigestEnabled !== undefined) {
          updates.push('weekly_digest_enabled = ?');
          params.push(body.weeklyDigestEnabled ? 1 : 0);
        }
        if (body.leaderboardOptIn !== undefined) {
          updates.push('leaderboard_opt_in = ?');
          params.push(body.leaderboardOptIn ? 1 : 0);
        }
        if (body.onboardingCompleted !== undefined) {
          updates.push('onboarding_completed = ?');
          params.push(body.onboardingCompleted ? 1 : 0);
        }

        if (body.preferredUnit !== undefined) {
          if (body.preferredUnit !== 'metric' && body.preferredUnit !== 'imperial') {
            sendJson(res, 400, {
              code: 'INVALID_UNIT',
              error: 'preferredUnit must be metric or imperial.',
            });
            return;
          }
          updates.push('preferred_unit = ?');
          params.push(body.preferredUnit);
        }

        if (body.electricityRegion !== undefined) {
          if (!VALID_REGIONS.has(body.electricityRegion)) {
            sendJson(res, 400, {
              code: 'INVALID_REGION',
              error: 'Unsupported electricity region code.',
            });
            return;
          }
          updates.push('electricity_region = ?');
          params.push(body.electricityRegion);
        }

        if (body.customElectricityFactorKg !== undefined) {
          if (body.customElectricityFactorKg === null) {
            updates.push('custom_electricity_factor_kg = ?');
            params.push(null);
          } else {
            const factor = Number(body.customElectricityFactorKg);
            if (!Number.isFinite(factor) || factor < 0 || factor > 2.5) {
              sendJson(res, 400, {
                code: 'INVALID_FACTOR',
                error: 'Custom electricity factor must be between 0 and 2.5 kg/kWh.',
              });
              return;
            }
            updates.push('custom_electricity_factor_kg = ?');
            params.push(Math.round(factor * 10_000) / 10_000);
          }
        }

        const nowIso = new Date().toISOString();
        const computedLevel = computeLevelTitle(Number(current.sustainability_points ?? 0));
        updates.push('level_title = ?');
        params.push(computedLevel);
        updates.push('updated_at = ?');
        params.push(nowIso);

        if (updates.length > 0) {
          db.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`).run(
            ...params,
            auth.userId
          );
          if (body.fullName !== undefined) {
            db.prepare('UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?').run(
              body.fullName.trim(),
              nowIso,
              auth.userId
            );
          }
        }

        const updatedRow = db.prepare('SELECT * FROM profiles WHERE id = ?').get(auth.userId);
        sendJson(res, 200, formatProfilePayload(updatedRow, config.jwtSecret));
        return;
      }

      if (req.method === 'POST' && pathname === '/api/profile/avatar') {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;

        const body = await readJsonBody(req, 4 * 1024 * 1024);
        const mimeType =
          typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : 'image/jpeg';
        const ext = ALLOWED_AVATAR_MIME[mimeType];
        if (!ext) {
          sendJson(res, 400, {
            code: 'INVALID_IMAGE_TYPE',
            error: 'Avatar image must be JPG, PNG, or WEBP.',
          });
          return;
        }

        const rawBase64 = typeof body.base64 === 'string' ? body.base64.trim() : '';
        if (!rawBase64) {
          sendJson(res, 400, {
            code: 'EMPTY_IMAGE',
            error: 'Selected image file was empty.',
          });
          return;
        }

        const stripped = rawBase64.includes(',') ? rawBase64.split(',').pop() : rawBase64;
        const buffer = Buffer.from(stripped, 'base64');
        if (buffer.byteLength === 0) {
          sendJson(res, 400, {
            code: 'EMPTY_IMAGE',
            error: 'Selected image file could not be decoded.',
          });
          return;
        }
        if (buffer.byteLength > 2 * 1024 * 1024) {
          sendJson(res, 400, {
            code: 'IMAGE_TOO_LARGE',
            error: 'Profile image must be 2 MB or smaller.',
          });
          return;
        }

        const current = ensureProfileRow(auth.userId);
        removeStoredAvatarFile(uploadsRoot, current.avatar_url);

        const userDir = path.join(uploadsRoot, auth.userId);
        fs.mkdirSync(userDir, { recursive: true });
        const filename = `avatar-${Date.now()}.${ext}`;
        const destPath = path.join(userDir, filename);
        fs.writeFileSync(destPath, buffer);

        const internalMarker = `avatar://${auth.userId}/${filename}`;
        const nowIso = new Date().toISOString();
        db.prepare('UPDATE profiles SET avatar_url = ?, updated_at = ? WHERE id = ?').run(
          internalMarker,
          nowIso,
          auth.userId
        );

        const updatedRow = db.prepare('SELECT * FROM profiles WHERE id = ?').get(auth.userId);
        sendJson(res, 200, formatProfilePayload(updatedRow, config.jwtSecret));
        return;
      }

      if (req.method === 'GET' && pathname.startsWith('/api/avatars/')) {
        const rel = pathname.slice('/api/avatars/'.length);
        const exp = reqUrl.searchParams.get('exp');
        const sig = reqUrl.searchParams.get('sig');

        if (!rel || rel.includes('..') || !verifyAvatarSignature(rel, exp, sig, config.jwtSecret)) {
          sendJson(res, 403, { code: 'FORBIDDEN', error: 'Invalid or expired avatar URL.' });
          return;
        }

        const candidate = path.resolve(uploadsRoot, rel);
        if (!candidate.startsWith(`${uploadsRoot}${path.sep}`) || !fs.existsSync(candidate)) {
          sendJson(res, 404, { code: 'NOT_FOUND', error: 'Avatar not found.' });
          return;
        }

        const ext = path.extname(candidate).toLowerCase();
        const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';
        const data = fs.readFileSync(candidate);
        res.writeHead(200, {
          ...CORS_HEADERS,
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=300',
        });
        res.end(data);
        return;
      }

      // 4. Activities Catalog & Carbon Emission Records
      if (req.method === 'GET' && pathname === '/api/activities/catalog') {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;

        const rows = db
          .prepare(
            `SELECT id, slug, title, category, direction, emission_factor_kg,
                    unit_label, default_quantity, helper_text, is_system
               FROM carbon_activities
              WHERE is_system = 1 OR user_id = ?
              ORDER BY title ASC`
          )
          .all(auth.userId);

        sendJson(res, 200, {
          items: rows.map((row) => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            category: row.category,
            direction: row.direction,
            emissionFactorKg: Number(row.emission_factor_kg),
            unitLabel: row.unit_label,
            defaultQuantity: Number(row.default_quantity),
            helper: row.helper_text ?? undefined,
            isSystem: Boolean(row.is_system),
          })),
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/emissions') {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;

        const rows = db
          .prepare(
            `SELECT *
               FROM carbon_emission_records
              WHERE user_id = ?
              ORDER BY recorded_at DESC
              LIMIT 500`
          )
          .all(auth.userId);

        sendJson(res, 200, { items: rows.map(mapCarbonRecordRow) });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/emissions') {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;

        const body = await readJsonBody(req);
        const rawItems = Array.isArray(body.items) ? body.items : [body];
        if (rawItems.length === 0 || rawItems.length > 50) {
          sendJson(res, 400, {
            code: 'INVALID_BATCH',
            error: 'Provide between 1 and 50 emission items per request.',
          });
          return;
        }

        const validated = [];
        for (const item of rawItems) {
          const check = validateEmissionItem(item);
          if (check.error) {
            sendJson(res, 400, { code: 'INVALID_EMISSION_INPUT', error: check.error });
            return;
          }
          if (check.value.activityId) {
            const act = db
              .prepare(
                `SELECT id FROM carbon_activities
                  WHERE id = ? AND (is_system = 1 OR user_id = ?)`
              )
              .get(check.value.activityId, auth.userId);
            if (!act) {
              check.value.activityId = null;
            }
          }
          validated.push(check.value);
        }

        const insertedIds = [];
        const nowIso = new Date().toISOString();

        withTransaction(db, () => {
          const insertStmt = db.prepare(`
            INSERT INTO carbon_emission_records (
              id, user_id, activity_id, title, category, direction,
              quantity, unit_label, emission_factor_kg, emissions_kg,
              region_code, methodology_source, assumptions, notes,
              recorded_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const item of validated) {
            const id = crypto.randomUUID();
            insertStmt.run(
              id,
              auth.userId,
              item.activityId,
              item.title,
              item.category,
              item.direction,
              item.quantity,
              item.unitLabel,
              item.emissionFactorKg,
              item.emissionsKg,
              item.regionCode,
              item.methodologySource,
              item.assumptions,
              item.notes,
              item.recordedAt,
              nowIso,
              nowIso
            );
            insertedIds.push(id);
          }
        });

        const placeholders = insertedIds.map(() => '?').join(', ');
        const rows = db
          .prepare(
            `SELECT * FROM carbon_emission_records
              WHERE user_id = ? AND id IN (${placeholders})
              ORDER BY recorded_at DESC`
          )
          .all(auth.userId, ...insertedIds);

        sendJson(res, 201, { items: rows.map(mapCarbonRecordRow) });
        return;
      }

      if (pathname.startsWith('/api/emissions/') && (req.method === 'PATCH' || req.method === 'DELETE')) {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;

        const recordId = pathname.slice('/api/emissions/'.length).trim();
        if (!recordId || recordId.includes('/')) {
          sendJson(res, 404, { code: 'NOT_FOUND', error: 'Emission record not found.' });
          return;
        }

        const existing = db
          .prepare('SELECT id FROM carbon_emission_records WHERE id = ? AND user_id = ?')
          .get(recordId, auth.userId);
        if (!existing) {
          sendJson(res, 404, { code: 'NOT_FOUND', error: 'Emission record not found.' });
          return;
        }

        if (req.method === 'DELETE') {
          db.prepare('DELETE FROM carbon_emission_records WHERE id = ? AND user_id = ?').run(
            recordId,
            auth.userId
          );
          sendJson(res, 200, { ok: true });
          return;
        }

        const body = await readJsonBody(req);
        const check = validateEmissionItem(body);
        if (check.error) {
          sendJson(res, 400, { code: 'INVALID_EMISSION_INPUT', error: check.error });
          return;
        }

        const v = check.value;
        if (v.activityId) {
          const act = db
            .prepare(
              `SELECT id FROM carbon_activities
                WHERE id = ? AND (is_system = 1 OR user_id = ?)`
            )
            .get(v.activityId, auth.userId);
          if (!act) v.activityId = null;
        }

        const nowIso = new Date().toISOString();
        db.prepare(
          `UPDATE carbon_emission_records
              SET activity_id = ?,
                  title = ?,
                  category = ?,
                  direction = ?,
                  quantity = ?,
                  unit_label = ?,
                  emission_factor_kg = ?,
                  emissions_kg = ?,
                  region_code = ?,
                  methodology_source = ?,
                  assumptions = ?,
                  notes = ?,
                  recorded_at = ?,
                  updated_at = ?
            WHERE id = ? AND user_id = ?`
        ).run(
          v.activityId,
          v.title,
          v.category,
          v.direction,
          v.quantity,
          v.unitLabel,
          v.emissionFactorKg,
          v.emissionsKg,
          v.regionCode,
          v.methodologySource,
          v.assumptions,
          v.notes,
          v.recordedAt,
          nowIso,
          recordId,
          auth.userId
        );

        const updated = db
          .prepare('SELECT * FROM carbon_emission_records WHERE id = ? AND user_id = ?')
          .get(recordId, auth.userId);
        sendJson(res, 200, { item: mapCarbonRecordRow(updated) });
        return;
      }

      // 5. Gamification Routes
      if (req.method === 'GET' && pathname === '/api/challenges') {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;

        const catalog = db
          .prepare(
            `SELECT * FROM challenges
              WHERE is_active = 1
              ORDER BY sort_order ASC, co2_savings_kg DESC`
          )
          .all();

        const userRows = db
          .prepare(
            `SELECT id, challenge_id, period_key, progress, status,
                    last_action_note, last_action_at, completed_at
               FROM user_challenges
              WHERE user_id = ?`
          )
          .all(auth.userId);

        const totalCompletedRow = db
          .prepare(
            `SELECT COUNT(*) AS cnt FROM user_challenges
              WHERE user_id = ? AND status = 'completed'`
          )
          .get(auth.userId);

        sendJson(res, 200, {
          catalog: catalog.map((c) => ({
            id: c.id,
            slug: c.slug,
            title: c.title,
            description: c.description,
            category: c.category,
            frequency: c.frequency,
            difficulty: c.difficulty,
            co2_savings_kg: Number(c.co2_savings_kg),
            reward_points: Number(c.reward_points),
            target_count: Number(c.target_count),
            unit_label: c.unit_label,
            action_steps_hint: c.action_steps_hint,
            verification_note: c.verification_note,
            sort_order: Number(c.sort_order),
          })),
          userChallenges: userRows.map((u) => ({
            id: u.id,
            challenge_id: u.challenge_id,
            period_key: u.period_key,
            progress: Number(u.progress),
            status: u.status,
            last_action_note: u.last_action_note,
            last_action_at: u.last_action_at,
            completed_at: u.completed_at,
          })),
          totalCompletedChallenges: Number(totalCompletedRow?.cnt ?? 0),
        });
        return;
      }

      if (
        req.method === 'POST' &&
        pathname.startsWith('/api/challenges/') &&
        pathname.endsWith('/action')
      ) {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;

        const middle = pathname.slice('/api/challenges/'.length, -'/action'.length);
        if (!middle || middle.includes('/')) {
          sendJson(res, 404, { code: 'NOT_FOUND', error: 'Challenge not found.' });
          return;
        }

        const body = await readJsonBody(req);
        const result = performChallengeAction(db, {
          userId: auth.userId,
          challengeId: middle,
          mode: body.mode,
          actionNote: body.actionNote,
          periodKey: body.periodKey,
        });

        if (result.error) {
          sendJson(res, result.statusCode, { code: 'CHALLENGE_ACTION_ERROR', error: result.error });
          return;
        }

        sendJson(res, result.statusCode, result.data);
        return;
      }

      if (req.method === 'GET' && pathname === '/api/achievements') {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;

        seedUserAchievements(db, auth.userId);
        const rows = db
          .prepare(
            `SELECT badge_key, title, description, icon, requirement_label,
                    earned, points_bonus, earned_at
               FROM achievements
              WHERE user_id = ?
              ORDER BY earned DESC, points_bonus ASC`
          )
          .all(auth.userId);

        sendJson(res, 200, {
          badges: rows.map((row) => ({
            id: row.badge_key,
            badgeKey: row.badge_key,
            title: row.title,
            description: row.description,
            icon: row.icon,
            requirementLabel: row.requirement_label,
            earned: Boolean(row.earned),
            pointsBonus: Number(row.points_bonus ?? 0),
            earnedAt: row.earned_at ?? undefined,
          })),
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/rewards') {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;

        const limit = Math.max(
          1,
          Math.min(100, Number(reqUrl.searchParams.get('limit') ?? 40) || 40)
        );
        const rows = db
          .prepare(
            `SELECT id, reward_key, source_type, challenge_id, title, description,
                    points_delta, verification_type, period_key, created_at
               FROM reward_history
              WHERE user_id = ?
              ORDER BY created_at DESC
              LIMIT ?`
          )
          .all(auth.userId, limit);

        sendJson(res, 200, {
          entries: rows.map((row) => ({
            id: row.id,
            rewardKey: row.reward_key,
            sourceType: row.source_type,
            challengeId: row.challenge_id ?? null,
            title: row.title,
            description: row.description,
            pointsDelta: Number(row.points_delta),
            verificationType:
              row.source_type === 'badge_unlock'
                ? 'milestone_rule'
                : 'self_attested_action',
            periodKey: row.period_key ?? null,
            createdAt: row.created_at,
          })),
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/leaderboard') {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;

        const limit = Number(reqUrl.searchParams.get('limit') ?? 25) || 25;
        const entries = getLeaderboardRows(db, auth.userId, limit);
        sendJson(res, 200, { entries });
        return;
      }

      // 6. Gemini AI Sustainability Assistant Routes
      if (req.method === 'GET' && pathname === '/api/assistant/history') {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;
        const messages = getChatHistoryRows(db, auth.userId);
        sendJson(res, 200, { messages });
        return;
      }

      if (req.method === 'DELETE' && pathname === '/api/assistant/history') {
        const auth = requireAuth(req, res, ['access']);
        if (!auth) return;
        db.prepare('DELETE FROM ai_chat_messages WHERE user_id = ?').run(auth.userId);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/assistant/chat') {
        const rawBody = await readRawBody(req, 512 * 1024);
        const webReq = new Request(`http://localhost${req.url}`, {
          method: req.method,
          headers: req.headers,
          body: rawBody,
        });
        const webRes = await assistantHandler(webReq);
        const resText = await webRes.text();
        const headerObj = { ...CORS_HEADERS };
        webRes.headers.forEach((value, key) => {
          headerObj[key] = value;
        });
        res.writeHead(webRes.status, headerObj);
        res.end(resText);
        return;
      }

      sendJson(res, 404, { code: 'NOT_FOUND', error: `Route not found: ${pathname}` });
    } catch (err) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      const message =
        status < 500 && err instanceof Error
          ? err.message
          : 'Internal EcoTrack backend error.';
      sendJson(res, status, { code: 'SERVER_ERROR', error: message });
    }
  }

  return {
    db,
    handleRequest,
    startServer(port = config.port, host = config.host) {
      return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
          void handleRequest(req, res);
        });
        server.on('error', reject);
        server.listen(port, host, () => {
          const addr = server.address();
          const boundPort = typeof addr === 'object' && addr ? addr.port : port;
          resolve({
            server,
            port: boundPort,
            baseUrl: `http://127.0.0.1:${boundPort}`,
            close: () =>
              new Promise((resClose) => {
                server.close(() => {
                  try {
                    db.close();
                  } catch {
                    // ignore already closed
                  }
                  resClose();
                });
              }),
          });
        });
      });
    },
    close() {
      try {
        db.close();
      } catch {
        // ignore
      }
    },
  };
}
