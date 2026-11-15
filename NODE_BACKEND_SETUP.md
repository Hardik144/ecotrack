# EcoTrack Node.js Backend Setup Guide

EcoTrack uses a self-contained **Node.js backend** (`node:http` + `node:sqlite` + `node:crypto`) inside [`backend/`](backend/) — **no Supabase account, Docker container, or external PostgreSQL server is required**.

On first boot, `npm run backend` automatically initializes the SQLite database (`WAL` mode, foreign keys enabled), creates all 11 tables, persists a local `.jwt-secret` if none is provided, and idempotently seeds 18 `carbon_activities`, 10 `challenges`, and 5 per-user `achievements` upon registration.

---

## 1. Backend Architecture (`backend/`)

| Module | Responsibility |
|---|---|
| [`backend/server.mjs`](backend/server.mjs) | Entrypoint (`npm run backend`), loads config and starts the HTTP server on `PORT=3001` |
| [`backend/env.mjs`](backend/env.mjs) | Loads `backend/.env`, manages DB/upload paths, resolves or auto-generates persistent HMAC JWT secret (`backend/data/.jwt-secret`) |
| [`backend/db.mjs`](backend/db.mjs) | Opens `node:sqlite` (`DatabaseSync`), creates 11 relational tables, enforces `CHECK` / `UNIQUE` constraints, and seeds catalogs |
| [`backend/auth.mjs`](backend/auth.mjs) | Per-user salted `scrypt` password hashing, constant-time comparisons, HMAC-SHA256 JWT tokens, recovery tokens/codes, and HMAC-signed avatar URLs |
| [`backend/app.mjs`](backend/app.mjs) | REST API router (`createBackendApp`), mass-assignment protections, private avatar upload/download validation, and CORS headers |
| [`backend/gamification.mjs`](backend/gamification.mjs) | Server-enforced period-locked challenge claims, `reward_history` deduplication, badge unlocks, streak tracking, and privacy-masked leaderboard queries |
| [`backend/ai.mjs`](backend/ai.mjs) | SQLite sliding-window & daily rate limiting (`12` / 5 min, `60` / 24h), user context loading, and Gemini Interactions REST client |
| [`backend/ai/`](backend/ai/) | Deterministic factors (`factors.ts`), personalization dossier builder (`personalization.ts`), verified calculation tools (`tools.ts`), and request handler (`handler.ts`) |

---

## 2. Quick Start

### Step 1: Start the Node.js Backend Server

```bash
npm run backend
```

Default configuration:
- **Listen Address**: `http://0.0.0.0:3001` (`http://localhost:3001`)
- **SQLite Database**: `backend/data/ecotrack.db`
- **Private Avatar Uploads**: `backend/uploads/avatars/`

### Step 2: Optional Gemini AI Key (`backend/.env` — Server-Only)

For live Gemini AI Sustainability Assistant responses, copy `backend/.env.example` to `backend/.env` and set your **server-side** key:

```bash
cp backend/.env.example backend/.env
```

```env
PORT=3001
HOST=0.0.0.0
ECOTRACK_DB_PATH=backend/data/ecotrack.db
# Optional strong secret (minimum 16 chars; auto-generated in dev if omitted):
# ECOTRACK_JWT_SECRET=replace-with-strong-random-secret
GEMINI_API_KEY=your_server_side_gemini_api_key
GEMINI_MODEL=gemini-4-hydrogen
```

> [!CAUTION]
> **NEVER** place `GEMINI_API_KEY` or `ECOTRACK_JWT_SECRET` inside the root mobile `.env` file or any `EXPO_PUBLIC_*` variable. The frontend blocks exposed keys at runtime and sends chat prompts solely to `POST /api/assistant/chat`.

If `GEMINI_API_KEY` is omitted, all other EcoTrack features (authentication, calculator, dashboard, analytics, challenges, leaderboard, profile, and avatars) run normally; `POST /api/assistant/chat` cleanly returns HTTP `503` (`AI_SERVICE_UNCONFIGURED`) before consuming rate-limit quota.

---

## 3. Frontend Client Networking (`.env`)

Root `.env` configures the Expo mobile/web client:

```env
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_API_URL=http://localhost:3001
```

[`src/services/apiClient.ts`](src/services/apiClient.ts) adapts `EXPO_PUBLIC_API_URL` per platform:
- **Web (`localhost` / `127.0.0.1`)**: Matches the active browser hostname on port `3001`.
- **iOS Simulator**: Uses `http://localhost:3001`.
- **Android Emulator**: Automatically resolves emulator host traffic to `http://10.0.2.2:3001` when unset, or set your LAN IP (e.g., `http://192.168.1.42:3001`) when testing on a physical phone.

---

## 4. SQLite Relational Schema (11 Tables)

- `users`: Primary credentials (`id`, `email UNIQUE COLLATE NOCASE`, `password_hash`, `full_name`)
- `password_resets`: Expiring hashed reset codes (`code_hash`, `expires_at`, `used_at`)
- `profiles`: Per-user budget, points, score, level, streak, units, `electricity_region`, custom factor, and privacy settings
- `carbon_activities`: Seeded 18 deterministic calculation presets (`transport`, `electricity`, `food`, `lifestyle`)
- `carbon_emission_records`: User-scoped carbon logs with audit metadata (`region_code`, `methodology_source`, `assumptions`, `recorded_at`)
- `challenges`: Seeded 10 daily & weekly sustainability challenges
- `user_challenges`: Period-scoped progress keyed on `UNIQUE (user_id, challenge_id, period_key)`
- `achievements`: 5 canonical badges seeded per user (`UNIQUE (user_id, badge_key)`)
- `reward_history`: Immutable idempotent Eco Points ledger (`UNIQUE (user_id, reward_key)`)
- `ai_chat_messages`: Persisted AI conversation history with `calculations` & `suggested_follow_ups`
- `ai_request_logs`: Rate-limit sliding-window audit log (`ai_request_logs`)

---

## 5. REST API Endpoints (`backend/app.mjs`)

- **Health**:
  - `GET /api/health` -> `{ ok, service, version, geminiConfigured }`
- **Authentication & Recovery**:
  - `POST /api/auth/register` (`{ fullName, email, password }`)
  - `POST /api/auth/login` (`{ email, password }`)
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
  - `POST /api/auth/forgot-password` (`{ email }` — returns a short-lived local `recoveryCode` in non-production environments)
  - `POST /api/auth/verify-recovery` (`{ code }` — exchanges reset code for a short-lived recovery JWT)
  - `POST /api/auth/update-password` (`{ newPassword }`)
- **Profile & Private Avatars**:
  - `GET /api/profile`
  - `PATCH /api/profile` (whitelisted preference/name/budget fields only; prevents client tampering with points/streak)
  - `POST /api/profile/avatar` (accepts validated base64 image; writes per-user file and signs URL)
  - `GET /api/avatars/:userId/:filename?exp=...&sig=...` (verifies HMAC-SHA256 expiration & signature)
- **Carbon Activities & Emissions**:
  - `GET /api/activities/catalog`
  - `GET /api/emissions`
  - `POST /api/emissions` (awards **0 Eco Points** per anti-farming policy)
  - `PATCH /api/emissions/:id`
  - `DELETE /api/emissions/:id`
- **Gamification & Leaderboard**:
  - `GET /api/challenges`
  - `POST /api/challenges/:id/action`
  - `GET /api/achievements`
  - `GET /api/rewards`
  - `GET /api/leaderboard` (`First L.` display names, opt-in filtered)
- **Gemini AI Assistant**:
  - `GET /api/assistant/history`
  - `DELETE /api/assistant/history`
  - `POST /api/assistant/chat`
