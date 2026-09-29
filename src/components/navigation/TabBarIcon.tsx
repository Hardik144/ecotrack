import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import type { AppIconName } from '@/constants/config';
import { Animation, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface TabBarIconProps {
  name: AppIconName;
  activeName: AppIconName;
  focused: boolean;
  color: ColorValue;
}

/**
 * Animated bottom-tab icon with a subtle Light Green pill highlight when active.
 */
export function TabBarIcon({
  name,
  activeName,
  focused,
  color,
}: TabBarIconProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(focused ? 1.06 : 1);

  useEffect(() => {
    scale.set(withSpring(focused ? 1.06 : 1, Animation.springConfig));
  }, [focused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View
        style={[
          styles.pill,
          focused && { backgroundColor: colors.secondary },
        ]}>
        <Ionicons
          name={focused ? activeName : name}
          size={21}
          color={
            typeof color === 'string'
              ? color
              : focused
                ? colors.primary
                : colors.tabIconInactive
          }
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
