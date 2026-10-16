import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/ThemedText';
import type { AppIconName } from '@/constants/config';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export interface OptionPillItem<T extends string> {
  key: T;
  label: string;
  subLabel?: string;
  icon?: AppIconName;
}

export interface OptionPillGroupProps<T extends string> {
  label?: string;
  items: readonly OptionPillItem<T>[];
  selectedKey: T;
  onSelect: (key: T) => void;
  layout?: 'wrap' | 'scroll';
}

export function OptionPillGroup<T extends string>({
  label,
  items,
  selectedKey,
  onSelect,
  layout = 'wrap',
}: OptionPillGroupProps<T>) {
  const { colors } = useTheme();

  const pills = items.map((item) => {
    const selected = item.key === selectedKey;
    return (
      <Pressable
        key={item.key}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={item.label}
        onPress={() => onSelect(item.key)}
        style={[
          styles.pill,
          {
            backgroundColor: selected ? colors.primary : colors.surface,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}>
        {item.icon ? (
          <Ionicons
            name={item.icon}
            size={15}
            color={selected ? colors.textOnPrimary : colors.primary}
          />
        ) : null}
        <View style={styles.pillTextWrap}>
          <ThemedText
            variant="label"
            style={{
              color: selected ? colors.textOnPrimary : colors.text,
            }}>
            {item.label}
          </ThemedText>
          {item.subLabel ? (
            <ThemedText
              variant="caption"
              style={{
                color: selected ? colors.secondary : colors.textMuted,
              }}>
              {item.subLabel}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
    );
  });

  return (
    <View style={styles.wrapper}>
      {label ? (
        <ThemedText variant="label" color="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      {layout === 'scroll' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollRow}>
          {pills}
        </ScrollView>
      ) : (
        <View style={styles.wrapRow}>{pills}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.xs,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  scrollRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: Spacing.xxs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pillTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
});
