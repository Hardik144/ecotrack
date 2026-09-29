import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const emptySubscribe = () => () => {};

/**
 * Hydration-safe color scheme hook for Expo Router web rendering.
 */
export function useColorScheme() {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const colorScheme = useRNColorScheme();

  return isClient ? (colorScheme ?? 'light') : 'light';
}
