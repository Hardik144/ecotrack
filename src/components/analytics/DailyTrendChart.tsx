import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ThemedText } from '@/components/ui/ThemedText';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { DailyTrendPoint } from '@/types/carbon';
import { formatCarbonKg } from '@/utils/formatters';
import { computeNiceChartMax } from './chartHelpers';

export interface DailyTrendChartProps {
  points: DailyTrendPoint[];
  dailyBudgetKg: number;
  rangeLabel: string;
}

const CHART_HEIGHT = 176;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 16;

/**
 * Chart 1: Interactive Daily CO2e Trend (Area + Line + Daily Target Threshold).
 */
export const DailyTrendChart = memo(function DailyTrendChart({
  points,
  dailyBudgetKg,
  rangeLabel,
}: DailyTrendChartProps) {
  const { colors } = useTheme();
  const [chartWidth, setChartWidth] = useState(300);
  const [selectedIndexState, setSelectedIndex] = useState<number | null>(null);

  const selectedIndex =
    selectedIndexState !== null && selectedIndexState < points.length
      ? selectedIndexState
      : Math.max(points.length - 1, 0);

  const anyLogged = points.some((p) => p.hasRecords);
  const activePoint = points[selectedIndex] ?? points[points.length - 1];

  if (points.length === 0 || !anyLogged) {
    return (
      <EmptyState
        icon="analytics-outline"
        title="No daily trend data in this window"
        description={`No emission records were found for ${rangeLabel}. Try a wider date filter or log an activity.`}
      />
    );
  }

  const maxY = computeNiceChartMax(
    [dailyBudgetKg, ...points.map((p) => Math.max(0, p.netKg))],
    Math.max(dailyBudgetKg, 2)
  );
  const plotW = Math.max(chartWidth - PAD_LEFT - PAD_RIGHT, 120);
  const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  const coords = points.map((pt, idx) => {
    const x =
      points.length === 1
        ? PAD_LEFT + plotW / 2
        : PAD_LEFT + (idx / (points.length - 1)) * plotW;
    const clampedYVal = Math.max(0, pt.netKg);
    const y = PAD_TOP + plotH - (clampedYVal / maxY) * plotH;
    return { x, y, pt };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const baselineY = PAD_TOP + plotH;
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baselineY} L ${coords[0].x.toFixed(1)} ${baselineY} Z`
      : '';

  const targetY =
    PAD_TOP + plotH - (Math.min(dailyBudgetKg, maxY) / maxY) * plotH;

  // Pick readable x-axis tick indices (max 6 ticks)
  const labelIndices: number[] = [];
  if (points.length <= 7) {
    for (let i = 0; i < points.length; i += 1) labelIndices.push(i);
  } else {
    const step = Math.ceil((points.length - 1) / 5);
    for (let i = 0; i < points.length; i += step) labelIndices.push(i);
    if (labelIndices[labelIndices.length - 1] !== points.length - 1) {
      labelIndices.push(points.length - 1);
    }
  }

  const totalNet = points.reduce((sum, p) => sum + p.netKg, 0);
  const loggedDaysCount = points.filter((p) => p.hasRecords).length;

  return (
    <Card variant="elevated" padding="lg" style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.summaryBlock}>
          <ThemedText variant="label" color="textMuted">
            {activePoint ? `${activePoint.shortDate.toUpperCase()} • ${activePoint.recordCount} LOGS` : 'DAILY FOOTPRINT'}
          </ThemedText>
          <ThemedText variant="h2" color="primary">
            {activePoint ? formatCarbonKg(activePoint.netKg) : '0.00 kg CO₂e'}
          </ThemedText>
          {activePoint ? (
            <ThemedText variant="caption" color="textSecondary">
              Gross {activePoint.grossKg.toFixed(2)} kg • Avoided{' '}
              {activePoint.offsetsKg.toFixed(2)} kg
            </ThemedText>
          ) : null}
        </View>
        <Badge
          label={
            activePoint && activePoint.netKg <= dailyBudgetKg
              ? 'Within Daily Target'
              : 'Above Daily Target'
          }
          tone={
            activePoint && activePoint.netKg <= dailyBudgetKg
              ? 'success'
              : 'warning'
          }
        />
      </View>

      <View style={styles.chartWrap}>
        <View style={styles.yAxisColumn}>
          <ThemedText variant="caption" color="textMuted" style={styles.axisText}>
            {maxY.toFixed(0)} kg
          </ThemedText>
          <ThemedText variant="caption" color="warning" style={styles.axisText}>
            Target {dailyBudgetKg.toFixed(0)}
          </ThemedText>
          <ThemedText variant="caption" color="textMuted" style={styles.axisText}>
            0 kg
          </ThemedText>
        </View>

        <View
          style={styles.svgHost}
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
            <Defs>
              <LinearGradient id="dailyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.28" />
                <Stop offset="100%" stopColor={colors.primary} stopOpacity="0.02" />
              </LinearGradient>
            </Defs>

            {/* Horizontal grid lines */}
            {[0, 0.5, 1].map((ratio) => {
              const gy = PAD_TOP + plotH * ratio;
              return (
                <Line
                  key={ratio}
                  x1={PAD_LEFT}
                  y1={gy}
                  x2={PAD_LEFT + plotW}
                  y2={gy}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              );
            })}

            {/* Daily target threshold line */}
            <Line
              x1={PAD_LEFT}
              y1={targetY}
              x2={PAD_LEFT + plotW}
              y2={targetY}
              stroke={colors.warning}
              strokeWidth={1.5}
              strokeDasharray="5,4"
            />

            {areaPath ? <Path d={areaPath} fill="url(#dailyAreaGrad)" /> : null}
            {linePath ? (
              <Path
                d={linePath}
                fill="none"
                stroke={colors.primary}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}

            {/* Data nodes */}
            {coords.map(({ x, y, pt }, idx) => {
              const selected = idx === selectedIndex;
              if (!pt.hasRecords && points.length > 14 && !selected) {
                return null;
              }
              return (
                <Circle
                  key={pt.dateKey}
                  cx={x}
                  cy={y}
                  r={selected ? 5.5 : pt.hasRecords ? 3.5 : 2.5}
                  fill={
                    selected
                      ? pt.netKg > dailyBudgetKg
                        ? colors.warning
                        : colors.primary
                      : pt.hasRecords
                        ? colors.surface
                        : colors.background
                  }
                  stroke={
                    pt.netKg > dailyBudgetKg && pt.hasRecords
                      ? colors.warning
                      : pt.hasRecords || selected
                        ? colors.primary
                        : colors.border
                  }
                  strokeWidth={selected ? 2.5 : 2}
                />
              );
            })}
          </Svg>
        </View>
      </View>

      <View style={styles.xAxisRow}>
        {labelIndices.map((idx) => (
          <Pressable
            key={points[idx].dateKey}
            accessibilityRole="button"
            onPress={() => setSelectedIndex(idx)}>
            <ThemedText
              variant="caption"
              color={idx === selectedIndex ? 'primary' : 'textMuted'}
              style={styles.axisText}>
              {points[idx].label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.selectorStrip}>
        {points.map((pt, idx) => {
          const active = idx === selectedIndex;
          return (
            <Pressable
              key={pt.dateKey}
              accessibilityRole="button"
              accessibilityLabel={`${pt.shortDate}: ${pt.netKg} kg`}
              onPress={() => setSelectedIndex(idx)}
              style={[
                styles.dayChip,
                {
                  backgroundColor: active
                    ? colors.primary
                    : pt.hasRecords
                      ? colors.surfaceElevated
                      : colors.background,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}>
              <ThemedText
                variant="caption"
                style={{
                  color: active ? colors.textOnPrimary : colors.textSecondary,
                  fontWeight: active ? '700' : '500',
                }}>
                {pt.shortDate}
              </ThemedText>
              <ThemedText
                variant="caption"
                style={{
                  color: active
                    ? colors.textOnPrimary
                    : pt.hasRecords
                      ? colors.primary
                      : colors.textMuted,
                }}>
                {pt.hasRecords ? `${pt.netKg.toFixed(1)}kg` : '—'}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.footerMeta, { borderTopColor: colors.border }]}>
        <ThemedText variant="caption" color="textMuted">
          Period Net: {formatCarbonKg(totalNet)} across {loggedDaysCount}/{points.length} active days
        </ThemedText>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  summaryBlock: {
    flex: 1,
    gap: 2,
  },
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.xs,
  },
  yAxisColumn: {
    justifyContent: 'space-between',
    paddingVertical: 10,
    minWidth: 46,
  },
  axisText: {
    fontSize: 11,
  },
  svgHost: {
    flex: 1,
    minHeight: CHART_HEIGHT,
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 50,
  },
  selectorStrip: {
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  dayChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  footerMeta: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
});
