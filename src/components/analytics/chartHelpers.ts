import { ACTIVITY_CATEGORIES, type CategoryMeta } from '@/constants/config';
import type { ThemeColors } from '@/constants/theme';
import type { ActivityCategory } from '@/types/carbon';

export function getCategoryMeta(category: ActivityCategory): CategoryMeta {
  return (
    ACTIVITY_CATEGORIES.find((item) => item.key === category) ??
    ACTIVITY_CATEGORIES[0]
  );
}

export function getCategoryColorMap(
  colors: ThemeColors
): Record<ActivityCategory, string> {
  return {
    transport: colors.primary,
    electricity: colors.warning,
    food: '#10B981',
    lifestyle: colors.info,
  };
}

export function computeNiceChartMax(
  values: number[],
  minFloor = 2
): number {
  const finiteValues = values.filter((v) => Number.isFinite(v) && v > 0);
  const rawMax = finiteValues.length > 0 ? Math.max(...finiteValues) : minFloor;
  const padded = Math.max(rawMax * 1.15, minFloor);
  if (padded <= 5) return Number(Math.ceil(padded * 2) / 2);
  if (padded <= 20) return Math.ceil(padded);
  if (padded <= 100) return Math.ceil(padded / 10) * 10;
  return Math.ceil(padded / 50) * 50;
}

export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

export function describeArcSegment(
  cx: number,
  cy: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const start = polarToCartesian(cx, cy, radius, endAngleDeg);
  const end = polarToCartesian(cx, cy, radius, startAngleDeg);
  const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? '0' : '1';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}
