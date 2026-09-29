import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from './ThemedText';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.textGroup}>
        <ThemedText variant="h3">{title}</ThemedText>
        {subtitle ? (
          <ThemedText variant="caption" color="textMuted">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onActionPress}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText variant="label" color="primary">
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  textGroup: {
    flex: 1,
    gap: Spacing.xxs,
  },
  pressed: {
    opacity: 0.65,
  },
});
