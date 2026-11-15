/**
 * Documented GHG Emission Factors & Conversion Constants for EcoTrack Edge Functions.
 * Kept in exact parity with src/constants/emissionFactors.ts (verified by automated parity tests).
 */

export type ActivityCategory = 'transport' | 'electricity' | 'food' | 'lifestyle';
export type ImpactDirection = 'emission' | 'offset';

export type ElectricityRegionCode =
  | 'global'
  | 'us-avg'
  | 'us-camx'
  | 'uk'
  | 'eu'
  | 'de'
  | 'fr'
  | 'in'
  | 'cn'
  | 'ca'
  | 'au'
  | 'jp'
  | 'custom';

export type TransportMode =
  | 'car'
  | 'motorcycle'
  | 'bus'
  | 'train'
  | 'air'
  | 'walking'
  | 'cycling';

export type CarFuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric';
export type MotorcycleSize = 'average' | 'small' | 'medium' | 'large';
export type BusServiceType = 'city' | 'coach';
export type TrainServiceType = 'national' | 'metro' | 'international';
export type FlightHaulClass =
  | 'domestic'
  | 'short-economy'
  | 'short-business'
  | 'long-economy'
  | 'long-business';
export type CyclingMode = 'conventional' | 'ebike';
export type DistanceUnit = 'km' | 'mi';

export type ElectricityPeriodBasis = 'monthly' | 'daily-average';
export type ElectricityMode = 'grid' | 'solar-offset';

export type VegetarianType = 'vegetarian' | 'vegan';
export type NonVegetarianProteinType = 'mixed' | 'poultry' | 'pork' | 'beef';
export type DairyProductType = 'milk' | 'cheese' | 'mixed';
export type FoodWasteMethod = 'landfill' | 'compost';
export type MassUnit = 'kg' | 'g' | 'lb';

export type WaterHeaterType = 'cold' | 'hot-electric' | 'hot-gas';
export type WaterVolumeUnit = 'L' | 'm3' | 'gal';
export type RecyclingMaterialType =
  | 'mixed'
  | 'paper'
  | 'plastic'
  | 'glass'
  | 'aluminum';

export const CONVERSION_FACTORS = {
  KM_PER_MILE: 1.609344,
  GRAMS_PER_KG: 1000,
  KG_PER_POUND: 0.45359237,
  KG_PER_METRIC_TONNE: 1000,
  KG_PER_SHORT_TON: 907.18474,
  LITERS_PER_CUBIC_METER: 1000,
  LITERS_PER_US_GALLON: 3.785411784,
  DAYS_PER_STANDARD_MONTH: 30,
  EV_KWH_PER_KM: 0.18,
  EBIKE_KWH_PER_KM: 0.008,
  HOT_WATER_ELECTRIC_KWH_PER_LITER: 0.0323,
  HOT_WATER_GAS_KG_PER_LITER: 0.0067,
} as const;

export interface ElectricityRegionFactor {
  code: ElectricityRegionCode;
  label: string;
  shortLabel: string;
  factorKgPerKwh: number;
  source: string;
  notes: string;
}

export const ELECTRICITY_REGIONS: readonly ElectricityRegionFactor[] = [
  {
    code: 'global',
    label: 'Global Average (IEA)',
    shortLabel: 'Global',
    factorKgPerKwh: 0.445,
    source: 'IEA Global Electricity Emissions Intensity Benchmark (2024)',
    notes: 'Global weighted power-generation average across fossil, nuclear, and renewables.',
  },
  {
    code: 'us-avg',
    label: 'United States Average (eGRID)',
    shortLabel: 'USA Avg',
    factorKgPerKwh: 0.341,
    source: 'US EPA eGRID2024 National Total Output Rate (747.9 lb CO₂e/MWh)',
    notes: 'Location-based US grid average incorporating CO₂, CH₄, and N₂O.',
  },
  {
    code: 'us-camx',
    label: 'USA — California (eGRID CAMX)',
    shortLabel: 'California',
    factorKgPerKwh: 0.184,
    source: 'US EPA eGRID2024 WECC California Subregion (CAMX)',
    notes: 'Solar, hydro, and natural-gas heavy California subregion mix.',
  },
  {
    code: 'uk',
    label: 'United Kingdom (DESNZ)',
    shortLabel: 'UK',
    factorKgPerKwh: 0.2254,
    source: 'UK DESNZ 2024 GHG Conversion Factors (0.20705 gen + 0.01830 T&D)',
    notes: 'Includes Scope 2 generation and Scope 3 transmission & distribution losses.',
  },
  {
    code: 'eu',
    label: 'European Union Average (EEA)',
    shortLabel: 'EU Avg',
    factorKgPerKwh: 0.22,
    source: 'European Environment Agency (EEA) EU-27 Electricity Intensity Benchmark',
    notes: 'EU-27 average grid emission intensity benchmark.',
  },
  {
    code: 'de',
    label: 'Germany National Grid',
    shortLabel: 'Germany',
    factorKgPerKwh: 0.33,
    source: 'EEA / Ember Germany Electricity Grid Carbon Intensity (2024)',
    notes: 'Combined wind, solar, and transitional thermal generation mix.',
  },
  {
    code: 'fr',
    label: 'France National Grid',
    shortLabel: 'France',
    factorKgPerKwh: 0.05,
    source: 'RTE France / Ember Electricity Carbon Intensity Benchmark',
    notes: 'Ultra-low-carbon nuclear and hydroelectric generation mix.',
  },
  {
    code: 'in',
    label: 'India National Grid (CEA v20.0)',
    shortLabel: 'India',
    factorKgPerKwh: 0.727,
    source: 'Central Electricity Authority (CEA) India CO₂ Baseline Database v20.0 (FY 2023-24, incl. RES)',
    notes: 'All-India synchronous national grid weighted average including renewables.',
  },
  {
    code: 'cn',
    label: 'China National Grid',
    shortLabel: 'China',
    factorKgPerKwh: 0.55,
    source: 'Ember / National Grid Carbon Intensity Benchmark (2024)',
    notes: 'National thermal baseload blended with utility-scale solar, wind, and hydro.',
  },
  {
    code: 'ca',
    label: 'Canada National Average',
    shortLabel: 'Canada',
    factorKgPerKwh: 0.115,
    source: 'Environment & Climate Change Canada / Ember Grid Benchmark',
    notes: 'Predominantly hydroelectric national generation profile.',
  },
  {
    code: 'au',
    label: 'Australia National Grid',
    shortLabel: 'Australia',
    factorKgPerKwh: 0.64,
    source: 'DCCEEW / Ember Australia Electricity Carbon Intensity (2024)',
    notes: 'National grid blending thermal coal/gas with accelerating solar and wind.',
  },
  {
    code: 'jp',
    label: 'Japan National Grid',
    shortLabel: 'Japan',
    factorKgPerKwh: 0.475,
    source: 'MOE / Ember Japan Electricity Carbon Intensity (2024)',
    notes: 'LNG, coal, solar, and partial nuclear power mix.',
  },
  {
    code: 'custom',
    label: 'Custom Utility Factor',
    shortLabel: 'Custom',
    factorKgPerKwh: 0.445,
    source: 'User-configured regional utility / supplier emission factor',
    notes: 'Enter an exact kg CO₂e/kWh rate from your local utility disclosure.',
  },
] as const;

export const ELECTRICITY_REGION_MAP: Record<ElectricityRegionCode, ElectricityRegionFactor> =
  ELECTRICITY_REGIONS.reduce(
    (acc, region) => {
      acc[region.code] = region;
      return acc;
    },
    {} as Record<ElectricityRegionCode, ElectricityRegionFactor>
  );

export interface FactorOptionMeta<T extends string> {
  key: T;
  label: string;
  factorKgPerUnit: number;
  unitLabel: string;
  source: string;
  description: string;
}

export const CAR_FUEL_FACTORS: Record<CarFuelType, FactorOptionMeta<CarFuelType>> = {
  petrol: {
    key: 'petrol',
    label: 'Petrol / Gasoline',
    factorKgPerUnit: 0.1645,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Average Petrol Car, unknown size)',
    description: '0.1645 kg CO₂e/vehicle-km, split across occupants for passenger-km.',
  },
  diesel: {
    key: 'diesel',
    label: 'Diesel',
    factorKgPerUnit: 0.1698,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Average Diesel Car)',
    description: '0.1698 kg CO₂e/vehicle-km, split across occupants for passenger-km.',
  },
  hybrid: {
    key: 'hybrid',
    label: 'Hybrid',
    factorKgPerUnit: 0.1261,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Average Hybrid Car)',
    description: '0.1261 kg CO₂e/vehicle-km regenerative hybrid baseline.',
  },
  electric: {
    key: 'electric',
    label: 'Electric (EV)',
    factorKgPerUnit: 0.0801,
    unitLabel: 'km',
    source: 'EV Efficiency (0.18 kWh/km WLTP/EPA avg) × Regional Electricity Grid Factor',
    description: 'Zero tailpipe emissions; upstream footprint reflects your active regional electricity grid.',
  },
};

export const MOTORCYCLE_SIZE_FACTORS: Record<MotorcycleSize, FactorOptionMeta<MotorcycleSize>> = {
  average: {
    key: 'average',
    label: 'Average Petrol Moto',
    factorKgPerUnit: 0.1137,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Average Motorcycle)',
    description: 'Fleet-weighted petrol motorcycle tailpipe & fuel baseline.',
  },
  small: {
    key: 'small',
    label: 'Small (≤125cc)',
    factorKgPerUnit: 0.083,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Small Motorcycle ≤125cc)',
    description: 'Light commuter scooter / small displacement motorcycle.',
  },
  medium: {
    key: 'medium',
    label: 'Medium (126–500cc)',
    factorKgPerUnit: 0.101,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Medium Motorcycle 126-500cc)',
    description: 'Mid-size street or touring motorcycle.',
  },
  large: {
    key: 'large',
    label: 'Large (>500cc)',
    factorKgPerUnit: 0.134,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Large Motorcycle >500cc)',
    description: 'Heavy cruiser or high-displacement motorcycle.',
  },
};

export const BUS_SERVICE_FACTORS: Record<BusServiceType, FactorOptionMeta<BusServiceType>> = {
  city: {
    key: 'city',
    label: 'City / Local Bus',
    factorKgPerUnit: 0.1085,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Average Local Bus)',
    description: 'Scheduled urban passenger bus factor per passenger-km.',
  },
  coach: {
    key: 'coach',
    label: 'Intercity Coach',
    factorKgPerUnit: 0.0272,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Coach)',
    description: 'High-occupancy long-distance scheduled highway coach.',
  },
};

export const TRAIN_SERVICE_FACTORS: Record<TrainServiceType, FactorOptionMeta<TrainServiceType>> = {
  national: {
    key: 'national',
    label: 'National / Commuter Rail',
    factorKgPerUnit: 0.0355,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (National Rail)',
    description: 'Passenger rail factor per passenger-km across national networks.',
  },
  metro: {
    key: 'metro',
    label: 'Metro / Light Rail / Tram',
    factorKgPerUnit: 0.0286,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Light Rail and Tram)',
    description: 'Electric urban metro, subway, or streetcar transit.',
  },
  international: {
    key: 'international',
    label: 'High-Speed Electric Rail',
    factorKgPerUnit: 0.0045,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (International Rail / Eurostar)',
    description: 'High-speed electrified rail on low-carbon grid.',
  },
};

export const FLIGHT_CLASS_FACTORS: Record<FlightHaulClass, FactorOptionMeta<FlightHaulClass>> = {
  domestic: {
    key: 'domestic',
    label: 'Domestic (<500 km)',
    factorKgPerUnit: 0.2293,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Domestic Flight, with Radiative Forcing)',
    description: 'Includes high-altitude non-CO₂ radiative forcing multiplier.',
  },
  'short-economy': {
    key: 'short-economy',
    label: 'Short-Haul Economy',
    factorKgPerUnit: 0.1258,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Short-Haul Economy, with RF)',
    description: 'Regional flights ~500–3,700 km in Economy cabin, including RF.',
  },
  'short-business': {
    key: 'short-business',
    label: 'Short-Haul Business',
    factorKgPerUnit: 0.1886,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Short-Haul Business Class, with RF)',
    description: 'Allocates 1.5× floor space seating share plus RF multiplier.',
  },
  'long-economy': {
    key: 'long-economy',
    label: 'Long-Haul Economy',
    factorKgPerUnit: 0.117,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Long-Haul Economy, with RF)',
    description: 'Intercontinental cruise efficiency per seat-km, including RF.',
  },
  'long-business': {
    key: 'long-business',
    label: 'Long-Haul Business',
    factorKgPerUnit: 0.3394,
    unitLabel: 'km',
    source: 'UK DESNZ 2024 GHG Conversion Factors (Long-Haul Business Class, with RF)',
    description: 'Reflects larger lie-flat seat footprint (~2.9× Economy floor space) with RF.',
  },
};

export const WALKING_FACTORS = {
  directEmissionKgPerKm: 0,
  carReplacementOffsetKgPerKm: CAR_FUEL_FACTORS.petrol.factorKgPerUnit,
  directSource: 'Zero tailpipe and upstream fuel emissions during human-powered walking.',
  offsetSource: 'Avoided UK DESNZ 2024 Average Petrol Car (0.1645 kg CO₂e/km).',
} as const;

export const CYCLING_FACTORS: Record<
  CyclingMode,
  {
    key: CyclingMode;
    label: string;
    directSource: string;
    offsetSource: string;
    carReplacementOffsetKgPerKm: number;
  }
> = {
  conventional: {
    key: 'conventional',
    label: 'Regular Bicycle',
    directSource: 'Zero tailpipe and grid charging emissions for human-powered cycling.',
    offsetSource: 'Avoided UK DESNZ 2024 Average Petrol Car (0.1645 kg CO₂e/km).',
    carReplacementOffsetKgPerKm: CAR_FUEL_FACTORS.petrol.factorKgPerUnit,
  },
  ebike: {
    key: 'ebike',
    label: 'Electric Bike (E-Bike)',
    directSource: 'Pedelec battery recharge (0.008 kWh/km) × Regional Electricity Grid Factor.',
    offsetSource: 'Avoided petrol car net of e-bike grid recharge.',
    carReplacementOffsetKgPerKm: CAR_FUEL_FACTORS.petrol.factorKgPerUnit,
  },
};

export const VEGETARIAN_MEAL_FACTORS: Record<VegetarianType, FactorOptionMeta<VegetarianType>> = {
  vegetarian: {
    key: 'vegetarian',
    label: 'Vegetarian (Dairy/Egg)',
    factorKgPerUnit: 1.25,
    unitLabel: 'meals',
    source: 'Poore & Nemecek (Science, 2018) / Scarborough et al. (2023) (~4.16 kg/day ÷ 3 + snack weighting)',
    description: 'Standard ~500 g meat-free meal containing grains, vegetables, and moderate egg/dairy.',
  },
  vegan: {
    key: 'vegan',
    label: 'Whole-Plant / Vegan',
    factorKgPerUnit: 0.82,
    unitLabel: 'meals',
    source: 'Scarborough et al. (2023) Vegan Diet Benchmark (2.47 kg CO₂e/day ÷ 3 meals)',
    description: 'Plant-protein meal using legumes, tofu, grains, and vegetables with no animal products.',
  },
};

export const NON_VEGETARIAN_MEAL_FACTORS: Record<
  NonVegetarianProteinType,
  FactorOptionMeta<NonVegetarianProteinType>
> = {
  mixed: {
    key: 'mixed',
    label: 'Mixed Meat Meal',
    factorKgPerUnit: 3.4,
    unitLabel: 'meals',
    source: 'Scarborough et al. (2023) Dietary Cohort Average (High/Low Meat midpoint)',
    description: 'Typical omnivorous meal blending poultry, pork, seafood, and occasional red meat.',
  },
  poultry: {
    key: 'poultry',
    label: 'Poultry / Fish Meal',
    factorKgPerUnit: 2.1,
    unitLabel: 'meals',
    source: 'Poore & Nemecek (Science, 2018) Poultry/Aquaculture Retail LCA (120 g portion + sides)',
    description: 'Chicken or farmed fish portion (~1.2 kg) plus grains and vegetables (~0.9 kg).',
  },
  pork: {
    key: 'pork',
    label: 'Pork Meal',
    factorKgPerUnit: 2.45,
    unitLabel: 'meals',
    source: 'Poore & Nemecek (Science, 2018) Pig Meat Retail LCA (120 g portion + sides)',
    description: '120 g pork portion (@ 12.31 kg CO₂e/kg retail) plus grains and vegetables.',
  },
  beef: {
    key: 'beef',
    label: 'Beef / Red Meat',
    factorKgPerUnit: 6.2,
    unitLabel: 'meals',
    source: 'Poore & Nemecek (Science, 2018) Beef Herd Retail LCA (100 g beef protein + sides)',
    description: 'Reflects ruminant methane and land-use footprint (~60 kg/kg farm-to-retail base).',
  },
};

export const DAIRY_PRODUCT_FACTORS: Record<DairyProductType, FactorOptionMeta<DairyProductType>> = {
  milk: {
    key: 'milk',
    label: 'Milk (250 ml glass)',
    factorKgPerUnit: 0.79,
    unitLabel: 'servings',
    source: 'Poore & Nemecek (Science, 2018) Cow Milk (3.15 kg CO₂e/kg × 0.25 L)',
    description: 'One 250 ml cup (~0.25 kg) of dairy cow milk.',
  },
  cheese: {
    key: 'cheese',
    label: 'Cheese (40 g slice)',
    factorKgPerUnit: 0.96,
    unitLabel: 'servings',
    source: 'Poore & Nemecek (Science, 2018) Cheese (23.88 kg CO₂e/kg × 0.04 kg)',
    description: 'Concentrated milk solids (~10 L milk per kg cheese); 40 g serving.',
  },
  mixed: {
    key: 'mixed',
    label: 'Mixed Dairy (Yogurt/Butter)',
    factorKgPerUnit: 0.65,
    unitLabel: 'servings',
    source: 'Poore & Nemecek (Science, 2018) Dairy Product Composite Serving Benchmark',
    description: 'Typical 150–200 g dairy yogurt, cream, or butter serving.',
  },
};

export const FOOD_WASTE_FACTORS: Record<FoodWasteMethod, FactorOptionMeta<FoodWasteMethod>> = {
  landfill: {
    key: 'landfill',
    label: 'Sent to Landfill',
    factorKgPerUnit: 0.5781,
    unitLabel: 'kg',
    source: 'US EPA WARM v16 Food Waste Landfill Factor (0.5244 MTCO₂e/short ton ÷ 0.907185)',
    description: 'Net methane and decomposition emissions per kg of landfilled mixed household food waste.',
  },
  compost: {
    key: 'compost',
    label: 'Composted / Digestion',
    factorKgPerUnit: 0.009,
    unitLabel: 'kg',
    source: 'UK DESNZ 2024 Organics Composting / Anaerobic Digestion Benchmark (~9 kg/tonne)',
    description: 'Diverts food waste away from anaerobic landfill methane generation.',
  },
};

export const WATER_HEATER_FACTORS: Record<
  WaterHeaterType,
  {
    key: WaterHeaterType;
    label: string;
    baseSupplyKgPerLiter: number;
    gasHeatingKgPerLiter?: number;
    source: string;
    description: string;
  }
> = {
  cold: {
    key: 'cold',
    label: 'Cold Tap / Municipal',
    baseSupplyKgPerLiter: 0.000339,
    source: 'UK DESNZ 2024 Water Supply (0.15311) + Wastewater Treatment (0.18574 kg/m³)',
    description: '0.33885 kg CO₂e per m³ (1,000 L) of treated potable water and sewage.',
  },
  'hot-electric': {
    key: 'hot-electric',
    label: 'Hot Water (Electric Heater)',
    baseSupplyKgPerLiter: 0.000339,
    source: 'UK DESNZ Water Supply/Treatment + Thermodynamic Heating (0.0323 kWh/L × Regional Grid)',
    description: 'Cold supply/treatment plus electric heating energy (ΔT 25°C @ 90% efficiency).',
  },
  'hot-gas': {
    key: 'hot-gas',
    label: 'Hot Water (Gas Boiler)',
    baseSupplyKgPerLiter: 0.000339,
    gasHeatingKgPerLiter: CONVERSION_FACTORS.HOT_WATER_GAS_KG_PER_LITER,
    source: 'UK DESNZ Water Supply/Treatment + Natural Gas Water Heating (ΔT 25°C @ 80% eff.)',
    description: '0.000339 supply/treatment + 0.0067 gas boiler heating per liter.',
  },
};

export const LIFESTYLE_WASTE_FACTOR: FactorOptionMeta<'landfill'> = {
  key: 'landfill',
  label: 'Household Waste (Landfill)',
  factorKgPerUnit: 0.497,
  unitLabel: 'kg',
  source: 'UK DESNZ 2024 Municipal / Household Waste Landfilled (497.04 kg CO₂e/tonne)',
  description: 'Residual unrecycled household trash sent to municipal landfill.',
};

export const RECYCLING_MATERIAL_FACTORS: Record<
  RecyclingMaterialType,
  FactorOptionMeta<RecyclingMaterialType> & { collectionEmissionKgPerKg: number }
> = {
  mixed: {
    key: 'mixed',
    label: 'Mixed Dry Recycling',
    factorKgPerUnit: 3.12,
    unitLabel: 'kg',
    collectionEmissionKgPerKg: 0.0064,
    source: 'US EPA WARM v16 Mixed Recyclables (-2.83 MTCO₂e/short ton) avoided credit',
    description: 'Avoids virgin raw material extraction and landfilling; DESNZ collection is 0.0064 kg/kg.',
  },
  paper: {
    key: 'paper',
    label: 'Paper & Cardboard',
    factorKgPerUnit: 3.42,
    unitLabel: 'kg',
    collectionEmissionKgPerKg: 0.0064,
    source: 'US EPA WARM v16 Corrugated/Paper Recycling (-3.1 MTCO₂e/short ton conservative bound)',
    description: 'Captures avoided forestry manufacturing and preserved carbon sink.',
  },
  plastic: {
    key: 'plastic',
    label: 'Plastic (PET / HDPE)',
    factorKgPerUnit: 1.65,
    unitLabel: 'kg',
    collectionEmissionKgPerKg: 0.0064,
    source: 'US EPA WARM v16 Plastics Recycling (-1.5 MTCO₂e/short ton conservative bound)',
    description: 'Offsets petrochemical resin production relative to virgin plastic.',
  },
  glass: {
    key: 'glass',
    label: 'Glass Bottles & Jars',
    factorKgPerUnit: 0.33,
    unitLabel: 'kg',
    collectionEmissionKgPerKg: 0.0064,
    source: 'US EPA WARM v16 Closed-Loop Glass Recycling (-0.3 MTCO₂e/short ton conservative bound)',
    description: 'Reduces furnace energy by substituting cullet for virgin silica/limestone.',
  },
  aluminum: {
    key: 'aluminum',
    label: 'Aluminum Cans',
    factorKgPerUnit: 10.06,
    unitLabel: 'kg',
    collectionEmissionKgPerKg: 0.0064,
    source: 'US EPA WARM v16 Closed-Loop Aluminum Can Recycling (-9.13 MTCO₂e/short ton)',
    description: 'Secondary aluminum smelting avoids up to ~95% of primary bauxite smelting energy.',
  },
};
