import type {
  ActivityCategory,
  ElectricityRegionCode,
  ImpactDirection,
} from '@/types';

/**
 * Centralized input validation & binary encoding helpers for EcoTrack.
 * Mirrors PostgreSQL CHECK constraints so invalid data fails early and cleanly.
 */

const VALID_REGION_CODES: readonly ElectricityRegionCode[] = [
  'global',
  'us-avg',
  'us-camx',
  'uk',
  'eu',
  'de',
  'fr',
  'in',
  'cn',
  'ca',
  'au',
  'jp',
  'custom',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_CATEGORIES: readonly ActivityCategory[] = [
  'transport',
  'electricity',
  'food',
  'lifestyle',
];
const VALID_DIRECTIONS: readonly ImpactDirection[] = ['emission', 'offset'];

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB (matches storage.buckets file_size_limit)

export interface ValidationResult<T = string> {
  ok: boolean;
  value?: T;
  error?: string;
}

export function validateEmail(rawEmail: string): ValidationResult {
  const cleaned = rawEmail.trim().toLowerCase();
  if (!cleaned || cleaned.length > 320 || !EMAIL_REGEX.test(cleaned)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  return { ok: true, value: cleaned };
}

export function validatePassword(rawPassword: string): ValidationResult {
  if (rawPassword.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }
  if (rawPassword.length > 128) {
    return { ok: false, error: 'Password must be 128 characters or fewer.' };
  }
  return { ok: true, value: rawPassword };
}

export function validateFullName(rawName: string): ValidationResult {
  const cleaned = rawName.trim().replace(/\s+/g, ' ');
  if (cleaned.length < 2) {
    return { ok: false, error: 'Full name must be at least 2 characters.' };
  }
  if (cleaned.length > 120) {
    return { ok: false, error: 'Full name must be 120 characters or fewer.' };
  }
  return { ok: true, value: cleaned };
}

export function validateDailyBudget(budgetKg: number): ValidationResult<number> {
  if (!Number.isFinite(budgetKg) || budgetKg < 2 || budgetKg > 200) {
    return {
      ok: false,
      error: 'Daily carbon budget must be between 2.0 and 200.0 kg CO₂e.',
    };
  }
  return { ok: true, value: Number(budgetKg.toFixed(2)) };
}

export function validateAvatarUrlInput(rawUrl: string | null | undefined): ValidationResult<string | null> {
  if (rawUrl === null || rawUrl === undefined) {
    return { ok: true, value: null };
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (trimmed.length > 2048) {
    return { ok: false, error: 'Profile image URL is too long (max 2048 characters).' };
  }
  const isStoragePath = /^[0-9a-fA-F-]{36}\/[A-Za-z0-9._/-]+$/.test(trimmed);
  const isHttpUrl = /^https?:\/\/\S+$/i.test(trimmed);
  if (!isStoragePath && !isHttpUrl) {
    return { ok: false, error: 'Profile image must be a valid http(s) image URL.' };
  }
  return { ok: true, value: trimmed };
}

export function validateElectricityRegionCode(
  region: string | undefined
): ValidationResult<ElectricityRegionCode> {
  if (!region || !VALID_REGION_CODES.includes(region as ElectricityRegionCode)) {
    return { ok: false, error: 'Select a supported regional electricity grid.' };
  }
  return { ok: true, value: region as ElectricityRegionCode };
}

export function validateCustomElectricityFactor(
  rawFactor: number | null | undefined
): ValidationResult<number | null> {
  if (rawFactor === null || rawFactor === undefined) {
    return { ok: true, value: null };
  }
  if (!Number.isFinite(rawFactor) || rawFactor < 0 || rawFactor > 2.5) {
    return {
      ok: false,
      error: 'Custom electricity factor must be between 0 and 2.5000 kg CO₂e/kWh.',
    };
  }
  return { ok: true, value: Number(rawFactor.toFixed(4)) };
}

const DATE_ONLY_INPUT_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function validateActivityDateInput(
  rawDate: string | undefined
): ValidationResult<string | null> {
  if (!rawDate || !rawDate.trim()) {
    return { ok: true, value: null };
  }

  const cleaned = rawDate.trim();
  const dateOnlyMatch = DATE_ONLY_INPUT_REGEX.exec(cleaned);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const localNoon = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      localNoon.getFullYear() !== year ||
      localNoon.getMonth() !== month - 1 ||
      localNoon.getDate() !== day
    ) {
      return { ok: false, error: 'Enter a valid calendar date (YYYY-MM-DD).' };
    }
    return { ok: true, value: localNoon.toISOString() };
  }

  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: 'Enter a valid date (YYYY-MM-DD) or timestamp.' };
  }

  return { ok: true, value: parsed.toISOString() };
}

export interface EmissionRecordInput {
  title: string;
  category: ActivityCategory;
  direction: ImpactDirection;
  emissionsKg: number;
  quantity?: number;
  unitLabel?: string;
  emissionFactorKg?: number | null;
  regionCode?: string | null;
  methodologySource?: string | null;
  assumptions?: string | null;
  notes?: string;
  activityId?: string | null;
  occurredAt?: string;
}

export interface SanitizedEmissionRecordInput {
  title: string;
  category: ActivityCategory;
  direction: ImpactDirection;
  emissionsKg: number;
  quantity: number;
  unitLabel: string;
  emissionFactorKg: number | null;
  regionCode: string | null;
  methodologySource: string | null;
  assumptions: string | null;
  notes: string | null;
  activityId: string | null;
  occurredAt: string | null;
}

export function validateEmissionRecordInput(
  input: EmissionRecordInput
): ValidationResult<SanitizedEmissionRecordInput> {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 160) {
    return { ok: false, error: 'Activity title must be between 2 and 160 characters.' };
  }

  if (!VALID_CATEGORIES.includes(input.category)) {
    return { ok: false, error: 'Invalid carbon activity category.' };
  }

  if (!VALID_DIRECTIONS.includes(input.direction)) {
    return { ok: false, error: 'Invalid impact direction.' };
  }

  const quantity = input.quantity ?? 1;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
    return { ok: false, error: 'Quantity must be between 0.01 and 100,000.' };
  }

  if (!Number.isFinite(input.emissionsKg) || input.emissionsKg < 0 || input.emissionsKg > 1000000) {
    return { ok: false, error: 'Emissions value must be between 0 and 1,000,000 kg CO₂e.' };
  }

  const unitLabel = (input.unitLabel ?? 'unit').trim();
  if (unitLabel.length < 1 || unitLabel.length > 32) {
    return { ok: false, error: 'Unit label must be between 1 and 32 characters.' };
  }

  let emissionFactorKg: number | null = null;
  if (input.emissionFactorKg !== null && input.emissionFactorKg !== undefined) {
    if (
      !Number.isFinite(input.emissionFactorKg) ||
      input.emissionFactorKg < 0 ||
      input.emissionFactorKg > 10000
    ) {
      return {
        ok: false,
        error: 'Emission factor must be between 0 and 10,000 kg CO₂e/unit.',
      };
    }
    emissionFactorKg = Number(input.emissionFactorKg.toFixed(6));
  }

  const regionCode = input.regionCode?.trim() || null;
  if (regionCode && regionCode.length > 32) {
    return { ok: false, error: 'Region code must be 32 characters or fewer.' };
  }

  const methodologySource = input.methodologySource?.trim() || null;
  if (methodologySource && methodologySource.length > 240) {
    return { ok: false, error: 'Methodology source must be 240 characters or fewer.' };
  }

  const assumptions = input.assumptions?.trim() || null;
  if (assumptions && assumptions.length > 1000) {
    return { ok: false, error: 'Assumptions summary must be 1000 characters or fewer.' };
  }

  const cleanedNotes = input.notes?.trim() ?? '';
  if (cleanedNotes.length > 500) {
    return { ok: false, error: 'Notes must be 500 characters or fewer.' };
  }

  const dateCheck = validateActivityDateInput(input.occurredAt);
  if (!dateCheck.ok) {
    return { ok: false, error: dateCheck.error };
  }

  return {
    ok: true,
    value: {
      title,
      category: input.category,
      direction: input.direction,
      emissionsKg: Number(input.emissionsKg.toFixed(3)),
      quantity: Number(quantity.toFixed(2)),
      unitLabel,
      emissionFactorKg,
      regionCode,
      methodologySource,
      assumptions,
      notes: cleanedNotes || null,
      activityId: input.activityId ?? null,
      occurredAt: dateCheck.value ?? null,
    },
  };
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Pure JS/TS base64 -> ArrayBuffer decoder compatible with Hermes and Web.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/^data:[^;]+;base64,/, '').replace(/[\r\n\s]/g, '');
  const len = clean.length;
  let padding = 0;
  if (clean.endsWith('==')) padding = 2;
  else if (clean.endsWith('=')) padding = 1;

  const byteLength = Math.max(0, Math.floor((len * 3) / 4) - padding);
  const bytes = new Uint8Array(byteLength);

  let byteIndex = 0;
  for (let i = 0; i < len; i += 4) {
    const c1 = BASE64_ALPHABET.indexOf(clean[i] ?? 'A');
    const c2 = BASE64_ALPHABET.indexOf(clean[i + 1] ?? 'A');
    const c3 = clean[i + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(clean[i + 2] ?? 'A');
    const c4 = clean[i + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(clean[i + 3] ?? 'A');

    if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) {
      throw new Error('Invalid base64 image payload.');
    }

    const triplet = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
    if (byteIndex < byteLength) bytes[byteIndex++] = (triplet >> 16) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = (triplet >> 8) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = triplet & 0xff;
  }

  return bytes.buffer;
}

export function validateAvatarAsset(
  mimeType: string | undefined,
  byteLength: number
): ValidationResult<{ mimeType: string; extension: string }> {
  const normalizedMime = (mimeType ?? 'image/jpeg').toLowerCase().trim();
  const canonicalMime = normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime;

  if (!ALLOWED_AVATAR_MIME_TYPES.has(normalizedMime)) {
    return {
      ok: false,
      error: 'Please select a JPEG, PNG, or WebP image.',
    };
  }

  if (byteLength <= 0 || byteLength > MAX_AVATAR_BYTES) {
    return {
      ok: false,
      error: 'Profile image must be under 5 MB.',
    };
  }

  const extension =
    canonicalMime === 'image/png'
      ? 'png'
      : canonicalMime === 'image/webp'
        ? 'webp'
        : 'jpg';

  return {
    ok: true,
    value: { mimeType: canonicalMime, extension },
  };
}
