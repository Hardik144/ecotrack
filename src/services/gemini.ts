/**
 * Secure Gemini Service Facade.
 *
 * Security Guarantee:
 * Gemini API calls execute exclusively inside the authenticated EcoTrack Node.js backend
 * (`POST /api/assistant/chat` backed by `backend/ai/`). Zero Gemini API keys or `@google/genai`
 * clients are ever bundled or initialized inside frontend mobile code.
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

export {
  clearChatHistory,
  fetchChatHistory,
  loadLocalChatCache,
  MAX_CHAT_PROMPT_CHARS,
  saveLocalChatCache,
  sendAssistantPrompt,
  type SendAssistantPromptFailure,
  type SendAssistantPromptInput,
  type SendAssistantPromptResult,
  type SendAssistantPromptSuccess,
} from './assistantService';
