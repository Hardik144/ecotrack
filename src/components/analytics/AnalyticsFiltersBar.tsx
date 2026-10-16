import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ThemedText } from '@/components/ui/ThemedText';
import { ACTIVITY_CATEGORIES } from '@/constants/config';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type {
  AnalyticsCategoryFilter,
  AnalyticsDateRange,
  AnalyticsDateRangePreset,
} from '@/types/carbon';

const DATE_PRESETS: { key: AnalyticsDateRangePreset; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: 'month', label: 'This Month' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
];

export interface AnalyticsFiltersBarProps {
  datePreset: AnalyticsDateRangePreset;
  onSelectDatePreset: (preset: AnalyticsDateRangePreset) => void;
  activeRange: AnalyticsDateRange;
  customStartDraft: string;
  customEndDraft: string;
  onChangeCustomStart: (value: string) => void;
  onChangeCustomEnd: (value: string) => void;
  onApplyCustomRange: () => void;
  customRangeError: string | null;
  categoryFilter: AnalyticsCategoryFilter;
  onSelectCategoryFilter: (category: AnalyticsCategoryFilter) => void;
  matchingCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

/**
 * Unified Date Range + Category Filter control bar for Analytics Dashboard.
 */
export function AnalyticsFiltersBar({
  datePreset,
  onSelectDatePreset,
  activeRange,
  customStartDraft,
  customEndDraft,
  onChangeCustomStart,
  onChangeCustomEnd,
  onApplyCustomRange,
  customRangeError,
  categoryFilter,
  onSelectCategoryFilter,
  matchingCount,
  totalCount,
  hasActiveFilters,
  onResetFilters,
}: AnalyticsFiltersBarProps) {
  const { colors } = useTheme();

  return (
    <Card variant="outlined" padding="md" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="options-outline" size={16} color={colors.primary} />
          <ThemedText variant="label" color="primary">
            Filters & Window
          </ThemedText>
        </View>
        <View style={styles.headerRight}>
          <Badge
            label={`${matchingCount} of ${totalCount} logs`}
            tone="secondary"
          />
          {hasActiveFilters ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset filters"
              hitSlop={8}
              onPress={onResetFilters}>
              <ThemedText variant="label" color="primary">
                Reset
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.groupBlock}>
        <ThemedText variant="caption" color="textMuted">
          Date Range • {activeRange.label} ({activeRange.startKey} to {activeRange.endKey})
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillScroll}>
          {DATE_PRESETS.map((item) => {
            const active = datePreset === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onSelectDatePreset(item.key)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: active
                      ? colors.primary
                      : colors.surfaceElevated,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}>
                <ThemedText
                  variant="label"
                  style={{
                    color: active ? colors.textOnPrimary : colors.textSecondary,
                  }}>
                  {item.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {datePreset === 'custom' ? (
        <View style={styles.customBox}>
          <View style={styles.customInputsRow}>
            <View style={styles.customInputHalf}>
              <Input
                label="Start (YYYY-MM-DD)"
                value={customStartDraft}
                onChangeText={onChangeCustomStart}
                placeholder="2026-10-15"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.customInputHalf}>
              <Input
                label="End (YYYY-MM-DD)"
                value={customEndDraft}
                onChangeText={onChangeCustomEnd}
                placeholder="2026-11-15"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
          {customRangeError ? (
            <ThemedText variant="caption" color="error">
              {customRangeError}
            </ThemedText>
          ) : null}
          <Button
            label="Apply Custom Dates"
            size="sm"
            variant="secondary"
            leftIcon="calendar-outline"
            onPress={onApplyCustomRange}
          />
        </View>
      ) : null}

      <View style={styles.groupBlock}>
        <ThemedText variant="caption" color="textMuted">
          Category Filter
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillScroll}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: categoryFilter === 'all' }}
            onPress={() => onSelectCategoryFilter('all')}
            style={[
              styles.pill,
              {
                backgroundColor:
                  categoryFilter === 'all'
                    ? colors.primary
                    : colors.surfaceElevated,
                borderColor:
                  categoryFilter === 'all' ? colors.primary : colors.border,
              },
            ]}>
            <ThemedText
              variant="label"
              style={{
                color:
                  categoryFilter === 'all'
                    ? colors.textOnPrimary
                    : colors.textSecondary,
              }}>
              All Categories
            </ThemedText>
          </Pressable>

          {ACTIVITY_CATEGORIES.map((cat) => {
            const active = categoryFilter === cat.key;
            return (
              <Pressable
                key={cat.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onSelectCategoryFilter(cat.key)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: active
                      ? colors.primary
                      : colors.surfaceElevated,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}>
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={active ? colors.textOnPrimary : colors.primary}
                />
                <ThemedText
                  variant="label"
                  style={{
                    color: active ? colors.textOnPrimary : colors.textSecondary,
                  }}>
                  {cat.shortLabel}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  groupBlock: {
    gap: Spacing.xs + 2,
  },
  pillScroll: {
    gap: Spacing.xs + 2,
    paddingVertical: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 3,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  customBox: {
    gap: Spacing.sm,
  },
  customInputsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  customInputHalf: {
    flex: 1,
  },
});
