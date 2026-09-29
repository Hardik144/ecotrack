import { useCallback } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Animation } from '@/constants/theme';

interface UsePressAnimationOptions {
  targetScale?: number;
  disabled?: boolean;
}

/**
 * Smooth spring press scale animation hook powered by react-native-reanimated.
 */
export function usePressAnimation(options?: UsePressAnimationOptions) {
  const scale = useSharedValue(1);
  const targetScale = options?.targetScale ?? Animation.pressScale;
  const disabled = options?.disabled ?? false;

  const onPressIn = useCallback(() => {
    if (disabled) return;
    scale.set(withSpring(targetScale, Animation.springConfig));
  }, [disabled, scale, targetScale]);

  const onPressOut = useCallback(() => {
    scale.set(withSpring(1, Animation.springConfig));
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return {
    animatedStyle,
    onPressIn,
    onPressOut,
  };
}
