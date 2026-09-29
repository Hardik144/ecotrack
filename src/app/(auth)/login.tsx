import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Badge,
  Button,
  Card,
  Input,
  ScreenContainer,
  ThemedText,
} from '@/components';
import { APP_CONFIG, Radii, Spacing } from '@/constants';
import { useEcoTrack } from '@/context';
import { useAppConfig, useTheme } from '@/hooks';
import { ROUTES } from '@/types';
import { getBackendConfigError, validateEmail, validatePassword } from '@/utils';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { backendConfigured } = useAppConfig();
  const { login } = useEcoTrack();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const configNotice = !backendConfigured ? getBackendConfigError() : null;

  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);

  const emailError =
    submitted && !emailValidation.ok ? emailValidation.error : undefined;

  const passwordError =
    submitted && !passwordValidation.ok ? passwordValidation.error : undefined;

  const handleLogin = async () => {
    setSubmitted(true);
    setAuthError(null);

    if (!emailValidation.ok || !passwordValidation.ok) {
      return;
    }

    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);

    if (!result.ok) {
      setAuthError(result.message ?? 'Unable to sign in. Please try again.');
      return;
    }

    router.replace(ROUTES.home);
  };

  return (
    <ScreenContainer keyboardAvoiding edges={['top', 'bottom']}>
      <Animated.View entering={FadeInDown.duration(260)} style={styles.container}>
        <View style={styles.brandHeader}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
            <Ionicons name="leaf" size={30} color={colors.textOnPrimary} />
          </View>
          <Badge
            label={APP_CONFIG.name}
            tone="secondary"
            style={styles.centerBadge}
          />
          <ThemedText variant="h1" style={styles.centerText}>
            Welcome back
          </ThemedText>
          <ThemedText
            variant="body"
            color="textSecondary"
            style={styles.centerText}>
            Sign in to monitor your daily carbon footprint and AI insights.
          </ThemedText>
        </View>

        {configNotice ? (
          <Card
            variant="outlined"
            padding="md"
            style={[
              styles.noticeCard,
              { borderColor: colors.warning, backgroundColor: colors.surface },
            ]}>
            <View style={styles.noticeRow}>
              <Ionicons name="construct-outline" size={18} color={colors.warning} />
              <ThemedText variant="label" color="warning">
                Backend Setup Required
              </ThemedText>
            </View>
            <ThemedText variant="caption" color="textSecondary">
              {configNotice}
            </ThemedText>
          </Card>
        ) : null}

        <Card variant="elevated" padding="lg" style={styles.formCard}>
          {authError ? (
            <View
              style={[
                styles.errorBanner,
                {
                  borderColor: colors.error,
                  backgroundColor: colors.surfaceElevated,
                },
              ]}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <ThemedText variant="caption" color="error" style={styles.errorText}>
                {authError}
              </ThemedText>
            </View>
          ) : null}

          <Input
            label="Email Address"
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={(val) => {
              setEmail(val);
              if (authError) setAuthError(null);
            }}
            leftIcon="mail-outline"
            errorText={emailError}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            value={password}
            onChangeText={(val) => {
              setPassword(val);
              if (authError) setAuthError(null);
            }}
            leftIcon="lock-closed-outline"
            errorText={passwordError}
            rightAdornment={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? 'Hide password' : 'Show password'
                }
                hitSlop={8}
                onPress={() => setShowPassword((prev) => !prev)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            }
          />

          <View style={styles.forgotRow}>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push(ROUTES.forgotPassword)}>
              <ThemedText variant="label" color="primary">
                Forgot password?
              </ThemedText>
            </Pressable>
          </View>

          <Button
            label="Sign In"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            rightIcon="arrow-forward"
            onPress={() => {
              void handleLogin();
            }}
          />
        </Card>

        <View style={styles.footerLinks}>
          <View style={styles.inlineRow}>
            <ThemedText variant="body" color="textSecondary">
              New to EcoTrack?
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push(ROUTES.register)}>
              <ThemedText variant="bodyMedium" color="primary">
                Create account
              </ThemedText>
            </Pressable>
          </View>

          <Button
            label="Preview 3-Step Onboarding"
            variant="ghost"
            size="sm"
            leftIcon="sparkles-outline"
            onPress={() => router.push(ROUTES.onboarding)}
          />
        </View>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
  brandHeader: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: Radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  centerText: {
    textAlign: 'center',
  },
  centerBadge: {
    alignSelf: 'center',
  },
  noticeCard: {
    gap: Spacing.xs,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  formCard: {
    gap: Spacing.base,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
  },
  forgotRow: {
    alignItems: 'flex-end',
  },
  footerLinks: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
});
