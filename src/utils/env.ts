import { createURL } from 'expo-linking';

/**
 * Runtime environment configuration reader and security validator.
 *
 * Security Invariants:
 * - Client code ONLY talks to the EcoTrack Node.js backend over HTTP/HTTPS.
 * - NEVER place GEMINI_API_KEY or ECOTRACK_JWT_SECRET in EXPO_PUBLIC_* variables.
 */

export interface EcoTrackEnv {
  apiUrl: string;
  aiAssistantUrl: string;
  appEnv: string;
}

const PLACEHOLDER_MARKERS = [
  'your-project-ref',
  'your-api-url',
  'your-gemini-api-key',
  'example.invalid',
];

const PRIVATE_IP_OR_LOCALHOST =
  /^(localhost|127\.0\.0\.1|10\.0\.2\.2|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/i;

export function isPlaceholderValue(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return true;
  return PLACEHOLDER_MARKERS.some((marker) => trimmed.includes(marker));
}

/**
 * Detects leaked server/API credentials that must NEVER ship in EXPO_PUBLIC_*.
 */
export function isServiceRoleOrSecretKey(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('sb_secret_') || /^aiza[0-9a-za-z_-]{15,}$/.test(lower)) {
    return true;
  }

  if (trimmed.split('.').length === 3) {
    try {
      const payloadSegment = trimmed.split('.')[1];
      const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
      const padLen = (4 - (base64.length % 4)) % 4;
      const padded = base64 + '='.repeat(padLen);
      const nodeBuffer = (
        globalThis as unknown as {
          Buffer?: {
            from: (
              input: string,
              encoding: string
            ) => { toString: (enc: string) => string };
          };
        }
      ).Buffer;
      const decoded =
        typeof atob === 'function'
          ? atob(padded)
          : nodeBuffer
            ? nodeBuffer.from(padded, 'base64').toString('utf8')
            : '';
      const parsed = JSON.parse(decoded) as { role?: string };
      if (parsed?.role === 'service_role') {
        return true;
      }
    } catch {
      // Non-JWT values are allowed if non-secret
    }
  }

  return false;
}

/**
 * Guards against accidentally placing a Gemini API key in client-exposed EXPO_PUBLIC_* env vars.
 */
export function hasExposedGeminiApiKeyInEnv(): boolean {
  const clientGeminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
  return Boolean(clientGeminiKey && !isPlaceholderValue(clientGeminiKey));
}

export function isValidBackendUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'https:') {
      return Boolean(parsed.hostname);
    }
    if (parsed.protocol === 'http:') {
      return (
        PRIVATE_IP_OR_LOCALHOST.test(parsed.hostname) ||
        parsed.hostname.endsWith('.local')
      );
    }
    return false;
  } catch {
    return false;
  }
}

export function getEnv(): EcoTrackEnv {
  return {
    apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || '',
    aiAssistantUrl:
      process.env.EXPO_PUBLIC_AI_ASSISTANT_URL?.trim().replace(/\/+$/, '') || '',
    appEnv: process.env.EXPO_PUBLIC_APP_ENV?.trim() || 'development',
  };
}

/**
 * Validates client configuration for connecting to the Node.js backend.
 * Empty `EXPO_PUBLIC_API_URL` is valid because smart local defaults apply cleanly.
 */
export function getBackendConfigError(): string | null {
  if (hasExposedGeminiApiKeyInEnv()) {
    return 'Security violation: GEMINI_API_KEY must NEVER be set in EXPO_PUBLIC_* variables. Move it to backend/.env on your Node.js server.';
  }

  const rawApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || '';
  if (!rawApiUrl) {
    return null;
  }

  if (isPlaceholderValue(rawApiUrl) || !isValidBackendUrl(rawApiUrl)) {
    return 'EXPO_PUBLIC_API_URL must be an HTTPS URL or local development HTTP URL (e.g. http://localhost:3001).';
  }

  return null;
}

export function isBackendConfigured(): boolean {
  return getBackendConfigError() === null;
}

/**
 * Checks whether AI coaching via the Node.js backend can safely operate without exposed client secrets.
 */
export function getAiBackendConfigError(): string | null {
  if (hasExposedGeminiApiKeyInEnv()) {
    return 'Security violation: Gemini API keys must NEVER be placed in EXPO_PUBLIC_* frontend variables. Remove EXPO_PUBLIC_GEMINI_API_KEY from .env and configure GEMINI_API_KEY in backend/.env instead.';
  }

  const { aiAssistantUrl } = getEnv();
  if (aiAssistantUrl && !isValidBackendUrl(aiAssistantUrl)) {
    return 'EXPO_PUBLIC_AI_ASSISTANT_URL must be a valid HTTP(S) endpoint URL.';
  }

  return getBackendConfigError();
}

export function isGeminiConfigured(): boolean {
  return getAiBackendConfigError() === null;
}

export function getAuthRedirectUrl(path = 'reset-password'): string {
  return createURL(path);
}
