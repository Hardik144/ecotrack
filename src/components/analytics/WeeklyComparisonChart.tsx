import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ThemedText } from '@/components/ui/ThemedText';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { WeeklyComparisonSummary } from '@/types/carbon';
import { formatCarbonKg } from '@/utils/formatters';
import { computeNiceChartMax } from './chartHelpers';

export interface WeeklyComparisonChartProps {
  summary: WeeklyComparisonSummary;
}

/**
 * Chart 2: Week-over-Week Net CO2e Comparison & 6-Week Bar Chart.
 */
export const WeeklyComparisonChart = memo(function WeeklyComparisonChart({
  summary,
}: WeeklyComparisonChartProps) {
  const { colors } = useTheme();
  const [selectedIndexState, setSelectedIndex] = useState<number | null>(null);

  const selectedIndex =
    selectedIndexState !== null && selectedIndexState < summary.buckets.length
      ? selectedIndexState
      : Math.max(summary.buckets.length - 1, 0);

  const anyRecords = summary.buckets.some((b) => b.recordCount > 0);
  if (!anyRecords) {
    return (
      <EmptyState
        icon="calendar-outline"
        title="No weekly comparison history yet"
        description="Log carbon activities to compare this week against previous weeks."
      />
    );
  }

  const selectedWeek =
    summary.buckets[selectedIndex] ?? summary.buckets[summary.buckets.length - 1];
  const maxVal = computeNiceChartMax(
    summary.buckets.flatMap((b) => [b.grossKg, Math.max(0, b.netKg), b.budgetKg]),
    5
  );

  const deltaTone =
    summary.deltaKg <= 0 ? 'success' : 'warning';
  const deltaBadgeText =
    summary.deltaPct !== null
      ? `${summary.deltaPct > 0 ? '+' : ''}${summary.deltaPct}% vs prior 7d`
      : summary.previous7dNetKg === 0 && summary.current7dNetKg > 0
        ? 'No prior 7d logs'
        : 'On track';

  return (
    <Card variant="elevated" padding="lg" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerStats}>
          <ThemedText variant="label" color="textMuted">
            ROLLING 7-DAY COMPARISON
          </ThemedText>
          <View style={styles.inlineValues}>
            <ThemedText variant="h2" color="primary">
              {formatCarbonKg(summary.current7dNetKg)}
            </ThemedText>
            <ThemedText variant="caption" color="textMuted">
              vs {formatCarbonKg(summary.previous7dNetKg)} prior 7d
            </ThemedText>
          </View>
        </View>
        <Badge label={deltaBadgeText} tone={deltaTone} />
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <ThemedText variant="caption" color="textSecondary">
            Net CO₂e
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.border }]} />
          <ThemedText variant="caption" color="textSecondary">
            Weekly Budget ({selectedWeek?.budgetKg.toFixed(0)} kg)
          </ThemedText>
        </View>
      </View>

      <View style={styles.barsRow}>
        {summary.buckets.map((week, idx) => {
          const active = idx === selectedIndex;
          const netHeight = Math.round(
            (Math.max(0, week.netKg) / maxVal) * 116
          );
          const overBudget = week.netKg > week.budgetKg;

          return (
            <Pressable
              key={week.weekStartKey}
              accessibilityRole="button"
              accessibilityLabel={`${week.rangeLabel}: ${week.netKg} kg`}
              onPress={() => setSelectedIndex(idx)}
              style={styles.barColumn}>
              <ThemedText
                variant="caption"
                color={active ? 'primary' : 'textMuted'}
                style={styles.barValue}>
                {week.recordCount > 0 ? week.netKg.toFixed(1) : '0'}
              </ThemedText>
              <View
                style={[
                  styles.barTrack,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: active ? colors.primary : 'transparent',
                    borderWidth: active ? 1.5 : 0,
                  },
                ]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: Math.max(netHeight, week.recordCount > 0 ? 6 : 0),
                      backgroundColor: overBudget
                        ? colors.warning
                        : active
                          ? colors.primary
                          : colors.primarySoft,
                    },
                  ]}
                />
              </View>
              <ThemedText
                variant="caption"
                color={active ? 'primary' : 'textSecondary'}
                style={styles.barLabel}>
                {week.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {selectedWeek ? (
        <View style={[styles.detailBox, { backgroundColor: colors.surfaceElevated }]}>
          <ThemedText variant="label" color="primary">
            Week of {selectedWeek.rangeLabel}
          </ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            Gross: {selectedWeek.grossKg.toFixed(2)} kg • Avoided:{' '}
            {selectedWeek.offsetsKg.toFixed(2)} kg • Net: {selectedWeek.netKg.toFixed(2)} kg (
            {selectedWeek.recordCount} logs across {selectedWeek.loggedDays}d)
          </ThemedText>
        </View>
      ) : null}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  headerStats: {
    flex: 1,
    gap: 2,
  },
  inlineValues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: Radii.pill,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  barValue: {
    fontSize: 11,
  },
  barTrack: {
    width: '100%',
    maxWidth: 40,
    height: 120,
    borderRadius: Radii.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: Radii.sm,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  detailBox: {
    padding: Spacing.sm + 2,
    borderRadius: Radii.md,
    gap: 2,
  },
});
