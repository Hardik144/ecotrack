import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ThemedText } from '@/components/ui/ThemedText';
import {
  DAIRY_PRODUCT_FACTORS,
  FOOD_WASTE_FACTORS,
  NON_VEGETARIAN_MEAL_FACTORS,
  VEGETARIAN_MEAL_FACTORS,
} from '@/constants/emissionFactors';
import { Spacing } from '@/constants/theme';
import type {
  DairyProductType,
  FoodWasteMethod,
  MassUnit,
  NonVegetarianProteinType,
  VegetarianType,
} from '@/types/carbon';
import { OptionPillGroup } from './OptionPillGroup';

export interface FoodFormState {
  vegetarianMealsText: string;
  vegetarianType: VegetarianType;
  nonVegetarianMealsText: string;
  nonVegetarianType: NonVegetarianProteinType;
  dairyServingsText: string;
  dairyType: DairyProductType;
  foodWasteText: string;
  foodWasteUnit: MassUnit;
  foodWasteMethod: FoodWasteMethod;
}

export interface FoodCalculatorSectionProps {
  state: FoodFormState;
  onChange: (patch: Partial<FoodFormState>) => void;
}

export function FoodCalculatorSection({
  state,
  onChange,
}: FoodCalculatorSectionProps) {
  const vegFactor = VEGETARIAN_MEAL_FACTORS[state.vegetarianType].factorKgPerUnit;
  const nonVegFactor =
    NON_VEGETARIAN_MEAL_FACTORS[state.nonVegetarianType].factorKgPerUnit;
  const dairyFactor = DAIRY_PRODUCT_FACTORS[state.dairyType].factorKgPerUnit;
  const wasteFactor = FOOD_WASTE_FACTORS[state.foodWasteMethod].factorKgPerUnit;

  return (
    <View style={styles.stack}>
      <ThemedText variant="caption" color="textSecondary">
        Enter quantities for any combination of meals, dairy, and food waste (set
        unused items to 0).
      </ThemedText>

      <Card variant="outlined" padding="md" style={styles.componentCard}>
        <View style={styles.cardHeader}>
          <ThemedText variant="bodyMedium">1. Vegetarian Meals</ThemedText>
          <Badge label={`${vegFactor.toFixed(2)} kg/meal`} tone="secondary" />
        </View>
        <OptionPillGroup
          items={Object.values(VEGETARIAN_MEAL_FACTORS).map((item) => ({
            key: item.key,
            label: item.label,
          }))}
          selectedKey={state.vegetarianType}
          onSelect={(vegetarianType) => onChange({ vegetarianType })}
        />
        <Input
          label="Number of Meals"
          placeholder="0"
          keyboardType="decimal-pad"
          value={state.vegetarianMealsText}
          onChangeText={(vegetarianMealsText) =>
            onChange({ vegetarianMealsText })
          }
          leftIcon="leaf-outline"
        />
      </Card>

      <Card variant="outlined" padding="md" style={styles.componentCard}>
        <View style={styles.cardHeader}>
          <ThemedText variant="bodyMedium">2. Non-Vegetarian Meals</ThemedText>
          <Badge label={`${nonVegFactor.toFixed(2)} kg/meal`} tone="warning" />
        </View>
        <OptionPillGroup
          items={Object.values(NON_VEGETARIAN_MEAL_FACTORS).map((item) => ({
            key: item.key,
            label: item.label,
          }))}
          selectedKey={state.nonVegetarianType}
          onSelect={(nonVegetarianType) => onChange({ nonVegetarianType })}
        />
        <Input
          label="Number of Meals"
          placeholder="0"
          keyboardType="decimal-pad"
          value={state.nonVegetarianMealsText}
          onChangeText={(nonVegetarianMealsText) =>
            onChange({ nonVegetarianMealsText })
          }
          leftIcon="restaurant-outline"
        />
      </Card>

      <Card variant="outlined" padding="md" style={styles.componentCard}>
        <View style={styles.cardHeader}>
          <ThemedText variant="bodyMedium">3. Dairy Consumption</ThemedText>
          <Badge label={`${dairyFactor.toFixed(2)} kg/serving`} tone="neutral" />
        </View>
        <OptionPillGroup
          items={Object.values(DAIRY_PRODUCT_FACTORS).map((item) => ({
            key: item.key,
            label: item.label,
          }))}
          selectedKey={state.dairyType}
          onSelect={(dairyType) => onChange({ dairyType })}
        />
        <Input
          label="Servings"
          placeholder="0"
          keyboardType="decimal-pad"
          value={state.dairyServingsText}
          onChangeText={(dairyServingsText) => onChange({ dairyServingsText })}
          leftIcon="cafe-outline"
        />
      </Card>

      <Card variant="outlined" padding="md" style={styles.componentCard}>
        <View style={styles.cardHeader}>
          <ThemedText variant="bodyMedium">4. Food Waste</ThemedText>
          <Badge label={`${wasteFactor.toFixed(4)} kg/kg`} tone="neutral" />
        </View>
        <OptionPillGroup
          label="Disposal Method"
          items={Object.values(FOOD_WASTE_FACTORS).map((item) => ({
            key: item.key,
            label: item.label,
          }))}
          selectedKey={state.foodWasteMethod}
          onSelect={(foodWasteMethod) => onChange({ foodWasteMethod })}
        />
        <OptionPillGroup
          label="Weight Unit"
          items={[
            { key: 'kg' as const, label: 'Kilograms (kg)' },
            { key: 'g' as const, label: 'Grams (g → kg)' },
            { key: 'lb' as const, label: 'Pounds (lb → kg)' },
          ]}
          selectedKey={state.foodWasteUnit}
          onSelect={(foodWasteUnit) => onChange({ foodWasteUnit })}
        />
        <Input
          label={`Food Wasted (${state.foodWasteUnit})`}
          placeholder="0"
          keyboardType="decimal-pad"
          value={state.foodWasteText}
          onChangeText={(foodWasteText) => onChange({ foodWasteText })}
          leftIcon="trash-outline"
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.md,
  },
  componentCard: {
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
});
