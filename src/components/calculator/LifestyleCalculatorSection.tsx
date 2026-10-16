import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ThemedText } from '@/components/ui/ThemedText';
import {
  LIFESTYLE_WASTE_FACTOR,
  RECYCLING_MATERIAL_FACTORS,
  WATER_HEATER_FACTORS,
} from '@/constants/emissionFactors';
import { Spacing } from '@/constants/theme';
import type {
  MassUnit,
  RecyclingMaterialType,
  WaterHeaterType,
  WaterVolumeUnit,
} from '@/types/carbon';
import { OptionPillGroup } from './OptionPillGroup';

export interface LifestyleFormState {
  waterAmountText: string;
  waterUnit: WaterVolumeUnit;
  waterHeaterType: WaterHeaterType;
  wasteAmountText: string;
  wasteUnit: MassUnit;
  recyclingAmountText: string;
  recyclingUnit: MassUnit;
  recyclingMaterial: RecyclingMaterialType;
}

export interface LifestyleCalculatorSectionProps {
  state: LifestyleFormState;
  onChange: (patch: Partial<LifestyleFormState>) => void;
}

export function LifestyleCalculatorSection({
  state,
  onChange,
}: LifestyleCalculatorSectionProps) {
  const recyclingMeta = RECYCLING_MATERIAL_FACTORS[state.recyclingMaterial];

  return (
    <View style={styles.stack}>
      <ThemedText variant="caption" color="textSecondary">
        Estimate household water use, residual landfill waste, and avoided
        emissions from recycling (leave unused items empty or 0).
      </ThemedText>

      <Card variant="outlined" padding="md" style={styles.componentCard}>
        <View style={styles.cardHeader}>
          <ThemedText variant="bodyMedium">1. Water Consumption</ThemedText>
          <Badge label="Supply + Heating" tone="secondary" />
        </View>
        <OptionPillGroup
          label="Water Supply / Heating"
          items={Object.values(WATER_HEATER_FACTORS).map((item) => ({
            key: item.key,
            label: item.label,
          }))}
          selectedKey={state.waterHeaterType}
          onSelect={(waterHeaterType) => onChange({ waterHeaterType })}
        />
        <OptionPillGroup
          label="Volume Unit"
          items={[
            { key: 'L' as const, label: 'Liters (L)' },
            { key: 'm3' as const, label: 'Cubic Meters (m³)' },
            { key: 'gal' as const, label: 'US Gallons (gal)' },
          ]}
          selectedKey={state.waterUnit}
          onSelect={(waterUnit) => onChange({ waterUnit })}
        />
        <Input
          label={`Water Used (${state.waterUnit})`}
          placeholder="0"
          keyboardType="decimal-pad"
          value={state.waterAmountText}
          onChangeText={(waterAmountText) => onChange({ waterAmountText })}
          leftIcon="water-outline"
          helperText="Example: an average 8-minute shower uses ~60 L; typical daily home total is ~150 L."
        />
      </Card>

      <Card variant="outlined" padding="md" style={styles.componentCard}>
        <View style={styles.cardHeader}>
          <ThemedText variant="bodyMedium">2. Waste Generation (Landfill)</ThemedText>
          <Badge
            label={`${LIFESTYLE_WASTE_FACTOR.factorKgPerUnit.toFixed(4)} kg/kg`}
            tone="warning"
          />
        </View>
        <OptionPillGroup
          label="Weight Unit"
          items={[
            { key: 'kg' as const, label: 'Kilograms (kg)' },
            { key: 'g' as const, label: 'Grams (g)' },
            { key: 'lb' as const, label: 'Pounds (lb)' },
          ]}
          selectedKey={state.wasteUnit}
          onSelect={(wasteUnit) => onChange({ wasteUnit })}
        />
        <Input
          label={`Trash Sent to Landfill (${state.wasteUnit})`}
          placeholder="0"
          keyboardType="decimal-pad"
          value={state.wasteAmountText}
          onChangeText={(wasteAmountText) => onChange({ wasteAmountText })}
          leftIcon="trash-bin-outline"
        />
      </Card>

      <Card variant="mint" padding="md" style={styles.componentCard}>
        <View style={styles.cardHeader}>
          <ThemedText variant="bodyMedium" color="primary">
            3. Recycling Activities (Eco Offset)
          </ThemedText>
          <Badge
            label={`-${recyclingMeta.factorKgPerUnit.toFixed(2)} kg/kg`}
            tone="success"
          />
        </View>
        <OptionPillGroup
          label="Recycled Material Stream"
          items={Object.values(RECYCLING_MATERIAL_FACTORS).map((item) => ({
            key: item.key,
            label: item.label,
          }))}
          selectedKey={state.recyclingMaterial}
          onSelect={(recyclingMaterial) => onChange({ recyclingMaterial })}
        />
        <OptionPillGroup
          label="Weight Unit"
          items={[
            { key: 'kg' as const, label: 'Kilograms (kg)' },
            { key: 'g' as const, label: 'Grams (g)' },
            { key: 'lb' as const, label: 'Pounds (lb)' },
          ]}
          selectedKey={state.recyclingUnit}
          onSelect={(recyclingUnit) => onChange({ recyclingUnit })}
        />
        <Input
          label={`Weight Recycled (${state.recyclingUnit})`}
          placeholder="0"
          keyboardType="decimal-pad"
          value={state.recyclingAmountText}
          onChangeText={(recyclingAmountText) =>
            onChange({ recyclingAmountText })
          }
          leftIcon="refresh-circle-outline"
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
