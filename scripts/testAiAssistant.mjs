import assert from 'node:assert/strict';
import fs from 'node:fs';
import module from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

// Allow Node 24's built-in TypeScript stripper to resolve extensionless local TS imports
// and stub Expo native runtime dependencies such as expo-linking during unit tests.
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

const envUtils = await import('../src/utils/env.ts');
const clientFactors = await import('../src/constants/emissionFactors.ts');
const clientCalc = await import('../src/utils/carbonCalculator.ts');
const suggestionUtils = await import('../src/utils/assistantSuggestions.ts');

const edgeFactors = await import('../backend/ai/factors.ts');
const edgeTools = await import('../backend/ai/tools.ts');
const edgePersonalization = await import('../backend/ai/personalization.ts');
const edgeHandler = await import('../backend/ai/handler.ts');

const ENV_BACKUP = { ...process.env };

function resetTestEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ENV_BACKUP)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ENV_BACKUP);
  delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  delete process.env.EXPO_PUBLIC_AI_ASSISTANT_URL;
  delete process.env.EXPO_PUBLIC_API_URL;
}

const SAMPLE_PROFILE = {
  full_name: 'Aarav Patel',
  daily_carbon_budget_kg: 12,
  sustainability_points: 185,
  sustainability_score: 76,
  level_title: 'Carbon Tracker',
  eco_streak_days: 5,
  preferred_unit: 'metric',
  electricity_region: 'us-avg',
  custom_electricity_factor_kg: null,
};

const TODAY_ISO = '2026-11-15T09:30:00.000Z';

const SAMPLE_RECORDS = [
  {
    id: 'rec-1',
    title: 'Petrol Car Commute',
    category: 'transport',
    direction: 'emission',
    quantity: 20,
    unit_label: 'km',
    emissions_kg: 3.41,
    emission_factor_kg: 0.1705,
    region_code: null,
    methodology_source: 'UK DESNZ / DEFRA 2024',
    recorded_at: TODAY_ISO,
  },
  {
    id: 'rec-2',
    title: 'Home Electricity Usage',
    category: 'electricity',
    direction: 'emission',
    quantity: 12,
    unit_label: 'kWh',
    emissions_kg: 4.63,
    emission_factor_kg: 0.386,
    region_code: 'us',
    methodology_source: 'US EPA eGRID2023',
    recorded_at: TODAY_ISO,
  },
  {
    id: 'rec-3',
    title: 'Beef Dinner',
    category: 'food',
    direction: 'emission',
    quantity: 1,
    unit_label: 'meal',
    emissions_kg: 6.45,
    emission_factor_kg: 6.45,
    region_code: null,
    methodology_source: 'Scarborough et al. (2023)',
    recorded_at: '2026-11-14T18:00:00.000Z',
  },
  {
    id: 'rec-4',
    title: 'Aluminum Recycling Offset',
    category: 'lifestyle',
    direction: 'offset',
    quantity: 1,
    unit_label: 'kg',
    emissions_kg: 9.1,
    emission_factor_kg: 9.1,
    region_code: null,
    methodology_source: 'US EPA WARM v16',
    recorded_at: '2026-11-14T12:00:00.000Z',
  },
];

const SAMPLE_ACHIEVEMENTS = [
  {
    badge_key: 'first_log',
    title: 'First Step',
    description: 'Logged your first carbon activity',
    requirement_label: 'Log 1 entry',
    earned: true,
  },
  {
    badge_key: 'zero_waste',
    title: 'Circular Champion',
    description: 'Log 5 recycling or compost actions',
    requirement_label: '5 recycling logs',
    earned: false,
  },
];

const SAMPLE_CHALLENGES = [
  {
    title: 'Transit Week',
    category: 'transport',
    co2_savings_kg: 8.5,
    progress: 3,
    target_count: 5,
    unit_label: 'trips',
    status: 'joined',
  },
  {
    title: 'Meatless Mondays',
    category: 'food',
    co2_savings_kg: 4.0,
    progress: 4,
    target_count: 4,
    unit_label: 'meals',
    status: 'completed',
  },
];

test('Security Env Guards block exposed frontend Gemini & server secret keys', () => {
  try {
    resetTestEnv();
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3001';

    assert.equal(envUtils.hasExposedGeminiApiKeyInEnv(), false);
    assert.equal(envUtils.isBackendConfigured(), true);
    assert.equal(envUtils.isGeminiConfigured(), true);
    assert.equal(envUtils.getAiBackendConfigError(), null);

    // Legacy EXPO_PUBLIC_GEMINI_API_KEY must always trigger a violation
    process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'AIzaSyFakeExposedClientSecretKey12345';
    assert.equal(envUtils.hasExposedGeminiApiKeyInEnv(), true);
    assert.equal(envUtils.isGeminiConfigured(), false);
    assert.match(envUtils.getAiBackendConfigError() ?? '', /Security violation/i);
    delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    // Invalid untrusted plain HTTP remote host must be rejected
    process.env.EXPO_PUBLIC_AI_ASSISTANT_URL = 'http://insecure.example.com/ai';
    assert.equal(envUtils.isGeminiConfigured(), false);
    assert.match(envUtils.getAiBackendConfigError() ?? '', /HTTP\(S\)/i);

    // Valid HTTPS AI proxy URL works cleanly
    process.env.EXPO_PUBLIC_AI_ASSISTANT_URL = 'https://proxy.ecotrack.example/ai';
    assert.equal(envUtils.isGeminiConfigured(), true);

    // Server secret detection rejects leaked keys
    assert.equal(
      envUtils.isServiceRoleOrSecretKey('sb_secret_not_allowed_in_client'),
      true
    );
    assert.equal(
      envUtils.isServiceRoleOrSecretKey('AIzaSyNotAllowedInClient123456'),
      true
    );
  } finally {
    resetTestEnv();
  }
});

test('Edge calculation tools match frontend deterministic factors & calculator engine identically', () => {
  const ctx = {
    defaultRegion: 'us-avg',
    defaultCustomGridFactorKg: null,
    preferredUnit: 'metric',
    dailyBudgetKg: 12,
    records: SAMPLE_RECORDS,
    completedChallengesCount: 1,
    profileBaselineScore: 76,
    localDateKey: '2026-11-15',
  };

  // 1. Transport comparison: 15 km petrol car vs city bus
  const clientCar = clientCalc.calculateTransportFootprint({
    mode: 'car',
    distance: 15,
    distanceUnit: 'km',
    carFuel: 'petrol',
    passengers: 1,
  });
  const clientBus = clientCalc.calculateTransportFootprint({
    mode: 'bus',
    distance: 15,
    distanceUnit: 'km',
    busType: 'city',
  });
  const toolTransport = edgeTools.executeEcoToolCall(
    'calculate_transport_comparison',
    {
      mode: 'car',
      car_fuel: 'petrol',
      distance: 15,
      compare_mode: 'bus',
      compare_bus_type: 'city',
    },
    ctx
  );
  assert.equal(toolTransport.isError, false);
  assert.equal(toolTransport.result.primary.emissionsKg, clientCar.data.emissionsKg);
  assert.equal(
    toolTransport.result.comparison.alternativeKg,
    clientBus.data.emissionsKg
  );
  assert.equal(
    toolTransport.savingsKg,
    Number((clientCar.data.emissionsKg - clientBus.data.emissionsKg).toFixed(2))
  );

  // 2. Electricity footprint + 20% reduction plan (US-avg grid, 2 household members, 300 kWh total -> 150 kWh/person)
  const clientElec = clientCalc.calculateElectricityFootprint({
    monthlyKwh: 300,
    periodBasis: 'monthly',
    householdMembers: 2,
    regionCode: 'us-avg',
    mode: 'grid',
  });
  assert.equal(clientElec.ok, true);
  const toolElec = edgeTools.executeEcoToolCall(
    'calculate_electricity_impact',
    {
      kwh: 300,
      region_code: 'us-avg',
      period_basis: 'monthly',
      household_members: 2,
      reduction_percent: 20,
    },
    ctx
  );
  assert.equal(toolElec.isError, false);
  assert.equal(toolElec.result.emissionsKg, clientElec.data.emissionsKg);
  assert.equal(
    toolElec.result.factorKgPerKwh,
    clientFactors.ELECTRICITY_REGION_MAP['us-avg'].factorKgPerKwh
  );
  // 20% of 150 kWh = 30 kWh * 0.341 = 10.23 kg
  assert.equal(toolElec.savingsKg, 10.23);

  // 3. Food comparison: 2 beef dinners vs 2 vegan meals
  assert.equal(
    edgeFactors.NON_VEGETARIAN_MEAL_FACTORS.beef.factorKgPerUnit,
    clientFactors.NON_VEGETARIAN_MEAL_FACTORS.beef.factorKgPerUnit
  );
  const toolFood = edgeTools.executeEcoToolCall(
    'calculate_food_comparison',
    {
      meal_type: 'beef',
      compare_meal_type: 'vegan',
      meal_count: 2,
    },
    ctx
  );
  const expectedMealSavings = Number(
    (
      2 * clientFactors.NON_VEGETARIAN_MEAL_FACTORS.beef.factorKgPerUnit -
      2 * clientFactors.VEGETARIAN_MEAL_FACTORS.vegan.factorKgPerUnit
    ).toFixed(2)
  );
  assert.equal(toolFood.isError, false);
  assert.equal(toolFood.result.swapSavingsKg, expectedMealSavings);
  assert.equal(toolFood.savingsKg, expectedMealSavings);

  // 4. Lifestyle: 60 L electric hot water on US-avg grid + 3 kg aluminum recycling
  const clientLifestyle = clientCalc.calculateLifestyleFootprint({
    waterAmount: 60,
    waterUnit: 'L',
    waterHeaterType: 'hot-electric',
    recyclingAmount: 3,
    recyclingUnit: 'kg',
    recyclingMaterial: 'aluminum',
    electricityRegion: 'us-avg',
  });
  assert.equal(clientLifestyle.ok, true);
  const toolLifestyle = edgeTools.executeEcoToolCall(
    'calculate_lifestyle_impact',
    {
      water_liters: 60,
      water_heater_type: 'hot-electric',
      recycling_kg: 3,
      recycling_material: 'aluminum',
    },
    ctx
  );
  assert.equal(toolLifestyle.isError, false);
  assert.equal(
    toolLifestyle.result.water.emissionsKg,
    clientLifestyle.data.totalEmissionsKg
  );
  assert.equal(
    toolLifestyle.result.recycling.avoidedKg,
    clientLifestyle.data.totalOffsetsKg
  );

  // 5. Analytics & reduction plan simulation grounded in logged SAMPLE_RECORDS
  const analyticsTool = edgeTools.executeEcoToolCall(
    'get_user_footprint_analytics',
    { range_preset: '30d', category: 'all' },
    ctx
  );
  assert.equal(analyticsTool.isError, false);
  assert.equal(analyticsTool.result.recordCount, 4);
  assert.equal(analyticsTool.result.grossKg, 14.49);
  assert.equal(analyticsTool.result.avoidedKg, 9.1);
  assert.equal(analyticsTool.result.netKg, 5.39);
  assert.equal(analyticsTool.result.highestCategory, 'food');

  const planTool = edgeTools.executeEcoToolCall(
    'simulate_reduction_plan',
    { category: 'all', reduction_percent: 20, timeframe: '30d' },
    ctx
  );
  assert.equal(planTool.isError, false);
  assert.equal(planTool.result.targetReductionKg, 2.9); // 20% of 14.49 = 2.898 -> 2.90
});

test('Edge Function handler enforces auth, validation, rate limits, and error redaction', async () => {
  let geminiCallCount = 0;

  const baseDeps = {
    getGeminiApiKey: () => 'AIzaSyValidBackendOnlySecretKey0000',
    authenticateUser: async (authHeader) =>
      authHeader === 'Bearer valid-user-jwt' ? { userId: 'user-123' } : null,
    checkAndRecordRateLimit: async () => ({
      allowed: true,
      retryAfterSeconds: 0,
      remainingWindow: 11,
      remainingDaily: 59,
      windowLimit: 12,
      dailyLimit: 60,
    }),
    fetchUserContextData: async () => ({
      profile: SAMPLE_PROFILE,
      records: SAMPLE_RECORDS,
      achievements: SAMPLE_ACHIEVEMENTS,
      challenges: SAMPLE_CHALLENGES,
    }),
    callGemini: async () => {
      geminiCallCount += 1;
      return { id: 'int-1', output_text: 'Ok' };
    },
  };

  // CORS preflight
  const corsRes = await edgeHandler.createAssistantHandler(baseDeps)(
    new Request('https://fn.test', { method: 'OPTIONS' })
  );
  assert.equal(corsRes.status, 204);

  // Method check
  const getRes = await edgeHandler.createAssistantHandler(baseDeps)(
    new Request('https://fn.test', { method: 'GET' })
  );
  assert.equal(getRes.status, 405);

  // Missing Authorization -> 401
  const noAuthRes = await edgeHandler.createAssistantHandler(baseDeps)(
    new Request('https://fn.test', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Hello' }),
    })
  );
  assert.equal(noAuthRes.status, 401);

  // Invalid JWT -> 401
  const badAuthRes = await edgeHandler.createAssistantHandler(baseDeps)(
    new Request('https://fn.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer expired-jwt' },
      body: JSON.stringify({ prompt: 'Hello' }),
    })
  );
  assert.equal(badAuthRes.status, 401);

  // Empty prompt -> 400
  const emptyRes = await edgeHandler.createAssistantHandler(baseDeps)(
    new Request('https://fn.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-user-jwt' },
      body: JSON.stringify({ prompt: '   ' }),
    })
  );
  assert.equal(emptyRes.status, 400);

  // Oversized prompt (>1000 chars) -> 400
  const longRes = await edgeHandler.createAssistantHandler(baseDeps)(
    new Request('https://fn.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-user-jwt' },
      body: JSON.stringify({ prompt: 'x'.repeat(1001) }),
    })
  );
  assert.equal(longRes.status, 400);

  // Rate limited -> 429 & Retry-After header; Gemini must NOT be called
  geminiCallCount = 0;
  const rateLimitedHandler = edgeHandler.createAssistantHandler({
    ...baseDeps,
    checkAndRecordRateLimit: async () => ({
      allowed: false,
      retryAfterSeconds: 45,
      remainingWindow: 0,
      remainingDaily: 48,
      windowLimit: 12,
      dailyLimit: 60,
    }),
  });
  const limitRes = await rateLimitedHandler(
    new Request('https://fn.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-user-jwt' },
      body: JSON.stringify({ prompt: 'Analyze my emissions' }),
    })
  );
  assert.equal(limitRes.status, 429);
  assert.equal(limitRes.headers.get('Retry-After'), '45');
  const limitJson = await limitRes.json();
  assert.equal(limitJson.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(limitJson.retryAfterSeconds, 45);
  assert.equal(geminiCallCount, 0);

  // Unconfigured server Gemini secret -> 503
  const noSecretHandler = edgeHandler.createAssistantHandler({
    ...baseDeps,
    getGeminiApiKey: () => 'your-gemini-api-key',
  });
  const unconfiguredRes = await noSecretHandler(
    new Request('https://fn.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-user-jwt' },
      body: JSON.stringify({ prompt: 'Explain CO2e' }),
    })
  );
  assert.equal(unconfiguredRes.status, 503);

  // Secret redaction when upstream error includes API key / Bearer token
  const leakHandler = edgeHandler.createAssistantHandler({
    ...baseDeps,
    callGemini: async () => {
      throw new Error(
        'Upstream HTTP 500 with key=AIzaSySensitiveLeak1234567890 and Bearer topsecret.jwt.token'
      );
    },
  });
  const leakRes = await leakHandler(
    new Request('https://fn.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-user-jwt' },
      body: JSON.stringify({ prompt: 'Explain CO2e' }),
    })
  );
  assert.equal(leakRes.status, 502);
  const leakJson = await leakRes.json();
  assert.equal(leakJson.detail.includes('AIzaSySensitiveLeak'), false);
  assert.equal(leakJson.detail.includes('topsecret.jwt.token'), false);
  assert.match(leakJson.detail, /\[REDACTED_API_KEY\]/);
  assert.match(leakJson.detail, /Bearer \[REDACTED\]/);
});

test('End-to-end personalized multi-turn Gemini tool scenarios cover all 8 capabilities & empty-log fallback', async () => {
  const capturedCalls = [];
  const persistedTurns = [];

  const createScenarioHandler = (scenarioFn, contextData) =>
    edgeHandler.createAssistantHandler({
      getGeminiApiKey: () => 'AIzaSyValidBackendOnlySecretKey0000',
      authenticateUser: async () => ({ userId: 'user-123' }),
      checkAndRecordRateLimit: async () => ({
        allowed: true,
        retryAfterSeconds: 0,
        remainingWindow: 10,
        remainingDaily: 58,
        windowLimit: 12,
        dailyLimit: 60,
      }),
      fetchUserContextData: async () => contextData,
      persistChatTurn: async (_auth, turn) => {
        persistedTurns.push(turn);
        return { assistantMessageId: `db-msg-${persistedTurns.length}` };
      },
      callGemini: async (_apiKey, params) => {
        capturedCalls.push(params);
        return scenarioFn(params);
      },
    });

  // Scenario 1: Transport comparison + activity analysis via multi-step Gemini Interactions loop
  let round = 0;
  const transportHandler = createScenarioHandler(
    (params) => {
      round += 1;
      if (round === 1) {
        assert.equal(params.model, 'gemini-4-hydrogen');
        assert.equal(params.store, false);
        assert.equal(params.generation_config.max_output_tokens, 900);
        // Verify personalization dossier injected into system_instruction
        assert.match(params.system_instruction, /Aarav/);
        assert.match(params.system_instruction, /United States Average/);
        assert.match(params.system_instruction, /Transit Week/);
        assert.match(params.system_instruction, /NEVER invent, estimate in your head, or fabricate/);

        return {
          id: 'int-round-1',
          steps: [
            {
              type: 'function_call',
              call_id: 'call_analytics_1',
              name: 'get_user_footprint_analytics',
              arguments: { range_preset: '30d', category: 'all' },
            },
            {
              type: 'function_call',
              call_id: 'call_transport_1',
              name: 'calculate_transport_comparison',
              arguments: {
                mode: 'car',
                car_fuel: 'petrol',
                distance: 15,
                compare_mode: 'bus',
                compare_bus_type: 'city',
              },
            },
          ],
        };
      }

      // Second round receives deterministic function_result payloads in conversationSteps
      const fnResults = params.input.filter((step) => step.type === 'function_result');
      assert.equal(fnResults.length, 2);
      const transportResult = JSON.parse(String(fnResults[1].result));
      assert.equal(transportResult.comparison.savingsKg, 0.84);

      return {
        id: 'int-round-2',
        output_text:
          'Your logged food (6.45 kg CO2e) and electricity (4.63 kg CO2e) lead your recent emissions, alongside your 20 km petrol commute (3.41 kg CO2e). Switching a 15 km petrol commute to a city bus cuts 0.84 kg CO2e per trip.',
      };
    },
    {
      profile: SAMPLE_PROFILE,
      records: SAMPLE_RECORDS,
      achievements: SAMPLE_ACHIEVEMENTS,
      challenges: SAMPLE_CHALLENGES,
    }
  );

  const res1 = await transportHandler(
    new Request('https://fn.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-user-jwt' },
      body: JSON.stringify({
        prompt: 'Analyze my emissions and compare a 15 km petrol car commute vs city bus',
        localDateKey: '2026-11-15',
        timezone: 'America/New_York',
      }),
    })
  );
  assert.equal(res1.status, 200);
  const body1 = await res1.json();
  assert.equal(body1.message.id, 'db-msg-1');
  assert.equal(body1.message.actionTag, 'Transport Comparison');
  assert.equal(body1.message.estimatedSavingsKg, 0.84);
  assert.ok(body1.message.calculations.length >= 3);
  assert.equal(body1.dossierSummary.totalRecords, 4);
  assert.equal(body1.dossierSummary.topCategory, 'food');
  assert.equal(persistedTurns.length, 1);
  assert.equal(persistedTurns[0].calculations.length, body1.message.calculations.length);

  // Scenario 2: Sustainability concept explanation (zero tool calls needed, single round)
  const conceptHandler = createScenarioHandler(
    () => ({
      id: 'int-concept',
      steps: [
        {
          type: 'model_output',
          content: [
            {
              type: 'text',
              text: 'CO2e expresses every greenhouse gas (CO2, methane CH4, nitrous oxide N2O) by its 100-year global warming equivalent in kilograms of carbon dioxide.',
            },
          ],
        },
      ],
    }),
    {
      profile: SAMPLE_PROFILE,
      records: SAMPLE_RECORDS,
      achievements: SAMPLE_ACHIEVEMENTS,
      challenges: SAMPLE_CHALLENGES,
    }
  );

  const res2 = await conceptHandler(
    new Request('https://fn.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-user-jwt' },
      body: JSON.stringify({
        prompt: 'Explain what kg CO2e and global warming potential mean',
        localDateKey: '2026-11-15',
      }),
    })
  );
  assert.equal(res2.status, 200);
  const body2 = await res2.json();
  assert.equal(body2.message.actionTag, 'Concept Guide');
  assert.deepEqual(body2.message.calculations, []);
  assert.match(body2.message.text, /global warming/i);

  // Scenario 3: Food & Electricity optimization multi-tool round trip
  let planRound = 0;
  const dietElecHandler = createScenarioHandler(
    (params) => {
      planRound += 1;
      if (planRound === 1) {
        return {
          id: 'int-diet-1',
          steps: [
            {
              type: 'function_call',
              call_id: 'call_food_1',
              name: 'calculate_food_comparison',
              arguments: { meal_type: 'beef', compare_meal_type: 'vegan', meal_count: 2 },
            },
            {
              type: 'function_call',
              call_id: 'call_elec_1',
              name: 'calculate_electricity_impact',
              arguments: { kwh: 200, region_code: 'us-avg', reduction_percent: 25 },
            },
          ],
        };
      }
      const fnResults = params.input.filter((s) => s.type === 'function_result');
      assert.equal(fnResults.length, 2);
      return {
        id: 'int-diet-2',
        output_text:
          'Swapping 2 beef meals to vegan saves significant CO2e, and cutting 25% off 200 kWh/month on the US grid avoids 17.05 kg CO2e.',
      };
    },
    {
      profile: SAMPLE_PROFILE,
      records: SAMPLE_RECORDS,
      achievements: SAMPLE_ACHIEVEMENTS,
      challenges: SAMPLE_CHALLENGES,
    }
  );

  const resPlan = await dietElecHandler(
    new Request('https://fn.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-user-jwt' },
      body: JSON.stringify({
        prompt: 'How can I lower my food and electricity emissions this month?',
        localDateKey: '2026-11-15',
      }),
    })
  );
  assert.equal(resPlan.status, 200);
  const bodyPlan = await resPlan.json();
  assert.equal(bodyPlan.message.actionTag, 'Electricity Strategy');
  assert.ok(bodyPlan.message.calculations.length >= 4);
  assert.equal(bodyPlan.message.estimatedSavingsKg, 17.05);

  // Scenario 4: New user with zero activity records still receives tailored guidance & tool-backed recycling calculation
  let emptyRound = 0;
  const newUserHandler = createScenarioHandler(
    (params) => {
      emptyRound += 1;
      if (emptyRound === 1) {
        assert.match(params.system_instruction, /0 carbon emission records logged so far/i);
        return {
          id: 'int-empty-1',
          steps: [
            {
              type: 'function_call',
              call_id: 'call_rec_1',
              name: 'calculate_lifestyle_impact',
              arguments: { recycling_kg: 2, recycling_material: 'aluminum' },
            },
          ],
        };
      }
      return {
        id: 'int-empty-2',
        output_text:
          'You have no logged carbon records yet. Recycling 2 kg of aluminum avoids 18.20 kg CO2e using EPA WARM v16 baselines.',
      };
    },
    {
      profile: {
        ...SAMPLE_PROFILE,
        full_name: 'Maya Lin',
        electricity_region: 'in',
        sustainability_score: 50,
      },
      records: [],
      achievements: SAMPLE_ACHIEVEMENTS.map((a) => ({ ...a, earned: false })),
      challenges: [],
    }
  );

  const res3 = await newUserHandler(
    new Request('https://fn.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-user-jwt' },
      body: JSON.stringify({
        prompt: 'How much CO2e does recycling 2 kg of aluminum avoid?',
        localDateKey: '2026-11-15',
      }),
    })
  );
  assert.equal(res3.status, 200);
  const body3 = await res3.json();
  const expectedAluminumAvoided = Number(
    (2 * clientFactors.RECYCLING_MATERIAL_FACTORS.aluminum.factorKgPerUnit).toFixed(2)
  );
  assert.equal(body3.dossierSummary.totalRecords, 0);
  assert.equal(body3.message.estimatedSavingsKg, expectedAluminumAvoided);
  assert.equal(body3.message.calculations[0].direction, 'offset');
  assert.equal(body3.message.calculations[0].resultKg, expectedAluminumAvoided);

  // 5 base rounds across Scenarios 1-4 (2 + 1 + 2 + 2)
  assert.equal(capturedCalls.length, 7);
});

test('Client personalization helper produces grounded dossier summaries & contextual prompts', () => {
  const dossierSummary = edgePersonalization.buildPersonalizationDossier({
    profile: SAMPLE_PROFILE,
    records: SAMPLE_RECORDS,
    achievements: SAMPLE_ACHIEVEMENTS,
    challenges: SAMPLE_CHALLENGES,
    localDateKey: '2026-11-15',
    timezone: 'America/New_York',
  });

  const analyticsSnapshot = {
    rangePreset: 'all',
    rangeLabel: 'All Time',
    dailyGrossKg: 8.04,
    dailyAvoidedKg: 0,
    dailyNetKg: 8.04,
    weeklyGrossKg: 14.49,
    weeklyAvoidedKg: 9.1,
    weeklyNetKg: 5.39,
    monthlyGrossKg: 14.49,
    monthlyAvoidedKg: 9.1,
    monthlyNetKg: 5.39,
    previousWeekNetKg: 0,
    previousMonthNetKg: 0,
    totalRecordsCount: 4,
    filteredRecordsCount: 4,
    highestEmissionCategory: {
      category: 'food',
      grossKg: 6.45,
      avoidedKg: 0,
      sharePercent: 45,
      recordCount: 1,
    },
    categoryBreakdown: [],
    sustainabilityScore: {
      score: dossierSummary.sustainabilityScore,
      budgetAdherenceScore: 80,
      avoidanceScore: 70,
      consistencyScore: 50,
      challengeBonus: 5,
      activeDays30d: 2,
      daysWithinBudget30d: 2,
    },
    transportVsElectricity: {
      transportGrossKg: 3.41,
      transportAvoidedKg: 0,
      electricityGrossKg: 4.63,
      electricityAvoidedKg: 0,
      electricityAvgDailyKg: 0.66,
      electricitySharePercent: 58,
      transportSharePercent: 42,
    },
  };

  const clientContext = suggestionUtils.buildAssistantContextSummary({
    activities: [
      { id: '1' },
      { id: '2' },
      { id: '3' },
      { id: '4' },
    ],
    dashboardAnalytics: analyticsSnapshot,
    badges: [
      { id: 'b1', title: 'First Step', description: '', icon: 'leaf', earned: true, requirementLabel: '' },
      { id: 'b2', title: 'Circular Champion', description: '', icon: 'leaf', earned: false, requirementLabel: '' },
    ],
    challenges: [
      {
        id: 'c1',
        title: 'Transit Week',
        description: '',
        category: 'transport',
        co2SavingsKg: 8.5,
        progress: 3,
        target: 5,
        unitLabel: 'trips',
        joined: true,
        completed: false,
      },
    ],
    preferences: {
      notificationsEnabled: true,
      weeklyDigestEnabled: true,
      preferredUnit: 'metric',
      electricityRegion: 'us-avg',
      customElectricityFactorKg: null,
    },
  });

  assert.equal(clientContext.totalRecords, 4);
  assert.equal(clientContext.topCategory, 'food');
  assert.equal(clientContext.earnedBadgesCount, 1);
  assert.equal(clientContext.activeChallengesCount, 1);
  assert.equal(clientContext.regionShortLabel, 'USA Avg');

  const suggestions = suggestionUtils.buildAssistantSuggestions({
    activities: [{ id: '1' }],
    dashboardAnalytics: analyticsSnapshot,
    badges: [
      { id: 'b2', title: 'Circular Champion', description: '', icon: 'leaf', earned: false, requirementLabel: '' },
    ],
    preferences: {
      notificationsEnabled: true,
      weeklyDigestEnabled: true,
      preferredUnit: 'metric',
      electricityRegion: 'us-avg',
      customElectricityFactorKg: null,
    },
  });

  assert.ok(suggestions.some((q) => /beef|plant-based/i.test(q)));
  assert.ok(suggestions.some((q) => /Circular Champion/i.test(q)));
  assert.ok(suggestions.some((q) => /USA Avg/i.test(q)));
});
