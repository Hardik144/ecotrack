import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createBackendApp } from '../backend/app.mjs';

function dispatch(app, method, url, headers = {}, body = undefined) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );
    req.destroy = () => {};

    const chunks = [];
    let status = 200;
    let resHeaders = {};
    const res = {
      writeHead(s, h) {
        status = s;
        resHeaders = h ?? {};
      },
      end(chunk) {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
        resolve({ status, headers: resHeaders, buf, text, json });
      },
    };

    Promise.resolve(app.handleRequest(req, res)).catch(reject);

    process.nextTick(() => {
      if (body !== undefined) {
        const serialized = typeof body === 'string' ? body : JSON.stringify(body);
        req.emit('data', Buffer.from(serialized));
      }
      req.emit('end');
    });
  });
}

function getLocalDateKey(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `daily:${yyyy}-${mm}-${dd}`;
}

test('Node Backend E2E: Auth, Password Reset, Profile, Private Avatars, Emissions CRUD, Multi-User Isolation, Gamification & AI', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecotrack-node-test-'));
  let geminiConfiguredFlag = true;
  let callGeminiSpy = async () => ({
    id: 'int-node-1',
    status: 'completed',
    steps: [
      {
        type: 'model_output',
        content: [
          {
            type: 'text',
            text: 'Personalized advice: shifting 15 km from solo petrol car (2.47 kg) to bus (1.63 kg) saves 0.84 kg CO₂e.',
          },
        ],
      },
    ],
  });

  const app = createBackendApp({
    dbPath: path.join(tmpDir, 'ecotrack.db'),
    uploadsDir: path.join(tmpDir, 'uploads'),
    jwtSecret: 'integration-test-jwt-secret-0123456789abcdef',
    getGeminiApiKey: () =>
      geminiConfiguredFlag ? 'test-server-only-gemini-key' : '',
    geminiModel: 'gemini-4-hydrogen',
    nodeEnv: 'development',
    callGeminiImpl: (...args) => callGeminiSpy(...args),
  });

  try {
    // 1. Health & unauthenticated protection
    const health = await dispatch(app, 'GET', '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.json.ok, true);
    assert.equal(health.json.geminiConfigured, true);

    for (const protectedPath of [
      '/api/profile',
      '/api/emissions',
      '/api/challenges',
      '/api/leaderboard',
      '/api/assistant/history',
    ]) {
      const unauth = await dispatch(app, 'GET', protectedPath);
      assert.equal(unauth.status, 401, `Expected 401 for unauthenticated ${protectedPath}`);
    }

    // 2. Register User A & User B, duplicate rejection, wrong password rejection
    const regA = await dispatch(app, 'POST', '/api/auth/register', {}, {
      fullName: 'Maya Chen',
      email: 'maya@ecotrack.test',
      password: 'PasswordA123!',
    });
    assert.equal(regA.status, 201);
    const tokenA = regA.json.session.accessToken;
    assert.ok(tokenA);
    assert.equal(regA.json.profile.fullName, 'Maya Chen');

    const dupReg = await dispatch(app, 'POST', '/api/auth/register', {}, {
      fullName: 'Maya Clone',
      email: 'MAYA@ECOTRACK.TEST',
      password: 'PasswordA123!',
    });
    assert.equal(dupReg.status, 409);

    const badLogin = await dispatch(app, 'POST', '/api/auth/login', {}, {
      email: 'maya@ecotrack.test',
      password: 'WrongPassword!',
    });
    assert.equal(badLogin.status, 401);

    const regB = await dispatch(app, 'POST', '/api/auth/register', {}, {
      fullName: 'Liam Patel',
      email: 'liam@ecotrack.test',
      password: 'PasswordB123!',
    });
    assert.equal(regB.status, 201);
    const tokenB = regB.json.session.accessToken;

    const authA = { Authorization: `Bearer ${tokenA}` };
    const authB = { Authorization: `Bearer ${tokenB}` };

    // 3. Profile updates reject point tampering + handle private avatars securely
    const profilePatch = await dispatch(app, 'PATCH', '/api/profile', authA, {
      dailyCarbonBudgetKg: 15,
      electricityRegion: 'us-avg',
      preferredUnit: 'imperial',
      sustainability_points: 999999,
      ecoPoints: 999999,
    });
    assert.equal(profilePatch.status, 200);
    assert.equal(profilePatch.json.profile.dailyCarbonBudgetKg, 15);
    assert.equal(profilePatch.json.preferences.electricityRegion, 'us-avg');
    assert.equal(profilePatch.json.preferences.preferredUnit, 'imperial');
    assert.equal(profilePatch.json.profile.ecoPoints, 0);

    // 1x1 valid PNG pixel
    const tinyPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const uploadRes = await dispatch(app, 'POST', '/api/profile/avatar', authA, {
      base64: tinyPngBase64,
      mimeType: 'image/png',
    });
    assert.equal(uploadRes.status, 200);
    const signedAvatarPath = uploadRes.json.profile.avatarUrl;
    assert.ok(signedAvatarPath.startsWith('/api/avatars/'));

    const avatarFetchOk = await dispatch(app, 'GET', signedAvatarPath);
    assert.equal(avatarFetchOk.status, 200);
    assert.equal(avatarFetchOk.headers['Content-Type'], 'image/png');

    const avatarTampered = await dispatch(
      app,
      'GET',
      signedAvatarPath.replace(/sig=[^&]+/, 'sig=' + '0'.repeat(64))
    );
    assert.equal(avatarTampered.status, 403);

    const removeAvatar = await dispatch(app, 'PATCH', '/api/profile', authA, {
      avatarUrl: null,
    });
    assert.equal(removeAvatar.status, 200);
    assert.equal(removeAvatar.json.profile.avatarUrl, null);
    const avatarAfterDelete = await dispatch(app, 'GET', signedAvatarPath);
    assert.equal(avatarAfterDelete.status, 404);

    // 4. Password Reset end-to-end flow (forgot -> verify code -> update password -> new login)
    const forgotRes = await dispatch(app, 'POST', '/api/auth/forgot-password', {}, {
      email: 'maya@ecotrack.test',
    });
    assert.equal(forgotRes.status, 200);
    const code = forgotRes.json.recoveryCode;
    assert.ok(code && code.length >= 6);

    const verifyRes = await dispatch(app, 'POST', '/api/auth/verify-recovery', {}, {
      code,
    });
    assert.equal(verifyRes.status, 200);
    const recoveryToken = verifyRes.json.session.accessToken;

    const resetRes = await dispatch(
      app,
      'POST',
      '/api/auth/update-password',
      { Authorization: `Bearer ${recoveryToken}` },
      { newPassword: 'NewMayaPassword99!' }
    );
    assert.equal(resetRes.status, 200);

    const oldPassLogin = await dispatch(app, 'POST', '/api/auth/login', {}, {
      email: 'maya@ecotrack.test',
      password: 'PasswordA123!',
    });
    assert.equal(oldPassLogin.status, 401);

    const newPassLogin = await dispatch(app, 'POST', '/api/auth/login', {}, {
      email: 'maya@ecotrack.test',
      password: 'NewMayaPassword99!',
    });
    assert.equal(newPassLogin.status, 200);

    // 5. Carbon Emissions CRUD + zero points for raw logs + strict user isolation
    const createEm = await dispatch(app, 'POST', '/api/emissions', authA, {
      items: [
        {
          title: 'Petrol Car Commute',
          category: 'transport',
          direction: 'emission',
          quantity: 10,
          unitLabel: 'km',
          emissionFactorKg: 0.1645,
          emissionsKg: 1.645,
          methodologySource: 'UK DESNZ 2024',
        },
      ],
    });
    assert.equal(createEm.status, 201);
    const recId = createEm.json.items[0].id;
    assert.equal(createEm.json.items[0].emissions_kg, 1.645);

    const profAfterLog = await dispatch(app, 'GET', '/api/profile', authA);
    assert.equal(profAfterLog.json.profile.ecoPoints, 0);

    // User B cannot see, update, or delete User A's emission record
    const listB = await dispatch(app, 'GET', '/api/emissions', authB);
    assert.equal(listB.json.items.length, 0);
    const patchB = await dispatch(app, 'PATCH', `/api/emissions/${recId}`, authB, {
      title: 'Hijacked',
      category: 'transport',
      direction: 'emission',
      quantity: 1,
      unitLabel: 'km',
      emissionFactorKg: 0.1,
      emissionsKg: 0.1,
    });
    assert.equal(patchB.status, 404);
    const delB = await dispatch(app, 'DELETE', `/api/emissions/${recId}`, authB);
    assert.equal(delB.status, 404);

    // User A edits and deletes cleanly
    const patchA = await dispatch(app, 'PATCH', `/api/emissions/${recId}`, authA, {
      title: 'Car Commute Updated',
      category: 'transport',
      direction: 'emission',
      quantity: 12,
      unitLabel: 'km',
      emissionFactorKg: 0.1645,
      emissionsKg: 1.974,
    });
    assert.equal(patchA.status, 200);
    assert.equal(patchA.json.item.title, 'Car Commute Updated');

    // 6. Challenges, Badges, Rewards & Opt-In Leaderboard
    const chalList = await dispatch(app, 'GET', '/api/challenges', authA);
    assert.equal(chalList.status, 200);
    assert.equal(chalList.json.catalog.length, 10);

    const dailyPlastic = chalList.json.catalog.find(
      (c) => c.slug === 'avoid-single-use-plastic'
    );
    const periodKey = getLocalDateKey();
    const act1 = await dispatch(
      app,
      'POST',
      `/api/challenges/${dailyPlastic.id}/action`,
      authA,
      { mode: 'increment', periodKey }
    );
    assert.equal(act1.status, 200);
    assert.equal(act1.json.newlyCompleted, true);
    assert.equal(act1.json.totalPoints, 55); // 30 challenge + 25 First Green Step

    const dupAct = await dispatch(
      app,
      'POST',
      `/api/challenges/${dailyPlastic.id}/action`,
      authA,
      { mode: 'increment', periodKey }
    );
    assert.equal(dupAct.json.duplicateBlocked, true);
    assert.equal(dupAct.json.pointsAwarded, 0);

    const rewardsA = await dispatch(app, 'GET', '/api/rewards', authA);
    assert.equal(rewardsA.status, 200);
    assert.equal(rewardsA.json.entries.length, 2);

    const lb1 = await dispatch(app, 'GET', '/api/leaderboard', authB);
    assert.equal(lb1.status, 200);
    assert.equal(lb1.json.entries.length, 2);
    assert.equal(lb1.json.entries[0].displayName, 'Maya C.');
    assert.equal(lb1.json.entries[0].sustainabilityPoints, 55);

    // Maya opts out of leaderboard -> hidden immediately
    await dispatch(app, 'PATCH', '/api/profile', authA, { leaderboardOptIn: false });
    const lb2 = await dispatch(app, 'GET', '/api/leaderboard', authB);
    assert.equal(lb2.json.entries.length, 1);
    assert.equal(lb2.json.entries[0].displayName, 'Liam P.');

    // 7. AI Sustainability Assistant unconfigured 503 + chat + persist + delete
    geminiConfiguredFlag = false;
    const aiUnconf = await dispatch(app, 'POST', '/api/assistant/chat', authA, {
      prompt: 'How much CO2e is 15 km by car vs bus?',
    });
    assert.equal(aiUnconf.status, 503);
    assert.equal(aiUnconf.json.code, 'AI_SERVICE_UNCONFIGURED');

    geminiConfiguredFlag = true;
    const aiChat = await dispatch(app, 'POST', '/api/assistant/chat', authA, {
      prompt: 'How can I lower my commute emissions?',
      localDateKey: '2026-11-16',
    });
    assert.equal(aiChat.status, 200);
    assert.equal(aiChat.json.message?.sender, 'assistant');
    assert.ok(aiChat.json.message?.text?.includes('0.84 kg'));

    const histA = await dispatch(app, 'GET', '/api/assistant/history', authA);
    assert.equal(histA.json.messages.length, 2);
    const histB = await dispatch(app, 'GET', '/api/assistant/history', authB);
    assert.equal(histB.json.messages.length, 0);

    const clearA = await dispatch(app, 'DELETE', '/api/assistant/history', authA);
    assert.equal(clearA.status, 200);
    const histAAfter = await dispatch(app, 'GET', '/api/assistant/history', authA);
    assert.equal(histAAfter.json.messages.length, 0);
  } finally {
    app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
