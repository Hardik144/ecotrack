import {
  type ActivityCategory,
  type BusServiceType,
  BUS_SERVICE_FACTORS,
  type CarFuelType,
  CAR_FUEL_FACTORS,
  CONVERSION_FACTORS,
  type CyclingMode,
  CYCLING_FACTORS,
  type DairyProductType,
  DAIRY_PRODUCT_FACTORS,
  type DistanceUnit,
  type ElectricityMode,
  type ElectricityPeriodBasis,
  type ElectricityRegionCode,
  ELECTRICITY_REGION_MAP,
  type FlightHaulClass,
  FLIGHT_CLASS_FACTORS,
  type FoodWasteMethod,
  FOOD_WASTE_FACTORS,
  LIFESTYLE_WASTE_FACTOR,
  type MotorcycleSize,
  MOTORCYCLE_SIZE_FACTORS,
  type NonVegetarianProteinType,
  NON_VEGETARIAN_MEAL_FACTORS,
  type RecyclingMaterialType,
  RECYCLING_MATERIAL_FACTORS,
  type TrainServiceType,
  TRAIN_SERVICE_FACTORS,
  type TransportMode,
  type VegetarianType,
  VEGETARIAN_MEAL_FACTORS,
  WALKING_FACTORS,
  type WaterHeaterType,
  WATER_HEATER_FACTORS,
} from './factors.ts';

export interface VerifiedCalculationCitation {
  label: string;
  formula: string;
  resultKg: number;
  direction: 'emission' | 'offset' | 'savings';
  source: string;
}

export interface EmissionRecordInputRow {
  id: string;
  title: string;
  category: ActivityCategory;
  direction: 'emission' | 'offset';
  quantity: number;
  unit_label: string;
  emissions_kg: number;
  emission_factor_kg?: number | null;
  region_code?: string | null;
  methodology_source?: string | null;
  recorded_at: string;
}

export interface ToolExecutionContext {
  defaultRegion: ElectricityRegionCode;
  defaultCustomGridFactorKg: number | null;
  preferredUnit: 'metric' | 'imperial';
  dailyBudgetKg: number;
  records: EmissionRecordInputRow[];
  completedChallengesCount: number;
  profileBaselineScore: number;
  localDateKey: string;
}

export interface ToolExecutionOutcome {
  result: Record<string, unknown>;
  citations: VerifiedCalculationCitation[];
  savingsKg: number | null;
  isError: boolean;
}

const MAX_CUSTOM_GRID_FACTOR = 2.5;
const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatFactorDisplay(factorKg: number): string {
  if (factorKg === 0) return '0.000';
  if (factorKg < 0.01) return factorKg.toFixed(6);
  return factorKg.toFixed(4);
}

export function applyEmissionFormula(amount: number, factorKg: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(factorKg) || amount < 0 || factorKg < 0) {
    return 0;
  }
  return roundTo(amount * factorKg, 3);
}

export function resolveElectricityRegion(
  regionCode: ElectricityRegionCode = 'global',
  customFactorKg?: number | null
):
  | {
      ok: true;
      regionCode: ElectricityRegionCode;
      label: string;
      shortLabel: string;
      factorKgPerKwh: number;
      source: string;
    }
  | { ok: false; error: string } {
  const meta = ELECTRICITY_REGION_MAP[regionCode];
  if (!meta) {
    return { ok: false, error: `Unsupported electricity region: ${String(regionCode)}` };
  }

  if (regionCode === 'custom') {
    if (
      typeof customFactorKg !== 'number' ||
      !Number.isFinite(customFactorKg) ||
      customFactorKg < 0 ||
      customFactorKg > MAX_CUSTOM_GRID_FACTOR
    ) {
      return {
        ok: false,
        error: `Custom grid emission factor must be between 0 and ${MAX_CUSTOM_GRID_FACTOR} kg CO₂e/kWh.`,
      };
    }
    const factor = roundTo(customFactorKg, 4);
    return {
      ok: true,
      regionCode: 'custom',
      label: meta.label,
      shortLabel: `Custom (${factor} kg/kWh)`,
      factorKgPerKwh: factor,
      source: meta.source,
    };
  }

  return {
    ok: true,
    regionCode: meta.code,
    label: meta.label,
    shortLabel: meta.shortLabel,
    factorKgPerKwh: meta.factorKgPerKwh,
    source: meta.source,
  };
}

function normalizeDistanceKm(amount: number, unit: DistanceUnit): number {
  return unit === 'mi'
    ? roundTo(amount * CONVERSION_FACTORS.KM_PER_MILE, 3)
    : roundTo(amount, 3);
}

function computeSingleTransport(params: {
  mode: TransportMode;
  distance: number;
  distanceUnit?: DistanceUnit;
  carFuel?: CarFuelType;
  passengers?: number;
  motorcycleSize?: MotorcycleSize;
  busType?: BusServiceType;
  trainType?: TrainServiceType;
  flightClass?: FlightHaulClass;
  isRoundTrip?: boolean;
  cyclingMode?: CyclingMode;
  countAsCarReplacementOffset?: boolean;
  electricityRegion?: ElectricityRegionCode;
  customElectricityFactorKg?: number | null;
}):
  | {
      ok: true;
      title: string;
      direction: 'emission' | 'offset';
      distanceKm: number;
      emissionFactorKg: number;
      emissionsKg: number;
      formula: string;
      source: string;
      regionCode: ElectricityRegionCode | null;
    }
  | { ok: false; error: string } {
  if (!Number.isFinite(params.distance) || params.distance <= 0 || params.distance > 50000) {
    return { ok: false, error: 'Distance must be between 0 and 50,000.' };
  }

  const unit: DistanceUnit = params.distanceUnit === 'mi' ? 'mi' : 'km';
  const baseDistanceKm = normalizeDistanceKm(params.distance, unit);

  if (params.mode === 'car') {
    const fuel: CarFuelType = params.carFuel ?? 'petrol';
    const fuelMeta = CAR_FUEL_FACTORS[fuel];
    if (!fuelMeta) {
      return { ok: false, error: `Unsupported car fuel type: ${String(fuel)}` };
    }
    const passengersRaw = params.passengers ?? 1;
    const passengers = Math.max(1, Math.min(6, Math.round(passengersRaw)));

    let vehicleFactorKgPerKm: number;
    let source: string;
    let regionCode: ElectricityRegionCode | null = null;

    if (fuel === 'electric') {
      const regionRes = resolveElectricityRegion(
        params.electricityRegion ?? 'global',
        params.customElectricityFactorKg
      );
      if (!regionRes.ok) return regionRes;
      regionCode = regionRes.regionCode;
      vehicleFactorKgPerKm = roundTo(
        CONVERSION_FACTORS.EV_KWH_PER_KM * regionRes.factorKgPerKwh,
        6
      );
      source = `EV draw (${CONVERSION_FACTORS.EV_KWH_PER_KM} kWh/km) × ${regionRes.source}`;
    } else {
      vehicleFactorKgPerKm = fuelMeta.factorKgPerUnit;
      source = fuelMeta.source;
    }

    const effectiveFactor = roundTo(vehicleFactorKgPerKm / passengers, 6);
    const emissionsKg = applyEmissionFormula(baseDistanceKm, effectiveFactor);
    const title = `Car (${fuelMeta.label}${passengers > 1 ? `, ${passengers} riders` : ''})`;

    return {
      ok: true,
      title,
      direction: 'emission',
      distanceKm: baseDistanceKm,
      emissionFactorKg: effectiveFactor,
      emissionsKg,
      formula: `${baseDistanceKm} km × ${formatFactorDisplay(effectiveFactor)} kg CO₂e/km = ${emissionsKg.toFixed(2)} kg CO₂e`,
      source,
      regionCode,
    };
  }

  if (params.mode === 'motorcycle') {
    const size: MotorcycleSize = params.motorcycleSize ?? 'average';
    const meta = MOTORCYCLE_SIZE_FACTORS[size] ?? MOTORCYCLE_SIZE_FACTORS.average;
    const emissionsKg = applyEmissionFormula(baseDistanceKm, meta.factorKgPerUnit);
    return {
      ok: true,
      title: `Motorcycle (${meta.label})`,
      direction: 'emission',
      distanceKm: baseDistanceKm,
      emissionFactorKg: meta.factorKgPerUnit,
      emissionsKg,
      formula: `${baseDistanceKm} km × ${formatFactorDisplay(meta.factorKgPerUnit)} kg CO₂e/km = ${emissionsKg.toFixed(2)} kg CO₂e`,
      source: meta.source,
      regionCode: null,
    };
  }

  if (params.mode === 'bus') {
    const busType: BusServiceType = params.busType ?? 'city';
    const meta = BUS_SERVICE_FACTORS[busType] ?? BUS_SERVICE_FACTORS.city;
    const emissionsKg = applyEmissionFormula(baseDistanceKm, meta.factorKgPerUnit);
    return {
      ok: true,
      title: meta.label,
      direction: 'emission',
      distanceKm: baseDistanceKm,
      emissionFactorKg: meta.factorKgPerUnit,
      emissionsKg,
      formula: `${baseDistanceKm} km × ${formatFactorDisplay(meta.factorKgPerUnit)} kg CO₂e/km = ${emissionsKg.toFixed(2)} kg CO₂e`,
      source: meta.source,
      regionCode: null,
    };
  }

  if (params.mode === 'train') {
    const trainType: TrainServiceType = params.trainType ?? 'national';
    const meta = TRAIN_SERVICE_FACTORS[trainType] ?? TRAIN_SERVICE_FACTORS.national;
    const emissionsKg = applyEmissionFormula(baseDistanceKm, meta.factorKgPerUnit);
    return {
      ok: true,
      title: meta.label,
      direction: 'emission',
      distanceKm: baseDistanceKm,
      emissionFactorKg: meta.factorKgPerUnit,
      emissionsKg,
      formula: `${baseDistanceKm} km × ${formatFactorDisplay(meta.factorKgPerUnit)} kg CO₂e/km = ${emissionsKg.toFixed(2)} kg CO₂e`,
      source: meta.source,
      regionCode: null,
    };
  }

  if (params.mode === 'air') {
    const flightClass: FlightHaulClass = params.flightClass ?? 'short-economy';
    const meta = FLIGHT_CLASS_FACTORS[flightClass] ?? FLIGHT_CLASS_FACTORS['short-economy'];
    const isRoundTrip = Boolean(params.isRoundTrip);
    const totalFlightKm = isRoundTrip ? roundTo(baseDistanceKm * 2, 3) : baseDistanceKm;
    const emissionsKg = applyEmissionFormula(totalFlightKm, meta.factorKgPerUnit);
    return {
      ok: true,
      title: `Air Travel (${meta.label}${isRoundTrip ? ', Round-Trip' : ''})`,
      direction: 'emission',
      distanceKm: totalFlightKm,
      emissionFactorKg: meta.factorKgPerUnit,
      emissionsKg,
      formula: `${totalFlightKm} km × ${formatFactorDisplay(meta.factorKgPerUnit)} kg CO₂e/km = ${emissionsKg.toFixed(2)} kg CO₂e`,
      source: meta.source,
      regionCode: null,
    };
  }

  if (params.mode === 'walking') {
    const asOffset = Boolean(params.countAsCarReplacementOffset);
    const factor = asOffset
      ? WALKING_FACTORS.carReplacementOffsetKgPerKm
      : WALKING_FACTORS.directEmissionKgPerKm;
    const emissionsKg = applyEmissionFormula(baseDistanceKm, factor);
    return {
      ok: true,
      title: asOffset ? 'Walking (Car Replacement Offset)' : 'Walking',
      direction: asOffset ? 'offset' : 'emission',
      distanceKm: baseDistanceKm,
      emissionFactorKg: factor,
      emissionsKg,
      formula: `${baseDistanceKm} km × ${formatFactorDisplay(factor)} kg CO₂e/km = ${asOffset ? '-' : ''}${emissionsKg.toFixed(2)} kg CO₂e`,
      source: asOffset ? WALKING_FACTORS.offsetSource : WALKING_FACTORS.directSource,
      regionCode: null,
    };
  }

  if (params.mode === 'cycling') {
    const cyclingMode: CyclingMode = params.cyclingMode ?? 'conventional';
    const cyclingMeta = CYCLING_FACTORS[cyclingMode] ?? CYCLING_FACTORS.conventional;
    const asOffset = Boolean(params.countAsCarReplacementOffset);
    let regionCode: ElectricityRegionCode | null = null;
    let ebikeFactor = 0;

    if (cyclingMode === 'ebike') {
      const regionRes = resolveElectricityRegion(
        params.electricityRegion ?? 'global',
        params.customElectricityFactorKg
      );
      if (!regionRes.ok) return regionRes;
      regionCode = regionRes.regionCode;
      ebikeFactor = roundTo(CONVERSION_FACTORS.EBIKE_KWH_PER_KM * regionRes.factorKgPerKwh, 6);
    }

    const effectiveFactor = asOffset
      ? roundTo(Math.max(0, cyclingMeta.carReplacementOffsetKgPerKm - ebikeFactor), 6)
      : ebikeFactor;
    const direction: 'emission' | 'offset' = asOffset ? 'offset' : 'emission';
    const emissionsKg = applyEmissionFormula(baseDistanceKm, effectiveFactor);
    return {
      ok: true,
      title: asOffset ? `${cyclingMeta.label} (Car Swap Offset)` : cyclingMeta.label,
      direction,
      distanceKm: baseDistanceKm,
      emissionFactorKg: effectiveFactor,
      emissionsKg,
      formula: `${baseDistanceKm} km × ${formatFactorDisplay(effectiveFactor)} kg CO₂e/km = ${asOffset ? '-' : ''}${emissionsKg.toFixed(2)} kg saved`,
      source: asOffset ? cyclingMeta.offsetSource : cyclingMeta.directSource,
      regionCode,
    };
  }

  return { ok: false, error: `Unsupported transport mode: ${String(params.mode)}` };
}

function parseMealOption(
  option: string
): { kind: 'veg'; sub: VegetarianType } | { kind: 'meat'; sub: NonVegetarianProteinType } | null {
  if (option === 'vegetarian' || option === 'vegan') {
    return { kind: 'veg', sub: option };
  }
  if (option === 'beef' || option === 'pork' || option === 'poultry' || option === 'mixed') {
    return { kind: 'meat', sub: option };
  }
  return null;
}

function computeSingleMeal(option: string, count: number):
  | {
      ok: true;
      title: string;
      count: number;
      factorKgPerMeal: number;
      emissionsKg: number;
      formula: string;
      source: string;
    }
  | { ok: false; error: string } {
  const parsed = parseMealOption(option);
  if (!parsed) {
    return { ok: false, error: `Unsupported meal type: ${option}` };
  }
  if (!Number.isFinite(count) || count <= 0 || count > 200) {
    return { ok: false, error: 'Meal count must be between 1 and 200.' };
  }
  const cleanCount = roundTo(count, 2);
  const meta =
    parsed.kind === 'veg'
      ? VEGETARIAN_MEAL_FACTORS[parsed.sub]
      : NON_VEGETARIAN_MEAL_FACTORS[parsed.sub];
  const emissionsKg = applyEmissionFormula(cleanCount, meta.factorKgPerUnit);
  return {
    ok: true,
    title: meta.label,
    count: cleanCount,
    factorKgPerMeal: meta.factorKgPerUnit,
    emissionsKg,
    formula: `${cleanCount} meals × ${formatFactorDisplay(meta.factorKgPerUnit)} kg/meal = ${emissionsKg.toFixed(2)} kg CO₂e`,
    source: meta.source,
  };
}

function parseDateKeyFromRecord(recordedAt: string, fallbackDateKey: string): string {
  const trimmed = recordedAt.trim();
  const dateOnly = DATE_ONLY_REGEX.exec(trimmed);
  if (dateOnly) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return fallbackDateKey;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToKey(dateKey: string, delta: number): string {
  const match = DATE_ONLY_REGEX.exec(dateKey);
  if (!match) return dateKey;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + delta);
  const d = new Date(utc);
  return d.toISOString().slice(0, 10);
}

export function summarizeUserAnalyticsWindow(
  records: EmissionRecordInputRow[],
  options: {
    rangePreset: '7d' | '30d' | 'month' | '90d' | 'all';
    category?: 'all' | ActivityCategory;
    localDateKey: string;
    dailyBudgetKg: number;
    completedChallengesCount: number;
    profileBaselineScore: number;
  }
): {
  rangeLabel: string;
  startKey: string;
  endKey: string;
  recordCount: number;
  activeDays: number;
  grossKg: number;
  avoidedKg: number;
  netKg: number;
  dailyAverageNetKg: number;
  sustainabilityScore: number;
  byCategory: Record<
    ActivityCategory,
    { grossKg: number; offsetKg: number; netKg: number; sharePct: number; count: number }
  >;
  highestCategory: ActivityCategory | null;
  transportVsElectricity: {
    transportGrossKg: number;
    electricityGrossKg: number;
    dominant: 'transport' | 'electricity' | 'tied' | 'none';
    gapKg: number;
  };
  topEmitters: { title: string; category: ActivityCategory; emissionsKg: number; dateKey: string }[];
} {
  const endKey = DATE_ONLY_REGEX.test(options.localDateKey)
    ? options.localDateKey
    : new Date().toISOString().slice(0, 10);

  let startKey = '0000-01-01';
  let rangeLabel = 'All Time';
  if (options.rangePreset === '7d') {
    startKey = addDaysToKey(endKey, -6);
    rangeLabel = 'Last 7 Days';
  } else if (options.rangePreset === '30d') {
    startKey = addDaysToKey(endKey, -29);
    rangeLabel = 'Last 30 Days';
  } else if (options.rangePreset === '90d') {
    startKey = addDaysToKey(endKey, -89);
    rangeLabel = 'Last 90 Days';
  } else if (options.rangePreset === 'month') {
    startKey = `${endKey.slice(0, 7)}-01`;
    rangeLabel = 'This Month';
  }

  const categoryFilter = options.category ?? 'all';
  const filtered = records.filter((row) => {
    if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
    const key = parseDateKeyFromRecord(row.recorded_at, endKey);
    if (options.rangePreset === 'all') return true;
    return key >= startKey && key <= endKey;
  });

  const byCategory: Record<
    ActivityCategory,
    { grossKg: number; offsetKg: number; netKg: number; sharePct: number; count: number }
  > = {
    transport: { grossKg: 0, offsetKg: 0, netKg: 0, sharePct: 0, count: 0 },
    electricity: { grossKg: 0, offsetKg: 0, netKg: 0, sharePct: 0, count: 0 },
    food: { grossKg: 0, offsetKg: 0, netKg: 0, sharePct: 0, count: 0 },
    lifestyle: { grossKg: 0, offsetKg: 0, netKg: 0, sharePct: 0, count: 0 },
  };

  let grossKg = 0;
  let avoidedKg = 0;
  const activeDaySet = new Set<string>();

  for (const row of filtered) {
    const val = Number(row.emissions_kg) || 0;
    const dayKey = parseDateKeyFromRecord(row.recorded_at, endKey);
    activeDaySet.add(dayKey);
    const cat = byCategory[row.category];
    cat.count += 1;
    if (row.direction === 'offset') {
      avoidedKg += val;
      cat.offsetKg += val;
    } else {
      grossKg += val;
      cat.grossKg += val;
    }
  }

  let highestCategory: ActivityCategory | null = null;
  let highestGross = 0;
  (['transport', 'electricity', 'food', 'lifestyle'] as ActivityCategory[]).forEach((catKey) => {
    const bucket = byCategory[catKey];
    bucket.grossKg = roundTo(bucket.grossKg, 2);
    bucket.offsetKg = roundTo(bucket.offsetKg, 2);
    bucket.netKg = roundTo(bucket.grossKg - bucket.offsetKg, 2);
    bucket.sharePct = grossKg > 0 ? roundTo((bucket.grossKg / grossKg) * 100, 1) : 0;
    if (bucket.grossKg > highestGross) {
      highestGross = bucket.grossKg;
      highestCategory = catKey;
    }
  });

  const netKg = roundTo(grossKg - avoidedKg, 2);
  const activeDays = activeDaySet.size;
  const dailyAverageNetKg = activeDays > 0 ? roundTo(netKg / activeDays, 2) : 0;

  // Derive deterministic score from 30d window
  const scoreStartKey = addDaysToKey(endKey, -29);
  const last30Records = records.filter((row) => {
    const key = parseDateKeyFromRecord(row.recorded_at, endKey);
    return key >= scoreStartKey && key <= endKey;
  });
  let sustainabilityScore = Math.max(0, Math.min(100, Math.round(options.profileBaselineScore || 50)));
  if (last30Records.length > 0) {
    let gross30 = 0;
    let offset30 = 0;
    const days30 = new Set<string>();
    for (const r of last30Records) {
      days30.add(parseDateKeyFromRecord(r.recorded_at, endKey));
      if (r.direction === 'offset') offset30 += Number(r.emissions_kg) || 0;
      else gross30 += Number(r.emissions_kg) || 0;
    }
    const active30 = days30.size;
    const avgDailyNet = (gross30 - offset30) / Math.max(active30, 1);
    const budget = Math.max(options.dailyBudgetKg, 2);
    const budgetRatio = avgDailyNet / budget;
    const adherence = Math.min(
      55,
      Math.max(0, budgetRatio <= 1 ? Math.round(55 - Math.max(0, budgetRatio) * 14) : Math.round(55 - (budgetRatio - 1) * 35))
    );
    const offsetShare = offset30 / Math.max(gross30 + offset30, 1);
    const offsetPts = Math.min(25, Math.round(offsetShare * 55));
    const consistencyPts = Math.min(
      20,
      Math.round(Math.min(active30 / 10, 1) * 14) + Math.min(options.completedChallengesCount * 2, 6)
    );
    sustainabilityScore = Math.min(100, Math.max(0, adherence + offsetPts + consistencyPts));
  }

  const transportGross = byCategory.transport.grossKg;
  const electricityGross = byCategory.electricity.grossKg;
  let dominant: 'transport' | 'electricity' | 'tied' | 'none' = 'none';
  if (transportGross > 0 || electricityGross > 0) {
    if (Math.abs(transportGross - electricityGross) < 0.005) dominant = 'tied';
    else dominant = transportGross > electricityGross ? 'transport' : 'electricity';
  }

  const topEmitters = [...filtered]
    .filter((r) => r.direction === 'emission')
    .sort((a, b) => (Number(b.emissions_kg) || 0) - (Number(a.emissions_kg) || 0))
    .slice(0, 5)
    .map((r) => ({
      title: r.title,
      category: r.category,
      emissionsKg: roundTo(Number(r.emissions_kg) || 0, 2),
      dateKey: parseDateKeyFromRecord(r.recorded_at, endKey),
    }));

  return {
    rangeLabel,
    startKey: options.rangePreset === 'all' ? 'earliest' : startKey,
    endKey,
    recordCount: filtered.length,
    activeDays,
    grossKg: roundTo(grossKg, 2),
    avoidedKg: roundTo(avoidedKg, 2),
    netKg,
    dailyAverageNetKg,
    sustainabilityScore,
    byCategory,
    highestCategory,
    transportVsElectricity: {
      transportGrossKg: transportGross,
      electricityGrossKg: electricityGross,
      dominant,
      gapKg: roundTo(Math.abs(transportGross - electricityGross), 2),
    },
    topEmitters,
  };
}

export const ECO_GEMINI_TOOLS = [
  {
    type: 'function' as const,
    name: 'calculate_transport_comparison',
    description:
      'Deterministically calculates exact CO2e emissions for a trip or commute using UK DESNZ 2024 and IEA/regional EV grid factors, and optionally compares two transport modes to compute exact savings in kg CO2e.',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['car', 'motorcycle', 'bus', 'train', 'air', 'walking', 'cycling'],
          description: 'Primary transport mode.',
        },
        distance: {
          type: 'number',
          description: 'Trip distance (one-way unless flight is_round_trip=true).',
        },
        distance_unit: {
          type: 'string',
          enum: ['km', 'mi'],
        },
        car_fuel: {
          type: 'string',
          enum: ['petrol', 'diesel', 'hybrid', 'electric'],
        },
        passengers: {
          type: 'integer',
          description: 'Car occupancy (1-6) for carpool sharing.',
        },
        bus_type: { type: 'string', enum: ['city', 'coach'] },
        train_type: { type: 'string', enum: ['national', 'metro', 'international'] },
        flight_class: {
          type: 'string',
          enum: ['domestic', 'short-economy', 'short-business', 'long-economy', 'long-business'],
        },
        is_round_trip: { type: 'boolean' },
        cycling_mode: { type: 'string', enum: ['conventional', 'ebike'] },
        compare_mode: {
          type: 'string',
          enum: ['car', 'motorcycle', 'bus', 'train', 'air', 'walking', 'cycling'],
          description: 'Optional alternative mode for the same distance to compute savings.',
        },
        compare_car_fuel: { type: 'string', enum: ['petrol', 'diesel', 'hybrid', 'electric'] },
        compare_passengers: { type: 'integer' },
        compare_bus_type: { type: 'string', enum: ['city', 'coach'] },
        compare_train_type: { type: 'string', enum: ['national', 'metro', 'international'] },
        compare_cycling_mode: { type: 'string', enum: ['conventional', 'ebike'] },
      },
      required: ['mode', 'distance'],
    },
  },
  {
    type: 'function' as const,
    name: 'calculate_electricity_impact',
    description:
      'Deterministically calculates household electricity CO2e emissions from kWh consumption using the user configured regional electricity grid (or specified region), with optional household split, solar offset, or regional comparison.',
    parameters: {
      type: 'object',
      properties: {
        kwh: { type: 'number', description: 'Electricity consumption in kWh.' },
        period_basis: { type: 'string', enum: ['monthly', 'daily-average'] },
        household_members: { type: 'integer' },
        region_code: {
          type: 'string',
          enum: ['global', 'us-avg', 'us-camx', 'uk', 'eu', 'de', 'fr', 'in', 'cn', 'ca', 'au', 'jp', 'custom'],
        },
        mode: { type: 'string', enum: ['grid', 'solar-offset'] },
        reduction_percent: {
          type: 'number',
          description: 'Optional efficiency reduction percentage (e.g. 15 or 20) to quantify exact kWh and CO2e savings.',
        },
      },
      required: ['kwh'],
    },
  },
  {
    type: 'function' as const,
    name: 'calculate_food_comparison',
    description:
      'Deterministically computes CO2e for meals (beef, pork, poultry, mixed, vegetarian, vegan), dairy servings, or food waste (landfill vs compost), and optionally compares replacing meal_a with meal_b.',
    parameters: {
      type: 'object',
      properties: {
        meal_type: {
          type: 'string',
          enum: ['beef', 'pork', 'poultry', 'mixed', 'vegetarian', 'vegan'],
        },
        meal_count: { type: 'number' },
        compare_meal_type: {
          type: 'string',
          enum: ['beef', 'pork', 'poultry', 'mixed', 'vegetarian', 'vegan'],
        },
        dairy_type: { type: 'string', enum: ['milk', 'cheese', 'mixed'] },
        dairy_servings: { type: 'number' },
        food_waste_kg: { type: 'number' },
        food_waste_method: { type: 'string', enum: ['landfill', 'compost'] },
      },
    },
  },
  {
    type: 'function' as const,
    name: 'calculate_lifestyle_impact',
    description:
      'Deterministically calculates CO2e from municipal/heated water use, landfill household waste, and avoided recycling savings (mixed, paper, plastic, glass, aluminum).',
    parameters: {
      type: 'object',
      properties: {
        water_liters: { type: 'number' },
        water_heater_type: { type: 'string', enum: ['cold', 'hot-electric', 'hot-gas'] },
        waste_kg: { type: 'number' },
        recycling_kg: { type: 'number' },
        recycling_material: {
          type: 'string',
          enum: ['mixed', 'paper', 'plastic', 'glass', 'aluminum'],
        },
      },
    },
  },
  {
    type: 'function' as const,
    name: 'get_user_footprint_analytics',
    description:
      'Computes exact verified statistics over the authenticated user EcoTrack carbon_emission_records for a chosen timeframe and optional category.',
    parameters: {
      type: 'object',
      properties: {
        range_preset: {
          type: 'string',
          enum: ['7d', '30d', 'month', '90d', 'all'],
        },
        category: {
          type: 'string',
          enum: ['all', 'transport', 'electricity', 'food', 'lifestyle'],
        },
      },
      required: ['range_preset'],
    },
  },
  {
    type: 'function' as const,
    name: 'simulate_reduction_plan',
    description:
      'Computes a concrete numeric target savings plan (kg CO2e to cut and practical equivalents in petrol car km avoided or red-meat meal swaps) anchored directly to the user logged emissions.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'transport', 'electricity', 'food', 'lifestyle'],
        },
        reduction_percent: {
          type: 'number',
          description: 'Target reduction percentage between 5 and 80.',
        },
        timeframe: {
          type: 'string',
          enum: ['7d', '30d', 'month'],
        },
      },
      required: ['category', 'reduction_percent'],
    },
  },
];

function asNumber(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function executeEcoToolCall(
  toolName: string,
  rawArgs: Record<string, unknown>,
  ctx: ToolExecutionContext
): ToolExecutionOutcome {
  const citations: VerifiedCalculationCitation[] = [];

  if (toolName === 'calculate_transport_comparison') {
    const mode = (rawArgs.mode as TransportMode) || 'car';
    const distance = asNumber(rawArgs.distance);
    if (distance === undefined || distance <= 0) {
      return {
        result: { error: 'Distance must be a positive number.' },
        citations,
        savingsKg: null,
        isError: true,
      };
    }

    const primary = computeSingleTransport({
      mode,
      distance,
      distanceUnit: (rawArgs.distance_unit as DistanceUnit) ?? 'km',
      carFuel: rawArgs.car_fuel as CarFuelType | undefined,
      passengers: asNumber(rawArgs.passengers),
      busType: rawArgs.bus_type as BusServiceType | undefined,
      trainType: rawArgs.train_type as TrainServiceType | undefined,
      flightClass: rawArgs.flight_class as FlightHaulClass | undefined,
      isRoundTrip: Boolean(rawArgs.is_round_trip),
      cyclingMode: rawArgs.cycling_mode as CyclingMode | undefined,
      countAsCarReplacementOffset: false,
      electricityRegion: ctx.defaultRegion,
      customElectricityFactorKg: ctx.defaultCustomGridFactorKg,
    });

    if (!primary.ok) {
      return {
        result: { error: primary.error },
        citations,
        savingsKg: null,
        isError: true,
      };
    }

    citations.push({
      label: primary.title,
      formula: primary.formula,
      resultKg: primary.emissionsKg,
      direction: primary.direction,
      source: primary.source,
    });

    let comparison: Record<string, unknown> | null = null;
    let savingsKg: number | null = null;

    if (typeof rawArgs.compare_mode === 'string' && rawArgs.compare_mode.trim()) {
      const compareMode = rawArgs.compare_mode as TransportMode;
      const alt = computeSingleTransport({
        mode: compareMode,
        distance,
        distanceUnit: (rawArgs.distance_unit as DistanceUnit) ?? 'km',
        carFuel: rawArgs.compare_car_fuel as CarFuelType | undefined,
        passengers: asNumber(rawArgs.compare_passengers),
        busType: rawArgs.compare_bus_type as BusServiceType | undefined,
        trainType: rawArgs.compare_train_type as TrainServiceType | undefined,
        cyclingMode: rawArgs.compare_cycling_mode as CyclingMode | undefined,
        countAsCarReplacementOffset: false,
        electricityRegion: ctx.defaultRegion,
        customElectricityFactorKg: ctx.defaultCustomGridFactorKg,
      });

      if (alt.ok) {
        citations.push({
          label: alt.title,
          formula: alt.formula,
          resultKg: alt.emissionsKg,
          direction: alt.direction,
          source: alt.source,
        });
        const delta = roundTo(primary.emissionsKg - alt.emissionsKg, 2);
        const absSavings = roundTo(Math.abs(delta), 2);
        savingsKg = absSavings > 0 ? absSavings : null;

        if (absSavings > 0) {
          const lowerTitle = delta > 0 ? alt.title : primary.title;
          citations.push({
            label: `Savings choosing ${lowerTitle}`,
            formula: `${Math.max(primary.emissionsKg, alt.emissionsKg).toFixed(2)} - ${Math.min(primary.emissionsKg, alt.emissionsKg).toFixed(2)} = ${absSavings.toFixed(2)} kg saved`,
            resultKg: absSavings,
            direction: 'savings',
            source: primary.source,
          });
        }

        comparison = {
          alternativeTitle: alt.title,
          alternativeKg: alt.emissionsKg,
          alternativeFormula: alt.formula,
          savingsKg: absSavings,
          lowerOption: delta > 0 ? alt.title : delta < 0 ? primary.title : 'Equal',
        };
      }
    }

    return {
      result: {
        primary: {
          title: primary.title,
          emissionsKg: primary.emissionsKg,
          distanceKm: primary.distanceKm,
          emissionFactorKgPerKm: primary.emissionFactorKg,
          formula: primary.formula,
          source: primary.source,
          regionCode: primary.regionCode,
        },
        comparison,
      },
      citations,
      savingsKg,
      isError: false,
    };
  }

  if (toolName === 'calculate_electricity_impact') {
    const kwh = asNumber(rawArgs.kwh);
    if (kwh === undefined || kwh <= 0 || kwh > 100000) {
      return {
        result: { error: 'kWh must be between 0 and 100,000.' },
        citations,
        savingsKg: null,
        isError: true,
      };
    }

    const regionCode =
      (rawArgs.region_code as ElectricityRegionCode | undefined) ?? ctx.defaultRegion;
    const region = resolveElectricityRegion(
      regionCode,
      regionCode === 'custom' ? ctx.defaultCustomGridFactorKg : null
    );
    if (!region.ok) {
      return {
        result: { error: region.error },
        citations,
        savingsKg: null,
        isError: true,
      };
    }

    const periodBasis: ElectricityPeriodBasis =
      rawArgs.period_basis === 'daily-average' ? 'daily-average' : 'monthly';
    const members = Math.max(1, Math.min(20, Math.round(asNumber(rawArgs.household_members) ?? 1)));
    const divisor = periodBasis === 'daily-average' ? CONVERSION_FACTORS.DAYS_PER_STANDARD_MONTH : 1;
    const effectiveKwh = roundTo(kwh / divisor / members, 2);
    const emissionsKg = applyEmissionFormula(effectiveKwh, region.factorKgPerKwh);
    const mode: ElectricityMode = rawArgs.mode === 'solar-offset' ? 'solar-offset' : 'grid';
    const formula = `${effectiveKwh} kWh × ${formatFactorDisplay(region.factorKgPerKwh)} kg CO₂e/kWh = ${mode === 'solar-offset' ? '-' : ''}${emissionsKg.toFixed(2)} kg CO₂e`;

    citations.push({
      label: `${region.shortLabel} Electricity (${effectiveKwh} kWh)`,
      formula,
      resultKg: emissionsKg,
      direction: mode === 'solar-offset' ? 'offset' : 'emission',
      source: region.source,
    });

    let reductionPlan: Record<string, unknown> | null = null;
    let savingsKg: number | null = null;
    const reductionPct = asNumber(rawArgs.reduction_percent);
    if (reductionPct !== undefined && reductionPct > 0 && reductionPct <= 100) {
      const savedKwh = roundTo(effectiveKwh * (reductionPct / 100), 2);
      const savedKg = applyEmissionFormula(savedKwh, region.factorKgPerKwh);
      savingsKg = savedKg;
      citations.push({
        label: `${reductionPct}% Electricity Cut`,
        formula: `${savedKwh} kWh saved × ${formatFactorDisplay(region.factorKgPerKwh)} kg/kWh = ${savedKg.toFixed(2)} kg saved`,
        resultKg: savedKg,
        direction: 'savings',
        source: region.source,
      });
      reductionPlan = {
        reductionPercent: reductionPct,
        savedKwh,
        savedKg,
        remainingKg: roundTo(emissionsKg - savedKg, 2),
      };
    }

    return {
      result: {
        regionCode: region.regionCode,
        regionLabel: region.label,
        factorKgPerKwh: region.factorKgPerKwh,
        effectiveKwh,
        householdMembers: members,
        periodBasis,
        mode,
        emissionsKg,
        formula,
        source: region.source,
        reductionPlan,
      },
      citations,
      savingsKg,
      isError: false,
    };
  }

  if (toolName === 'calculate_food_comparison') {
    const payload: Record<string, unknown> = {};
    let savingsKg: number | null = null;

    if (typeof rawArgs.meal_type === 'string') {
      const mealCount = asNumber(rawArgs.meal_count) ?? 1;
      const mealA = computeSingleMeal(rawArgs.meal_type, mealCount);
      if (!mealA.ok) {
        return { result: { error: mealA.error }, citations, savingsKg: null, isError: true };
      }
      citations.push({
        label: mealA.title,
        formula: mealA.formula,
        resultKg: mealA.emissionsKg,
        direction: 'emission',
        source: mealA.source,
      });
      payload.primaryMeal = mealA;

      if (typeof rawArgs.compare_meal_type === 'string') {
        const mealB = computeSingleMeal(rawArgs.compare_meal_type, mealCount);
        if (mealB.ok) {
          citations.push({
            label: mealB.title,
            formula: mealB.formula,
            resultKg: mealB.emissionsKg,
            direction: 'emission',
            source: mealB.source,
          });
          const diff = roundTo(Math.abs(mealA.emissionsKg - mealB.emissionsKg), 2);
          savingsKg = diff > 0 ? diff : null;
          if (diff > 0) {
            citations.push({
              label: `Meal swap savings (${mealA.count} meals)`,
              formula: `${Math.max(mealA.emissionsKg, mealB.emissionsKg).toFixed(2)} - ${Math.min(mealA.emissionsKg, mealB.emissionsKg).toFixed(2)} = ${diff.toFixed(2)} kg saved`,
              resultKg: diff,
              direction: 'savings',
              source: mealB.source,
            });
          }
          payload.comparisonMeal = mealB;
          payload.swapSavingsKg = diff;
        }
      }
    }

    const dairyServings = asNumber(rawArgs.dairy_servings);
    if (dairyServings !== undefined && dairyServings > 0) {
      const dairyType: DairyProductType = (rawArgs.dairy_type as DairyProductType) ?? 'milk';
      const meta = DAIRY_PRODUCT_FACTORS[dairyType] ?? DAIRY_PRODUCT_FACTORS.milk;
      const kg = applyEmissionFormula(dairyServings, meta.factorKgPerUnit);
      const formula = `${dairyServings} servings × ${formatFactorDisplay(meta.factorKgPerUnit)} kg/serving = ${kg.toFixed(2)} kg CO₂e`;
      citations.push({
        label: meta.label,
        formula,
        resultKg: kg,
        direction: 'emission',
        source: meta.source,
      });
      payload.dairy = { label: meta.label, emissionsKg: kg, formula, source: meta.source };
    }

    const foodWasteKg = asNumber(rawArgs.food_waste_kg);
    if (foodWasteKg !== undefined && foodWasteKg > 0) {
      const method: FoodWasteMethod =
        rawArgs.food_waste_method === 'compost' ? 'compost' : 'landfill';
      const meta = FOOD_WASTE_FACTORS[method];
      const kg = applyEmissionFormula(foodWasteKg, meta.factorKgPerUnit);
      const formula = `${foodWasteKg} kg × ${formatFactorDisplay(meta.factorKgPerUnit)} kg/kg = ${kg.toFixed(2)} kg CO₂e`;
      citations.push({
        label: `Food Waste (${meta.label})`,
        formula,
        resultKg: kg,
        direction: 'emission',
        source: meta.source,
      });
      payload.foodWaste = { method, emissionsKg: kg, formula, source: meta.source };
    }

    if (Object.keys(payload).length === 0) {
      return {
        result: { error: 'Provide meal_type, dairy_servings, or food_waste_kg.' },
        citations,
        savingsKg: null,
        isError: true,
      };
    }

    return { result: payload, citations, savingsKg, isError: false };
  }

  if (toolName === 'calculate_lifestyle_impact') {
    const payload: Record<string, unknown> = {};
    let savingsKg: number | null = null;

    const waterLiters = asNumber(rawArgs.water_liters);
    if (waterLiters !== undefined && waterLiters > 0) {
      const heater: WaterHeaterType = (rawArgs.water_heater_type as WaterHeaterType) ?? 'cold';
      const meta = WATER_HEATER_FACTORS[heater] ?? WATER_HEATER_FACTORS.cold;
      let factorPerLiter = meta.baseSupplyKgPerLiter;
      let source = meta.source;
      if (heater === 'hot-electric') {
        const reg = resolveElectricityRegion(ctx.defaultRegion, ctx.defaultCustomGridFactorKg);
        const gridFactor = reg.ok ? reg.factorKgPerKwh : 0.445;
        factorPerLiter = roundTo(
          meta.baseSupplyKgPerLiter + CONVERSION_FACTORS.HOT_WATER_ELECTRIC_KWH_PER_LITER * gridFactor,
          6
        );
        source = reg.ok ? `${meta.source}; ${reg.source}` : meta.source;
      } else if (heater === 'hot-gas') {
        factorPerLiter = roundTo(
          meta.baseSupplyKgPerLiter + (meta.gasHeatingKgPerLiter ?? 0),
          6
        );
      }
      const kg = applyEmissionFormula(waterLiters, factorPerLiter);
      const formula = `${waterLiters} L × ${formatFactorDisplay(factorPerLiter)} kg/L = ${kg.toFixed(3)} kg CO₂e`;
      citations.push({
        label: `Water (${meta.label})`,
        formula,
        resultKg: kg,
        direction: 'emission',
        source,
      });
      payload.water = { emissionsKg: kg, formula, source };
    }

    const wasteKg = asNumber(rawArgs.waste_kg);
    if (wasteKg !== undefined && wasteKg > 0) {
      const kg = applyEmissionFormula(wasteKg, LIFESTYLE_WASTE_FACTOR.factorKgPerUnit);
      const formula = `${wasteKg} kg × ${formatFactorDisplay(LIFESTYLE_WASTE_FACTOR.factorKgPerUnit)} kg/kg = ${kg.toFixed(2)} kg CO₂e`;
      citations.push({
        label: LIFESTYLE_WASTE_FACTOR.label,
        formula,
        resultKg: kg,
        direction: 'emission',
        source: LIFESTYLE_WASTE_FACTOR.source,
      });
      payload.waste = { emissionsKg: kg, formula, source: LIFESTYLE_WASTE_FACTOR.source };
    }

    const recyclingKg = asNumber(rawArgs.recycling_kg);
    if (recyclingKg !== undefined && recyclingKg > 0) {
      const material: RecyclingMaterialType =
        (rawArgs.recycling_material as RecyclingMaterialType) ?? 'mixed';
      const meta = RECYCLING_MATERIAL_FACTORS[material] ?? RECYCLING_MATERIAL_FACTORS.mixed;
      const savedKg = applyEmissionFormula(recyclingKg, meta.factorKgPerUnit);
      const formula = `${recyclingKg} kg × ${formatFactorDisplay(meta.factorKgPerUnit)} kg/kg = -${savedKg.toFixed(2)} kg avoided`;
      citations.push({
        label: `Recycling (${meta.label})`,
        formula,
        resultKg: savedKg,
        direction: 'offset',
        source: meta.source,
      });
      savingsKg = savedKg;
      payload.recycling = {
        material,
        avoidedKg: savedKg,
        formula,
        source: meta.source,
      };
    }

    if (Object.keys(payload).length === 0) {
      return {
        result: { error: 'Provide water_liters, waste_kg, or recycling_kg.' },
        citations,
        savingsKg: null,
        isError: true,
      };
    }

    return { result: payload, citations, savingsKg, isError: false };
  }

  if (toolName === 'get_user_footprint_analytics') {
    const preset = (rawArgs.range_preset as '7d' | '30d' | 'month' | '90d' | 'all') ?? '30d';
    const category = (rawArgs.category as 'all' | ActivityCategory) ?? 'all';
    const summary = summarizeUserAnalyticsWindow(ctx.records, {
      rangePreset: preset,
      category,
      localDateKey: ctx.localDateKey,
      dailyBudgetKg: ctx.dailyBudgetKg,
      completedChallengesCount: ctx.completedChallengesCount,
      profileBaselineScore: ctx.profileBaselineScore,
    });

    citations.push({
      label: `User Records (${summary.rangeLabel})`,
      formula: `${summary.grossKg.toFixed(2)} gross - ${summary.avoidedKg.toFixed(2)} avoided = ${summary.netKg.toFixed(2)} kg net (${summary.recordCount} entries)`,
      resultKg: summary.netKg,
      direction: summary.netKg < 0 ? 'offset' : 'emission',
      source: 'Authenticated EcoTrack carbon_emission_records',
    });

    return {
      result: summary,
      citations,
      savingsKg: null,
      isError: false,
    };
  }

  if (toolName === 'simulate_reduction_plan') {
    const category = (rawArgs.category as 'all' | ActivityCategory) ?? 'all';
    const pct = Math.max(5, Math.min(80, asNumber(rawArgs.reduction_percent) ?? 20));
    const timeframe = (rawArgs.timeframe as '7d' | '30d' | 'month') ?? '7d';

    const summary = summarizeUserAnalyticsWindow(ctx.records, {
      rangePreset: timeframe,
      category,
      localDateKey: ctx.localDateKey,
      dailyBudgetKg: ctx.dailyBudgetKg,
      completedChallengesCount: ctx.completedChallengesCount,
      profileBaselineScore: ctx.profileBaselineScore,
    });

    const baselineGrossKg = summary.grossKg;
    const targetReductionKg = roundTo(baselineGrossKg * (pct / 100), 2);
    const projectedAfterKg = roundTo(Math.max(0, baselineGrossKg - targetReductionKg), 2);

    // Deterministic swap equivalents
    const carKmEquivalent =
      targetReductionKg > 0
        ? roundTo(targetReductionKg / CAR_FUEL_FACTORS.petrol.factorKgPerUnit, 1)
        : 0;
    const beefToVeganSwapSavings = roundTo(
      NON_VEGETARIAN_MEAL_FACTORS.beef.factorKgPerUnit - VEGETARIAN_MEAL_FACTORS.vegan.factorKgPerUnit,
      2
    );
    const beefSwapsNeeded =
      targetReductionKg > 0 ? roundTo(targetReductionKg / beefToVeganSwapSavings, 1) : 0;

    if (targetReductionKg > 0) {
      citations.push({
        label: `${pct}% ${category === 'all' ? 'Footprint' : category} Target (${summary.rangeLabel})`,
        formula: `${baselineGrossKg.toFixed(2)} kg × ${pct}% = ${targetReductionKg.toFixed(2)} kg CO₂e saved`,
        resultKg: targetReductionKg,
        direction: 'savings',
        source: 'EcoTrack logs + UK DESNZ 2024 / Scarborough et al. (2023) equivalents',
      });
    }

    return {
      result: {
        category,
        timeframe: summary.rangeLabel,
        baselineGrossKg,
        reductionPercent: pct,
        targetReductionKg,
        projectedAfterKg,
        hasLoggedRecords: summary.recordCount > 0,
        equivalentPetrolCarKmReplaced: carKmEquivalent,
        equivalentBeefToVeganMealSwaps: beefSwapsNeeded,
      },
      citations,
      savingsKg: targetReductionKg > 0 ? targetReductionKg : null,
      isError: false,
    };
  }

  return {
    result: { error: `Unknown tool: ${toolName}` },
    citations,
    savingsKg: null,
    isError: true,
  };
}
