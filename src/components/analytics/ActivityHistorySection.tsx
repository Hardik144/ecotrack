import { router } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { ListRowItem } from '@/components/common/PlaceholderNotice';
import { Input } from '@/components/ui/Input';
import { ThemedText } from '@/components/ui/ThemedText';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { CarbonActivity } from '@/types/carbon';
import { ROUTES } from '@/types/navigation';
import { formatCarbonKg, formatShortDate } from '@/utils/formatters';
import { getCategoryMeta } from './chartHelpers';

export interface ActivityHistorySectionProps {
  activities: CarbonActivity[];
  searchQuery: string;
  onChangeSearchQuery: (value: string) => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

/**
 * Filterable, searchable EcoTrack carbon activity history with edit/inspect navigation.
 */
export const ActivityHistorySection = memo(function ActivityHistorySection({
  activities,
  searchQuery,
  onChangeSearchQuery,
  hasActiveFilters,
  onResetFilters,
}: ActivityHistorySectionProps) {
  const { colors } = useTheme();
  const [sortBy, setSortBy] = useState<'newest' | 'highest'>('newest');
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...activities];
    if (sortBy === 'highest') {
      copy.sort((a, b) => b.emissionsKg - a.emissionsKg);
    } else {
      copy.sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );
    }
    return copy;
  }, [activities, sortBy]);

  const visibleItems = showAll ? sorted : sorted.slice(0, 8);

  return (
    <View style={styles.container}>
      <View style={styles.controlsRow}>
        <View style={styles.searchWrap}>
          <Input
            value={searchQuery}
            onChangeText={onChangeSearchQuery}
            placeholder="Search title, source, grid, or notes..."
            leftIcon="search-outline"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.sortRow}>
        <ThemedText variant="caption" color="textMuted">
          Showing {visibleItems.length} of {sorted.length} matching records
        </ThemedText>
        <View style={styles.sortPills}>
          {(['newest', 'highest'] as const).map((mode) => {
            const active = sortBy === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                onPress={() => setSortBy(mode)}
                style={[
                  styles.sortPill,
                  {
                    backgroundColor: active
                      ? colors.primary
                      : colors.surfaceElevated,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}>
                <ThemedText
                  variant="caption"
                  style={{
                    color: active ? colors.textOnPrimary : colors.textSecondary,
                    fontWeight: '600',
                  }}>
                  {mode === 'newest' ? 'Newest' : 'Highest CO₂e'}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {sorted.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title={
            hasActiveFilters || searchQuery.trim()
              ? 'No matching activity records'
              : 'No activities recorded yet'
          }
          description={
            hasActiveFilters || searchQuery.trim()
              ? 'No activity records match your current date, category, or search filters.'
              : 'Log your first transport, electricity, food, or lifestyle activity in the Calculator.'
          }
          actionLabel={
            hasActiveFilters || searchQuery.trim()
              ? 'Reset Filters'
              : 'Open Calculator'
          }
          onActionPress={
            hasActiveFilters || searchQuery.trim()
              ? onResetFilters
              : () => router.push(ROUTES.calculate)
          }
        />
      ) : (
        <View style={styles.list}>
          {visibleItems.map((item) => {
            const meta = getCategoryMeta(item.category);
            const qtyLabel =
              item.quantity !== undefined && item.unitLabel
                ? `${item.quantity} ${item.unitLabel} • `
                : '';
            const trailing =
              item.direction === 'offset'
                ? `-${formatCarbonKg(item.emissionsKg, { includeUnit: true })}`
                : `+${formatCarbonKg(item.emissionsKg, { includeUnit: true })}`;

            return (
              <ListRowItem
                key={item.id}
                icon={meta.icon}
                title={item.title}
                subtitle={`${meta.shortLabel} • ${qtyLabel}${formatShortDate(item.occurredAt)}`}
                trailing={trailing}
                onPress={() => router.push(ROUTES.activityDetail(item.id))}
              />
            );
          })}

          {sorted.length > 8 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAll((prev) => !prev)}
              style={[
                styles.expandBtn,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}>
              <ThemedText variant="label" color="primary">
                {showAll
                  ? 'Show Fewer Activities'
                  : `Show All ${sorted.length} Activities`}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm + 2,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  searchWrap: {
    flex: 1,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  sortPills: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  sortPill: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  list: {
    gap: Spacing.sm,
  },
  expandBtn: {
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
  },
});
