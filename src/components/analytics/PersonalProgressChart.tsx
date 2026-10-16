import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ThemedText } from '@/components/ui/ThemedText';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { ProgressPoint } from '@/types/carbon';
import { computeNiceChartMax } from './chartHelpers';

export interface PersonalProgressChartProps {
  points: ProgressPoint[];
  dailyBudgetKg: number;
}

const CHART_HEIGHT = 166;
const PAD_LEFT = 10;
const PAD_RIGHT = 10;
const PAD_TOP = 16;
const PAD_BOTTOM = 16;

/**
 * Chart 6: Personal Sustainability Progress Over Time (Weekly Score & Avg Daily Net Trajectory).
 */
export const PersonalProgressChart = memo(function PersonalProgressChart({
  points,
  dailyBudgetKg,
}: PersonalProgressChartProps) {
  const { colors } = useTheme();
  const [metricMode, setMetricMode] = useState<'score' | 'dailyAvg'>('score');
  const [chartWidth, setChartWidth] = useState(300);

  const activePoints = points.filter((p) => p.loggedDays > 0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (activePoints.length === 0) {
    return (
      <EmptyState
        icon="trending-up-outline"
        title="No personal progress trajectory yet"
        description="Log activities over time to track your Sustainability Score and daily average footprint trajectory."
      />
    );
  }

  const resolvedSelected =
    points.find((p) => p.key === selectedKey) ??
    activePoints[activePoints.length - 1];

  const firstActive = activePoints[0];
  const latestActive = activePoints[activePoints.length - 1];

  const scoreDelta =
    firstActive.score !== null && latestActive.score !== null
      ? latestActive.score - firstActive.score
      : 0;
  const avgDelta =
    firstActive.avgDailyNetKg !== null && latestActive.avgDailyNetKg !== null
      ? Number((latestActive.avgDailyNetKg - firstActive.avgDailyNetKg).toFixed(2))
      : 0;

  const maxY =
    metricMode === 'score'
      ? 100
      : computeNiceChartMax(
          [
            dailyBudgetKg,
            ...points.map((p) => Math.max(0, p.avgDailyNetKg ?? 0)),
          ],
          Math.max(dailyBudgetKg, 2)
        );
  const plotW = Math.max(chartWidth - PAD_LEFT - PAD_RIGHT, 120);
  const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  const coords = points.map((pt, idx) => {
    const x =
      points.length === 1
        ? PAD_LEFT + plotW / 2
        : PAD_LEFT + (idx / (points.length - 1)) * plotW;
    const rawVal = metricMode === 'score' ? pt.score : pt.avgDailyNetKg;
    const y =
      rawVal !== null
        ? PAD_TOP + plotH - (Math.max(0, Math.min(rawVal, maxY)) / maxY) * plotH
        : null;
    return { x, y, pt };
  });

  // Connect contiguous active weeks cleanly; start fresh M path after unlogged weeks
  const pathCommands: string[] = [];
  let inSegment = false;
  for (const node of coords) {
    if (node.y === null) {
      inSegment = false;
      continue;
    }
    pathCommands.push(
      `${inSegment ? 'L' : 'M'} ${node.x.toFixed(1)} ${node.y.toFixed(1)}`
    );
    inSegment = true;
  }
  const linePath = pathCommands.join(' ');

  const budgetY =
    PAD_TOP + plotH - (Math.min(dailyBudgetKg, maxY) / maxY) * plotH;

  const progressBadgeLabel =
    activePoints.length < 2
      ? 'Baseline Week'
      : metricMode === 'score'
        ? `${scoreDelta >= 0 ? '+' : ''}${scoreDelta} pts trend`
        : `${avgDelta > 0 ? '+' : ''}${avgDelta.toFixed(1)} kg/d trend`;

  const progressBadgeTone =
    activePoints.length < 2
      ? 'secondary'
      : metricMode === 'score'
        ? scoreDelta >= 0
          ? 'success'
          : 'warning'
        : avgDelta <= 0
          ? 'success'
          : 'warning';

  return (
    <Card variant="elevated" padding="lg" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <ThemedText variant="label" color="textMuted">
            {metricMode === 'score'
              ? 'ECO SCORE TRAJECTORY (0–100)'
              : 'DAILY AVERAGE NET FOOTPRINT'}
          </ThemedText>
          <ThemedText variant="h2" color="primary">
            {metricMode === 'score'
              ? `${resolvedSelected.score ?? '--'} / 100`
              : resolvedSelected.avgDailyNetKg !== null
                ? `${resolvedSelected.avgDailyNetKg.toFixed(2)} kg/day`
                : 'No logs'}
          </ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            {resolvedSelected.rangeLabel} • {resolvedSelected.loggedDays} active days
          </ThemedText>
        </View>
        <Badge label={progressBadgeLabel} tone={progressBadgeTone} />
      </View>

      <View style={styles.modeToggleRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setMetricMode('score')}
          style={[
            styles.modeBtn,
            {
              backgroundColor:
                metricMode === 'score' ? colors.primary : colors.surfaceElevated,
              borderColor:
                metricMode === 'score' ? colors.primary : colors.border,
            },
          ]}>
          <ThemedText
            variant="label"
            style={{
              color:
                metricMode === 'score'
                  ? colors.textOnPrimary
                  : colors.textSecondary,
            }}>
            Sustainability Score
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setMetricMode('dailyAvg')}
          style={[
            styles.modeBtn,
            {
              backgroundColor:
                metricMode === 'dailyAvg'
                  ? colors.primary
                  : colors.surfaceElevated,
              borderColor:
                metricMode === 'dailyAvg' ? colors.primary : colors.border,
            },
          ]}>
          <ThemedText
            variant="label"
            style={{
              color:
                metricMode === 'dailyAvg'
                  ? colors.textOnPrimary
                  : colors.textSecondary,
            }}>
            Avg Daily CO₂e vs Budget
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.chartWrap}>
        <View style={styles.yAxisCol}>
          <ThemedText variant="caption" color="textMuted" style={styles.axisText}>
            {metricMode === 'score' ? '100' : `${maxY.toFixed(0)} kg`}
          </ThemedText>
          <ThemedText variant="caption" color="textMuted" style={styles.axisText}>
            {metricMode === 'score' ? '50' : `${(maxY / 2).toFixed(0)} kg`}
          </ThemedText>
          <ThemedText variant="caption" color="textMuted" style={styles.axisText}>
            0
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

            {metricMode === 'dailyAvg' ? (
              <Line
                x1={PAD_LEFT}
                y1={budgetY}
                x2={PAD_LEFT + plotW}
                y2={budgetY}
                stroke={colors.warning}
                strokeWidth={1.5}
                strokeDasharray="5,4"
              />
            ) : null}

            {linePath ? (
              <Path
                d={linePath}
                fill="none"
                stroke={colors.primary}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {coords.map(({ x, y, pt }) => {
              const isSelected = pt.key === resolvedSelected.key;
              if (y === null) {
                return (
                  <Circle
                    key={pt.key}
                    cx={x}
                    cy={PAD_TOP + plotH}
                    r={3}
                    fill={colors.background}
                    stroke={colors.border}
                    strokeWidth={1.5}
                  />
                );
              }
              return (
                <Circle
                  key={pt.key}
                  cx={x}
                  cy={y}
                  r={isSelected ? 5.5 : 4}
                  fill={isSelected ? colors.primary : colors.surface}
                  stroke={colors.primary}
                  strokeWidth={2.5}
                  onPress={() => setSelectedKey(pt.key)}
                />
              );
            })}
          </Svg>
        </View>
      </View>

      <View style={styles.weekButtonsRow}>
        {points.map((pt) => {
          const isSelected = pt.key === resolvedSelected.key;
          const hasData = pt.loggedDays > 0;
          return (
            <Pressable
              key={pt.key}
              accessibilityRole="button"
              onPress={() => setSelectedKey(pt.key)}
              style={[
                styles.weekPill,
                isSelected && { backgroundColor: colors.surfaceElevated },
              ]}>
              <ThemedText
                variant="caption"
                color={
                  isSelected ? 'primary' : hasData ? 'textSecondary' : 'textMuted'
                }
                style={styles.axisText}>
                {pt.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText variant="caption" color="textMuted">
        Unlogged weeks stay unmarked rather than estimated. Score reflects budget adherence (55%), offset ratio (25%), and consistency/challenges (20%).
      </ThemedText>
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
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: Spacing.xs + 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
  },
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.xs,
  },
  yAxisCol: {
    justifyContent: 'space-between',
    paddingVertical: 10,
    minWidth: 38,
  },
  axisText: {
    fontSize: 11,
  },
  svgHost: {
    flex: 1,
    minHeight: CHART_HEIGHT,
  },
  weekButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 42,
  },
  weekPill: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
});
