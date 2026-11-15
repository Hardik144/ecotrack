import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getBackendConfigError, getEnv } from '@/utils/env';

const AUTH_SESSION_STORAGE_KEY = 'ecotrack_node_auth_session_v1';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: string;
  user: AuthUser;
}

export type AuthChangeEvent =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY';

export type AuthStateListener = (
  event: AuthChangeEvent,
  session: AuthSession | null
) => void;

export class ApiClientError extends Error {
  status: number;
  code: string;
  payload: unknown;

  constructor(status: number, code: string, message: string, payload?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

let inMemorySession: AuthSession | null = null;
let sessionLoadedFromDisk = false;
const listeners = new Set<AuthStateListener>();

function emitAuthEvent(event: AuthChangeEvent, session: AuthSession | null) {
  for (const listener of listeners) {
    try {
      listener(event, session);
    } catch {
      // Ignore individual subscriber errors
    }
  }
}

export function subscribeAuthSession(listener: AuthStateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadPersistedSession(): Promise<AuthSession | null> {
  if (sessionLoadedFromDisk) {
    return inMemorySession;
  }

  try {
    const raw = await AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    sessionLoadedFromDisk = true;
    if (!raw) {
      inMemorySession = null;
      return null;
    }

    const parsed = JSON.parse(raw) as AuthSession | null;
    if (
      !parsed ||
      typeof parsed.accessToken !== 'string' ||
      !parsed.user?.id
    ) {
      inMemorySession = null;
      return null;
    }

    const expiresMs = new Date(parsed.expiresAt).getTime();
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
      inMemorySession = null;
      await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }

    inMemorySession = parsed;
    return parsed;
  } catch {
    sessionLoadedFromDisk = true;
    inMemorySession = null;
    return null;
  }
}

export async function setPersistedSession(
  session: AuthSession | null,
  event: AuthChangeEvent = session ? 'SIGNED_IN' : 'SIGNED_OUT'
): Promise<void> {
  inMemorySession = session;
  sessionLoadedFromDisk = true;

  try {
    if (session) {
      await AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    }
  } catch {
    // Non-blocking storage fallback
  }

  emitAuthEvent(event, session);
}

export function notifyAuthEvent(
  event: AuthChangeEvent,
  session: AuthSession | null
): void {
  emitAuthEvent(event, session);
}

/**
 * Resolves the active EcoTrack Node.js backend origin.
 * On Web, automatically matches the active hostname when `localhost` / empty
 * is configured so local dev previews on 127.0.0.1 or LAN work seamlessly.
 */
export function getApiBaseUrl(): string {
  const { apiUrl } = getEnv();

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const browserHost = window.location.hostname;
    const browserProtocol =
      window.location.protocol === 'https:' ? 'https:' : 'http:';

    if (!apiUrl) {
      return `${browserProtocol}//${browserHost}:3001`;
    }

    try {
      const parsed = new URL(apiUrl);
      if (
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
        browserHost &&
        browserHost !== parsed.hostname
      ) {
        return `${parsed.protocol}//${browserHost}:${parsed.port || '3001'}`;
      }
    } catch {
      // Fall through to configured string
    }
  }

  if (apiUrl) {
    return apiUrl;
  }

  return Platform.OS === 'android'
    ? 'http://10.0.2.2:3001'
    : 'http://localhost:3001';
}

export function resolveBackendAssetUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith('/')) {
    return `${getApiBaseUrl()}${rawUrl}`;
  }
  return rawUrl;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  tokenOverride?: string | null;
  skipAuth?: boolean;
  timeoutMs?: number;
  clearSessionOn401?: boolean;
}

export async function apiRequest<T>(
  pathOrAbsoluteUrl: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const configError = getBackendConfigError();
  if (configError) {
    throw new ApiClientError(400, 'CONFIG_ERROR', configError);
  }

  const baseUrl = getApiBaseUrl();
  const targetUrl = pathOrAbsoluteUrl.startsWith('http')
    ? pathOrAbsoluteUrl
    : `${baseUrl}${pathOrAbsoluteUrl.startsWith('/') ? '' : '/'}${pathOrAbsoluteUrl}`;

  const token =
    options.tokenOverride !== undefined
      ? options.tokenOverride
      : options.skipAuth
        ? null
        : (await loadPersistedSession())?.accessToken ?? null;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 15000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiClientError(
        408,
        'TIMEOUT',
        `EcoTrack Node server timed out connecting to ${baseUrl}.`
      );
    }
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      `Unable to reach the EcoTrack Node server (${baseUrl}). Ensure the backend is running via "npm run backend".`
    );
  } finally {
    clearTimeout(timer);
  }

  const rawText = await response.text();
  let parsed: Record<string, unknown> | null = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const code =
      typeof parsed?.code === 'string' ? parsed.code : `HTTP_${response.status}`;
    const message =
      typeof parsed?.error === 'string'
        ? parsed.error
        : typeof parsed?.message === 'string'
          ? parsed.message
          : `Request failed with status ${response.status}.`;

    if (response.status === 401 && options.clearSessionOn401 !== false && !options.skipAuth) {
      void setPersistedSession(null, 'SIGNED_OUT');
    }

    throw new ApiClientError(response.status, code, message, parsed);
  }

  return (parsed ?? {}) as T;
}

export interface BackendHealthStatus {
  ok: boolean;
  service: string;
  version: string;
  geminiConfigured: boolean;
}

export async function fetchBackendHealth(): Promise<BackendHealthStatus> {
  return apiRequest<BackendHealthStatus>('/api/health', {
    skipAuth: true,
    timeoutMs: 5000,
    clearSessionOn401: false,
  });
}
