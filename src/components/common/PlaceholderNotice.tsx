import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import type { AppIconName } from '@/constants/config';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ThemedText } from '@/components/ui/ThemedText';

export interface PlaceholderNoticeProps {
  phaseLabel?: string;
  title: string;
  description: string;
  icon?: AppIconName;
}

/**
 * Clean foundation placeholder banner outlining upcoming feature integrations.
 */
export function PlaceholderNotice({
  phaseLabel = 'Foundation Scaffold',
  title,
  description,
  icon = 'layers-outline',
}: PlaceholderNoticeProps) {
  const { colors } = useTheme();

  return (
    <Card variant="mint" padding="md" style={styles.card}>
      <View style={styles.topRow}>
        <Badge label={phaseLabel} tone="primary" icon={icon} />
      </View>
      <View style={styles.body}>
        <ThemedText variant="h3" style={{ color: colors.textOnSecondary }}>
          {title}
        </ThemedText>
        <ThemedText variant="caption" style={{ color: colors.textOnSecondary, opacity: 0.9 }}>
          {description}
        </ThemedText>
      </View>
    </Card>
  );
}

export interface ProgressBarProps {
  progress: number;
  trackColor?: string;
  fillColor?: string;
  height?: number;
}

export function ProgressBar({
  progress,
  trackColor,
  fillColor,
  height = 8,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const safeProgress = Math.min(Math.max(progress, 0), 1);

  return (
    <View
      style={[
        styles.track,
        {
          height,
          backgroundColor: trackColor ?? colors.surfaceElevated,
        },
      ]}>
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round(safeProgress * 100)}%`,
            backgroundColor: fillColor ?? colors.primary,
          },
        ]}
      />
    </View>
  );
}

export interface ListRowItemProps {
  icon: AppIconName;
  title: string;
  subtitle?: string;
  trailing?: string;
  onPress?: () => void;
}

export function ListRowItem({
  icon,
  title,
  subtitle,
  trailing,
  onPress,
}: ListRowItemProps) {
  const { colors } = useTheme();

  return (
    <Card
      variant="outlined"
      padding="md"
      onPress={onPress}
      accessibilityLabel={title}
      style={styles.listCard}>
      <View style={styles.listRow}>
        <View style={[styles.listIconWrap, { backgroundColor: colors.secondary }]}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={styles.listTextWrap}>
          <ThemedText variant="bodyMedium">{title}</ThemedText>
          {subtitle ? (
            <ThemedText variant="caption" color="textMuted">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {trailing ? (
          <ThemedText variant="label" color="primary">
            {trailing}
          </ThemedText>
        ) : null}
        {onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    gap: Spacing.xs,
  },
  track: {
    height: 8,
    width: '100%',
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radii.pill,
  },
  listCard: {
    width: '100%',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  listIconWrap: {
    width: 38,
    height: 38,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTextWrap: {
    flex: 1,
    gap: Spacing.xxs,
  },
});
