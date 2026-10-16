import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { EmptyState } from '@/components/common/EmptyState';
import { ProgressBar } from '@/components/common/PlaceholderNotice';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ThemedText } from '@/components/ui/ThemedText';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { ActivityCategory, CategoryBreakdownSlice } from '@/types/carbon';
import { formatCarbonKg } from '@/utils/formatters';
import {
  describeArcSegment,
  getCategoryColorMap,
  getCategoryMeta,
} from './chartHelpers';

export interface CategoryDonutChartProps {
  slices: CategoryBreakdownSlice[];
  totalGrossKg: number;
  totalOffsetsKg: number;
  activeCategoryFilter?: 'all' | ActivityCategory;
  onSelectCategory?: (category: ActivityCategory) => void;
}

const SIZE = 200;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = 76;
const STROKE_WIDTH = 26;

/**
 * Chart 4: Interactive Category-Wise Donut Chart showing gross emission mix and category offsets.
 */
export const CategoryDonutChart = memo(function CategoryDonutChart({
  slices,
  totalGrossKg,
  totalOffsetsKg,
  activeCategoryFilter = 'all',
  onSelectCategory,
}: CategoryDonutChartProps) {
  const { colors } = useTheme();
  const categoryColors = getCategoryColorMap(colors);
  const [focusedCategory, setFocusedCategory] = useState<ActivityCategory | null>(
    null
  );

  const segments = useMemo(() => {
    const nonZeroGrossSlices = slices.filter((s) => s.grossKg > 0);
    const gapDeg = nonZeroGrossSlices.length > 1 ? 2.5 : 0;
    const result: {
      slice: CategoryBreakdownSlice;
      startAngle: number;
      endAngle: number;
      isFullCircle: boolean;
    }[] = [];

    let angle = 0;
    for (const slice of nonZeroGrossSlices) {
      const rawSweep = totalGrossKg > 0 ? (slice.grossKg / totalGrossKg) * 360 : 0;
      const sweep = Math.max(rawSweep - gapDeg, 2);
      result.push({
        slice,
        startAngle: angle,
        endAngle: angle + sweep,
        isFullCircle: nonZeroGrossSlices.length === 1,
      });
      angle += rawSweep;
    }
    return result;
  }, [slices, totalGrossKg]);

  const hasAnyData = totalGrossKg > 0 || totalOffsetsKg > 0;
  if (!hasAnyData) {
    return (
      <EmptyState
        icon="pie-chart-outline"
        title="No category distribution yet"
        description="Log activities in Transportation, Electricity, Food, or Lifestyle to populate the category donut."
      />
    );
  }

  const selectedKey =
    activeCategoryFilter !== 'all' ? activeCategoryFilter : focusedCategory;
  const focusedSlice = selectedKey
    ? slices.find((s) => s.category === selectedKey) ?? null
    : null;

  const handleToggleSlice = (category: ActivityCategory) => {
    setFocusedCategory((prev) => (prev === category ? null : category));
    onSelectCategory?.(category);
  };

  return (
    <Card variant="elevated" padding="lg" style={styles.card}>
      <View style={styles.donutSection}>
        <View style={styles.svgBox}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <Circle
              cx={CX}
              cy={CY}
              r={RADIUS}
              fill="none"
              stroke={colors.surfaceElevated}
              strokeWidth={STROKE_WIDTH}
            />
            {segments.map(({ slice, startAngle, endAngle, isFullCircle }) => {
              const color = categoryColors[slice.category];
              const dimmed =
                selectedKey !== null && selectedKey !== slice.category;

              if (isFullCircle) {
                return (
                  <Circle
                    key={slice.category}
                    cx={CX}
                    cy={CY}
                    r={RADIUS}
                    fill="none"
                    stroke={color}
                    strokeWidth={STROKE_WIDTH}
                    opacity={dimmed ? 0.32 : 1}
                    onPress={() => handleToggleSlice(slice.category)}
                  />
                );
              }

              const pathD = describeArcSegment(
                CX,
                CY,
                RADIUS,
                startAngle,
                endAngle
              );
              return (
                <Path
                  key={slice.category}
                  d={pathD}
                  fill="none"
                  stroke={color}
                  strokeWidth={
                    selectedKey === slice.category
                      ? STROKE_WIDTH + 3
                      : STROKE_WIDTH
                  }
                  strokeLinecap="butt"
                  opacity={dimmed ? 0.32 : 1}
                  onPress={() => handleToggleSlice(slice.category)}
                />
              );
            })}
          </Svg>

          <View style={styles.centerOverlay} pointerEvents="none">
            <ThemedText variant="caption" color="textMuted" style={styles.centerLabel}>
              {focusedSlice
                ? getCategoryMeta(focusedSlice.category).shortLabel.toUpperCase()
                : 'GROSS CO₂E'}
            </ThemedText>
            <ThemedText variant="h2" color="primary" style={styles.centerValue}>
              {focusedSlice
                ? `${focusedSlice.grossKg.toFixed(1)} kg`
                : `${totalGrossKg.toFixed(1)} kg`}
            </ThemedText>
            <ThemedText variant="caption" color="textSecondary">
              {focusedSlice
                ? `${focusedSlice.sharePct.toFixed(1)}% • ${focusedSlice.recordCount} logs`
                : totalOffsetsKg > 0
                  ? `-${totalOffsetsKg.toFixed(1)} kg avoided`
                  : '100% of gross'}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.legendStack}>
        {slices.map((slice) => {
          const meta = getCategoryMeta(slice.category);
          const color = categoryColors[slice.category];
          const isFocused = selectedKey === slice.category;

          return (
            <Pressable
              key={slice.category}
              accessibilityRole="button"
              accessibilityLabel={`${meta.label}: ${slice.grossKg} kg (${slice.sharePct}%)`}
              onPress={() => handleToggleSlice(slice.category)}
              style={[
                styles.legendRow,
                isFocused && {
                  backgroundColor: colors.surfaceElevated,
                  borderRadius: Radii.md,
                  paddingHorizontal: Spacing.sm,
                  paddingVertical: Spacing.xs,
                },
              ]}>
              <View style={styles.legendTop}>
                <View style={styles.legendTitleWrap}>
                  <View style={[styles.swatch, { backgroundColor: color }]} />
                  <Ionicons name={meta.icon} size={15} color={color} />
                  <ThemedText variant="bodyMedium">{meta.label}</ThemedText>
                </View>

                <View style={styles.legendRight}>
                  {slice.offsetsKg > 0 ? (
                    <Badge
                      label={`-${slice.offsetsKg.toFixed(1)} kg`}
                      tone="success"
                    />
                  ) : null}
                  <ThemedText variant="label" color="text">
                    {formatCarbonKg(slice.grossKg)}
                  </ThemedText>
                  <Badge
                    label={`${Math.round(slice.sharePct)}%`}
                    tone={isFocused ? 'primary' : 'secondary'}
                  />
                </View>
              </View>
              <ProgressBar
                progress={slice.sharePct / 100}
                fillColor={color}
                height={6}
              />
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: Spacing.lg,
  },
  donutSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgBox: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    width: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  centerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  centerValue: {
    textAlign: 'center',
  },
  legendStack: {
    gap: Spacing.sm + 2,
  },
  legendRow: {
    gap: Spacing.xs + 2,
    paddingVertical: 2,
  },
  legendTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    flexShrink: 1,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: Radii.pill,
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
});
