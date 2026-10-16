import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Badge,
  Button,
  Card,
  CategoryChip,
  ElectricityCalculatorSection,
  FoodCalculatorSection,
  FormulaBreakdownCard,
  Input,
  LifestyleCalculatorSection,
  RegionalGridSelector,
  ScreenContainer,
  SectionHeader,
  ThemedText,
  TransportCalculatorSection,
  type ElectricityFormState,
  type FoodFormState,
  type LifestyleFormState,
  type TransportFormState,
} from '@/components';
import { ACTIVITY_CATEGORIES, Radii, Spacing } from '@/constants';
import { useEcoTrack } from '@/context';
import { useTheme } from '@/hooks';
import {
  ROUTES,
  type ActivityCategory,
  type CalculationLineItem,
  type CarbonActivityPresetItem,
  type ElectricityRegionCode,
} from '@/types';
import {
  calculateElectricityFootprint,
  calculateFoodFootprint,
  calculateLifestyleFootprint,
  calculateTransportFootprint,
  formatCarbonKg,
} from '@/utils';

const VALID_CATEGORIES: readonly ActivityCategory[] = [
  'transport',
  'electricity',
  'food',
  'lifestyle',
];

function isValidCategory(value: string | undefined): value is ActivityCategory {
  return VALID_CATEGORIES.includes(value as ActivityCategory);
}

const SLUG_BY_LINE_KEY_PREFIX: { prefix: string; slug: string }[] = [
  { prefix: 'transport-car-petrol', slug: 'car-petrol' },
  { prefix: 'transport-car-electric', slug: 'ev-ride' },
  { prefix: 'transport-moto', slug: 'motorcycle-avg' },
  { prefix: 'transport-bus', slug: 'city-bus' },
  { prefix: 'transport-train', slug: 'rail-national' },
  { prefix: 'transport-air', slug: 'air-short-econ' },
  { prefix: 'transport-walking-offset', slug: 'bike-walk' },
  { prefix: 'transport-cycling-conventional-offset', slug: 'bike-walk' },
  { prefix: 'electricity-', slug: 'grid-kwh' },
  { prefix: 'food-veg-vegetarian', slug: 'vegetarian-meal' },
  { prefix: 'food-veg-vegan', slug: 'plant-based-swap' },
  { prefix: 'food-nonveg-beef', slug: 'beef-meal' },
  { prefix: 'food-nonveg-', slug: 'poultry-meal' },
  { prefix: 'food-dairy-', slug: 'dairy-milk' },
  { prefix: 'food-waste-', slug: 'food-waste-landfill' },
  { prefix: 'lifestyle-water-', slug: 'water-cold' },
  { prefix: 'lifestyle-waste-', slug: 'waste-landfill' },
  { prefix: 'lifestyle-recycling-', slug: 'recycling-mixed' },
];

function resolveCatalogActivityId(
  itemKey: string,
  presets: CarbonActivityPresetItem[]
): string | null {
  if (itemKey.endsWith('-solar-offset')) {
    return presets.find((p) => p.slug === 'solar-offset')?.id ?? null;
  }
  const match = SLUG_BY_LINE_KEY_PREFIX.find((entry) =>
    itemKey.startsWith(entry.prefix)
  );
  if (!match) return null;
  return presets.find((p) => p.slug === match.slug)?.id ?? null;
}

export default function CarbonCalculatorScreen() {
  const { colors } = useTheme();
  const {
    preferences,
    activityPresets,
    addActivitiesBatch,
    updateRegionalElectricitySetting,
  } = useEcoTrack();
  const params = useLocalSearchParams<{ category?: string }>();

  const [localCategory, setLocalCategory] =
    useState<ActivityCategory>('transport');
  const selectedCategory: ActivityCategory = isValidCategory(params.category)
    ? params.category
    : localCategory;

  const [regionOverride, setRegionOverride] =
    useState<ElectricityRegionCode | null>(null);
  const [customFactorOverride, setCustomFactorOverride] = useState<string | null>(
    null
  );
  const [isSavingRegion, setIsSavingRegion] = useState(false);
  const [regionNotice, setRegionNotice] = useState<string | null>(null);

  const activeRegionCode: ElectricityRegionCode =
    regionOverride ?? preferences.electricityRegion;
  const activeCustomFactorText: string =
    customFactorOverride ??
    (preferences.customElectricityFactorKg !== null
      ? String(preferences.customElectricityFactorKg)
      : '0.4450');

  const [transportState, setTransportState] = useState<TransportFormState>(() => ({
    mode: 'car',
    distanceText: '12',
    distanceUnit: preferences.preferredUnit === 'imperial' ? 'mi' : 'km',
    carFuel: 'petrol',
    passengers: 1,
    motorcycleSize: 'average',
    busType: 'city',
    trainType: 'national',
    flightClass: 'short-economy',
    isRoundTrip: false,
    cyclingMode: 'conventional',
    countAsCarReplacementOffset: false,
  }));

  const [electricityState, setElectricityState] = useState<ElectricityFormState>(
    () => ({
      monthlyKwhText: '300',
      periodBasis: 'daily-average',
      householdMembers: 1,
      mode: 'grid',
    })
  );

  const [foodState, setFoodState] = useState<FoodFormState>({
    vegetarianMealsText: '1',
    vegetarianType: 'vegetarian',
    nonVegetarianMealsText: '0',
    nonVegetarianType: 'mixed',
    dairyServingsText: '1',
    dairyType: 'milk',
    foodWasteText: '0',
    foodWasteUnit: 'kg',
    foodWasteMethod: 'landfill',
  });

  const [lifestyleState, setLifestyleState] = useState<LifestyleFormState>(
    () => ({
      waterAmountText: '150',
      waterUnit: preferences.preferredUnit === 'imperial' ? 'gal' : 'L',
      waterHeaterType: 'cold',
      wasteAmountText: '1',
      wasteUnit: preferences.preferredUnit === 'imperial' ? 'lb' : 'kg',
      recyclingAmountText: '0',
      recyclingUnit: preferences.preferredUnit === 'imperial' ? 'lb' : 'kg',
      recyclingMaterial: 'mixed',
    })
  );

  const [customTitle, setCustomTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastLoggedSummary, setLastLoggedSummary] = useState<string | null>(
    null
  );

  const needsRegionalGridSelector =
    selectedCategory === 'electricity' ||
    (selectedCategory === 'transport' &&
      ((transportState.mode === 'car' && transportState.carFuel === 'electric') ||
        (transportState.mode === 'cycling' &&
          transportState.cyclingMode === 'ebike'))) ||
    (selectedCategory === 'lifestyle' &&
      lifestyleState.waterHeaterType === 'hot-electric');

  const calculationOutcome = useMemo<{
    items: CalculationLineItem[];
    totalEmissionsKg: number;
    totalOffsetsKg: number;
    netKg: number;
    error: string | null;
  }>(() => {
    if (selectedCategory === 'transport') {
      const res = calculateTransportFootprint({
        mode: transportState.mode,
        distance: transportState.distanceText,
        distanceUnit: transportState.distanceUnit,
        customTitle,
        carFuel: transportState.carFuel,
        passengers: transportState.passengers,
        motorcycleSize: transportState.motorcycleSize,
        busType: transportState.busType,
        trainType: transportState.trainType,
        flightClass: transportState.flightClass,
        isRoundTrip: transportState.isRoundTrip,
        cyclingMode: transportState.cyclingMode,
        countAsCarReplacementOffset: transportState.countAsCarReplacementOffset,
        electricityRegion: activeRegionCode,
        customElectricityFactorKg: activeCustomFactorText,
      });
      if (!res.ok || !res.data) {
        return {
          items: [],
          totalEmissionsKg: 0,
          totalOffsetsKg: 0,
          netKg: 0,
          error: res.error ?? 'Enter valid transport trip details.',
        };
      }
      const isOffset = res.data.direction === 'offset';
      return {
        items: [res.data],
        totalEmissionsKg: isOffset ? 0 : res.data.emissionsKg,
        totalOffsetsKg: isOffset ? res.data.emissionsKg : 0,
        netKg: isOffset ? -res.data.emissionsKg : res.data.emissionsKg,
        error: null,
      };
    }

    if (selectedCategory === 'electricity') {
      const res = calculateElectricityFootprint({
        monthlyKwh: electricityState.monthlyKwhText,
        periodBasis: electricityState.periodBasis,
        householdMembers: electricityState.householdMembers,
        regionCode: activeRegionCode,
        customFactorKg: activeCustomFactorText,
        mode: electricityState.mode,
        customTitle,
      });
      if (!res.ok || !res.data) {
        return {
          items: [],
          totalEmissionsKg: 0,
          totalOffsetsKg: 0,
          netKg: 0,
          error: res.error ?? 'Enter valid monthly electricity consumption.',
        };
      }
      const isOffset = res.data.direction === 'offset';
      return {
        items: [res.data],
        totalEmissionsKg: isOffset ? 0 : res.data.emissionsKg,
        totalOffsetsKg: isOffset ? res.data.emissionsKg : 0,
        netKg: isOffset ? -res.data.emissionsKg : res.data.emissionsKg,
        error: null,
      };
    }

    if (selectedCategory === 'food') {
      const res = calculateFoodFootprint({
        vegetarianMeals: foodState.vegetarianMealsText,
        vegetarianType: foodState.vegetarianType,
        nonVegetarianMeals: foodState.nonVegetarianMealsText,
        nonVegetarianType: foodState.nonVegetarianType,
        dairyServings: foodState.dairyServingsText,
        dairyType: foodState.dairyType,
        foodWasteAmount: foodState.foodWasteText,
        foodWasteUnit: foodState.foodWasteUnit,
        foodWasteMethod: foodState.foodWasteMethod,
      });
      if (!res.ok || !res.data) {
        return {
          items: [],
          totalEmissionsKg: 0,
          totalOffsetsKg: 0,
          netKg: 0,
          error: res.error ?? 'Enter at least one valid food quantity.',
        };
      }
      return {
        items: res.data.items,
        totalEmissionsKg: res.data.totalEmissionsKg,
        totalOffsetsKg: res.data.totalOffsetsKg,
        netKg: res.data.netKg,
        error: null,
      };
    }

    const res = calculateLifestyleFootprint({
      waterAmount: lifestyleState.waterAmountText,
      waterUnit: lifestyleState.waterUnit,
      waterHeaterType: lifestyleState.waterHeaterType,
      wasteAmount: lifestyleState.wasteAmountText,
      wasteUnit: lifestyleState.wasteUnit,
      recyclingAmount: lifestyleState.recyclingAmountText,
      recyclingUnit: lifestyleState.recyclingUnit,
      recyclingMaterial: lifestyleState.recyclingMaterial,
      electricityRegion: activeRegionCode,
      customElectricityFactorKg: activeCustomFactorText,
    });
    if (!res.ok || !res.data) {
      return {
        items: [],
        totalEmissionsKg: 0,
        totalOffsetsKg: 0,
        netKg: 0,
        error: res.error ?? 'Enter at least one valid lifestyle quantity.',
      };
    }
    return {
      items: res.data.items,
      totalEmissionsKg: res.data.totalEmissionsKg,
      totalOffsetsKg: res.data.totalOffsetsKg,
      netKg: res.data.netKg,
      error: null,
    };
  }, [
    activeCustomFactorText,
    activeRegionCode,
    customTitle,
    electricityState,
    foodState,
    lifestyleState,
    selectedCategory,
    transportState,
  ]);

  const handleSelectCategory = (category: ActivityCategory) => {
    setLocalCategory(category);
    if (params.category) {
      router.setParams({ category });
    }
    setSaveError(null);
    setLastLoggedSummary(null);
    setRegionNotice(null);
  };

  const handleSaveRegionDefault = async () => {
    setRegionNotice(null);
    setSaveError(null);
    const trimmedCustom = activeCustomFactorText.trim();
    const strictCustom = trimmedCustom ? Number(trimmedCustom) : null;
    setIsSavingRegion(true);
    const res = await updateRegionalElectricitySetting(
      activeRegionCode,
      activeRegionCode === 'custom' ? strictCustom : null
    );
    setIsSavingRegion(false);

    if (!res.ok) {
      setSaveError(res.error ?? 'Unable to save default electricity region.');
      return;
    }

    setRegionOverride(null);
    setCustomFactorOverride(null);
    setRegionNotice('Saved as your default grid region.');
  };

  const handleSaveActivities = async () => {
    if (calculationOutcome.error || calculationOutcome.items.length === 0) {
      setSaveError(
        calculationOutcome.error ?? 'Enter valid activity values before logging.'
      );
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    const payloads = calculationOutcome.items.map((item) => ({
      title: item.title,
      activityId: resolveCatalogActivityId(item.key, activityPresets),
      category: item.category,
      direction: item.direction,
      quantity: item.activityAmount,
      unitLabel: item.unitLabel,
      emissionsKg: item.emissionsKg,
      emissionFactorKg: item.emissionFactorKg,
      regionCode: item.regionCode ?? null,
      methodologySource: item.source,
      assumptions: [item.formulaText, ...item.assumptions].join(' • '),
      notes: notes.trim() || undefined,
    }));

    const result = await addActivitiesBatch(payloads);
    setIsSaving(false);

    if (!result.ok) {
      setSaveError(result.error ?? 'Failed to save calculation.');
      return;
    }

    setCustomTitle('');
    setNotes('');
    const countLabel =
      payloads.length === 1
        ? payloads[0].title
        : `${payloads.length} ${selectedCategory} items`;
    const signedNet = formatCarbonKg(calculationOutcome.netKg, {
      showSign: true,
    });
    setLastLoggedSummary(`${countLabel} (${signedNet})`);
  };

  const isNetSavings = calculationOutcome.netKg < 0;

  return (
    <ScreenContainer keyboardAvoiding>
      <Animated.View entering={FadeInDown.duration(260)} style={styles.header}>
        <ThemedText variant="h1">Carbon Calculator</ThemedText>
        <ThemedText variant="body" color="textSecondary">
          Documented emission factors with unit conversions, configurable grids,
          and reproducible formulas.
        </ThemedText>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(50).duration(260)}
        style={styles.section}>
        <SectionHeader title="Activity Category" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {ACTIVITY_CATEGORIES.map((category) => (
            <CategoryChip
              key={category.key}
              category={category}
              selected={selectedCategory === category.key}
              onPress={() => handleSelectCategory(category.key)}
            />
          ))}
        </ScrollView>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(90).duration(260)}
        style={styles.formStack}>
        <Card variant="elevated" padding="lg" style={styles.formCard}>
          {selectedCategory === 'transport' ? (
            <TransportCalculatorSection
              state={transportState}
              onChange={(patch) => {
                setTransportState((prev) => ({ ...prev, ...patch }));
                setSaveError(null);
                setLastLoggedSummary(null);
              }}
              distanceError={
                calculationOutcome.error &&
                calculationOutcome.error.toLowerCase().includes('distance')
                  ? calculationOutcome.error
                  : undefined
              }
            />
          ) : null}

          {selectedCategory === 'electricity' ? (
            <ElectricityCalculatorSection
              state={electricityState}
              onChange={(patch) => {
                setElectricityState((prev) => ({ ...prev, ...patch }));
                setSaveError(null);
                setLastLoggedSummary(null);
              }}
              kwhError={
                calculationOutcome.error &&
                calculationOutcome.error.toLowerCase().includes('electricity')
                  ? calculationOutcome.error
                  : undefined
              }
            />
          ) : null}

          {selectedCategory === 'food' ? (
            <FoodCalculatorSection
              state={foodState}
              onChange={(patch) => {
                setFoodState((prev) => ({ ...prev, ...patch }));
                setSaveError(null);
                setLastLoggedSummary(null);
              }}
            />
          ) : null}

          {selectedCategory === 'lifestyle' ? (
            <LifestyleCalculatorSection
              state={lifestyleState}
              onChange={(patch) => {
                setLifestyleState((prev) => ({ ...prev, ...patch }));
                setSaveError(null);
                setLastLoggedSummary(null);
              }}
            />
          ) : null}

          {needsRegionalGridSelector ? (
            <RegionalGridSelector
              regionCode={activeRegionCode}
              customFactorText={activeCustomFactorText}
              onChangeRegion={(code) => {
                setRegionOverride(code);
                setRegionNotice(null);
                setSaveError(null);
              }}
              onChangeCustomFactorText={(val) => {
                setCustomFactorOverride(val);
                setRegionNotice(null);
                setSaveError(null);
              }}
              onSaveAsDefault={() => {
                void handleSaveRegionDefault();
              }}
              isSavingDefault={isSavingRegion}
              savedNotice={regionNotice}
            />
          ) : null}

          {selectedCategory === 'transport' || selectedCategory === 'electricity' ? (
            <Input
              label="Custom Activity Label (Optional)"
              placeholder={
                calculationOutcome.items[0]?.title ?? 'Custom activity label'
              }
              value={customTitle}
              onChangeText={setCustomTitle}
              leftIcon="create-outline"
            />
          ) : null}

          <Input
            label="Notes (Optional)"
            placeholder="Add commute route, utility bill month, or meal notes..."
            value={notes}
            onChangeText={setNotes}
            multiline
            leftIcon="chatbubble-ellipses-outline"
          />

          <FormulaBreakdownCard
            items={calculationOutcome.items}
            validationError={calculationOutcome.error}
          />

          <Card
            variant={isNetSavings ? 'mint' : 'forest'}
            padding="md"
            style={styles.resultCard}>
            <View style={styles.resultTop}>
              <ThemedText
                variant="label"
                style={{
                  color: isNetSavings ? colors.primary : colors.secondary,
                }}>
                {isNetSavings
                  ? 'NET ESTIMATED CARBON SAVED'
                  : 'CALCULATED CARBON FOOTPRINT'}
              </ThemedText>
              <Badge
                label={`${calculationOutcome.items.length} ${calculationOutcome.items.length === 1 ? 'item' : 'items'}`}
                tone={isNetSavings ? 'primary' : 'secondary'}
              />
            </View>
            <ThemedText
              variant="display"
              style={{
                color: isNetSavings ? colors.primary : colors.textOnPrimary,
              }}>
              {formatCarbonKg(calculationOutcome.netKg)}
            </ThemedText>
            {calculationOutcome.totalEmissionsKg > 0 &&
            calculationOutcome.totalOffsetsKg > 0 ? (
              <ThemedText
                variant="caption"
                style={{
                  color: isNetSavings ? colors.textSecondary : colors.secondary,
                }}>
                Gross emissions +{calculationOutcome.totalEmissionsKg.toFixed(2)}{' '}
                kg • Offsets -{calculationOutcome.totalOffsetsKg.toFixed(2)} kg
              </ThemedText>
            ) : null}
          </Card>

          {saveError ? (
            <View
              style={[
                styles.errorBanner,
                {
                  borderColor: colors.error,
                  backgroundColor: colors.surfaceElevated,
                },
              ]}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={colors.error}
              />
              <ThemedText variant="caption" color="error" style={styles.errorText}>
                {saveError}
              </ThemedText>
            </View>
          ) : null}

          <Button
            label={
              calculationOutcome.items.length > 1
                ? `Log All ${calculationOutcome.items.length} Items to Footprint`
                : "Log to Today's Footprint"
            }
            variant="primary"
            size="lg"
            fullWidth
            loading={isSaving}
            disabled={Boolean(calculationOutcome.error)}
            leftIcon="checkmark-circle-outline"
            onPress={() => {
              void handleSaveActivities();
            }}
          />

          {lastLoggedSummary ? (
            <Card variant="mint" padding="md" style={styles.confirmationCard}>
              <View style={styles.confirmRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.primary}
                />
                <View style={styles.confirmCopy}>
                  <ThemedText variant="bodyMedium" color="primary">
                    Saved & synced with dashboard
                  </ThemedText>
                  <ThemedText variant="caption" color="textSecondary">
                    {lastLoggedSummary}
                  </ThemedText>
                </View>
                <Button
                  label="Analytics"
                  size="sm"
                  variant="primary"
                  onPress={() => router.push(ROUTES.analytics)}
                />
              </View>
            </Card>
          ) : null}
        </Card>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.xs,
  },
  section: {
    gap: Spacing.sm,
  },
  chipRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xxs,
  },
  formStack: {
    gap: Spacing.md,
  },
  formCard: {
    gap: Spacing.base,
  },
  resultCard: {
    gap: Spacing.xs,
  },
  resultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
  },
  confirmationCard: {
    marginTop: Spacing.xs,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  confirmCopy: {
    flex: 1,
    gap: Spacing.xxs,
  },
});
