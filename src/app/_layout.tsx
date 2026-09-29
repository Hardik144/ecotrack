import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  type Theme,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingState } from '@/components';
import { Colors } from '@/constants/theme';
import { EcoTrackProvider, useEcoTrack } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ROUTES } from '@/types';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors if splash screen was already hidden
});

const EcoLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.background,
    card: Colors.light.surface,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: Colors.light.success,
  },
};

const EcoDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.surface,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.success,
  },
};

function RootNavigator() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = isDark ? Colors.dark : Colors.light;
  const { isAuthInitializing, isAuthenticated, isPasswordRecovery } = useEcoTrack();

  useEffect(() => {
    if (!isAuthInitializing) {
      void SplashScreen.hideAsync();
    }
  }, [isAuthInitializing]);

  if (isAuthInitializing) {
    return (
      <View style={[styles.bootContainer, { backgroundColor: palette.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LoadingState label="Restoring your EcoTrack session..." />
      </View>
    );
  }

  return (
    <ThemeProvider value={isDark ? EcoDarkTheme : EcoLightTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.primary,
          headerTitleStyle: { color: palette.text, fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.background },
        }}>
        <Stack.Protected
          guard={isAuthenticated && !isPasswordRecovery}
          redirectTo={isPasswordRecovery ? ROUTES.resetPassword : ROUTES.login}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="challenges"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="activity/[id]"
            options={{
              title: 'Activity Details',
              headerBackTitle: 'Back',
            }}
          />
        </Stack.Protected>

        <Stack.Protected
          guard={!isAuthenticated}
          redirectTo={isPasswordRecovery ? ROUTES.resetPassword : ROUTES.home}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected
          guard={!isAuthenticated || isPasswordRecovery}
          redirectTo={ROUTES.home}>
          <Stack.Screen
            name="reset-password"
            options={{
              title: 'Set New Password',
              headerShown: false,
            }}
          />
        </Stack.Protected>

        <Stack.Screen
          name="onboarding"
          options={{
            title: 'Welcome to EcoTrack',
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const palette = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaProvider>
        <EcoTrackProvider>
          <RootNavigator />
        </EcoTrackProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
