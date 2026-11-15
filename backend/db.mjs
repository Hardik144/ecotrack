import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function deterministicUuid(seedKey) {
  const hex = crypto.createHash('sha256').update(seedKey).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

export const SYSTEM_ACTIVITIES_SEED = [
  // Transportation (UK DESNZ 2024 Conversion Factors)
  ['car-petrol', 'Petrol Car Drive', 'transport', 'emission', 0.1645, 'km', 12, 'UK DESNZ 2024 average solo passenger petrol car'],
  ['motorcycle-avg', 'Motorcycle Ride', 'transport', 'emission', 0.1137, 'km', 10, 'UK DESNZ 2024 average petrol motorcycle'],
  ['city-bus', 'City Bus', 'transport', 'emission', 0.1085, 'km', 15, 'UK DESNZ 2024 average local passenger bus'],
  ['rail-national', 'Commuter / National Train', 'transport', 'emission', 0.0355, 'km', 20, 'UK DESNZ 2024 national rail per passenger-km'],
  ['air-short-econ', 'Flight (Short-Haul Economy)', 'transport', 'emission', 0.1258, 'km', 500, 'UK DESNZ 2024 short-haul economy with radiative forcing'],
  ['ev-ride', 'Electric Vehicle', 'transport', 'emission', 0.0801, 'km', 18, 'EV efficiency (0.18 kWh/km) x IEA global grid'],
  ['bike-walk', 'Bicycle / Walk Swap', 'transport', 'offset', 0.1645, 'km', 5, 'Avoided solo petrol car emissions per km'],
  // Electricity (IEA / EPA eGRID2024 / CEA / DESNZ)
  ['grid-kwh', 'Home Grid Electricity', 'electricity', 'emission', 0.445, 'kWh', 8, 'IEA global grid baseline (configurable by region)'],
  ['solar-offset', 'Solar / Green Power', 'electricity', 'offset', 0.445, 'kWh', 6, 'Clean rooftop or renewable tariff offset'],
  // Food (Poore & Nemecek 2018 / Scarborough et al. 2023 / EPA WARM v16)
  ['beef-meal', 'Beef / Red Meat Meal', 'food', 'emission', 6.2, 'meals', 1, 'Poore & Nemecek (2018) beef protein portion + sides'],
  ['poultry-meal', 'Poultry or Fish Meal', 'food', 'emission', 2.1, 'meals', 1, 'Poore & Nemecek (2018) poultry/fish portion + sides'],
  ['vegetarian-meal', 'Vegetarian Meal', 'food', 'emission', 1.25, 'meals', 1, 'Dairy/egg inclusive vegetarian dish (~500 g)'],
  ['plant-based-swap', 'Plant-Based Meal', 'food', 'emission', 0.82, 'meals', 1, 'Scarborough et al. (2023) whole-plant vegan meal'],
  ['dairy-milk', 'Dairy Milk Serving', 'food', 'emission', 0.79, 'servings', 1, 'Poore & Nemecek (2018) 250 ml cow milk glass'],
  ['food-waste-landfill', 'Food Waste (Landfill)', 'food', 'emission', 0.5781, 'kg', 1, 'US EPA WARM v16 food waste landfill methane factor'],
  // Lifestyle (UK DESNZ 2024 & US EPA WARM v16)
  ['water-cold', 'Municipal Cold Water', 'lifestyle', 'emission', 0.000339, 'L', 150, 'UK DESNZ 2024 water supply & wastewater treatment'],
  ['waste-landfill', 'Household Waste (Landfill)', 'lifestyle', 'emission', 0.497, 'kg', 1, 'UK DESNZ 2024 municipal landfill waste baseline'],
  ['recycling-mixed', 'Mixed Dry Recycling', 'lifestyle', 'offset', 3.12, 'kg', 2, 'US EPA WARM v16 avoided virgin production & landfill credit'],
];

export const SYSTEM_CHALLENGES_SEED = [
  {
    slug: 'avoid-single-use-plastic',
    title: 'Avoid Single-Use Plastic',
    description:
      'Say no to disposable shopping bags, plastic straws, utensils, and single-use takeout packaging today.',
    category: 'lifestyle',
    frequency: 'daily',
    difficulty: 'easy',
    co2_savings_kg: 0.45,
    reward_points: 30,
    target_count: 1,
    unit_label: 'day',
    action_steps_hint:
      'Bring a cloth tote or refuse disposable wrappers & utensils all day.',
    verification_note:
      'Self-attested action (honesty policy — physical purchases are not automatically audited).',
    sort_order: 10,
  },
  {
    slug: 'carry-reusable-bottle',
    title: 'Carry a Reusable Water Bottle',
    description:
      'Bring and refill your own reusable water bottle instead of buying single-use bottled drinks today.',
    category: 'lifestyle',
    frequency: 'daily',
    difficulty: 'easy',
    co2_savings_kg: 0.25,
    reward_points: 25,
    target_count: 1,
    unit_label: 'day',
    action_steps_hint:
      'Use your personal flask or tumbler for water, coffee, or tea refills today.',
    verification_note:
      'Self-attested action (honesty policy — capped at one claim per local day).',
    sort_order: 20,
  },
  {
    slug: 'switch-off-unused-appliances',
    title: 'Switch Off Unused Appliances',
    description:
      'Power down unused room lights, standby monitors, TV strips, and idle chargers before leaving or sleeping.',
    category: 'electricity',
    frequency: 'daily',
    difficulty: 'easy',
    co2_savings_kg: 0.55,
    reward_points: 30,
    target_count: 1,
    unit_label: 'day',
    action_steps_hint:
      'Turn off switches at the outlet/strip for electronics not actively in use.',
    verification_note:
      'Self-attested action (honesty policy — no smart-plug telemetry required).',
    sort_order: 30,
  },
  {
    slug: 'reduce-food-waste-daily',
    title: 'Reduce Food Waste',
    description:
      'Finish portioned meals, refrigerate leftovers promptly, or compost kitchen peels instead of landfilling.',
    category: 'food',
    frequency: 'daily',
    difficulty: 'medium',
    co2_savings_kg: 0.9,
    reward_points: 40,
    target_count: 1,
    unit_label: 'day',
    action_steps_hint:
      'Plan portions realistically and store leftovers or compost scraps cleanly.',
    verification_note:
      'Self-attested action (honesty policy — distinct from numeric carbon logging).',
    sort_order: 40,
  },
  {
    slug: 'walk-cycle-short-distances',
    title: 'Walk or Cycle for Short Distances',
    description:
      'Walk or ride a bicycle instead of taking a car or rideshare for short neighborhood trips under 3 km.',
    category: 'transport',
    frequency: 'daily',
    difficulty: 'medium',
    co2_savings_kg: 1.2,
    reward_points: 45,
    target_count: 1,
    unit_label: 'trip',
    action_steps_hint:
      'Choose active travel for errands, station hops, or short commutes today.',
    verification_note:
      'Self-attested action (GPS/step hardware is not verified by EcoTrack).',
    sort_order: 50,
  },
  {
    slug: 'use-public-transportation',
    title: 'Use Public Transportation',
    description:
      'Take a city bus, tram, metro, or commuter train instead of a private car or solo taxi ride today.',
    category: 'transport',
    frequency: 'daily',
    difficulty: 'medium',
    co2_savings_kg: 1.65,
    reward_points: 50,
    target_count: 1,
    unit_label: 'trip',
    action_steps_hint:
      'Complete at least one trip today on shared transit.',
    verification_note:
      'Self-attested action (transit tickets are not externally validated).',
    sort_order: 60,
  },
  {
    slug: 'weekly-transit-commuter',
    title: 'Weekly Public Transit Streak',
    description:
      'Choose bus, metro, rail, walking, or cycling across 4 commutes or errands during this week.',
    category: 'transport',
    frequency: 'weekly',
    difficulty: 'hard',
    co2_savings_kg: 6.5,
    reward_points: 140,
    target_count: 4,
    unit_label: 'trips',
    action_steps_hint:
      'Log 4 separate transit or active-commute trips across the current ISO week.',
    verification_note:
      'Self-attested multi-step weekly challenge; capped at 1 completion bonus per ISO week.',
    sort_order: 70,
  },
  {
    slug: 'weekly-plastic-free-sprint',
    title: 'Plastic-Free Routine Week',
    description:
      'Avoid single-use plastic bottles, bags, and disposable cups across 5 separate days this week.',
    category: 'lifestyle',
    frequency: 'weekly',
    difficulty: 'medium',
    co2_savings_kg: 2.25,
    reward_points: 120,
    target_count: 5,
    unit_label: 'days',
    action_steps_hint:
      'Advance 1 step per plastic-free day with your reusable kit.',
    verification_note:
      'Self-attested weekly habit challenge; rewards grant only when reaching 5/5.',
    sort_order: 80,
  },
  {
    slug: 'weekly-appliance-power-cut',
    title: 'Standby Power Audit Week',
    description:
      'Switch off unused appliances and standby power strips across 5 evenings this week.',
    category: 'electricity',
    frequency: 'weekly',
    difficulty: 'medium',
    co2_savings_kg: 2.75,
    reward_points: 110,
    target_count: 5,
    unit_label: 'nights',
    action_steps_hint:
      'Check chargers, monitors, kitchen appliances, and climate settings for 5 nights.',
    verification_note:
      'Self-attested weekly energy challenge; no smart-meter link required.',
    sort_order: 90,
  },
  {
    slug: 'weekly-zero-food-waste',
    title: 'Zero Food Waste Kitchen Week',
    description:
      'Plan meals, repurpose leftovers, and keep edible food out of trash across 5 days this week.',
    category: 'food',
    frequency: 'weekly',
    difficulty: 'hard',
    co2_savings_kg: 5.5,
    reward_points: 150,
    target_count: 5,
    unit_label: 'days',
    action_steps_hint:
      'Log 5 waste-free kitchen days using meal planning or composting.',
    verification_note:
      'Self-attested weekly nutrition & waste challenge; capped once per ISO week.',
    sort_order: 100,
  },
];

export const CORE_BADGE_SEEDS = [
  {
    badge_key: 'first_green_step',
    title: 'First Green Step',
    description: 'Completed your very first sustainable action challenge in EcoTrack.',
    icon: 'leaf',
    requirement_label: 'Complete 1 challenge',
    points_bonus: 25,
  },
  {
    badge_key: 'plastic_free_hero',
    title: 'Plastic-Free Hero',
    description:
      'Replaced single-use bottles or disposable plastics across 2+ lifestyle challenges.',
    icon: 'water',
    requirement_label: '2 plastic-free/bottle actions',
    points_bonus: 50,
  },
  {
    badge_key: 'energy_saver',
    title: 'Energy Saver',
    description:
      'Cut idle appliance draw across 2+ electricity conservation challenges.',
    icon: 'flash',
    requirement_label: '2 energy-saving challenges',
    points_bonus: 50,
  },
  {
    badge_key: 'eco_warrior',
    title: 'Eco Warrior',
    description:
      'Built consistent sustainable habits by completing 5+ action challenges or a 3-day action streak.',
    icon: 'shield-checkmark',
    requirement_label: '5 challenges or 3-day streak',
    points_bonus: 100,
  },
  {
    badge_key: 'carbon_champion',
    title: 'Carbon Champion',
    description:
      'Reached 10+ completed sustainable challenges and 350+ earned Eco Points.',
    icon: 'trophy',
    requirement_label: '10 challenges & 350 pts',
    points_bonus: 150,
  },
];

export function computeLevelTitle(points) {
  if (points >= 1000) return 'Planet Guardian';
  if (points >= 400) return 'Forest Steward';
  if (points >= 150) return 'Green Pathfinder';
  return 'Seedling Explorer';
}

export function createDatabase(dbPath) {
  let resolvedPath = dbPath;
  if (resolvedPath && resolvedPath !== ':memory:') {
    try {
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    } catch (err) {
      console.warn(
        `[EcoTrack DB] Warning: Cannot create directory ${path.dirname(resolvedPath)} (${err.message}). Falling back to backend/data/...`
      );
      const fallbackDir = path.resolve(process.cwd(), 'backend', 'data');
      try {
        fs.mkdirSync(fallbackDir, { recursive: true });
        resolvedPath = path.join(fallbackDir, 'ecotrack.db');
      } catch {
        const tmpDir = path.join(os.tmpdir(), 'ecotrack');
        fs.mkdirSync(tmpDir, { recursive: true });
        resolvedPath = path.join(tmpDir, 'ecotrack.db');
      }
    }
  }

  const db = new DatabaseSync(resolvedPath || ':memory:');
  if (resolvedPath && resolvedPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      avatar_url TEXT,
      daily_carbon_budget_kg REAL NOT NULL DEFAULT 12
        CHECK (daily_carbon_budget_kg > 0 AND daily_carbon_budget_kg <= 500),
      sustainability_points INTEGER NOT NULL DEFAULT 0
        CHECK (sustainability_points >= 0),
      sustainability_score INTEGER NOT NULL DEFAULT 50
        CHECK (sustainability_score >= 0 AND sustainability_score <= 100),
      level_title TEXT NOT NULL DEFAULT 'Seedling Explorer',
      eco_streak_days INTEGER NOT NULL DEFAULT 0
        CHECK (eco_streak_days >= 0),
      last_action_date TEXT,
      notifications_enabled INTEGER NOT NULL DEFAULT 1,
      weekly_digest_enabled INTEGER NOT NULL DEFAULT 1,
      leaderboard_opt_in INTEGER NOT NULL DEFAULT 1,
      preferred_unit TEXT NOT NULL DEFAULT 'metric'
        CHECK (preferred_unit IN ('metric', 'imperial')),
      electricity_region TEXT NOT NULL DEFAULT 'global',
      custom_electricity_factor_kg REAL
        CHECK (custom_electricity_factor_kg IS NULL OR (custom_electricity_factor_kg >= 0 AND custom_electricity_factor_kg <= 2.5)),
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS carbon_activities (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      slug TEXT UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('transport', 'electricity', 'food', 'lifestyle')),
      direction TEXT NOT NULL DEFAULT 'emission' CHECK (direction IN ('emission', 'offset')),
      emission_factor_kg REAL NOT NULL CHECK (emission_factor_kg >= 0),
      unit_label TEXT NOT NULL,
      default_quantity REAL NOT NULL DEFAULT 1 CHECK (default_quantity > 0),
      helper_text TEXT,
      is_system INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS carbon_emission_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_id TEXT REFERENCES carbon_activities(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('transport', 'electricity', 'food', 'lifestyle')),
      direction TEXT NOT NULL DEFAULT 'emission' CHECK (direction IN ('emission', 'offset')),
      quantity REAL NOT NULL CHECK (quantity > 0 AND quantity <= 1000000),
      unit_label TEXT NOT NULL,
      emission_factor_kg REAL NOT NULL CHECK (emission_factor_kg >= 0 AND emission_factor_kg <= 1000),
      emissions_kg REAL NOT NULL CHECK (emissions_kg >= 0),
      region_code TEXT,
      methodology_source TEXT,
      assumptions TEXT,
      notes TEXT,
      recorded_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_emission_records_user_date
      ON carbon_emission_records(user_id, recorded_at DESC);

    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('transport', 'electricity', 'food', 'lifestyle')),
      frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
      difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
      co2_savings_kg REAL NOT NULL CHECK (co2_savings_kg > 0),
      reward_points INTEGER NOT NULL CHECK (reward_points > 0),
      target_count INTEGER NOT NULL DEFAULT 1 CHECK (target_count > 0),
      unit_label TEXT NOT NULL,
      action_steps_hint TEXT NOT NULL DEFAULT '',
      verification_note TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 100,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      period_key TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
      status TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'completed')),
      last_action_note TEXT,
      last_action_at TEXT,
      joined_at TEXT NOT NULL,
      completed_at TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, challenge_id, period_key)
    );
    CREATE INDEX IF NOT EXISTS idx_user_challenges_user_period
      ON user_challenges(user_id, period_key);

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      requirement_label TEXT NOT NULL,
      earned INTEGER NOT NULL DEFAULT 0,
      points_bonus INTEGER NOT NULL DEFAULT 0,
      earned_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (user_id, badge_key)
    );
    CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);

    CREATE TABLE IF NOT EXISTS reward_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward_key TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('challenge_completion', 'badge_unlock')),
      challenge_id TEXT REFERENCES challenges(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      points_delta INTEGER NOT NULL CHECK (points_delta > 0),
      verification_type TEXT NOT NULL DEFAULT 'self_attested',
      period_key TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (user_id, reward_key)
    );
    CREATE INDEX IF NOT EXISTS idx_reward_history_user_date
      ON reward_history(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      action_tag TEXT,
      estimated_savings_kg REAL,
      calculations TEXT,
      suggested_follow_ups TEXT,
      model_used TEXT,
      interaction_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_messages_user_date
      ON ai_chat_messages(user_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS ai_request_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      model_used TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_request_logs_user_date
      ON ai_request_logs(user_id, created_at DESC);
  `);

  seedCatalog(db);
  return db;
}

export function seedCatalog(db) {
  const now = new Date().toISOString();

  const upsertActivity = db.prepare(`
    INSERT INTO carbon_activities (
      id, user_id, slug, title, category, direction,
      emission_factor_kg, unit_label, default_quantity, helper_text, is_system, created_at
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      direction = excluded.direction,
      emission_factor_kg = excluded.emission_factor_kg,
      unit_label = excluded.unit_label,
      default_quantity = excluded.default_quantity,
      helper_text = excluded.helper_text,
      is_system = 1
  `);

  const upsertChallenge = db.prepare(`
    INSERT INTO challenges (
      id, slug, title, description, category, frequency, difficulty,
      co2_savings_kg, reward_points, target_count, unit_label,
      action_steps_hint, verification_note, sort_order, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      category = excluded.category,
      frequency = excluded.frequency,
      difficulty = excluded.difficulty,
      co2_savings_kg = excluded.co2_savings_kg,
      reward_points = excluded.reward_points,
      target_count = excluded.target_count,
      unit_label = excluded.unit_label,
      action_steps_hint = excluded.action_steps_hint,
      verification_note = excluded.verification_note,
      sort_order = excluded.sort_order,
      is_active = 1
  `);

  db.exec('BEGIN');
  try {
    for (const [
      slug,
      title,
      category,
      direction,
      factorKg,
      unitLabel,
      defaultQty,
      helperText,
    ] of SYSTEM_ACTIVITIES_SEED) {
      upsertActivity.run(
        deterministicUuid(`carbon_activity:${slug}`),
        slug,
        title,
        category,
        direction,
        factorKg,
        unitLabel,
        defaultQty,
        helperText,
        now
      );
    }

    for (const c of SYSTEM_CHALLENGES_SEED) {
      upsertChallenge.run(
        deterministicUuid(`challenge:${c.slug}`),
        c.slug,
        c.title,
        c.description,
        c.category,
        c.frequency,
        c.difficulty,
        c.co2_savings_kg,
        c.reward_points,
        c.target_count,
        c.unit_label,
        c.action_steps_hint,
        c.verification_note,
        c.sort_order,
        now
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function seedUserAchievements(db, userId) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO achievements (
      id, user_id, badge_key, title, description, icon,
      requirement_label, earned, points_bonus, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    ON CONFLICT(user_id, badge_key) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      icon = excluded.icon,
      requirement_label = excluded.requirement_label,
      points_bonus = excluded.points_bonus
  `);

  for (const badge of CORE_BADGE_SEEDS) {
    stmt.run(
      deterministicUuid(`achievement:${userId}:${badge.badge_key}`),
      userId,
      badge.badge_key,
      badge.title,
      badge.description,
      badge.icon,
      badge.requirement_label,
      badge.points_bonus,
      now
    );
  }
}

export function withTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
