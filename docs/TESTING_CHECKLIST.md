# EcoTrack Release QA & Verification Checklist

This checklist documents every verified check performed for the EcoTrack release with the self-contained **Node.js (`node:http` + `node:sqlite`) backend**.

---

## 1. Automated Verification Suites (`node --test`)

Run all six deterministic and backend integration test suites locally with Node `24+`:

```bash
node --test \
  scripts/testCalculationEngine.mjs \
  scripts/testAnalyticsEngine.mjs \
  scripts/testAiAssistant.mjs \
  scripts/testGamification.mjs \
  scripts/testAuditAndSecurity.mjs \
  scripts/testNodeBackend.mjs
```

| Test Suite | Scope Covered | Status |
|---|---|---|
| `scripts/testCalculationEngine.mjs` | Core equation `CO2e = amount * factor`, all 7 transport modes (`car`, `motorcycle`, `bus`, `train`, `air travel`, `walking`, `cycling`), regional electricity grids & household split, multi-item food & waste, heated/cold water & recycling offsets, invalid input rejection | Verified (10/10 passing) |
| `scripts/testAnalyticsEngine.mjs` | Daily/Weekly/Monthly KPI reconciliation, rolling vs calendar buckets, Category Donut mix, Transport vs Electricity comparison, Personal Progress trajectory, empty-DB zero states, Monthly Sustainability Report & CSV export, malformed timestamp guards | Verified (6/6 passing) |
| `scripts/testAiAssistant.mjs` | Client secret leakage guards (`EXPO_PUBLIC_GEMINI_API_KEY`, server secret patterns), client/backend emission factor parity, auth `401` enforcement, prompt validation `400`, rate limiting `429 + Retry-After`, key/token error redaction, multi-step Gemini tool calls (`calculate_*`, `get_user_footprint_analytics`), zero-log personalization | Verified (5/5 passing) |
| `scripts/testGamification.mjs` | Local daily (`daily:YYYY-MM-DD`) & ISO weekly (`weekly:YYYY-Www`) period keys including ISO year boundaries, privacy-masked leaderboard names, tier progression, duplicate-claim prevention, zero points for carbon log entries, SQLite backend enforcement | Verified (8/8 passing) |
| `scripts/testAuditAndSecurity.mjs` | `scrypt` password hashing, HMAC JWTs, signed expiring avatar URLs, zero `@supabase/supabase-js` or client Supabase code, frontend secret/bundle scan, navigation guards, Android keyboard `padding`, SafeArea tabs, `app.json` Android/iOS IDs & assets, `503` unconfigured check before rate-limit quota burn | Verified (4/4 passing) |
| `scripts/testNodeBackend.mjs` | Live HTTP router dispatch against ephemeral SQLite DB: health/401 protection, registration/login, local password reset recovery flow, profile update & mass-assignment guard, signed private avatar upload/download & tampering rejection, multi-user record isolation (`404` cross-user edits/deletes), zero-point emission logs, period-locked challenge claims, leaderboard opt-out, AI chat persistence & history clear | Verified (1/1 comprehensive E2E test passing) |

---

## 2. Static Analysis, Build & Diagnostics

| Check | Command | Scope & Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | Verified (`0` type errors) |
| ESLint | `npx eslint .` | Verified (`0` errors, `0` warnings) |
| Expo Lint | `npx expo lint` | Verified (`exit code 0`) |
| Expo Doctor | `npx expo-doctor` | Verified (`20/20` checks passed) |
| Web Export | `npx expo export --platform web --output-dir dist` | Verified before final E2E run |

---

## 3. Live Interactive Node Backend + Web Verification

Verified against the exported static web bundle served over HTTP alongside the live **Node.js backend** (`npm run backend`, port `3001`):

- [x] **Onboarding Tour (`src/app/onboarding.tsx`)**: All 3 slides (*Track Your Footprint*, *Gamified Climate Action*, *Smart AI Coach*), `Next` / `Back` transitions, and `Get Started` transition to `/login`.
- [x] **Protected Route Guard (`src/app/_layout.tsx`)**: Navigating directly to `/analytics` while unauthenticated redirects back to `/login`.
- [x] **Registration, Login & Forgot Password (`src/app/(auth)/`)**: Full account registration, persisted login session verification against `GET /api/auth/me`, inline form validation, logout, and local recovery code password reset (`/forgot-password` -> `/reset-password`).
- [x] **Carbon Calculator, Home & Analytics Persistence**: Saving emission calculations via `POST /api/emissions` updates Home KPIs and Analytics metrics/charts cleanly while awarding `0` Eco Points.
- [x] **Challenges, Badges & Profile Settings**: Completing a daily challenge credits points & *First Green Step* badge once per period, blocks duplicate claims, and Profile reflects live `Node API Live` health & Leaderboard opt-in controls.

---

## 4. Optional Live Cloud AI & Physical Device Checks

- [ ] **Live Gemini AI Coach (`GEMINI_API_KEY` in `backend/.env`)**: Populate a real Google Gemini API key inside `backend/.env`, restart `npm run backend`, and confirm live multi-turn tool-backed Gemini responses on `(tabs)/assistant.tsx`.
- [ ] **Physical Android & iOS Keyboard / Safe Area Check**: Open text inputs on `login`, `register`, `calculate`, `assistant`, `challenges`, `profile`, and `activity/[id]` on notched Android (gesture nav + edge-to-edge) and iOS devices to confirm `KeyboardAvoidingView` (`behavior="padding"`) keeps composers and submit buttons uncovered and bottom tab labels unclipped.
