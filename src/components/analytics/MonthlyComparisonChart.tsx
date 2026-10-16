import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ThemedText } from '@/components/ui/ThemedText';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { MonthlyComparisonSummary } from '@/types/carbon';
import { formatCarbonKg } from '@/utils/formatters';
import { computeNiceChartMax } from './chartHelpers';

export interface MonthlyComparisonChartProps {
  summary: MonthlyComparisonSummary;
  onSelectMonthForReport?: (monthKey: string) => void;
}

/**
 * Chart 3: Calendar Month-over-Month Emissions vs Avoided Comparison.
 */
export const MonthlyComparisonChart = memo(function MonthlyComparisonChart({
  summary,
  onSelectMonthForReport,
}: MonthlyComparisonChartProps) {
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
        icon="stats-chart-outline"
        title="No monthly comparison data yet"
        description="Log activities across days or months to unlock month-over-month comparisons."
      />
    );
  }

  const maxBarVal = computeNiceChartMax(
    summary.buckets.flatMap((b) => [b.grossKg, Math.max(0, b.netKg), b.offsetsKg]),
    5
  );
  const selectedMonth =
    summary.buckets[selectedIndex] ?? summary.buckets[summary.buckets.length - 1];

  const deltaTone = summary.deltaKg <= 0 ? 'success' : 'warning';
  const deltaBadge =
    summary.deltaPct !== null
      ? `${summary.deltaPct > 0 ? '+' : ''}${summary.deltaPct}% vs last month`
      : summary.previousMonthNetKg === 0 && summary.currentMonthNetKg > 0
        ? 'No prior month data'
        : 'Stable';

  return (
    <Card variant="elevated" padding="lg" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <ThemedText variant="label" color="textMuted">
            THIS MONTH VS PREVIOUS MONTH
          </ThemedText>
          <View style={styles.inlineValues}>
            <ThemedText variant="h2" color="primary">
              {formatCarbonKg(summary.currentMonthNetKg)}
            </ThemedText>
            <ThemedText variant="caption" color="textMuted">
              vs {formatCarbonKg(summary.previousMonthNetKg)} last mo
            </ThemedText>
          </View>
        </View>
        <Badge label={deltaBadge} tone={deltaTone} />
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <ThemedText variant="caption" color="textSecondary">
            Net CO₂e
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.warning }]} />
          <ThemedText variant="caption" color="textSecondary">
            Gross Emissions
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <ThemedText variant="caption" color="textSecondary">
            Avoided Offsets
          </ThemedText>
        </View>
      </View>

      <View style={styles.rowsStack}>
        {summary.buckets.map((month, idx) => {
          const active = idx === selectedIndex;
          const grossPct = Math.round((month.grossKg / maxBarVal) * 100);
          const netPct = Math.round((Math.max(0, month.netKg) / maxBarVal) * 100);
          const offsetPct = Math.round((month.offsetsKg / maxBarVal) * 100);

          return (
            <Pressable
              key={month.monthKey}
              accessibilityRole="button"
              accessibilityLabel={`${month.fullLabel}: ${month.netKg} kg net`}
              onPress={() => {
                setSelectedIndex(idx);
                onSelectMonthForReport?.(month.monthKey);
              }}
              style={[
                styles.monthRow,
                active && {
                  backgroundColor: colors.surfaceElevated,
                  borderRadius: Radii.md,
                  paddingHorizontal: Spacing.sm,
                  paddingVertical: Spacing.xs,
                },
              ]}>
              <ThemedText
                variant="label"
                color={active ? 'primary' : 'textSecondary'}
                style={styles.monthLabel}>
                {month.label}
              </ThemedText>

              <View style={styles.barGroup}>
                <View style={styles.trackBg}>
                  <View
                    style={[
                      styles.bar,
                      {
                        width: `${Math.max(netPct, month.netKg > 0 ? 3 : 0)}%`,
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>
                <View style={styles.trackBg}>
                  <View
                    style={[
                      styles.bar,
                      {
                        width: `${Math.max(grossPct, month.grossKg > 0 ? 3 : 0)}%`,
                        backgroundColor: colors.warning,
                        opacity: 0.78,
                      },
                    ]}
                  />
                </View>
                {month.offsetsKg > 0 ? (
                  <View style={styles.trackBg}>
                    <View
                      style={[
                        styles.bar,
                        {
                          width: `${Math.max(offsetPct, 3)}%`,
                          backgroundColor: colors.success,
                        },
                      ]}
                    />
                  </View>
                ) : null}
              </View>

              <View style={styles.monthValues}>
                <ThemedText variant="label" color="text">
                  {month.netKg.toFixed(1)} kg
                </ThemedText>
                <ThemedText variant="caption" color="textMuted" style={styles.subCaption}>
                  {month.recordCount} logs
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      {selectedMonth ? (
        <ThemedText variant="caption" color="textMuted">
          {selectedMonth.fullLabel}: {selectedMonth.grossKg.toFixed(2)} kg gross −{' '}
          {selectedMonth.offsetsKg.toFixed(2)} kg avoided = {selectedMonth.netKg.toFixed(2)} kg net
          {' • '}Avg {selectedMonth.avgDailyNetKg.toFixed(2)} kg/day
        </ThemedText>
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
  headerLeft: {
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
  rowsStack: {
    gap: Spacing.sm,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  monthLabel: {
    width: 38,
  },
  barGroup: {
    flex: 1,
    gap: 4,
  },
  trackBg: {
    width: '100%',
    height: 7,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  bar: {
    height: 7,
    borderRadius: Radii.pill,
  },
  monthValues: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  subCaption: {
    fontSize: 10,
  },
});
