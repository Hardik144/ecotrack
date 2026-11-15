import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';

const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const RECOVERY_TOKEN_TTL_SECONDS = 60 * 15; // 15 minutes

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

/**
 * Hashes a user password with per-user random salt and Node scrypt.
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

/**
 * Verifies a password attempt against a stored scrypt hash in constant time.
 */
export function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  try {
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function signAuthToken(
  payload,
  secret,
  ttlSeconds = DEFAULT_TOKEN_TTL_SECONDS
) {
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload = {
    sub: payload.userId,
    email: payload.email,
    scope: payload.scope ?? 'access',
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };

  const headerPart = base64UrlEncode(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  );
  const bodyPart = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerPart}.${bodyPart}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest();

  return {
    token: `${signingInput}.${base64UrlEncode(sig)}`,
    expiresAt: new Date(fullPayload.exp * 1000).toISOString(),
  };
}

export function signRecoveryToken(payload, secret) {
  return signAuthToken(
    { ...payload, scope: 'password_recovery' },
    secret,
    RECOVERY_TOKEN_TTL_SECONDS
  );
}

export function verifyAuthToken(token, secret, allowedScopes = ['access']) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerPart, bodyPart, sigPart] = parts;
  if (!headerPart || !bodyPart || !sigPart) return null;

  const signingInput = `${headerPart}.${bodyPart}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest();

  let actualSig;
  try {
    actualSig = base64UrlDecode(sigPart);
  } catch {
    return null;
  }

  if (
    actualSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(actualSig, expectedSig)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(bodyPart).toString('utf8'));
    if (
      !decoded ||
      typeof decoded.sub !== 'string' ||
      typeof decoded.exp !== 'number'
    ) {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (decoded.exp <= nowSec) {
      return null;
    }

    const scope = typeof decoded.scope === 'string' ? decoded.scope : 'access';
    if (!allowedScopes.includes(scope)) {
      return null;
    }

    return {
      userId: decoded.sub,
      email: typeof decoded.email === 'string' ? decoded.email : '',
      scope,
      expiresAt: new Date(decoded.exp * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

export function extractBearerToken(authHeader) {
  if (typeof authHeader !== 'string') return null;
  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token || null;
}

export function hashResetCode(code) {
  return crypto
    .createHash('sha256')
    .update(code.trim().toUpperCase())
    .digest('hex');
}

export function generateResetCode() {
  // Unambiguous uppercase alphanumeric 8-char recovery code
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function signAvatarResourceUrl(relativeAssetPath, secret, ttlSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const message = `${relativeAssetPath}:${exp}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  return `/api/avatars/${relativeAssetPath}?exp=${exp}&sig=${sig}`;
}

export function verifyAvatarSignature(relativeAssetPath, expRaw, sigRaw, secret) {
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    return false;
  }
  if (typeof sigRaw !== 'string' || !/^[0-9a-f]{64}$/i.test(sigRaw)) {
    return false;
  }

  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(`${relativeAssetPath}:${exp}`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(sigRaw.toLowerCase(), 'utf8'),
    Buffer.from(expectedHex, 'utf8')
  );
}
