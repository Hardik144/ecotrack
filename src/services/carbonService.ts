import { CALCULATOR_PRESETS } from '@/constants/config';
import type {
  ActivityCategory,
  CarbonActivity,
  CarbonActivityPresetItem,
} from '@/types/carbon';
import type { EmissionRecordInput } from '@/utils/validation';

import { apiRequest } from './apiClient';

export interface BackendEmissionRow {
  id: string;
  user_id: string;
  activity_id: string | null;
  title: string;
  category: string;
  direction: string;
  quantity: number;
  unit_label: string;
  emission_factor_kg: number;
  emissions_kg: number;
  region_code: string | null;
  methodology_source: string | null;
  assumptions: string | null;
  notes: string | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

export function getFallbackPresets(): CarbonActivityPresetItem[] {
  return CALCULATOR_PRESETS.map((preset) => ({
    id: preset.id,
    slug: preset.id,
    title: preset.label,
    category: preset.category,
    direction: preset.direction,
    emissionFactorKg: preset.factorKgPerUnit,
    unitLabel: preset.unitLabel,
    defaultQuantity: preset.defaultQuantity,
    helper: preset.helper,
    isSystem: true,
  }));
}

export function mapEmissionRecordRow(row: BackendEmissionRow): CarbonActivity {
  return {
    id: row.id,
    userId: row.user_id,
    activityId: row.activity_id,
    title: row.title,
    category: row.category as ActivityCategory,
    direction: row.direction === 'offset' ? 'offset' : 'emission',
    quantity: Number(row.quantity),
    unitLabel: row.unit_label,
    emissionFactorKg: Number(row.emission_factor_kg),
    emissionsKg: Number(row.emissions_kg),
    regionCode: row.region_code ?? null,
    methodologySource: row.methodology_source ?? null,
    assumptions: row.assumptions ?? null,
    occurredAt: row.recorded_at,
    createdAt: row.created_at,
    notes: row.notes ?? undefined,
  };
}

export async function fetchCarbonActivitiesCatalog(): Promise<
  CarbonActivityPresetItem[]
> {
  try {
    const res = await apiRequest<{ items: CarbonActivityPresetItem[] }>(
      '/api/activities/catalog',
      { method: 'GET' }
    );
    if (!Array.isArray(res.items) || res.items.length === 0) {
      return getFallbackPresets();
    }
    return res.items.map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      category: item.category,
      direction: item.direction === 'offset' ? 'offset' : 'emission',
      emissionFactorKg: Number(item.emissionFactorKg),
      unitLabel: item.unitLabel,
      defaultQuantity: Number(item.defaultQuantity),
      helper: item.helper ?? undefined,
      isSystem: Boolean(item.isSystem),
    }));
  } catch {
    return getFallbackPresets();
  }
}

export async function fetchEmissionRecords(
  _userId: string
): Promise<CarbonActivity[]> {
  const res = await apiRequest<{ items: BackendEmissionRow[] }>('/api/emissions', {
    method: 'GET',
  });
  return (res.items ?? []).map(mapEmissionRecordRow);
}

function toEmissionPayloadBody(input: EmissionRecordInput) {
  const occurredIso = input.occurredAt ?? new Date().toISOString();
  const quantity = input.quantity ?? 1;
  const unitLabel = (input.unitLabel ?? 'unit').trim();
  const emissionFactorKg = input.emissionFactorKg ?? 0;

  return {
    activityId: input.activityId ?? null,
    title: input.title.trim(),
    category: input.category,
    direction: input.direction,
    quantity: Number(quantity.toFixed(3)),
    unitLabel,
    emissionFactorKg: Number(emissionFactorKg.toFixed(6)),
    emissionsKg: Number(Math.abs(input.emissionsKg).toFixed(3)),
    regionCode: input.regionCode ?? null,
    methodologySource: input.methodologySource?.trim() || null,
    assumptions: input.assumptions?.trim() || null,
    notes: input.notes?.trim() || null,
    recordedAt: occurredIso,
  };
}

export async function createEmissionRecordsBatch(
  _userId: string,
  inputs: EmissionRecordInput[]
): Promise<CarbonActivity[]> {
  if (inputs.length === 0) {
    throw new Error('At least one carbon activity item is required.');
  }

  for (const input of inputs) {
    const quantity = input.quantity ?? 1;
    const factorKg = input.emissionFactorKg ?? 0;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Quantity for "${input.title}" must be greater than zero.`);
    }
    if (!Number.isFinite(factorKg) || factorKg < 0) {
      throw new Error(
        `Emission factor for "${input.title}" cannot be negative.`
      );
    }
    if (!Number.isFinite(input.emissionsKg) || input.emissionsKg < 0) {
      throw new Error(`Calculated CO2e for "${input.title}" cannot be negative.`);
    }
  }

  const res = await apiRequest<{ items: BackendEmissionRow[] }>('/api/emissions', {
    method: 'POST',
    body: {
      items: inputs.map(toEmissionPayloadBody),
    },
  });

  return (res.items ?? []).map(mapEmissionRecordRow);
}

export async function createEmissionRecord(
  userId: string,
  input: EmissionRecordInput
): Promise<CarbonActivity> {
  const created = await createEmissionRecordsBatch(userId, [input]);
  if (!created[0]) {
    throw new Error('Failed to create emission record.');
  }
  return created[0];
}

export async function updateEmissionRecord(
  _userId: string,
  recordId: string,
  input: EmissionRecordInput
): Promise<CarbonActivity> {
  const quantity = input.quantity ?? 1;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Activity quantity must be greater than zero.');
  }

  const res = await apiRequest<{ item: BackendEmissionRow }>(
    `/api/emissions/${encodeURIComponent(recordId)}`,
    {
      method: 'PATCH',
      body: toEmissionPayloadBody(input),
    }
  );

  return mapEmissionRecordRow(res.item);
}

export async function deleteEmissionRecord(
  _userId: string,
  recordId: string
): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/emissions/${encodeURIComponent(recordId)}`,
    { method: 'DELETE' }
  );
}
