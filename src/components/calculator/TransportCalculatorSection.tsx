import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ThemedText } from '@/components/ui/ThemedText';
import {
  BUS_SERVICE_FACTORS,
  CAR_FUEL_FACTORS,
  FLIGHT_CLASS_FACTORS,
  MOTORCYCLE_SIZE_FACTORS,
  TRAIN_SERVICE_FACTORS,
  TRANSPORT_MODE_META,
} from '@/constants/emissionFactors';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type {
  BusServiceType,
  CarFuelType,
  CyclingMode,
  DistanceUnit,
  FlightHaulClass,
  MotorcycleSize,
  TrainServiceType,
  TransportMode,
} from '@/types/carbon';
import { OptionPillGroup } from './OptionPillGroup';

export interface TransportFormState {
  mode: TransportMode;
  distanceText: string;
  distanceUnit: DistanceUnit;
  carFuel: CarFuelType;
  passengers: number;
  motorcycleSize: MotorcycleSize;
  busType: BusServiceType;
  trainType: TrainServiceType;
  flightClass: FlightHaulClass;
  isRoundTrip: boolean;
  cyclingMode: CyclingMode;
  countAsCarReplacementOffset: boolean;
}

export interface TransportCalculatorSectionProps {
  state: TransportFormState;
  onChange: (patch: Partial<TransportFormState>) => void;
  distanceError?: string;
}

export function TransportCalculatorSection({
  state,
  onChange,
  distanceError,
}: TransportCalculatorSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.stack}>
      <OptionPillGroup
        label="Transportation Mode (7 Supported Modes)"
        items={TRANSPORT_MODE_META.map((item) => ({
          key: item.key,
          label: item.label,
          icon: item.icon,
        }))}
        selectedKey={state.mode}
        onSelect={(mode) =>
          onChange({
            mode,
            countAsCarReplacementOffset:
              mode === 'walking' || mode === 'cycling'
                ? state.countAsCarReplacementOffset
                : false,
          })
        }
        layout="scroll"
      />

      <OptionPillGroup
        label="Distance Unit"
        items={[
          { key: 'km' as const, label: 'Kilometers (km)' },
          { key: 'mi' as const, label: 'Miles (mi → km)' },
        ]}
        selectedKey={state.distanceUnit}
        onSelect={(distanceUnit) => onChange({ distanceUnit })}
      />

      <Input
        label={`Trip Distance (${state.distanceUnit})`}
        placeholder="12"
        keyboardType="decimal-pad"
        value={state.distanceText}
        onChangeText={(distanceText) => onChange({ distanceText })}
        leftIcon="navigate-outline"
        errorText={distanceError}
        helperText={
          state.distanceUnit === 'mi'
            ? 'Converted at 1 mi = 1.609344 km before applying kg/km factors.'
            : 'Normalized directly to canonical kilometers.'
        }
      />

      {state.mode === 'car' ? (
        <View style={styles.subBlock}>
          <OptionPillGroup
            label="Fuel / Powertrain"
            items={Object.values(CAR_FUEL_FACTORS).map((f) => ({
              key: f.key,
              label: f.label,
            }))}
            selectedKey={state.carFuel}
            onSelect={(carFuel) => onChange({ carFuel })}
          />

          <Card variant="outlined" padding="md" style={styles.inlineRowCard}>
            <View style={styles.inlineCopy}>
              <ThemedText variant="bodyMedium">Passengers in Vehicle</ThemedText>
              <ThemedText variant="caption" color="textMuted">
                Splits vehicle emissions evenly when carpooling
              </ThemedText>
            </View>
            <View style={styles.stepperGroup}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease passengers"
                onPress={() =>
                  onChange({ passengers: Math.max(1, state.passengers - 1) })
                }
                style={[
                  styles.stepperBtn,
                  { backgroundColor: colors.surfaceElevated },
                ]}>
                <Ionicons name="remove" size={16} color={colors.text} />
              </Pressable>
              <ThemedText variant="h3" color="primary" style={styles.countText}>
                {state.passengers}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase passengers"
                onPress={() =>
                  onChange({ passengers: Math.min(6, state.passengers + 1) })
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
      ) : null}

      {state.mode === 'motorcycle' ? (
        <OptionPillGroup
          label="Engine Size"
          items={Object.values(MOTORCYCLE_SIZE_FACTORS).map((item) => ({
            key: item.key,
            label: item.label,
          }))}
          selectedKey={state.motorcycleSize}
          onSelect={(motorcycleSize) => onChange({ motorcycleSize })}
        />
      ) : null}

      {state.mode === 'bus' ? (
        <OptionPillGroup
          label="Bus Service Type"
          items={Object.values(BUS_SERVICE_FACTORS).map((item) => ({
            key: item.key,
            label: item.label,
          }))}
          selectedKey={state.busType}
          onSelect={(busType) => onChange({ busType })}
        />
      ) : null}

      {state.mode === 'train' ? (
        <OptionPillGroup
          label="Rail Service Type"
          items={Object.values(TRAIN_SERVICE_FACTORS).map((item) => ({
            key: item.key,
            label: item.label,
          }))}
          selectedKey={state.trainType}
          onSelect={(trainType) => onChange({ trainType })}
        />
      ) : null}

      {state.mode === 'air' ? (
        <View style={styles.subBlock}>
          <OptionPillGroup
            label="Flight Haul & Cabin Class (with Radiative Forcing)"
            items={Object.values(FLIGHT_CLASS_FACTORS).map((item) => ({
              key: item.key,
              label: item.label,
            }))}
            selectedKey={state.flightClass}
            onSelect={(flightClass) => onChange({ flightClass })}
          />

          <Card variant="outlined" padding="md" style={styles.inlineRowCard}>
            <View style={styles.inlineCopy}>
              <ThemedText variant="bodyMedium">Round-Trip Flight (×2)</ThemedText>
              <ThemedText variant="caption" color="textMuted">
                Doubles one-way route distance for outbound + return legs
              </ThemedText>
            </View>
            <Switch
              value={state.isRoundTrip}
              onValueChange={(isRoundTrip) => onChange({ isRoundTrip })}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </Card>
        </View>
      ) : null}

      {state.mode === 'cycling' ? (
        <OptionPillGroup
          label="Bicycle Type"
          items={[
            { key: 'conventional' as const, label: 'Regular Bicycle (0 kg/km)' },
            { key: 'ebike' as const, label: 'E-Bike (Regional Grid)' },
          ]}
          selectedKey={state.cyclingMode}
          onSelect={(cyclingMode) => onChange({ cyclingMode })}
        />
      ) : null}

      {state.mode === 'walking' || state.mode === 'cycling' ? (
        <Card variant="mint" padding="md" style={styles.inlineRowCard}>
          <View style={styles.inlineCopy}>
            <ThemedText variant="bodyMedium" color="primary">
              Replaced a Car Trip (Offset)
            </ThemedText>
            <ThemedText variant="caption" color="textSecondary">
              {state.countAsCarReplacementOffset
                ? 'Logs avoided petrol car emissions (0.1645 kg/km) as an Eco Offset'
                : 'Off = logs direct trip emissions (0.00 kg CO₂e/km for human power)'}
            </ThemedText>
          </View>
          <Switch
            value={state.countAsCarReplacementOffset}
            onValueChange={(countAsCarReplacementOffset) =>
              onChange({ countAsCarReplacementOffset })
            }
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
          />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.md,
  },
  subBlock: {
    gap: Spacing.sm,
  },
  inlineRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  inlineCopy: {
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
