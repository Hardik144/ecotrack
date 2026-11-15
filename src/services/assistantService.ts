import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  AiQuotaStatus,
  ChatMessage,
  VerifiedCalculationCitation,
} from '@/types/carbon';
import { getAiBackendConfigError } from '@/utils/env';

import { ApiClientError, apiRequest } from './apiClient';

export const MAX_CHAT_PROMPT_CHARS = 1000;
const LOCAL_CHAT_CACHE_PREFIX = 'ecotrack_ai_chat_cache_v1_';
const MAX_CACHED_MESSAGES = 60;

interface BackendChatMessageRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action_tag: string | null;
  estimated_savings_kg: number | null;
  calculations: unknown;
  suggested_follow_ups: string[] | null;
  model_used: string | null;
  created_at: string;
}

export interface SendAssistantPromptInput {
  userId: string;
  prompt: string;
  history: ChatMessage[];
  localDateKey?: string;
  timezone?: string;
}

export interface SendAssistantPromptSuccess {
  ok: true;
  message: ChatMessage;
  quota?: AiQuotaStatus;
}

export interface SendAssistantPromptFailure {
  ok: false;
  code: string;
  error: string;
  retryAfterSeconds?: number;
  quota?: AiQuotaStatus;
}

export type SendAssistantPromptResult =
  | SendAssistantPromptSuccess
  | SendAssistantPromptFailure;

function formatTimeLabel(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return 'Now';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function parseCalculations(raw: unknown): VerifiedCalculationCitation[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const parsed: VerifiedCalculationCitation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (
      typeof obj.label === 'string' &&
      typeof obj.formula === 'string' &&
      typeof obj.resultKg === 'number' &&
      Number.isFinite(obj.resultKg)
    ) {
      parsed.push({
        label: obj.label,
        formula: obj.formula,
        resultKg: obj.resultKg,
        direction:
          obj.direction === 'offset' ||
          obj.direction === 'savings' ||
          obj.direction === 'emission'
            ? obj.direction
            : 'emission',
        source:
          typeof obj.source === 'string' ? obj.source : 'EcoTrack Calculator',
      });
    }
  }
  return parsed.length > 0 ? parsed : undefined;
}

function mapChatMessageRow(row: BackendChatMessageRow): ChatMessage {
  return {
    id: row.id,
    sender: row.role === 'user' ? 'user' : 'assistant',
    text: row.content,
    timestamp: formatTimeLabel(row.created_at),
    createdAt: row.created_at,
    actionTag: row.action_tag ?? undefined,
    estimatedSavingsKg:
      row.estimated_savings_kg !== null &&
      row.estimated_savings_kg !== undefined
        ? Number(row.estimated_savings_kg)
        : undefined,
    calculations: parseCalculations(row.calculations),
    suggestedFollowUps: Array.isArray(row.suggested_follow_ups)
      ? row.suggested_follow_ups.filter(
          (item): item is string => typeof item === 'string'
        )
      : undefined,
    modelUsed: row.model_used ?? undefined,
  };
}

function getCacheKey(userId: string): string {
  return `${LOCAL_CHAT_CACHE_PREFIX}${userId}`;
}

export async function saveLocalChatCache(
  userId: string,
  messages: ChatMessage[]
): Promise<void> {
  if (!userId) return;
  try {
    const clean = messages
      .filter((m) => !m.isError)
      .slice(-MAX_CACHED_MESSAGES);
    await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(clean));
  } catch {
    // Cache writes are best-effort
  }
}

export async function loadLocalChatCache(userId: string): Promise<ChatMessage[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(getCacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export async function clearLocalChatCache(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(getCacheKey(userId));
  } catch {
    // Ignore storage cleanup error
  }
}

export async function fetchChatHistory(userId: string): Promise<ChatMessage[]> {
  try {
    const res = await apiRequest<{ messages: BackendChatMessageRow[] }>(
      '/api/assistant/history',
      { method: 'GET' }
    );
    const mapped = (res.messages ?? []).map(mapChatMessageRow);
    void saveLocalChatCache(userId, mapped);
    return mapped;
  } catch {
    return loadLocalChatCache(userId);
  }
}

export async function clearChatHistory(userId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/assistant/history', {
    method: 'DELETE',
  });
  await clearLocalChatCache(userId);
}

interface AssistantApiPayload {
  ok?: boolean;
  code?: string;
  error?: string;
  retryAfterSeconds?: number;
  reply?: string;
  actionTag?: string;
  estimatedSavingsKg?: number | null;
  calculations?: unknown;
  suggestedFollowUps?: string[];
  modelUsed?: string;
  messageId?: string;
  createdAt?: string;
  quota?: AiQuotaStatus;
  message?: {
    id?: string;
    sender?: 'assistant';
    text?: string;
    actionTag?: string;
    estimatedSavingsKg?: number | null;
    calculations?: unknown;
    suggestedFollowUps?: string[];
    modelUsed?: string;
    createdAt?: string;
  };
}

export async function sendAssistantPrompt(
  input: SendAssistantPromptInput
): Promise<SendAssistantPromptResult> {
  const cleanedPrompt = input.prompt.trim();
  if (!cleanedPrompt) {
    return {
      ok: false,
      code: 'EMPTY_PROMPT',
      error: 'Please enter a sustainability question or request first.',
    };
  }

  if (cleanedPrompt.length > MAX_CHAT_PROMPT_CHARS) {
    return {
      ok: false,
      code: 'PROMPT_TOO_LONG',
      error: `Messages must be ${MAX_CHAT_PROMPT_CHARS} characters or fewer.`,
    };
  }

  const configErr = getAiBackendConfigError();
  if (configErr) {
    return {
      ok: false,
      code: 'AI_CONFIG_ERROR',
      error: configErr,
    };
  }

  const formattedHistory = input.history
    .filter((m) => !m.isError && m.text.trim().length > 0)
    .slice(-12)
    .map((m) => ({
      role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.text.trim().slice(0, 1500),
    }));

  try {
    const payload = await apiRequest<AssistantApiPayload>('/api/assistant/chat', {
      method: 'POST',
      timeoutMs: 60000,
      clearSessionOn401: false,
      body: {
        prompt: cleanedPrompt,
        history: formattedHistory,
        localDateKey: input.localDateKey,
        timezone: input.timezone,
      },
    });

    const replyText =
      (typeof payload.reply === 'string' && payload.reply.trim()) ||
      (typeof payload.message?.text === 'string' && payload.message.text.trim()) ||
      '';

    if (!replyText) {
      return {
        ok: false,
        code: payload.code ?? 'INVALID_AI_RESPONSE',
        error:
          payload.error ??
          'The Sustainability Assistant returned an empty response. Please try again.',
        retryAfterSeconds: payload.retryAfterSeconds,
        quota: payload.quota,
      };
    }

    const now = new Date();
    const msgObj = payload.message ?? {};
    const message: ChatMessage = {
      id: payload.messageId ?? msgObj.id ?? `msg-ai-${now.getTime()}`,
      sender: 'assistant',
      text: replyText,
      timestamp: formatTimeLabel(now),
      createdAt: msgObj.createdAt ?? payload.createdAt ?? now.toISOString(),
      actionTag: payload.actionTag ?? msgObj.actionTag,
      estimatedSavingsKg:
        typeof payload.estimatedSavingsKg === 'number'
          ? payload.estimatedSavingsKg
          : typeof msgObj.estimatedSavingsKg === 'number'
          ? msgObj.estimatedSavingsKg
          : undefined,
      calculations: parseCalculations(payload.calculations ?? msgObj.calculations),
      suggestedFollowUps: Array.isArray(payload.suggestedFollowUps)
        ? payload.suggestedFollowUps
        : Array.isArray(msgObj.suggestedFollowUps)
        ? msgObj.suggestedFollowUps
        : undefined,
      modelUsed: payload.modelUsed ?? msgObj.modelUsed,
    };

    return {
      ok: true,
      message,
      quota: payload.quota,
    };
  } catch (err) {
    if (err instanceof ApiClientError) {
      const data = err.payload as AssistantApiPayload | undefined;
      return {
        ok: false,
        code: err.code || `HTTP_${err.status}`,
        error: err.message,
        retryAfterSeconds: data?.retryAfterSeconds,
        quota: data?.quota,
      };
    }

    return {
      ok: false,
      code: 'ASSISTANT_REQUEST_FAILED',
      error:
        err instanceof Error
          ? err.message
          : 'Unable to reach the EcoTrack AI Sustainability Assistant.',
    };
  }
}
