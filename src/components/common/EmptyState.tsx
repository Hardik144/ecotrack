import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import type { AppIconName } from '@/constants/config';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ThemedText } from '@/components/ui/ThemedText';

export interface EmptyStateProps {
  icon?: AppIconName;
  title: string;
  description: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

/**
 * Clean, calm sustainability-themed empty state card with optional action CTA.
 */
export function EmptyState({
  icon = 'leaf-outline',
  title,
  description,
  actionLabel,
  onActionPress,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <Card variant="outlined" padding="lg" style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <ThemedText variant="h3" style={styles.center}>
          {title}
        </ThemedText>
        <ThemedText variant="caption" color="textMuted" style={styles.center}>
          {description}
        </ThemedText>
      </View>
      {actionLabel && onActionPress ? (
        <Button
          label={actionLabel}
          variant="secondary"
          size="sm"
          onPress={onActionPress}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: Spacing.xs,
    alignItems: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
