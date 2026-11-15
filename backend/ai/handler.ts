import {
  buildContextualFollowUps,
  buildEcoSystemInstruction,
  buildPersonalizationDossier,
  classifyActionTag,
  sanitizeLocalDateKey,
  type AchievementInputRow,
  type ChallengeInputRow,
  type DossierSummary,
  type ProfileInputRow,
} from './personalization.ts';
import {
  ECO_GEMINI_TOOLS,
  executeEcoToolCall,
  type EmissionRecordInputRow,
  type ToolExecutionContext,
  type VerifiedCalculationCitation,
} from './tools.ts';

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
export const MAX_PROMPT_LENGTH = 1000;
export const MAX_HISTORY_MESSAGES = 12;
export const MAX_TOOL_ROUNDS = 5;
export const MAX_OUTPUT_TOKENS = 900;

export const RATE_LIMIT_POLICY = {
  windowSeconds: 300,
  maxWindowRequests: 12,
  maxDailyRequests: 60,
} as const;

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export interface AssistantRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingWindow: number;
  remainingDaily: number;
  windowLimit: number;
  dailyLimit: number;
}

export interface IncomingChatHistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

export interface GeminiContentPart {
  type: string;
  text?: string;
}

export interface GeminiInteractionStep {
  type: string;
  id?: string;
  name?: string;
  call_id?: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
  content?: GeminiContentPart[];
}

export interface GeminiInteractionResponse {
  id?: string;
  status?: string;
  output_text?: string;
  steps?: GeminiInteractionStep[];
}

export interface GeminiCreateParams {
  model: string;
  input: GeminiInteractionStep[];
  system_instruction: string;
  tools: typeof ECO_GEMINI_TOOLS;
  store: boolean;
  generation_config: {
    max_output_tokens: number;
  };
}

export interface AuthenticatedUserSession {
  userId: string;
}

export interface UserSustainabilityData {
  profile: ProfileInputRow;
  records: EmissionRecordInputRow[];
  achievements: AchievementInputRow[];
  challenges: ChallengeInputRow[];
}

export interface PersistAssistantTurnInput {
  userId: string;
  userPrompt: string;
  assistantReply: string;
  actionTag: string;
  estimatedSavingsKg: number | null;
  calculations: VerifiedCalculationCitation[];
  suggestedFollowUps: string[];
  modelUsed: string;
  interactionId: string | null;
}

export interface AssistantHandlerDeps {
  getGeminiApiKey: () => string;
  getModelName?: () => string;
  authenticateUser: (authHeader: string | null) => Promise<AuthenticatedUserSession | null>;
  checkAndRecordRateLimit: (
    authHeader: string,
    userId: string,
    modelUsed: string
  ) => Promise<AssistantRateLimitResult>;
  fetchUserContextData: (
    authHeader: string,
    userId: string
  ) => Promise<UserSustainabilityData>;
  persistChatTurn?: (
    authHeader: string,
    turn: PersistAssistantTurnInput
  ) => Promise<{ userMessageId?: string; assistantMessageId?: string } | void>;
  callGemini: (
    apiKey: string,
    params: GeminiCreateParams
  ) => Promise<GeminiInteractionResponse>;
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...(extraHeaders ?? {}),
    },
  });
}

function extractBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  if (!match || !match[1]?.trim()) return null;
  return match[1].trim();
}

export function sanitizeOutgoingErrorMessage(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : String(raw ?? 'Unexpected error');
  // Redact accidental Google API key / Bearer token patterns
  return message
    .replace(/AIza[0-9A-Za-z_-]{15,}/g, '[REDACTED_API_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .slice(0, 240);
}

export function extractModelOutputText(response: any): string {
  if (!response || typeof response !== 'object') return '';

  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (typeof response.text === 'string' && response.text.trim()) {
    return response.text.trim();
  }

  // Check response.outputs (array of strings or { text } / { type, text })
  if (Array.isArray(response.outputs)) {
    const parts = response.outputs
      .map((item: any) => {
        if (typeof item === 'string') return item.trim();
        if (typeof item?.text === 'string') return item.text.trim();
        if (typeof item?.content === 'string') return item.content.trim();
        return '';
      })
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join('\n\n');
    }
  }

  // Check response.steps
  const steps = Array.isArray(response.steps) ? response.steps : [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (!step) continue;

    if (typeof step.text === 'string' && step.text.trim()) {
      return step.text.trim();
    }

    if (typeof step.content === 'string' && step.content.trim()) {
      return step.content.trim();
    }

    if (Array.isArray(step.content)) {
      const parts = step.content
        .map((part: any) => {
          if (typeof part === 'string') return part.trim();
          if (typeof part?.text === 'string') return part.text.trim();
          return '';
        })
        .filter(Boolean);
      if (parts.length > 0) {
        return parts.join('\n\n');
      }
    }
  }

  // Check classic Gemini candidates
  if (Array.isArray(response.candidates)) {
    for (const cand of response.candidates) {
      const parts = cand?.content?.parts;
      if (Array.isArray(parts)) {
        const textParts = parts
          .map((p: any) => (typeof p?.text === 'string' ? p.text.trim() : ''))
          .filter(Boolean);
        if (textParts.length > 0) {
          return textParts.join('\n\n');
        }
      }
    }
  }

  return '';
}

function normalizeIncomingHistory(rawHistory: unknown): IncomingChatHistoryItem[] {
  if (!Array.isArray(rawHistory)) return [];
  const normalized: IncomingChatHistoryItem[] = [];

  for (const item of rawHistory) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const role = rec.role === 'user' || rec.role === 'assistant' ? rec.role : null;
    const text = typeof rec.text === 'string' ? rec.text.trim() : '';
    if (!role || !text) continue;
    normalized.push({
      role,
      text: text.slice(0, 2000),
    });
  }

  return normalized.slice(-MAX_HISTORY_MESSAGES);
}

function isGeminiSecretConfigured(apiKey: string): boolean {
  const trimmed = apiKey.trim();
  if (!trimmed) return false;
  if (trimmed.includes('your-gemini-api-key') || trimmed.includes('placeholder')) {
    return false;
  }
  return trimmed.length >= 16;
}

export interface SustainabilityAssistantSuccessPayload {
  message: {
    id: string;
    sender: 'assistant';
    text: string;
    actionTag: string;
    estimatedSavingsKg: number | null;
    calculations: VerifiedCalculationCitation[];
    suggestedFollowUps: string[];
    modelUsed: string;
    interactionId: string | null;
    createdAt: string;
  };
  quota: {
    remainingWindow: number;
    remainingDaily: number;
    windowLimit: number;
    dailyLimit: number;
  };
  dossierSummary: DossierSummary;
}

export function createAssistantHandler(deps: AssistantHandlerDeps) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return jsonResponse(405, {
        code: 'METHOD_NOT_ALLOWED',
        error: 'Only POST requests are supported.',
      });
    }

    const authHeader = request.headers.get('authorization');
    const bearer = extractBearerToken(authHeader);
    if (!bearer || !authHeader) {
      return jsonResponse(401, {
        code: 'UNAUTHORIZED',
        error: 'Sign in with your EcoTrack account before messaging the AI Assistant.',
      });
    }

    let sessionUser: AuthenticatedUserSession | null = null;
    try {
      sessionUser = await deps.authenticateUser(authHeader);
    } catch {
      sessionUser = null;
    }

    if (!sessionUser?.userId) {
      return jsonResponse(401, {
        code: 'UNAUTHORIZED',
        error: 'Your session is invalid or expired. Please sign in again.',
      });
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return jsonResponse(400, {
          code: 'INVALID_BODY',
          error: 'Request payload must be a JSON object.',
        });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return jsonResponse(400, {
        code: 'INVALID_JSON',
        error: 'Malformed JSON request body.',
      });
    }

    const rawPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!rawPrompt) {
      return jsonResponse(400, {
        code: 'EMPTY_PROMPT',
        error: 'Please enter a sustainability question before sending.',
      });
    }
    if (rawPrompt.length > MAX_PROMPT_LENGTH) {
      return jsonResponse(400, {
        code: 'PROMPT_TOO_LONG',
        error: `Messages must be ${MAX_PROMPT_LENGTH} characters or fewer.`,
      });
    }

    const geminiApiKey = deps.getGeminiApiKey().trim();
    if (!isGeminiSecretConfigured(geminiApiKey)) {
      return jsonResponse(503, {
        code: 'AI_SERVICE_UNCONFIGURED',
        error:
          'Gemini AI credentials are not configured on the backend yet. Set GEMINI_API_KEY in backend/.env or the Node backend environment.',
      });
    }

    const modelName = deps.getModelName?.().trim() || DEFAULT_GEMINI_MODEL;

    // Enforce server-side per-user rate limit BEFORE calling Gemini
    let quota: AssistantRateLimitResult;
    try {
      quota = await deps.checkAndRecordRateLimit(authHeader, sessionUser.userId, modelName);
    } catch (err) {
      return jsonResponse(503, {
        code: 'RATE_LIMIT_CHECK_FAILED',
        error: 'Unable to verify AI request quota right now. Please try again shortly.',
        detail: sanitizeOutgoingErrorMessage(err),
      });
    }

    if (!quota.allowed) {
      return jsonResponse(
        429,
        {
          code: 'RATE_LIMIT_EXCEEDED',
          error: `Request limit reached (${quota.windowLimit} requests per ${Math.round(RATE_LIMIT_POLICY.windowSeconds / 60)} min or ${quota.dailyLimit}/day). Please wait ${quota.retryAfterSeconds}s and try again.`,
          retryAfterSeconds: quota.retryAfterSeconds,
          quota: {
            remainingWindow: quota.remainingWindow,
            remainingDaily: quota.remainingDaily,
            windowLimit: quota.windowLimit,
            dailyLimit: quota.dailyLimit,
          },
        },
        {
          'Retry-After': String(quota.retryAfterSeconds),
        }
      );
    }

    let userData: UserSustainabilityData;
    try {
      userData = await deps.fetchUserContextData(authHeader, sessionUser.userId);
    } catch (err) {
      return jsonResponse(500, {
        code: 'CONTEXT_LOAD_FAILED',
        error: 'Could not load your EcoTrack activity records for personalization.',
        detail: sanitizeOutgoingErrorMessage(err),
      });
    }

    const localDateKey = sanitizeLocalDateKey(
      typeof body.localDateKey === 'string' ? body.localDateKey : undefined
    );
    const timezone = typeof body.timezone === 'string' ? body.timezone : 'UTC';

    const dossier = buildPersonalizationDossier({
      profile: userData.profile,
      records: userData.records,
      achievements: userData.achievements,
      challenges: userData.challenges,
      localDateKey,
      timezone,
    });

    const systemInstruction = buildEcoSystemInstruction(dossier);
    const history = normalizeIncomingHistory(body.history);

    const conversationSteps: GeminiInteractionStep[] = history.map((item) => ({
      type: item.role === 'user' ? 'user_input' : 'model_output',
      content: [{ type: 'text', text: item.text }],
    }));

    conversationSteps.push({
      type: 'user_input',
      content: [{ type: 'text', text: rawPrompt }],
    });

    const toolContext: ToolExecutionContext = {
      defaultRegion: dossier.electricityRegion,
      defaultCustomGridFactorKg: userData.profile.custom_electricity_factor_kg ?? null,
      preferredUnit: dossier.preferredUnit,
      dailyBudgetKg: dossier.dailyBudgetKg,
      records: userData.records,
      completedChallengesCount: dossier.completedChallengesCount,
      profileBaselineScore: userData.profile.sustainability_score,
      localDateKey,
    };

    const collectedCitations: VerifiedCalculationCitation[] = [];
    const toolsCalled: string[] = [];
    let verifiedSavingsKg: number | null = null;
    let finalResponse: GeminiInteractionResponse | null = null;

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
        const interaction = await deps.callGemini(geminiApiKey, {
          model: modelName,
          input: conversationSteps,
          system_instruction: systemInstruction,
          tools: ECO_GEMINI_TOOLS,
          store: false,
          generation_config: {
            max_output_tokens: MAX_OUTPUT_TOKENS,
          },
        });

        finalResponse = interaction;
        const responseSteps = interaction.steps ?? [];
        const functionCalls = responseSteps.filter(
          (step) => step.type === 'function_call' && typeof step.name === 'string'
        );

        if (functionCalls.length === 0) {
          break;
        }

        // Preserve model tool-call steps cleanly for stateless continuation
        conversationSteps.push(...responseSteps);

        for (const callStep of functionCalls) {
          const toolName = callStep.name ?? '';
          const callId = callStep.call_id || callStep.id || `call_${round}_${toolsCalled.length}`;
          const args =
            callStep.arguments && typeof callStep.arguments === 'object'
              ? callStep.arguments
              : {};

          const outcome = executeEcoToolCall(toolName, args, toolContext);
          toolsCalled.push(toolName);
          collectedCitations.push(...outcome.citations);
          if (outcome.savingsKg !== null && outcome.savingsKg > 0) {
            verifiedSavingsKg =
              verifiedSavingsKg === null
                ? outcome.savingsKg
                : Number(Math.max(verifiedSavingsKg, outcome.savingsKg).toFixed(2));
          }

          conversationSteps.push({
            type: 'function_result',
            name: toolName,
            call_id: callId,
            result: JSON.stringify(outcome.result),
          });
        }
      }
    } catch (err) {
      const sanitized = sanitizeOutgoingErrorMessage(err);
      const isUpstreamRateLimit = /429|resource_exhausted|quota/i.test(sanitized);
      return jsonResponse(isUpstreamRateLimit ? 429 : 502, {
        code: isUpstreamRateLimit ? 'UPSTREAM_RATE_LIMIT' : 'AI_UPSTREAM_ERROR',
        error: isUpstreamRateLimit
          ? 'Gemini AI is temporarily busy. Please try again in a few moments.'
          : 'EcoTrack AI encountered an upstream connection issue. Please try again.',
        detail: sanitized,
      });
    }

    let replyText = finalResponse ? extractModelOutputText(finalResponse) : '';
    if (!replyText) {
      if (collectedCitations.length > 0) {
        const primary = collectedCitations[0];
        replyText = `Based on your EcoTrack activities, ${primary.activityLabel} produces approximately ${primary.emissionsKg.toFixed(2)} kg CO₂e (${primary.methodologyCitation}). Consider reducing distance or switching to public transit / cycling to lower your footprint.`;
      } else {
        replyText = `I analyzed your footprint question. You can lower your daily emissions by replacing short car trips with walking or cycling, reducing standby electricity usage, and minimizing landfill food waste.`;
      }
    }

    const actionTag = classifyActionTag(rawPrompt, toolsCalled);
    const suggestedFollowUps = buildContextualFollowUps(rawPrompt, dossier, toolsCalled);
    const createdAt = new Date().toISOString();

    let assistantMessageId = `msg-ai-${Date.now()}`;
    if (deps.persistChatTurn) {
      try {
        const persisted = await deps.persistChatTurn(authHeader, {
          userId: sessionUser.userId,
          userPrompt: rawPrompt,
          assistantReply: replyText,
          actionTag,
          estimatedSavingsKg: verifiedSavingsKg,
          calculations: collectedCitations,
          suggestedFollowUps,
          modelUsed: modelName,
          interactionId: finalResponse?.id ?? null,
        });
        if (persisted?.assistantMessageId) {
          assistantMessageId = persisted.assistantMessageId;
        }
      } catch {
        // Non-fatal persistence error; still return verified AI reply
      }
    }

    const payload: SustainabilityAssistantSuccessPayload = {
      message: {
        id: assistantMessageId,
        sender: 'assistant',
        text: replyText,
        actionTag,
        estimatedSavingsKg: verifiedSavingsKg,
        calculations: collectedCitations,
        suggestedFollowUps,
        modelUsed: modelName,
        interactionId: finalResponse?.id ?? null,
        createdAt,
      },
      quota: {
        remainingWindow: quota.remainingWindow,
        remainingDaily: quota.remainingDaily,
        windowLimit: quota.windowLimit,
        dailyLimit: quota.dailyLimit,
      },
      dossierSummary: dossier.summary,
    };

    return jsonResponse(200, payload as unknown as Record<string, unknown>);
  };
}
