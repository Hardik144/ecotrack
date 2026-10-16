import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ThemedText } from '@/components/ui/ThemedText';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { TransportVsElectricitySummary } from '@/types/carbon';
import { formatCarbonKg } from '@/utils/formatters';
import { computeNiceChartMax, getCategoryColorMap } from './chartHelpers';

export interface TransportVsElectricityChartProps {
  summary: TransportVsElectricitySummary;
  rangeLabel: string;
}

const CHART_HEIGHT = 152;
const PAD_TOP = 12;
const PAD_BOTTOM = 8;

/**
 * Chart 5: Transportation vs Electricity Head-to-Head Grouped Comparison Chart.
 */
export const TransportVsElectricityChart = memo(
  function TransportVsElectricityChart({
    summary,
    rangeLabel,
  }: TransportVsElectricityChartProps) {
  const { colors } = useTheme();
  const categoryColors = getCategoryColorMap(colors);
  const [chartWidth, setChartWidth] = useState(300);

  const hasAny =
    summary.transportGrossKg > 0 ||
    summary.electricityGrossKg > 0 ||
    summary.transportOffsetsKg > 0 ||
    summary.electricityOffsetsKg > 0;

  if (!hasAny) {
    return (
      <EmptyState
        icon="swap-horizontal-outline"
        title="No transport or electricity records yet"
        description={`Log travel or home electricity usage within ${rangeLabel} to compare mobility vs home energy emissions.`}
      />
    );
  }

  const maxPeriodVal = computeNiceChartMax(
    summary.periods.flatMap((p) => [p.transportKg, p.electricityKg]),
    2
  );
  const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const periodCount = Math.max(summary.periods.length, 1);
  const slotWidth = chartWidth / periodCount;
  const barWidth = Math.min(Math.max(slotWidth * 0.28, 6), 18);

  const dominantLabel =
    summary.dominantCategory === 'transport'
      ? `Transport higher by ${summary.gapKg.toFixed(1)} kg`
      : summary.dominantCategory === 'electricity'
        ? `Electricity higher by ${summary.gapKg.toFixed(1)} kg`
        : summary.dominantCategory === 'tied'
          ? 'Even split'
          : 'Offsets only';

  // Thin out bottom axis labels when many periods exist
  const labelStride = periodCount > 8 ? Math.ceil(periodCount / 6) : 1;

  return (
    <Card variant="elevated" padding="lg" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitle}>
          <ThemedText variant="label" color="textMuted">
            MOBILITY VS HOME GRID ({rangeLabel.toUpperCase()})
          </ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            Gross emissions comparison across sub-periods
          </ThemedText>
        </View>
        <Badge
          label={dominantLabel}
          tone={summary.dominantCategory === 'electricity' ? 'warning' : 'secondary'}
        />
      </View>

      <View style={styles.headToHeadRow}>
        <View
          style={[
            styles.metricBox,
            { backgroundColor: colors.surfaceElevated, borderColor: categoryColors.transport },
          ]}>
          <View style={styles.metricTitleRow}>
            <Ionicons name="car-outline" size={16} color={categoryColors.transport} />
            <ThemedText variant="label" style={{ color: categoryColors.transport }}>
              Transportation
            </ThemedText>
          </View>
          <ThemedText variant="h2">{formatCarbonKg(summary.transportGrossKg)}</ThemedText>
          <ThemedText variant="caption" color="textMuted">
            {summary.transportSharePct.toFixed(0)}% of pair
            {summary.transportOffsetsKg > 0
              ? ` • -${summary.transportOffsetsKg.toFixed(1)}kg offset`
              : ''}
          </ThemedText>
        </View>

        <View
          style={[
            styles.metricBox,
            { backgroundColor: colors.surfaceElevated, borderColor: categoryColors.electricity },
          ]}>
          <View style={styles.metricTitleRow}>
            <Ionicons name="flash-outline" size={16} color={categoryColors.electricity} />
            <ThemedText variant="label" style={{ color: categoryColors.electricity }}>
              Electricity
            </ThemedText>
          </View>
          <ThemedText variant="h2">{formatCarbonKg(summary.electricityGrossKg)}</ThemedText>
          <ThemedText variant="caption" color="textMuted">
            {summary.electricitySharePct.toFixed(0)}% of pair
            {summary.electricityOffsetsKg > 0
              ? ` • -${summary.electricityOffsetsKg.toFixed(1)}kg solar`
              : ''}
          </ThemedText>
        </View>
      </View>

      <View
        style={styles.chartHost}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 40 && Math.abs(w - chartWidth) > 2) {
            setChartWidth(w);
          }
        }}>
        <Svg
          width={chartWidth}
          height={CHART_HEIGHT}
          viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
          {[0, 0.5, 1].map((ratio) => {
            const gy = PAD_TOP + plotH * ratio;
            return (
              <Line
                key={ratio}
                x1={0}
                y1={gy}
                x2={chartWidth}
                y2={gy}
                stroke={colors.border}
                strokeWidth={1}
              />
            );
          })}

          {summary.periods.map((period, idx) => {
            const center = idx * slotWidth + slotWidth / 2;
            const transportH = Math.max(
              (period.transportKg / maxPeriodVal) * plotH,
              period.transportKg > 0 ? 4 : 0
            );
            const elecH = Math.max(
              (period.electricityKg / maxPeriodVal) * plotH,
              period.electricityKg > 0 ? 4 : 0
            );
            const baselineY = PAD_TOP + plotH;

            return [
              <Rect
                key={`${period.key}-t`}
                x={center - barWidth - 1.5}
                y={baselineY - transportH}
                width={barWidth}
                height={transportH}
                rx={3}
                fill={categoryColors.transport}
              />,
              <Rect
                key={`${period.key}-e`}
                x={center + 1.5}
                y={baselineY - elecH}
                width={barWidth}
                height={elecH}
                rx={3}
                fill={categoryColors.electricity}
              />,
            ];
          })}
        </Svg>
      </View>

      <View style={styles.axisRow}>
        {summary.periods.map((period, idx) => (
          <View key={period.key} style={styles.axisSlot}>
            {idx % labelStride === 0 || idx === summary.periods.length - 1 ? (
              <ThemedText variant="caption" color="textMuted" style={styles.axisLabel}>
                {period.label}
              </ThemedText>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View
            style={[styles.dot, { backgroundColor: categoryColors.transport }]}
          />
          <ThemedText variant="caption" color="textSecondary">
            Transport Net: {formatCarbonKg(summary.transportNetKg)}
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.dot, { backgroundColor: categoryColors.electricity }]}
          />
          <ThemedText variant="caption" color="textSecondary">
            Electricity Net: {formatCarbonKg(summary.electricityNetKg)}
          </ThemedText>
        </View>
      </View>
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
  headerTitle: {
    flex: 1,
    gap: 2,
  },
  headToHeadRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  metricBox: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderLeftWidth: 3,
    gap: 2,
  },
  metricTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  chartHost: {
    minHeight: CHART_HEIGHT,
  },
  axisRow: {
    flexDirection: 'row',
  },
  axisSlot: {
    flex: 1,
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: 10,
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
});
