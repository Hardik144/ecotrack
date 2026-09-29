import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { CategoryMeta } from '@/constants/config';
import { Radii, Spacing } from '@/constants/theme';
import { usePressAnimation } from '@/hooks/usePressAnimation';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from '@/components/ui/ThemedText';

export interface CategoryChipProps {
  category: CategoryMeta;
  selected?: boolean;
  onPress: () => void;
}

/**
 * Interactive category selection pill for transport, food, energy, shopping, and waste.
 */
export function CategoryChip({
  category,
  selected = false,
  onPress,
}: CategoryChipProps) {
  const { colors } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({
    targetScale: 0.96,
  });

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${category.label} category`}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.chip,
          {
            backgroundColor: selected ? colors.primary : colors.surface,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}>
        <Ionicons
          name={selected ? category.activeIcon : category.icon}
          size={16}
          color={selected ? colors.textOnPrimary : colors.primary}
        />
        <ThemedText
          variant="label"
          style={{
            color: selected ? colors.textOnPrimary : colors.text,
          }}>
          {category.label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
});
