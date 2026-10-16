import {
  BUS_SERVICE_FACTORS,
  CAR_FUEL_FACTORS,
  CONVERSION_FACTORS,
  CYCLING_FACTORS,
  DAIRY_PRODUCT_FACTORS,
  ELECTRICITY_REGION_MAP,
  FLIGHT_CLASS_FACTORS,
  FOOD_WASTE_FACTORS,
  LIFESTYLE_WASTE_FACTOR,
  MOTORCYCLE_SIZE_FACTORS,
  NON_VEGETARIAN_MEAL_FACTORS,
  RECYCLING_MATERIAL_FACTORS,
  TRAIN_SERVICE_FACTORS,
  VEGETARIAN_MEAL_FACTORS,
  WALKING_FACTORS,
  WATER_HEATER_FACTORS,
} from '../constants/emissionFactors';
import type {
  ActivityCategory,
  BusServiceType,
  CalculationBatchResult,
  CalculationLineItem,
  CarFuelType,
  CyclingMode,
  DairyProductType,
  DistanceUnit,
  ElectricityMode,
  ElectricityPeriodBasis,
  ElectricityRegionCode,
  FlightHaulClass,
  FoodWasteMethod,
  MassUnit,
  MotorcycleSize,
  NonVegetarianProteinType,
  RecyclingMaterialType,
  TrainServiceType,
  TransportMode,
  VegetarianType,
  WaterHeaterType,
  WaterVolumeUnit,
} from '../types/carbon';

/**
 * Legacy fallback baseline factors preserved for backward compatibility.
 */
export const BASELINE_EMISSION_FACTORS: Record<
  ActivityCategory,
  { factor: number; unit: string }
> = {
  transport: { factor: CAR_FUEL_FACTORS.petrol.factorKgPerUnit, unit: 'km' },
  electricity: { factor: ELECTRICITY_REGION_MAP.global.factorKgPerKwh, unit: 'kWh' },
  food: { factor: NON_VEGETARIAN_MEAL_FACTORS.poultry.factorKgPerUnit, unit: 'meals' },
  lifestyle: { factor: LIFESTYLE_WASTE_FACTOR.factorKgPerUnit, unit: 'kg' },
};

export const MAX_CUSTOM_GRID_FACTOR = 2.5;

export interface EngineResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface ResolvedElectricityRegion {
  regionCode: ElectricityRegionCode;
  label: string;
  shortLabel: string;
  factorKgPerKwh: number;
  source: string;
  isCustom: boolean;
}

export interface TransportCalculationInput {
  mode: TransportMode;
  distance: string | number;
  distanceUnit?: DistanceUnit;
  customTitle?: string;
  carFuel?: CarFuelType;
  passengers?: string | number;
  motorcycleSize?: MotorcycleSize;
  busType?: BusServiceType;
  trainType?: TrainServiceType;
  flightClass?: FlightHaulClass;
  isRoundTrip?: boolean;
  cyclingMode?: CyclingMode;
  countAsCarReplacementOffset?: boolean;
  electricityRegion?: ElectricityRegionCode;
  customElectricityFactorKg?: string | number | null;
}

export interface ElectricityCalculationInput {
  monthlyKwh: string | number;
  periodBasis?: ElectricityPeriodBasis;
  householdMembers?: string | number;
  regionCode?: ElectricityRegionCode;
  customFactorKg?: string | number | null;
  mode?: ElectricityMode;
  customTitle?: string;
}

export interface FoodCalculationInput {
  vegetarianMeals?: string | number;
  vegetarianType?: VegetarianType;
  nonVegetarianMeals?: string | number;
  nonVegetarianType?: NonVegetarianProteinType;
  dairyServings?: string | number;
  dairyType?: DairyProductType;
  foodWasteAmount?: string | number;
  foodWasteUnit?: MassUnit;
  foodWasteMethod?: FoodWasteMethod;
}

export interface LifestyleCalculationInput {
  waterAmount?: string | number;
  waterUnit?: WaterVolumeUnit;
  waterHeaterType?: WaterHeaterType;
  wasteAmount?: string | number;
  wasteUnit?: MassUnit;
  recyclingAmount?: string | number;
  recyclingUnit?: MassUnit;
  recyclingMaterial?: RecyclingMaterialType;
  electricityRegion?: ElectricityRegionCode;
  customElectricityFactorKg?: string | number | null;
}

const STRICT_NUMBER_REGEX = /^[+-]?(\d+\.?\d*|\.\d+)$/;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function formatFactorDisplay(factorKg: number): string {
  if (factorKg === 0) return '0.000';
  if (factorKg < 0.01) return factorKg.toFixed(6);
  return factorKg.toFixed(4);
}

/**
 * Deterministic core calculation formula:
 * CO₂ emissions (kg) = Activity amount × Emission factor
 */
export function applyEmissionFormula(
  activityAmount: number,
  emissionFactorKg: number
): number {
  if (
    !Number.isFinite(activityAmount) ||
    !Number.isFinite(emissionFactorKg) ||
    activityAmount < 0 ||
    emissionFactorKg < 0
  ) {
    return 0;
  }
  return roundTo(activityAmount * emissionFactorKg, 3);
}

export function estimateEmissionKg(
  category: ActivityCategory,
  quantity: number,
  customFactor?: number
): number {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }
  const factor = customFactor ?? BASELINE_EMISSION_FACTORS[category].factor;
  return applyEmissionFormula(quantity, factor);
}

export function calculateNetCarbon(emissionsKg: number, offsetsKg: number): number {
  return roundTo(emissionsKg - offsetsKg, 2);
}

export function calculateBudgetProgress(netKg: number, dailyBudgetKg: number): number {
  if (dailyBudgetKg <= 0) return 0;
  return Math.min(Math.max(netKg / dailyBudgetKg, 0), 1);
}

interface ParsedNumericField {
  isPresent: boolean;
  value: number;
  error?: string;
}

function parseNumericField(
  raw: string | number | null | undefined,
  fieldLabel: string
): ParsedNumericField {
  if (raw === null || raw === undefined) {
    return { isPresent: false, value: 0 };
  }

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      return {
        isPresent: true,
        value: 0,
        error: `${fieldLabel} must be a valid finite number.`,
      };
    }
    return { isPresent: true, value: raw };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { isPresent: false, value: 0 };
  }

  if (!STRICT_NUMBER_REGEX.test(trimmed)) {
    return {
      isPresent: true,
      value: 0,
      error: `${fieldLabel} must be a valid numeric value.`,
    };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return {
      isPresent: true,
      value: 0,
      error: `${fieldLabel} must be a valid finite number.`,
    };
  }

  return { isPresent: true, value: parsed };
}

function validatePositiveAmount(
  raw: string | number | null | undefined,
  fieldLabel: string,
  maxValue: number
): EngineResult<number> {
  const parsed = parseNumericField(raw, fieldLabel);
  if (parsed.error) {
    return { ok: false, error: parsed.error };
  }
  if (!parsed.isPresent || parsed.value <= 0) {
    return { ok: false, error: `${fieldLabel} must be greater than 0.` };
  }
  if (parsed.value > maxValue) {
    return {
      ok: false,
      error: `${fieldLabel} cannot exceed ${maxValue.toLocaleString()}.`,
    };
  }
  return { ok: true, data: parsed.value };
}

function validateOptionalNonNegativeAmount(
  raw: string | number | null | undefined,
  fieldLabel: string,
  maxValue: number
): EngineResult<number> {
  const parsed = parseNumericField(raw, fieldLabel);
  if (parsed.error) {
    return { ok: false, error: parsed.error };
  }
  if (!parsed.isPresent) {
    return { ok: true, data: 0 };
  }
  if (parsed.value < 0) {
    return { ok: false, error: `${fieldLabel} cannot be negative.` };
  }
  if (parsed.value > maxValue) {
    return {
      ok: false,
      error: `${fieldLabel} cannot exceed ${maxValue.toLocaleString()}.`,
    };
  }
  return { ok: true, data: parsed.value };
}

function validateWholeCount(
  raw: string | number | null | undefined,
  fieldLabel: string,
  min: number,
  max: number,
  defaultValue: number
): EngineResult<number> {
  const parsed = parseNumericField(raw, fieldLabel);
  if (parsed.error) {
    return { ok: false, error: parsed.error };
  }
  if (!parsed.isPresent) {
    return { ok: true, data: defaultValue };
  }
  if (!Number.isInteger(parsed.value) || parsed.value < min || parsed.value > max) {
    return {
      ok: false,
      error: `${fieldLabel} must be a whole number between ${min} and ${max}.`,
    };
  }
  return { ok: true, data: parsed.value };
}

function normalizeDistanceToKm(amount: number, unit: DistanceUnit): number {
  return unit === 'mi'
    ? roundTo(amount * CONVERSION_FACTORS.KM_PER_MILE, 3)
    : roundTo(amount, 3);
}

function normalizeMassToKg(amount: number, unit: MassUnit): number {
  if (unit === 'g') {
    return roundTo(amount / CONVERSION_FACTORS.GRAMS_PER_KG, 3);
  }
  if (unit === 'lb') {
    return roundTo(amount * CONVERSION_FACTORS.KG_PER_POUND, 3);
  }
  return roundTo(amount, 3);
}

function normalizeWaterToLiters(amount: number, unit: WaterVolumeUnit): number {
  if (unit === 'm3') {
    return roundTo(amount * CONVERSION_FACTORS.LITERS_PER_CUBIC_METER, 2);
  }
  if (unit === 'gal') {
    return roundTo(amount * CONVERSION_FACTORS.LITERS_PER_US_GALLON, 2);
  }
  return roundTo(amount, 2);
}

/**
 * Resolves a documented regional electricity emission factor or validated custom utility rate.
 */
export function resolveElectricityRegion(
  regionCode: ElectricityRegionCode = 'global',
  customFactorKg?: string | number | null
): EngineResult<ResolvedElectricityRegion> {
  const regionMeta = ELECTRICITY_REGION_MAP[regionCode];
  if (!regionMeta) {
    return { ok: false, error: 'Unsupported electricity grid region.' };
  }

  if (regionCode === 'custom') {
    const parsed = parseNumericField(customFactorKg, 'Custom grid emission factor');
    if (parsed.error) {
      return { ok: false, error: parsed.error };
    }
    if (!parsed.isPresent) {
      return {
        ok: false,
        error: 'Enter a custom electricity emission factor in kg CO₂e/kWh.',
      };
    }
    if (parsed.value < 0 || parsed.value > MAX_CUSTOM_GRID_FACTOR) {
      return {
        ok: false,
        error: `Custom electricity factor must be between 0 and ${MAX_CUSTOM_GRID_FACTOR} kg CO₂e/kWh.`,
      };
    }
    const factor = roundTo(parsed.value, 4);
    return {
      ok: true,
      data: {
        regionCode: 'custom',
        label: regionMeta.label,
        shortLabel: `Custom (${factor} kg/kWh)`,
        factorKgPerKwh: factor,
        source: regionMeta.source,
        isCustom: true,
      },
    };
  }

  return {
    ok: true,
    data: {
      regionCode: regionMeta.code,
      label: regionMeta.label,
      shortLabel: regionMeta.shortLabel,
      factorKgPerKwh: regionMeta.factorKgPerKwh,
      source: regionMeta.source,
      isCustom: false,
    },
  };
}

/**
 * Calculates CO₂e emissions (or car-replacement offset for walking/cycling) across all 7 transport modes.
 */
export function calculateTransportFootprint(
  input: TransportCalculationInput
): EngineResult<CalculationLineItem> {
  const distanceUnit: DistanceUnit = input.distanceUnit ?? 'km';
  const distanceCheck = validatePositiveAmount(input.distance, 'Distance', 50000);
  if (!distanceCheck.ok || distanceCheck.data === undefined) {
    return { ok: false, error: distanceCheck.error };
  }

  const rawDistance = distanceCheck.data;
  const baseDistanceKm = normalizeDistanceToKm(rawDistance, distanceUnit);
  const customTitle = input.customTitle?.trim();

  const unitConversionNote =
    distanceUnit === 'mi'
      ? `Converted ${rawDistance} mi × ${CONVERSION_FACTORS.KM_PER_MILE} km/mi = ${baseDistanceKm} km.`
      : `Distance recorded directly in canonical kilometers (${baseDistanceKm} km).`;

  if (input.mode === 'car') {
    const fuel: CarFuelType = input.carFuel ?? 'petrol';
    const occupantsCheck = validateWholeCount(
      input.passengers,
      'Passengers',
      1,
      6,
      1
    );
    if (!occupantsCheck.ok || occupantsCheck.data === undefined) {
      return { ok: false, error: occupantsCheck.error };
    }
    const passengers = occupantsCheck.data;

    let vehicleFactorKgPerKm: number;
    let source: string;
    let regionCode: ElectricityRegionCode | null = null;
    const assumptions: string[] = [unitConversionNote];

    if (fuel === 'electric') {
      const regionRes = resolveElectricityRegion(
        input.electricityRegion ?? 'global',
        input.customElectricityFactorKg
      );
      if (!regionRes.ok || !regionRes.data) {
        return { ok: false, error: regionRes.error };
      }
      regionCode = regionRes.data.regionCode;
      vehicleFactorKgPerKm = roundTo(
        CONVERSION_FACTORS.EV_KWH_PER_KM * regionRes.data.factorKgPerKwh,
        6
      );
      source = `EV draw (${CONVERSION_FACTORS.EV_KWH_PER_KM} kWh/km) × ${regionRes.data.source}`;
      assumptions.push(
        `EV grid factor (${regionRes.data.label}): ${CONVERSION_FACTORS.EV_KWH_PER_KM} kWh/km × ${regionRes.data.factorKgPerKwh} kg CO₂e/kWh = ${formatFactorDisplay(vehicleFactorKgPerKm)} kg CO₂e/vehicle-km.`
      );
    } else {
      const fuelMeta = CAR_FUEL_FACTORS[fuel];
      vehicleFactorKgPerKm = fuelMeta.factorKgPerUnit;
      source = fuelMeta.source;
      assumptions.push(fuelMeta.description);
    }

    const effectiveFactor = roundTo(vehicleFactorKgPerKm / passengers, 6);
    if (passengers > 1) {
      assumptions.push(
        `Carpool occupancy split across ${passengers} passengers: ${formatFactorDisplay(vehicleFactorKgPerKm)} ÷ ${passengers} = ${formatFactorDisplay(effectiveFactor)} kg CO₂e/passenger-km.`
      );
    }

    const emissionsKg = applyEmissionFormula(baseDistanceKm, effectiveFactor);
    const defaultTitle = `Car (${CAR_FUEL_FACTORS[fuel].label}${passengers > 1 ? `, ${passengers} riders` : ''})`;

    return {
      ok: true,
      data: {
        key: `transport-car-${fuel}`,
        title: customTitle || defaultTitle,
        category: 'transport',
        direction: 'emission',
        rawAmount: rawDistance,
        rawUnit: distanceUnit,
        activityAmount: baseDistanceKm,
        unitLabel: 'km',
        emissionFactorKg: effectiveFactor,
        emissionsKg,
        formulaText: `${baseDistanceKm} km × ${formatFactorDisplay(effectiveFactor)} kg CO₂e/km = ${emissionsKg.toFixed(2)} kg CO₂e`,
        regionCode,
        source,
        assumptions,
      },
    };
  }

  if (input.mode === 'motorcycle') {
    const size: MotorcycleSize = input.motorcycleSize ?? 'average';
    const meta = MOTORCYCLE_SIZE_FACTORS[size];
    const emissionsKg = applyEmissionFormula(baseDistanceKm, meta.factorKgPerUnit);
    return {
      ok: true,
      data: {
        key: `transport-moto-${size}`,
        title: customTitle || `Motorcycle (${meta.label})`,
        category: 'transport',
        direction: 'emission',
        rawAmount: rawDistance,
        rawUnit: distanceUnit,
        activityAmount: baseDistanceKm,
        unitLabel: 'km',
        emissionFactorKg: meta.factorKgPerUnit,
        emissionsKg,
        formulaText: `${baseDistanceKm} km × ${formatFactorDisplay(meta.factorKgPerUnit)} kg CO₂e/km = ${emissionsKg.toFixed(2)} kg CO₂e`,
        source: meta.source,
        assumptions: [unitConversionNote, meta.description],
      },
    };
  }

  if (input.mode === 'bus') {
    const busType: BusServiceType = input.busType ?? 'city';
    const meta = BUS_SERVICE_FACTORS[busType];
    const emissionsKg = applyEmissionFormula(baseDistanceKm, meta.factorKgPerUnit);
    return {
      ok: true,
      data: {
        key: `transport-bus-${busType}`,
        title: customTitle || meta.label,
        category: 'transport',
        direction: 'emission',
        rawAmount: rawDistance,
        rawUnit: distanceUnit,
        activityAmount: baseDistanceKm,
        unitLabel: 'km',
        emissionFactorKg: meta.factorKgPerUnit,
        emissionsKg,
        formulaText: `${baseDistanceKm} km × ${formatFactorDisplay(meta.factorKgPerUnit)} kg CO₂e/km = ${emissionsKg.toFixed(2)} kg CO₂e`,
        source: meta.source,
        assumptions: [unitConversionNote, meta.description],
      },
    };
  }

  if (input.mode === 'train') {
    const trainType: TrainServiceType = input.trainType ?? 'national';
    const meta = TRAIN_SERVICE_FACTORS[trainType];
    const emissionsKg = applyEmissionFormula(baseDistanceKm, meta.factorKgPerUnit);
    return {
      ok: true,
      data: {
        key: `transport-train-${trainType}`,
        title: customTitle || meta.label,
        category: 'transport',
        direction: 'emission',
        rawAmount: rawDistance,
        rawUnit: distanceUnit,
        activityAmount: baseDistanceKm,
        unitLabel: 'km',
        emissionFactorKg: meta.factorKgPerUnit,
        emissionsKg,
        formulaText: `${baseDistanceKm} km × ${formatFactorDisplay(meta.factorKgPerUnit)} kg CO₂e/km = ${emissionsKg.toFixed(2)} kg CO₂e`,
        source: meta.source,
        assumptions: [unitConversionNote, meta.description],
      },
    };
  }

  if (input.mode === 'air') {
    const flightClass: FlightHaulClass = input.flightClass ?? 'short-economy';
    const meta = FLIGHT_CLASS_FACTORS[flightClass];
    const isRoundTrip = Boolean(input.isRoundTrip);
    const totalFlightKm = isRoundTrip ? roundTo(baseDistanceKm * 2, 3) : baseDistanceKm;
    const emissionsKg = applyEmissionFormula(totalFlightKm, meta.factorKgPerUnit);

    const assumptions = [
      unitConversionNote,
      isRoundTrip
        ? `Round-trip flight doubles one-way distance (${baseDistanceKm} km × 2 = ${totalFlightKm} km).`
        : 'Calculated for one-way flight distance.',
      meta.description,
    ];

    return {
      ok: true,
      data: {
        key: `transport-air-${flightClass}`,
        title: customTitle || `Air Travel (${meta.label}${isRoundTrip ? ', Round-Trip' : ''})`,
        category: 'transport',
        direction: 'emission',
        rawAmount: rawDistance,
        rawUnit: distanceUnit,
        activityAmount: totalFlightKm,
        unitLabel: 'km',
        emissionFactorKg: meta.factorKgPerUnit,
        emissionsKg,
        formulaText: `${totalFlightKm} km × ${formatFactorDisplay(meta.factorKgPerUnit)} kg CO₂e/km = ${emissionsKg.toFixed(2)} kg CO₂e`,
        source: meta.source,
        assumptions,
      },
    };
  }

  if (input.mode === 'walking') {
    const asOffset = Boolean(input.countAsCarReplacementOffset);
    const factor = asOffset
      ? WALKING_FACTORS.carReplacementOffsetKgPerKm
      : WALKING_FACTORS.directEmissionKgPerKm;
    const emissionsKg = applyEmissionFormula(baseDistanceKm, factor);
    const direction = asOffset ? 'offset' : 'emission';

    return {
      ok: true,
      data: {
        key: asOffset ? 'transport-walking-offset' : 'transport-walking-direct',
        title: customTitle || (asOffset ? 'Walking (Car Replacement Offset)' : 'Walking'),
        category: 'transport',
        direction,
        rawAmount: rawDistance,
        rawUnit: distanceUnit,
        activityAmount: baseDistanceKm,
        unitLabel: 'km',
        emissionFactorKg: factor,
        emissionsKg,
        formulaText: `${baseDistanceKm} km × ${formatFactorDisplay(factor)} kg CO₂e/km = ${asOffset ? '-' : ''}${emissionsKg.toFixed(2)} kg CO₂e`,
        source: asOffset ? WALKING_FACTORS.offsetSource : WALKING_FACTORS.directSource,
        assumptions: [
          unitConversionNote,
          asOffset
            ? 'Counts avoided tailpipe emissions compared to an average solo petrol car trip.'
            : 'Human-powered walking produces 0.00 kg CO₂e/km direct transport emissions.',
        ],
      },
    };
  }

  // Cycling
  const cyclingMode: CyclingMode = input.cyclingMode ?? 'conventional';
  const cyclingMeta = CYCLING_FACTORS[cyclingMode];
  const asOffset = Boolean(input.countAsCarReplacementOffset);
  const assumptions: string[] = [unitConversionNote];
  let regionCode: ElectricityRegionCode | null = null;
  let ebikeFactorPerKm = 0;

  if (cyclingMode === 'ebike') {
    const regionRes = resolveElectricityRegion(
      input.electricityRegion ?? 'global',
      input.customElectricityFactorKg
    );
    if (!regionRes.ok || !regionRes.data) {
      return { ok: false, error: regionRes.error };
    }
    regionCode = regionRes.data.regionCode;
    ebikeFactorPerKm = roundTo(
      CONVERSION_FACTORS.EBIKE_KWH_PER_KM * regionRes.data.factorKgPerKwh,
      6
    );
    assumptions.push(
      `E-bike battery recharge on ${regionRes.data.label}: ${CONVERSION_FACTORS.EBIKE_KWH_PER_KM} kWh/km × ${regionRes.data.factorKgPerKwh} kg/kWh = ${formatFactorDisplay(ebikeFactorPerKm)} kg CO₂e/km.`
    );
  }

  const effectiveFactor = asOffset
    ? roundTo(Math.max(0, cyclingMeta.carReplacementOffsetKgPerKm - ebikeFactorPerKm), 6)
    : ebikeFactorPerKm;
  const direction = asOffset ? 'offset' : 'emission';
  const emissionsKg = applyEmissionFormula(baseDistanceKm, effectiveFactor);

  if (asOffset) {
    assumptions.push(
      cyclingMode === 'ebike'
        ? 'Net savings subtract e-bike grid charging from avoided petrol car emissions.'
        : 'Counts avoided emissions relative to an average solo petrol car trip.'
    );
  } else if (cyclingMode === 'conventional') {
    assumptions.push('Conventional bicycle riding produces 0.00 kg CO₂e/km direct emissions.');
  }

  return {
    ok: true,
    data: {
      key: `transport-cycling-${cyclingMode}-${direction}`,
      title:
        customTitle ||
        (asOffset
          ? `${cyclingMeta.label} (Car Swap Offset)`
          : cyclingMeta.label),
      category: 'transport',
      direction,
      rawAmount: rawDistance,
      rawUnit: distanceUnit,
      activityAmount: baseDistanceKm,
      unitLabel: 'km',
      emissionFactorKg: effectiveFactor,
      emissionsKg,
      formulaText: `${baseDistanceKm} km × ${formatFactorDisplay(effectiveFactor)} kg CO₂e/km = ${asOffset ? '-' : ''}${emissionsKg.toFixed(2)} kg CO₂e`,
      regionCode,
      source: asOffset ? cyclingMeta.offsetSource : cyclingMeta.directSource,
      assumptions,
    },
  };
}

/**
 * Calculates household electricity CO₂e from monthly consumption (kWh) and regional emission factor.
 */
export function calculateElectricityFootprint(
  input: ElectricityCalculationInput
): EngineResult<CalculationLineItem> {
  const kwhCheck = validatePositiveAmount(
    input.monthlyKwh,
    'Monthly electricity consumption (kWh)',
    100000
  );
  if (!kwhCheck.ok || kwhCheck.data === undefined) {
    return { ok: false, error: kwhCheck.error };
  }

  const householdCheck = validateWholeCount(
    input.householdMembers,
    'Household occupants',
    1,
    20,
    1
  );
  if (!householdCheck.ok || householdCheck.data === undefined) {
    return { ok: false, error: householdCheck.error };
  }

  const regionRes = resolveElectricityRegion(
    input.regionCode ?? 'global',
    input.customFactorKg
  );
  if (!regionRes.ok || !regionRes.data) {
    return { ok: false, error: regionRes.error };
  }

  const monthlyKwh = kwhCheck.data;
  const householdMembers = householdCheck.data;
  const periodBasis: ElectricityPeriodBasis = input.periodBasis ?? 'monthly';
  const mode: ElectricityMode = input.mode ?? 'grid';
  const region = regionRes.data;

  const periodDivisor =
    periodBasis === 'daily-average' ? CONVERSION_FACTORS.DAYS_PER_STANDARD_MONTH : 1;
  const activityKwh = roundTo(monthlyKwh / periodDivisor / householdMembers, 2);

  if (activityKwh <= 0) {
    return {
      ok: false,
      error: 'Per-person electricity share must exceed 0.01 kWh.',
    };
  }

  const emissionsKg = applyEmissionFormula(activityKwh, region.factorKgPerKwh);
  const fullMonthCo2Kg = applyEmissionFormula(monthlyKwh / householdMembers, region.factorKgPerKwh);
  const direction = mode === 'solar-offset' ? 'offset' : 'emission';

  const assumptions: string[] = [
    `Regional emission factor (${region.label}): ${region.factorKgPerKwh.toFixed(4)} kg CO₂e/kWh.`,
    periodBasis === 'daily-average'
      ? `Prorated from ${monthlyKwh} kWh/month ÷ ${CONVERSION_FACTORS.DAYS_PER_STANDARD_MONTH} days = ${roundTo(monthlyKwh / 30, 2)} kWh/day (full month share: ${fullMonthCo2Kg.toFixed(2)} kg CO₂e).`
      : `Calculated for full monthly billing consumption (${monthlyKwh} kWh; daily average ≈ ${roundTo(monthlyKwh / 30, 2)} kWh/day).`,
  ];

  if (householdMembers > 1) {
    assumptions.push(`Split evenly across ${householdMembers} household occupants.`);
  }

  const defaultTitle =
    mode === 'solar-offset'
      ? `Solar Offset (${region.shortLabel})`
      : periodBasis === 'daily-average'
        ? `Home Electricity — Daily Share (${region.shortLabel})`
        : `Monthly Electricity — ${region.shortLabel}`;

  return {
    ok: true,
    data: {
      key: `electricity-${region.regionCode}-${periodBasis}-${mode}`,
      title: input.customTitle?.trim() || defaultTitle,
      category: 'electricity',
      direction,
      rawAmount: monthlyKwh,
      rawUnit: 'kWh',
      activityAmount: activityKwh,
      unitLabel: 'kWh',
      emissionFactorKg: region.factorKgPerKwh,
      emissionsKg,
      formulaText: `${activityKwh} kWh × ${formatFactorDisplay(region.factorKgPerKwh)} kg CO₂e/kWh = ${direction === 'offset' ? '-' : ''}${emissionsKg.toFixed(2)} kg CO₂e`,
      regionCode: region.regionCode,
      source: region.source,
      assumptions,
    },
  };
}

/**
 * Calculates food CO₂e across Vegetarian meals, Non-vegetarian meals, Dairy consumption, and Food waste.
 */
export function calculateFoodFootprint(
  input: FoodCalculationInput
): EngineResult<CalculationBatchResult> {
  const vegCheck = validateOptionalNonNegativeAmount(
    input.vegetarianMeals,
    'Vegetarian meals',
    200
  );
  if (!vegCheck.ok || vegCheck.data === undefined) {
    return { ok: false, error: vegCheck.error };
  }

  const nonVegCheck = validateOptionalNonNegativeAmount(
    input.nonVegetarianMeals,
    'Non-vegetarian meals',
    200
  );
  if (!nonVegCheck.ok || nonVegCheck.data === undefined) {
    return { ok: false, error: nonVegCheck.error };
  }

  const dairyCheck = validateOptionalNonNegativeAmount(
    input.dairyServings,
    'Dairy servings',
    500
  );
  if (!dairyCheck.ok || dairyCheck.data === undefined) {
    return { ok: false, error: dairyCheck.error };
  }

  const wasteCheck = validateOptionalNonNegativeAmount(
    input.foodWasteAmount,
    'Food waste',
    50000
  );
  if (!wasteCheck.ok || wasteCheck.data === undefined) {
    return { ok: false, error: wasteCheck.error };
  }

  const items: CalculationLineItem[] = [];

  if (vegCheck.data > 0) {
    const vegType: VegetarianType = input.vegetarianType ?? 'vegetarian';
    const meta = VEGETARIAN_MEAL_FACTORS[vegType];
    const emissionsKg = applyEmissionFormula(vegCheck.data, meta.factorKgPerUnit);
    items.push({
      key: `food-veg-${vegType}`,
      title: meta.label,
      category: 'food',
      direction: 'emission',
      rawAmount: vegCheck.data,
      rawUnit: meta.unitLabel,
      activityAmount: roundTo(vegCheck.data, 2),
      unitLabel: meta.unitLabel,
      emissionFactorKg: meta.factorKgPerUnit,
      emissionsKg,
      formulaText: `${vegCheck.data} ${meta.unitLabel} × ${formatFactorDisplay(meta.factorKgPerUnit)} kg/${meta.unitLabel.replace(/s$/, '')} = ${emissionsKg.toFixed(2)} kg CO₂e`,
      source: meta.source,
      assumptions: [meta.description],
    });
  }

  if (nonVegCheck.data > 0) {
    const nonVegType: NonVegetarianProteinType = input.nonVegetarianType ?? 'mixed';
    const meta = NON_VEGETARIAN_MEAL_FACTORS[nonVegType];
    const emissionsKg = applyEmissionFormula(nonVegCheck.data, meta.factorKgPerUnit);
    items.push({
      key: `food-nonveg-${nonVegType}`,
      title: meta.label,
      category: 'food',
      direction: 'emission',
      rawAmount: nonVegCheck.data,
      rawUnit: meta.unitLabel,
      activityAmount: roundTo(nonVegCheck.data, 2),
      unitLabel: meta.unitLabel,
      emissionFactorKg: meta.factorKgPerUnit,
      emissionsKg,
      formulaText: `${nonVegCheck.data} ${meta.unitLabel} × ${formatFactorDisplay(meta.factorKgPerUnit)} kg/${meta.unitLabel.replace(/s$/, '')} = ${emissionsKg.toFixed(2)} kg CO₂e`,
      source: meta.source,
      assumptions: [meta.description],
    });
  }

  if (dairyCheck.data > 0) {
    const dairyType: DairyProductType = input.dairyType ?? 'milk';
    const meta = DAIRY_PRODUCT_FACTORS[dairyType];
    const emissionsKg = applyEmissionFormula(dairyCheck.data, meta.factorKgPerUnit);
    items.push({
      key: `food-dairy-${dairyType}`,
      title: `Dairy — ${meta.label}`,
      category: 'food',
      direction: 'emission',
      rawAmount: dairyCheck.data,
      rawUnit: meta.unitLabel,
      activityAmount: roundTo(dairyCheck.data, 2),
      unitLabel: meta.unitLabel,
      emissionFactorKg: meta.factorKgPerUnit,
      emissionsKg,
      formulaText: `${dairyCheck.data} ${meta.unitLabel} × ${formatFactorDisplay(meta.factorKgPerUnit)} kg/serving = ${emissionsKg.toFixed(2)} kg CO₂e`,
      source: meta.source,
      assumptions: [meta.description],
    });
  }

  if (wasteCheck.data > 0) {
    const wasteUnit: MassUnit = input.foodWasteUnit ?? 'kg';
    const method: FoodWasteMethod = input.foodWasteMethod ?? 'landfill';
    const meta = FOOD_WASTE_FACTORS[method];
    const normalizedKg = normalizeMassToKg(wasteCheck.data, wasteUnit);
    if (normalizedKg < 0.01) {
      return {
        ok: false,
        error: 'Converted food waste must be at least 0.01 kg (10 g).',
      };
    }
    const emissionsKg = applyEmissionFormula(normalizedKg, meta.factorKgPerUnit);
    const unitNote =
      wasteUnit === 'kg'
        ? `Recorded in canonical kilograms (${normalizedKg} kg).`
        : `Converted ${wasteCheck.data} ${wasteUnit} to ${normalizedKg} kg.`;

    items.push({
      key: `food-waste-${method}`,
      title: `Food Waste (${meta.label})`,
      category: 'food',
      direction: 'emission',
      rawAmount: wasteCheck.data,
      rawUnit: wasteUnit,
      activityAmount: normalizedKg,
      unitLabel: 'kg',
      emissionFactorKg: meta.factorKgPerUnit,
      emissionsKg,
      formulaText: `${normalizedKg} kg × ${formatFactorDisplay(meta.factorKgPerUnit)} kg CO₂e/kg = ${emissionsKg.toFixed(2)} kg CO₂e`,
      source: meta.source,
      assumptions: [unitNote, meta.description],
    });
  }

  if (items.length === 0) {
    return {
      ok: false,
      error: 'Enter at least one food item greater than 0 to calculate.',
    };
  }

  const totalEmissionsKg = roundTo(
    items.reduce((sum, item) => sum + item.emissionsKg, 0),
    3
  );

  return {
    ok: true,
    data: {
      category: 'food',
      items,
      totalEmissionsKg,
      totalOffsetsKg: 0,
      netKg: roundTo(totalEmissionsKg, 2),
    },
  };
}

/**
 * Calculates lifestyle CO₂e across Water consumption, Landfill waste generation, and Recycling offsets.
 */
export function calculateLifestyleFootprint(
  input: LifestyleCalculationInput
): EngineResult<CalculationBatchResult> {
  const waterCheck = validateOptionalNonNegativeAmount(
    input.waterAmount,
    'Water consumption',
    100000
  );
  if (!waterCheck.ok || waterCheck.data === undefined) {
    return { ok: false, error: waterCheck.error };
  }

  const wasteCheck = validateOptionalNonNegativeAmount(
    input.wasteAmount,
    'Waste generation',
    50000
  );
  if (!wasteCheck.ok || wasteCheck.data === undefined) {
    return { ok: false, error: wasteCheck.error };
  }

  const recyclingCheck = validateOptionalNonNegativeAmount(
    input.recyclingAmount,
    'Recycling amount',
    50000
  );
  if (!recyclingCheck.ok || recyclingCheck.data === undefined) {
    return { ok: false, error: recyclingCheck.error };
  }

  const items: CalculationLineItem[] = [];

  if (waterCheck.data > 0) {
    const waterUnit: WaterVolumeUnit = input.waterUnit ?? 'L';
    const heaterType: WaterHeaterType = input.waterHeaterType ?? 'cold';
    const heaterMeta = WATER_HEATER_FACTORS[heaterType];
    const liters = normalizeWaterToLiters(waterCheck.data, waterUnit);

    if (liters < 0.1) {
      return {
        ok: false,
        error: 'Water consumption must be at least 0.1 L.',
      };
    }

    let factorKgPerLiter = heaterMeta.baseSupplyKgPerLiter;
    let regionCode: ElectricityRegionCode | null = null;
    let source = heaterMeta.source;

    const unitNote =
      waterUnit === 'L'
        ? `Water volume entered directly in liters (${liters} L).`
        : `Converted ${waterCheck.data} ${waterUnit} to ${liters} L.`;
    const assumptions = [unitNote, heaterMeta.description];

    if (heaterType === 'hot-electric') {
      const regionRes = resolveElectricityRegion(
        input.electricityRegion ?? 'global',
        input.customElectricityFactorKg
      );
      if (!regionRes.ok || !regionRes.data) {
        return { ok: false, error: regionRes.error };
      }
      regionCode = regionRes.data.regionCode;
      const heatingComponent =
        CONVERSION_FACTORS.HOT_WATER_ELECTRIC_KWH_PER_LITER *
        regionRes.data.factorKgPerKwh;
      factorKgPerLiter = roundTo(
        heaterMeta.baseSupplyKgPerLiter + heatingComponent,
        6
      );
      source = `${heaterMeta.source}; ${regionRes.data.source}`;
      assumptions.push(
        `Electric heating uses ${CONVERSION_FACTORS.HOT_WATER_ELECTRIC_KWH_PER_LITER} kWh/L × ${regionRes.data.factorKgPerKwh} kg/kWh (${regionRes.data.label}).`
      );
    } else if (heaterType === 'hot-gas') {
      factorKgPerLiter = roundTo(
        heaterMeta.baseSupplyKgPerLiter +
          (heaterMeta.gasHeatingKgPerLiter ?? 0),
        6
      );
    }

    const emissionsKg = applyEmissionFormula(liters, factorKgPerLiter);
    items.push({
      key: `lifestyle-water-${heaterType}`,
      title: `Water — ${heaterMeta.label}`,
      category: 'lifestyle',
      direction: 'emission',
      rawAmount: waterCheck.data,
      rawUnit: waterUnit,
      activityAmount: liters,
      unitLabel: 'L',
      emissionFactorKg: factorKgPerLiter,
      emissionsKg,
      formulaText: `${liters} L × ${formatFactorDisplay(factorKgPerLiter)} kg CO₂e/L = ${emissionsKg.toFixed(3)} kg CO₂e`,
      regionCode,
      source,
      assumptions,
    });
  }

  if (wasteCheck.data > 0) {
    const wasteUnit: MassUnit = input.wasteUnit ?? 'kg';
    const normalizedKg = normalizeMassToKg(wasteCheck.data, wasteUnit);
    if (normalizedKg < 0.01) {
      return {
        ok: false,
        error: 'Converted waste weight must be at least 0.01 kg.',
      };
    }

    const emissionsKg = applyEmissionFormula(
      normalizedKg,
      LIFESTYLE_WASTE_FACTOR.factorKgPerUnit
    );
    items.push({
      key: 'lifestyle-waste-landfill',
      title: LIFESTYLE_WASTE_FACTOR.label,
      category: 'lifestyle',
      direction: 'emission',
      rawAmount: wasteCheck.data,
      rawUnit: wasteUnit,
      activityAmount: normalizedKg,
      unitLabel: 'kg',
      emissionFactorKg: LIFESTYLE_WASTE_FACTOR.factorKgPerUnit,
      emissionsKg,
      formulaText: `${normalizedKg} kg × ${formatFactorDisplay(LIFESTYLE_WASTE_FACTOR.factorKgPerUnit)} kg CO₂e/kg = ${emissionsKg.toFixed(2)} kg CO₂e`,
      source: LIFESTYLE_WASTE_FACTOR.source,
      assumptions: [
        wasteUnit === 'kg'
          ? `Recorded in canonical kilograms (${normalizedKg} kg).`
          : `Converted ${wasteCheck.data} ${wasteUnit} to ${normalizedKg} kg.`,
        LIFESTYLE_WASTE_FACTOR.description,
      ],
    });
  }

  if (recyclingCheck.data > 0) {
    const recyclingUnit: MassUnit = input.recyclingUnit ?? 'kg';
    const material: RecyclingMaterialType = input.recyclingMaterial ?? 'mixed';
    const meta = RECYCLING_MATERIAL_FACTORS[material];
    const normalizedKg = normalizeMassToKg(recyclingCheck.data, recyclingUnit);
    if (normalizedKg < 0.01) {
      return {
        ok: false,
        error: 'Converted recycled weight must be at least 0.01 kg.',
      };
    }

    const emissionsKg = applyEmissionFormula(normalizedKg, meta.factorKgPerUnit);
    const collectionOverheadKg = applyEmissionFormula(
      normalizedKg,
      meta.collectionEmissionKgPerKg
    );

    items.push({
      key: `lifestyle-recycling-${material}`,
      title: `Recycling — ${meta.label}`,
      category: 'lifestyle',
      direction: 'offset',
      rawAmount: recyclingCheck.data,
      rawUnit: recyclingUnit,
      activityAmount: normalizedKg,
      unitLabel: 'kg',
      emissionFactorKg: meta.factorKgPerUnit,
      emissionsKg,
      formulaText: `${normalizedKg} kg × ${formatFactorDisplay(meta.factorKgPerUnit)} kg CO₂e/kg = -${emissionsKg.toFixed(2)} kg saved`,
      source: meta.source,
      assumptions: [
        recyclingUnit === 'kg'
          ? `Recorded in canonical kilograms (${normalizedKg} kg).`
          : `Converted ${recyclingCheck.data} ${recyclingUnit} to ${normalizedKg} kg.`,
        meta.description,
        `DESNZ 2024 collection/MRF transport overhead would be +${collectionOverheadKg.toFixed(3)} kg CO₂e.`,
      ],
    });
  }

  if (items.length === 0) {
    return {
      ok: false,
      error: 'Enter at least one water, waste, or recycling amount greater than 0.',
    };
  }

  const totalEmissionsKg = roundTo(
    items
      .filter((i) => i.direction === 'emission')
      .reduce((sum, i) => sum + i.emissionsKg, 0),
    3
  );
  const totalOffsetsKg = roundTo(
    items
      .filter((i) => i.direction === 'offset')
      .reduce((sum, i) => sum + i.emissionsKg, 0),
    3
  );

  return {
    ok: true,
    data: {
      category: 'lifestyle',
      items,
      totalEmissionsKg,
      totalOffsetsKg,
      netKg: calculateNetCarbon(totalEmissionsKg, totalOffsetsKg),
    },
  };
}
