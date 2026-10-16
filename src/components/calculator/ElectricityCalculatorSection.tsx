import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ThemedText } from '@/components/ui/ThemedText';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type {
  ElectricityMode,
  ElectricityPeriodBasis,
} from '@/types/carbon';
import { OptionPillGroup } from './OptionPillGroup';

export interface ElectricityFormState {
  monthlyKwhText: string;
  periodBasis: ElectricityPeriodBasis;
  householdMembers: number;
  mode: ElectricityMode;
}

export interface ElectricityCalculatorSectionProps {
  state: ElectricityFormState;
  onChange: (patch: Partial<ElectricityFormState>) => void;
  kwhError?: string;
}

export function ElectricityCalculatorSection({
  state,
  onChange,
  kwhError,
}: ElectricityCalculatorSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.stack}>
      <OptionPillGroup
        label="Calculation Type"
        items={[
          {
            key: 'grid' as const,
            label: 'Utility Consumption',
            icon: 'flash-outline',
          },
          {
            key: 'solar-offset' as const,
            label: 'Solar Generation Offset',
            icon: 'sunny-outline',
          },
        ]}
        selectedKey={state.mode}
        onSelect={(mode) => onChange({ mode })}
      />

      <Input
        label={
          state.mode === 'solar-offset'
            ? 'Monthly Clean Solar Generation (kWh)'
            : 'Monthly Electricity Consumption (kWh)'
        }
        placeholder="320"
        keyboardType="decimal-pad"
        value={state.monthlyKwhText}
        onChangeText={(monthlyKwhText) => onChange({ monthlyKwhText })}
        leftIcon="flash-outline"
        errorText={kwhError}
        helperText="Read directly from your monthly electric utility bill in kWh."
      />

      <OptionPillGroup
        label="Logging Basis"
        items={[
          { key: 'daily-average' as const, label: 'Daily Average (÷ 30 days)' },
          { key: 'monthly' as const, label: 'Full Monthly Total' },
        ]}
        selectedKey={state.periodBasis}
        onSelect={(periodBasis) => onChange({ periodBasis })}
      />

      <Card variant="outlined" padding="md" style={styles.householdCard}>
        <View style={styles.householdCopy}>
          <ThemedText variant="bodyMedium">Household Occupants</ThemedText>
          <ThemedText variant="caption" color="textMuted">
            Divides shared utility bill equally by household members
          </ThemedText>
        </View>
        <View style={styles.stepperGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease household occupants"
            onPress={() =>
              onChange({
                householdMembers: Math.max(1, state.householdMembers - 1),
              })
            }
            style={[
              styles.stepperBtn,
              { backgroundColor: colors.surfaceElevated },
            ]}>
            <Ionicons name="remove" size={16} color={colors.text} />
          </Pressable>
          <ThemedText variant="h3" color="primary" style={styles.countText}>
            {state.householdMembers}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase household occupants"
            onPress={() =>
              onChange({
                householdMembers: Math.min(20, state.householdMembers + 1),
              })
            }
            style={[
              styles.stepperBtn,
              { backgroundColor: colors.secondary },
            ]}>
            <Ionicons name="add" size={16} color={colors.primary} />
          </Pressable>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.md,
  },
  householdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  householdCopy: {
    flex: 1,
    gap: Spacing.xxs,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    minWidth: 24,
    textAlign: 'center',
  },
});
