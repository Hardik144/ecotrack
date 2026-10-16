import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ThemedText } from '@/components/ui/ThemedText';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { CalculationLineItem } from '@/types/carbon';

export interface FormulaBreakdownCardProps {
  items: CalculationLineItem[];
  validationError?: string | null;
}

export function FormulaBreakdownCard({
  items,
  validationError = null,
}: FormulaBreakdownCardProps) {
  const { colors } = useTheme();

  if (validationError) {
    return (
      <Card
        variant="outlined"
        padding="md"
        style={[styles.card, { borderColor: colors.error }]}>
        <View style={styles.headerRow}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
          <ThemedText variant="label" color="error">
            INPUT VALIDATION
          </ThemedText>
        </View>
        <ThemedText variant="caption" color="error">
          {validationError}
        </ThemedText>
      </Card>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <Card variant="outlined" padding="md" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="analytics-outline" size={16} color={colors.primary} />
          <ThemedText variant="label" color="primary">
            TRANSPARENT FORMULA & ASSUMPTIONS
          </ThemedText>
        </View>
        <Badge label="CO₂e = Amount × Factor" tone="secondary" />
      </View>

      <View style={styles.itemsStack}>
        {items.map((item) => {
          const isOffset = item.direction === 'offset';
          return (
            <View
              key={item.key}
              style={[
                styles.lineCard,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}>
              <View style={styles.lineTopRow}>
                <ThemedText variant="bodyMedium" style={styles.lineTitle}>
                  {item.title}
                </ThemedText>
                <Badge
                  label={isOffset ? 'Eco Offset' : 'Emission'}
                  tone={isOffset ? 'success' : 'neutral'}
                />
              </View>

              <ThemedText variant="label" color="primary">
                {item.formulaText}
              </ThemedText>

              {item.assumptions.map((note, idx) => (
                <View key={`${item.key}-a-${idx}`} style={styles.bulletRow}>
                  <ThemedText variant="caption" color="textMuted">
                    •
                  </ThemedText>
                  <ThemedText
                    variant="caption"
                    color="textSecondary"
                    style={styles.bulletText}>
                    {note}
                  </ThemedText>
                </View>
              ))}

              <ThemedText variant="caption" color="textMuted">
                Source: {item.source}
              </ThemedText>
            </View>
          );
        })}
      </View>
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
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  itemsStack: {
    gap: Spacing.sm,
  },
  lineCard: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  lineTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  lineTitle: {
    flex: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  bulletText: {
    flex: 1,
  },
});
