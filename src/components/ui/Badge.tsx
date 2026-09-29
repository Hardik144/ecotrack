import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { AppIconName } from '@/constants/config';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from './ThemedText';

export type BadgeTone =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'neutral';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: AppIconName;
  style?: StyleProp<ViewStyle>;
}

/**
 * Compact pill badge for sustainability status tags, units, and categories.
 */
export function Badge({
  label,
  tone = 'secondary',
  icon,
  style,
}: BadgeProps) {
  const { colors } = useTheme();

  const toneMap = {
    primary: { background: colors.primary, text: colors.textOnPrimary },
    secondary: { background: colors.secondary, text: colors.textOnSecondary },
    success: { background: colors.successSoft, text: colors.success },
    warning: { background: colors.warningSoft, text: colors.warning },
    error: { background: colors.errorSoft, text: colors.error },
    neutral: { background: colors.surfaceElevated, text: colors.textSecondary },
  }[tone];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: toneMap.background },
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={13} color={toneMap.text} /> : null}
      <ThemedText variant="label" style={{ color: toneMap.text }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 1,
    borderRadius: Radii.pill,
  },
});
