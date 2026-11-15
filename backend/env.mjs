import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '..');

function stripSurroundingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parses a simple KEY=VALUE .env file without overwriting process.env keys
 * that were already explicitly passed into the Node process.
 */
export function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) {
    return {};
  }

  const parsed = {};
  const raw = fs.readFileSync(envFilePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = stripSurroundingQuotes(trimmed.slice(eqIndex + 1).trim());
    parsed[key] = val;
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
  return parsed;
}

/**
 * Resolves a persistent local dev JWT signing secret so restarted local servers
 * keep existing mobile/web sessions valid without committing a static secret.
 */
export function resolveJwtSecret(dbPath, explicitSecret) {
  const trimmed = (explicitSecret ?? process.env.ECOTRACK_JWT_SECRET ?? '').trim();
  if (trimmed.length >= 16) {
    return trimmed;
  }

  if (!dbPath || dbPath === ':memory:') {
    return crypto.randomBytes(32).toString('hex');
  }

  const dataDir = path.dirname(dbPath);
  const secretPath = path.join(dataDir, '.jwt-secret');
  fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(secretPath)) {
    const persisted = fs.readFileSync(secretPath, 'utf8').trim();
    if (persisted.length >= 32) {
      return persisted;
    }
  }

  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretPath, `${generated}\n`, { mode: 0o600 });
  return generated;
}

export function getBackendConfig(overrides = {}) {
  loadEnvFile(path.join(REPO_ROOT, 'backend', '.env'));

  const dbPath =
    overrides.dbPath ??
    (process.env.ECOTRACK_DB_PATH
      ? path.resolve(REPO_ROOT, process.env.ECOTRACK_DB_PATH)
      : path.join(REPO_ROOT, 'backend', 'data', 'ecotrack.db'));

  const uploadsDir =
    overrides.uploadsDir ??
    path.join(REPO_ROOT, 'backend', 'uploads', 'avatars');

  return {
    host: overrides.host ?? process.env.HOST ?? '0.0.0.0',
    port: Number(overrides.port ?? process.env.PORT ?? 3001),
    dbPath,
    uploadsDir,
    jwtSecret: resolveJwtSecret(dbPath, overrides.jwtSecret),
    getGeminiApiKey:
      overrides.getGeminiApiKey ??
      (() => (process.env.GEMINI_API_KEY ?? '').trim()),
    geminiModel:
      overrides.geminiModel ??
      (process.env.GEMINI_MODEL?.trim() || 'gemini-4-hydrogen'),
    nodeEnv: overrides.nodeEnv ?? process.env.NODE_ENV ?? 'development',
  };
}
