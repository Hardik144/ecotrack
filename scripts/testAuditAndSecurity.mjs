import assert from 'node:assert/strict';
import fs from 'node:fs';
import module from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

module.registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'expo-linking') {
      return {
        shortCircuit: true,
        url: 'data:text/javascript,export function createURL(p){return "ecotrack://"+p;}',
      };
    }

    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      context.parentURL?.startsWith('file://') &&
      !path.extname(specifier)
    ) {
      const parentDir = path.dirname(new URL(context.parentURL).pathname);
      const tsPath = path.resolve(parentDir, `${specifier}.ts`);
      if (fs.existsSync(tsPath)) {
        return { shortCircuit: true, url: pathToFileURL(tsPath).href };
      }
      const tsxPath = path.resolve(parentDir, `${specifier}.tsx`);
      if (fs.existsSync(tsxPath)) {
        return { shortCircuit: true, url: pathToFileURL(tsxPath).href };
      }
    }
    return nextResolve(specifier, context);
  },
});

const edgeHandler = await import('../backend/ai/handler.ts');

const ROOT = path.resolve(import.meta.dirname, '..');

function walkFiles(dir, extFilter) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.expo' ||
      entry.name === 'dist'
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, extFilter));
    } else if (!extFilter || extFilter.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

test('Security Audit: Node.js backend enforces hashed passwords, signed tokens, private avatars, and zero Supabase dependency', async () => {
  const { hashPassword, verifyPassword, signAuthToken, verifyAuthToken, signAvatarResourceUrl, verifyAvatarSignature } =
    await import('../backend/auth.mjs');

  const hashed = hashPassword('StrongEcoPass99!');
  assert.ok(hashed.startsWith('scrypt:'));
  assert.equal(verifyPassword('StrongEcoPass99!', hashed), true);
  assert.equal(verifyPassword('WrongPass', hashed), false);

  const secret = 'test-audit-secret-key-0123456789abcdef';
  const signed = signAuthToken({ userId: 'u-1', email: 'u1@example.com' }, secret, 60);
  const verified = verifyAuthToken(signed.token, secret);
  assert.equal(verified?.userId, 'u-1');
  assert.equal(verifyAuthToken(`${signed.token}x`, secret), null);

  const signedAvatar = signAvatarResourceUrl('u-1/avatar.jpg', secret, 120);
  const avatarUrl = new URL(`http://localhost${signedAvatar}`);
  assert.equal(
    verifyAvatarSignature(
      'u-1/avatar.jpg',
      avatarUrl.searchParams.get('exp'),
      avatarUrl.searchParams.get('sig'),
      secret
    ),
    true
  );
  assert.equal(
    verifyAvatarSignature(
      'u-2/avatar.jpg',
      avatarUrl.searchParams.get('exp'),
      avatarUrl.searchParams.get('sig'),
      secret
    ),
    false
  );

  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
  );
  assert.equal(pkg.dependencies['@supabase/supabase-js'], undefined);
  assert.equal(pkg.dependencies['react-native-url-polyfill'], undefined);
  assert.equal(fs.existsSync(path.join(ROOT, 'src/services/supabase.ts')), false);
});

test('Security Audit: frontend bundle never embeds service_role keys, Gemini secrets, or unsafe eval/HTML', () => {
  const srcFiles = walkFiles(path.join(ROOT, 'src'), /\.(ts|tsx)$/);
  assert.ok(srcFiles.length > 20);

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(
      /import\s+[\s\S]*from\s+['"]@google\/genai['"]/.test(content),
      false,
      `Frontend file must not import @google/genai: ${path.relative(ROOT, file)}`
    );
    assert.equal(
      /EXPO_PUBLIC_GEMINI_API_KEY\s*=|AIza[0-9A-Za-z_-]{20,}/.test(content),
      false,
      `Hardcoded Gemini key pattern found in ${path.relative(ROOT, file)}`
    );
    assert.equal(
      /dangerouslySetInnerHTML|\beval\s*\(|new Function\s*\(/.test(content),
      false,
      `Unsafe dynamic code/HTML pattern found in ${path.relative(ROOT, file)}`
    );
  }

  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
  );
  assert.equal(pkg.dependencies['@google/genai'], undefined);
  assert.equal(pkg.dependencies['expo-device'], undefined);
  assert.equal(pkg.dependencies['expo-web-browser'], undefined);

  const envExample = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.equal(
    /EXPO_PUBLIC_GEMINI_API_KEY=/m.test(envExample.replace(/^#.*$/gm, '')),
    false,
    '.env.example must not define active EXPO_PUBLIC_GEMINI_API_KEY'
  );
});

test('Audit Fixes: navigation guards, double-header removal, Android keyboard padding, SafeArea tabs, Analytics totals & app.json', () => {
  const rootLayout = fs.readFileSync(
    path.join(ROOT, 'src/app/_layout.tsx'),
    'utf8'
  );
  assert.match(rootLayout, /<Stack\.Protected[\s\S]*guard=\{isAuthenticated/);
  assert.match(
    rootLayout,
    /<Stack\.Screen\s+name="challenges"\s+options=\{\{\s*headerShown:\s*false,?\s*\}\}/
  );

  const screenContainer = fs.readFileSync(
    path.join(ROOT, 'src/components/ui/ScreenContainer.tsx'),
    'utf8'
  );
  assert.match(
    screenContainer,
    /behavior=\{Platform\.OS === 'web' \? undefined : 'padding'\}/
  );

  const assistantScreen = fs.readFileSync(
    path.join(ROOT, 'src/app/(tabs)/assistant.tsx'),
    'utf8'
  );
  assert.match(
    assistantScreen,
    /behavior=\{Platform\.OS === 'web' \? undefined : 'padding'\}/
  );

  const tabsLayout = fs.readFileSync(
    path.join(ROOT, 'src/app/(tabs)/_layout.tsx'),
    'utf8'
  );
  assert.match(tabsLayout, /useSafeAreaInsets/);

  const analyticsScreen = fs.readFileSync(
    path.join(ROOT, 'src/app/(tabs)/analytics.tsx'),
    'utf8'
  );
  assert.match(analyticsScreen, /totalCompletedChallenges/);

  const challengesScreen = fs.readFileSync(
    path.join(ROOT, 'src/app/challenges.tsx'),
    'utf8'
  );
  assert.match(challengesScreen, /edges=\{\['top', 'bottom'\]\}/);
  assert.match(challengesScreen, /keyboardAvoiding/);

  const appConfig = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')
  );
  assert.equal(appConfig.expo.android.package, 'com.ecotrack.app');
  assert.equal(appConfig.expo.ios.bundleIdentifier, 'com.ecotrack.app');
  assert.equal(appConfig.expo.android.softwareKeyboardLayoutMode, 'resize');

  for (const relPath of [
    appConfig.expo.icon,
    appConfig.expo.ios.icon,
    appConfig.expo.android.adaptiveIcon.foregroundImage,
    appConfig.expo.android.adaptiveIcon.backgroundImage,
    appConfig.expo.android.adaptiveIcon.monochromeImage,
    appConfig.expo.web.favicon,
  ]) {
    const resolved = path.join(ROOT, relPath);
    assert.ok(fs.existsSync(resolved), `Missing referenced asset: ${relPath}`);
  }
});

test('Edge Function Hardening: unconfigured GEMINI_API_KEY fails with 503 BEFORE consuming rate-limit quota', async () => {
  let rateLimitChecks = 0;
  const handler = edgeHandler.createAssistantHandler({
    getGeminiApiKey: () => 'your-gemini-api-key',
    authenticateUser: async () => ({ userId: 'user-123' }),
    checkAndRecordRateLimit: async () => {
      rateLimitChecks += 1;
      return {
        allowed: true,
        retryAfterSeconds: 0,
        remainingWindow: 11,
        remainingDaily: 59,
        windowLimit: 12,
        dailyLimit: 60,
      };
    },
    fetchUserContextData: async () => ({
      profile: {
        full_name: 'Test User',
        daily_carbon_budget_kg: 12,
        sustainability_points: 0,
        sustainability_score: 50,
        level_title: 'Seedling Explorer',
        eco_streak_days: 0,
        preferred_unit: 'metric',
        electricity_region: 'global',
        custom_electricity_factor_kg: null,
      },
      records: [],
      achievements: [],
      challenges: [],
    }),
    callGemini: async () => ({ id: 'never', output_text: 'never' }),
  });

  const res = await handler(
    new Request('https://fn.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-user-jwt' },
      body: JSON.stringify({ prompt: 'How do I lower commute CO2?' }),
    })
  );

  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.code, 'AI_SERVICE_UNCONFIGURED');
  assert.equal(
    rateLimitChecks,
    0,
    'Unconfigured Edge Function must not consume user rate-limit quota'
  );
});
