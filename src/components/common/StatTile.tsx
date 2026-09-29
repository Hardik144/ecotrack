import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import type { AppIconName } from '@/constants/config';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Card } from '@/components/ui/Card';
import { ThemedText } from '@/components/ui/ThemedText';

export interface StatTileProps {
  label: string;
  value: string;
  helper?: string;
  icon: AppIconName;
  onPress?: () => void;
}

/**
 * Compact sustainability metric card used on dashboard and insights grids.
 */
export function StatTile({ label, value, helper, icon, onPress }: StatTileProps) {
  const { colors } = useTheme();

  return (
    <Card
      variant="elevated"
      padding="md"
      onPress={onPress}
      accessibilityLabel={`${label}: ${value}`}
      style={styles.card}>
      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: colors.secondary },
          ]}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <ThemedText variant="caption" color="textMuted" numberOfLines={1} style={styles.label}>
          {label}
        </ThemedText>
      </View>

      <ThemedText variant="h2" style={styles.value}>
        {value}
      </ThemedText>

      {helper ? (
        <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
          {helper}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
  value: {
    marginTop: Spacing.xxs,
  },
});
