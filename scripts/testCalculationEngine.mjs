import assert from 'node:assert/strict';
import fs from 'node:fs';
import module from 'node:module';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Resolve extensionless relative TypeScript imports when executing directly under Node.js
module.registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !specifier.endsWith('.ts') &&
      !specifier.endsWith('.js') &&
      !specifier.endsWith('.mjs')
    ) {
      const parentPath = context.parentURL
        ? fileURLToPath(context.parentURL)
        : process.cwd();
      const candidate = new URL(`${specifier}.ts`, pathToFileURL(parentPath));
      if (fs.existsSync(candidate)) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});

const {
  applyEmissionFormula,
  calculateElectricityFootprint,
  calculateFoodFootprint,
  calculateLifestyleFootprint,
  calculateTransportFootprint,
  resolveElectricityRegion,
} = await import('../src/utils/carbonCalculator.ts');

test('Core formula obeys CO2 = Activity amount * Emission factor', () => {
  assert.equal(applyEmissionFormula(10, 0.1645), 1.645);
  assert.equal(applyEmissionFormula(0, 0.1645), 0);
  assert.equal(applyEmissionFormula(-5, 0.1645), 0);
  assert.equal(applyEmissionFormula(Number.NaN, 0.445), 0);
});

test('Transport 1: Petrol car with miles conversion and carpool occupancy', () => {
  // 10 mi * 1.609344 = 16.093 km; 0.1645 / 2 riders = 0.08225 kg/km; 16.093 * 0.08225 = 1.324 kg
  const res = calculateTransportFootprint({
    mode: 'car',
    distance: '10',
    distanceUnit: 'mi',
    carFuel: 'petrol',
    passengers: 2,
  });
  assert.equal(res.ok, true);
  assert.equal(res.data?.activityAmount, 16.093);
  assert.equal(res.data?.unitLabel, 'km');
  assert.equal(res.data?.emissionFactorKg, 0.08225);
  assert.equal(res.data?.emissionsKg, 1.324);
  assert.equal(res.data?.direction, 'emission');
});

test('Transport 2: Electric car couples with regional electricity factor (India grid)', () => {
  // 20 km * (0.18 kWh/km * 0.727 kg/kWh = 0.13086 kg/km) = 2.617 kg
  const res = calculateTransportFootprint({
    mode: 'car',
    distance: 20,
    distanceUnit: 'km',
    carFuel: 'electric',
    passengers: 1,
    electricityRegion: 'in',
  });
  assert.equal(res.ok, true);
  assert.equal(res.data?.regionCode, 'in');
  assert.equal(res.data?.emissionFactorKg, 0.13086);
  assert.equal(res.data?.emissionsKg, 2.617);
});

test('Transport 3-5: Motorcycle, Bus, Train, and Round-Trip Air Travel', () => {
  // Motorcycle medium 25 km * 0.101 = 2.525 kg
  const moto = calculateTransportFootprint({
    mode: 'motorcycle',
    distance: 25,
    motorcycleSize: 'medium',
  });
  assert.equal(moto.ok, true);
  assert.equal(moto.data?.emissionsKg, 2.525);

  // City bus 15 km * 0.1085 = 1.628 kg
  const bus = calculateTransportFootprint({
    mode: 'bus',
    distance: 15,
    busType: 'city',
  });
  assert.equal(bus.ok, true);
  assert.equal(bus.data?.emissionsKg, 1.628);

  // National train 40 km * 0.0355 = 1.42 kg
  const rail = calculateTransportFootprint({
    mode: 'train',
    distance: 40,
    trainType: 'national',
  });
  assert.equal(rail.ok, true);
  assert.equal(rail.data?.emissionsKg, 1.42);

  // Round-trip short-haul economy flight: 600 km * 2 = 1200 km * 0.1258 = 150.96 kg
  const flight = calculateTransportFootprint({
    mode: 'air',
    distance: 600,
    flightClass: 'short-economy',
    isRoundTrip: true,
  });
  assert.equal(flight.ok, true);
  assert.equal(flight.data?.activityAmount, 1200);
  assert.equal(flight.data?.emissionsKg, 150.96);
});

test('Transport 6-7: Walking and Cycling direct zero vs car-replacement offsets', () => {
  // Direct walking: 5 km * 0 = 0
  const walkDirect = calculateTransportFootprint({
    mode: 'walking',
    distance: 5,
    countAsCarReplacementOffset: false,
  });
  assert.equal(walkDirect.ok, true);
  assert.equal(walkDirect.data?.direction, 'emission');
  assert.equal(walkDirect.data?.emissionsKg, 0);

  // Bike swap: 5 km * 0.1645 = 0.823 kg saved
  const bikeOffset = calculateTransportFootprint({
    mode: 'cycling',
    distance: 5,
    cyclingMode: 'conventional',
    countAsCarReplacementOffset: true,
  });
  assert.equal(bikeOffset.ok, true);
  assert.equal(bikeOffset.data?.direction, 'offset');
  assert.equal(bikeOffset.data?.emissionsKg, 0.823);

  // E-bike car swap on California grid (0.184 kg/kWh): 0.1645 - (0.008 * 0.184) = 0.163028 kg/km
  const ebikeOffset = calculateTransportFootprint({
    mode: 'cycling',
    distance: 10,
    cyclingMode: 'ebike',
    countAsCarReplacementOffset: true,
    electricityRegion: 'us-camx',
  });
  assert.equal(ebikeOffset.ok, true);
  assert.equal(ebikeOffset.data?.emissionFactorKg, 0.163028);
  assert.equal(ebikeOffset.data?.emissionsKg, 1.63);
});

test('Electricity: Regional grid, daily proration, household split, and custom factor', () => {
  // 300 kWh monthly / 30 days / 2 people = 5 kWh * 0.1840 (CAMX) = 0.92 kg
  const dailyShare = calculateElectricityFootprint({
    monthlyKwh: '300',
    periodBasis: 'daily-average',
    householdMembers: 2,
    regionCode: 'us-camx',
  });
  assert.equal(dailyShare.ok, true);
  assert.equal(dailyShare.data?.activityAmount, 5);
  assert.equal(dailyShare.data?.emissionFactorKg, 0.184);
  assert.equal(dailyShare.data?.emissionsKg, 0.92);

  // Full monthly with custom regional factor: 450 kWh * 0.25 = 112.5 kg
  const customMonth = calculateElectricityFootprint({
    monthlyKwh: 450,
    periodBasis: 'monthly',
    householdMembers: 1,
    regionCode: 'custom',
    customFactorKg: '0.25',
  });
  assert.equal(customMonth.ok, true);
  assert.equal(customMonth.data?.activityAmount, 450);
  assert.equal(customMonth.data?.emissionsKg, 112.5);
});

test('Food: Multi-component calculation (vegetarian, beef, milk dairy, food waste)', () => {
  // 1 veg (1.25) + 1 beef (6.20) + 2 milk (1.58) + 500 g landfill food waste (0.5 * 0.5781 = 0.289) = 9.319 kg
  const res = calculateFoodFootprint({
    vegetarianMeals: '1',
    vegetarianType: 'vegetarian',
    nonVegetarianMeals: '1',
    nonVegetarianType: 'beef',
    dairyServings: '2',
    dairyType: 'milk',
    foodWasteAmount: '500',
    foodWasteUnit: 'g',
    foodWasteMethod: 'landfill',
  });
  assert.equal(res.ok, true);
  assert.equal(res.data?.items.length, 4);
  assert.equal(res.data?.totalEmissionsKg, 9.319);
  assert.equal(res.data?.netKg, 9.32);
});

test('Lifestyle: Cold municipal water + landfill waste + recycling offset', () => {
  // 150 L cold water (0.051) + 2 kg waste (0.994) - 1 kg mixed recycling (3.120) -> 1.045 - 3.120 = -2.08 net kg
  const res = calculateLifestyleFootprint({
    waterAmount: '150',
    waterUnit: 'L',
    waterHeaterType: 'cold',
    wasteAmount: '2',
    wasteUnit: 'kg',
    recyclingAmount: '1',
    recyclingUnit: 'kg',
    recyclingMaterial: 'mixed',
  });
  assert.equal(res.ok, true);
  assert.equal(res.data?.items.length, 3);
  assert.equal(res.data?.totalEmissionsKg, 1.045);
  assert.equal(res.data?.totalOffsetsKg, 3.12);
  assert.equal(res.data?.netKg, -2.08);
});

test('Lifestyle: Heated electric water links with configured regional electricity grid', () => {
  // 100 L on France grid (0.05 kg/kWh): 0.000339 + (0.0323 * 0.05 = 0.001615) = 0.001954 kg/L -> 0.195 kg
  const res = calculateLifestyleFootprint({
    waterAmount: '100',
    waterUnit: 'L',
    waterHeaterType: 'hot-electric',
    electricityRegion: 'fr',
  });
  assert.equal(res.ok, true);
  assert.equal(res.data?.items[0].emissionFactorKg, 0.001954);
  assert.equal(res.data?.totalEmissionsKg, 0.195);
});

test('Invalid and missing input rejection', () => {
  assert.equal(calculateTransportFootprint({ mode: 'car', distance: '' }).ok, false);
  assert.equal(calculateTransportFootprint({ mode: 'car', distance: 'abc' }).ok, false);
  assert.equal(calculateTransportFootprint({ mode: 'car', distance: '-5' }).ok, false);
  assert.equal(calculateTransportFootprint({ mode: 'car', distance: 0 }).ok, false);
  assert.equal(calculateTransportFootprint({ mode: 'car', distance: '1.2.3' }).ok, false);

  assert.equal(
    calculateElectricityFootprint({
      monthlyKwh: '200',
      regionCode: 'custom',
      customFactorKg: '3.5',
    }).ok,
    false
  );
  assert.equal(resolveElectricityRegion('custom', '').ok, false);

  assert.equal(calculateFoodFootprint({}).ok, false);
  assert.equal(calculateFoodFootprint({ vegetarianMeals: '-1' }).ok, false);
  assert.equal(calculateFoodFootprint({ dairyServings: 'NaN' }).ok, false);

  assert.equal(calculateLifestyleFootprint({}).ok, false);
  assert.equal(calculateLifestyleFootprint({ recyclingAmount: '-2' }).ok, false);
});
