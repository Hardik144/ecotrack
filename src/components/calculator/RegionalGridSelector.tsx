import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ThemedText } from '@/components/ui/ThemedText';
import {
  ELECTRICITY_REGIONS,
  ELECTRICITY_REGION_MAP,
} from '@/constants/emissionFactors';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { ElectricityRegionCode } from '@/types/carbon';
import { resolveElectricityRegion } from '@/utils/carbonCalculator';
import { OptionPillGroup } from './OptionPillGroup';

export interface RegionalGridSelectorProps {
  regionCode: ElectricityRegionCode;
  customFactorText: string;
  onChangeRegion: (code: ElectricityRegionCode) => void;
  onChangeCustomFactorText: (text: string) => void;
  onSaveAsDefault?: () => void;
  isSavingDefault?: boolean;
  savedNotice?: string | null;
  compact?: boolean;
}

export function RegionalGridSelector({
  regionCode,
  customFactorText,
  onChangeRegion,
  onChangeCustomFactorText,
  onSaveAsDefault,
  isSavingDefault = false,
  savedNotice = null,
  compact = false,
}: RegionalGridSelectorProps) {
  const { colors } = useTheme();
  const regionMeta = ELECTRICITY_REGION_MAP[regionCode] ?? ELECTRICITY_REGION_MAP.global;
  const resolved = resolveElectricityRegion(regionCode, customFactorText);

  const regionItems = ELECTRICITY_REGIONS.map((item) => ({
    key: item.code,
    label: item.shortLabel,
    subLabel: item.code === 'custom' ? undefined : `${item.factorKgPerKwh}`,
  }));

  return (
    <Card
      variant={compact ? 'outlined' : 'mint'}
      padding="md"
      style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="globe-outline" size={16} color={colors.primary} />
          <ThemedText variant="label" color="primary">
            REGIONAL ELECTRICITY GRID FACTOR
          </ThemedText>
        </View>
        <Badge
          label={
            resolved.ok && resolved.data
              ? `${resolved.data.factorKgPerKwh.toFixed(4)} kg/kWh`
              : 'Factor needed'
          }
          tone={resolved.ok ? 'success' : 'warning'}
        />
      </View>

      <OptionPillGroup
        items={regionItems}
        selectedKey={regionCode}
        onSelect={onChangeRegion}
        layout="scroll"
      />

      {regionCode === 'custom' ? (
        <Input
          label="Custom Regional Factor (kg CO₂e / kWh)"
          placeholder="0.4450"
          keyboardType="decimal-pad"
          value={customFactorText}
          onChangeText={onChangeCustomFactorText}
          leftIcon="options-outline"
          errorText={!resolved.ok ? resolved.error : undefined}
          helperText="Enter local utility emission factor (0.0000 – 2.5000 kg CO₂e/kWh)."
        />
      ) : (
        <ThemedText variant="caption" color="textSecondary">
          {regionMeta.label} • Source: {regionMeta.source}
        </ThemedText>
      )}

      {onSaveAsDefault ? (
        <View style={styles.saveRow}>
          <Button
            label={isSavingDefault ? 'Saving...' : 'Save Default Region'}
            variant="secondary"
            size="sm"
            loading={isSavingDefault}
            leftIcon="bookmark-outline"
            onPress={onSaveAsDefault}
          />
          {savedNotice ? (
            <ThemedText variant="caption" color="primary" style={styles.savedText}>
              {savedNotice}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  savedText: {
    flex: 1,
  },
});
