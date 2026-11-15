# EcoTrack Android Build Instructions & Final Demonstration Guide

This guide covers building installable Android binaries (APK / AAB) via Expo Application Services (EAS) or local Continuous Native Generation (CNG), plus a 5-minute end-to-end demonstration walkthrough.

---

## Part 1: Prerequisites

1. Node.js `>= 20` (verified on Node `v24.16.0`) and npm (`package-lock.json` present).
2. Running **EcoTrack Node.js Backend** (`npm run backend`, default port `3001`). See [NODE_BACKEND_SETUP.md](../NODE_BACKEND_SETUP.md).
3. Optional `GEMINI_API_KEY` configured in **server-only** `backend/.env` if demonstrating live Gemini AI Sustainability Assistant coaching.
4. For cloud Android builds: an [Expo / EAS](https://expo.dev) account.

> [!NOTE]
> `app.json` is already configured with Android package ID `com.ecotrack.app`, iOS bundle identifier `com.ecotrack.app`, `softwareKeyboardLayoutMode: "resize"`, adaptive icon assets (`assets/images/android-icon-*.png`), and photo-picker permissions (`expo-image-picker`). Because EcoTrack uses **Continuous Native Generation (CNG)**, `android/` and `ios/` directories are not committed and are generated automatically during build/prebuild.

---

## Part 2: Building for Android with EAS Build (Recommended)

No local Android Studio or Xcode installation is required when building in the cloud with EAS.

### Step 1: Log in & initialize EAS Build profiles

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

If prompted to create `eas.json`, ensure your `preview` profile builds an installable Android APK (`distribution: internal`, `buildType: apk`), while `production` builds a Google Play App Bundle (`.aab`):

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

### Step 2: Register EAS Environment Variables (Never Commit `.env`)

Push only **public** client variables to your EAS project environment (never push `ECOTRACK_JWT_SECRET` or `GEMINI_API_KEY` to EAS mobile build env vars):

```bash
npx eas-cli@latest env:create --name EXPO_PUBLIC_APP_ENV --value production --environment preview --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value https://api.your-ecotrack-host.example --environment preview --visibility plaintext
```

For local Android Emulator testing against `npm run backend` on your development machine, leave `EXPO_PUBLIC_API_URL=http://localhost:3001` — `src/services/apiClient.ts` automatically adapts emulator requests to `http://10.0.2.2:3001`.

### Step 3: Build the Android APK (Testing / Sideloading)

```bash
npx eas-cli@latest build --platform android --profile preview
```

Once EAS finishes building, scan the QR code or download the `.apk` artifact directly onto any Android 8.0+ phone.

### Step 4: Build a Development Client (Optional, Local Device Iteration)

```bash
npx eas-cli@latest build --platform android --profile development
```

### Step 5: Build a Google Play Store Release (`.aab`)

```bash
npx eas-cli@latest build --platform android --profile production
```

---

## Part 3: Local Android Build (Optional, Requires Android SDK & JDK 17)

If you prefer compiling locally instead of EAS Cloud:

1. Generate the native Android project from `app.json` config plugins:
   ```bash
   npx expo prebuild --platform android
   ```
2. Compile and install a debug build onto a connected Android device or emulator:
   ```bash
   npx expo run:android
   ```
3. Or build a release APK directly via Gradle:
   ```bash
   cd android && ./gradlew assembleRelease
   ```
   Output APK location: `android/app/build/outputs/apk/release/app-release.apk`.

---

## Part 4: Final 5-Minute Demonstration Script

Use this structured walkthrough when presenting or evaluating EcoTrack live:

### 1. Onboarding & Security Gate (`0:00 – 0:45`)
- Launch EcoTrack cold: highlight the **3-step onboarding** carousel (Footprint Tracking, Green Challenges, Gemini AI Companion).
- Tap **Get Started** to arrive at **Sign In**, trigger an empty submission to show instant validation, then register or sign in with a test account. Point out that protected routes redirect unauthenticated sessions back to Sign In via Expo Router `Stack.Protected`.

### 2. Carbon Calculation Engine (`0:45 – 1:45`)
- Open the **Calculate** tab.
- **Transportation**: Select *Car (Petrol)*, adjust occupancy or switch to *Electric Vehicle* to show live coupling to the user's configured **Regional Grid Factor** (e.g., Global `0.4450` vs France `0.0500` vs India `0.7270 kg CO₂e/kWh`). Highlight *Walking/Cycling* direct zero vs car-replacement avoided offset.
- **Electricity / Food / Lifestyle**: Switch tabs, show monthly vs daily proration (`÷ 30 days`) and multi-item batch logging (e.g., Vegetarian meal + Food waste + Aluminum recycling). Tap **Save & Log** -> verify activity saves cleanly to the Node.js SQLite database and yields `0` Eco Points (showing honesty/anti-farming design).

### 3. Home Dashboard & Live Analytics (`1:45 – 2:45`)
- Return to **Home**: verify Daily CO₂e KPI, Daily Target Budget bar, Weekly Footprint, Eco Score, Sustainability Progress tier, and Recent Activities updated immediately.
- Open an entry to demonstrate **Activity Details (`activity/[id]`)** — inspect stored emission factor, source citation (UK DESNZ 2024 / EPA WARM v16 / Poore & Nemecek), quantity edit, or delete.
- Open **Analytics**: showcase all 6 interactive charts (*Daily Trend*, *Weekly Comparison*, *Monthly Comparison*, *Category Donut*, *Transport vs Electricity*, *Personal Progress Over Time*), apply a Date / Category filter, toggle sorting in Activity History, and tap **Export CSV** / **Share Monthly Report**.

### 4. Gamification System (`2:45 – 3:45`)
- Open **Challenges & Rewards** from the Home Quick Action or Sustainability card.
- Join a **Daily** or **Weekly** green challenge (e.g., *Avoid single-use plastic* or *Use public transportation*), add an optional reflection note, and tap **Complete Action Step**.
- Demonstrate **Period Duplicate Protection** (completed today cannot be re-claimed today), inspect **Eco Points + Reward History** ledger, showcase **5 Achievement Badges** (*First Green Step*, *Plastic-Free Hero*, *Energy Saver*, *Eco Warrior*, *Carbon Champion*), and switch to the **Leaderboard** tab showing privacy-masked names (`First L.`).

### 5. Personalized Gemini AI Assistant (`3:45 – 4:30`)
- Open the **AI Assistant** tab. Show the personalized context strip summarizing total logs, top emission category, active grid region, and earned badges.
- Tap a suggested question (e.g., comparing your petrol commute vs transit or lowering your top category). Point out:
  - Server-side rate limit quota pill (`remainingDaily/dailyLimit`),
  - Verified deterministic calculation citation cards returned from Node backend tools (`backend/ai/tools.ts`, zero hallucinated arithmetic),
  - Persistent chat history synced to SQLite `ai_chat_messages`.

### 6. Profile, Privacy & Architecture Recap (`4:30 – 5:00`)
- Open **Profile**: adjust **Daily Carbon Budget**, toggle **Leaderboard Visibility**, change **Regional Grid** / **Preferred Units**, verify **Security & Sync Status** confirming zero client-side secrets (`GEMINI_API_KEY` stays server-only), and sign out cleanly.
