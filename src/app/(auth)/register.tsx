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
import { Radii, Spacing } from '@/constants';
import { useEcoTrack } from '@/context';
import { useTheme } from '@/hooks';
import { ROUTES } from '@/types';
import { validateEmail, validateFullName, validatePassword } from '@/utils';

export default function RegisterScreen() {
  const { colors } = useTheme();
  const { register } = useEcoTrack();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const nameValidation = validateFullName(fullName);
  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);

  const nameError =
    submitted && !nameValidation.ok ? nameValidation.error : undefined;

  const emailError =
    submitted && !emailValidation.ok ? emailValidation.error : undefined;

  const passwordError =
    submitted && !passwordValidation.ok ? passwordValidation.error : undefined;

  const confirmError =
    submitted && confirmPassword !== password
      ? 'Passwords do not match.'
      : undefined;

  const handleRegister = async () => {
    setSubmitted(true);
    setAuthError(null);

    const valid =
      nameValidation.ok &&
      emailValidation.ok &&
      passwordValidation.ok &&
      confirmPassword === password;

    if (!valid) return;

    setIsLoading(true);
    const result = await register(fullName, email, password);
    setIsLoading(false);

    if (!result.ok) {
      setAuthError(result.message ?? 'Registration failed. Please try again.');
      return;
    }

    if (result.requiresEmailConfirmation) {
      setConfirmationEmail(email.trim().toLowerCase());
      return;
    }

    router.replace(ROUTES.home);
  };

  return (
    <ScreenContainer keyboardAvoiding edges={['top', 'bottom']}>
      <Animated.View entering={FadeInDown.duration(260)} style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>

        <View style={styles.header}>
          <ThemedText variant="h1">Create your account</ThemedText>
          <ThemedText variant="body" color="textSecondary">
            Start tracking your personal carbon footprint in under a minute.
          </ThemedText>
        </View>

        {confirmationEmail ? (
          <Card variant="mint" padding="lg" style={styles.confirmationCard}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primary }]}>
              <Ionicons
                name="mail-unread-outline"
                size={26}
                color={colors.textOnPrimary}
              />
            </View>
            <Badge
              label="Confirm Your Email"
              tone="primary"
              style={styles.centerBadge}
            />
            <ThemedText variant="h2" style={styles.center}>
              Verify your account
            </ThemedText>
            <ThemedText variant="body" color="textSecondary" style={styles.center}>
              We sent a verification link to{' '}
              <ThemedText variant="bodyMedium">{confirmationEmail}</ThemedText>.
              Open the link to activate your account, then sign in.
            </ThemedText>
            <Button
              label="Go to Sign In"
              variant="primary"
              fullWidth
              onPress={() => router.replace(ROUTES.login)}
            />
          </Card>
        ) : (
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
              label="Full Name"
              placeholder="Alex Rivera"
              autoCapitalize="words"
              value={fullName}
              onChangeText={(val) => {
                setFullName(val);
                if (authError) setAuthError(null);
              }}
              leftIcon="person-outline"
              errorText={nameError}
            />

            <Input
              label="Email Address"
              placeholder="you@example.com"
              autoCapitalize="none"
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
              placeholder="Minimum 6 characters"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={(val) => {
                setPassword(val);
                if (authError) setAuthError(null);
              }}
              leftIcon="lock-closed-outline"
              errorText={passwordError}
              helperText="Mix letters and numbers for stronger security."
              rightAdornment={
                <Pressable
                  accessibilityRole="button"
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

            <Input
              label="Confirm Password"
              placeholder="Re-enter password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={(val) => {
                setConfirmPassword(val);
                if (authError) setAuthError(null);
              }}
              leftIcon="shield-checkmark-outline"
              errorText={confirmError}
            />

            <Button
              label="Create Account"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              rightIcon="checkmark-circle-outline"
              onPress={() => {
                void handleRegister();
              }}
            />
          </Card>
        )}

        <View style={styles.footerRow}>
          <ThemedText variant="body" color="textSecondary">
            Already have an account?
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.replace(ROUTES.login)}>
            <ThemedText variant="bodyMedium" color="primary">
              Sign in
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.lg,
    paddingVertical: Spacing.base,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: Spacing.xs,
  },
  formCard: {
    gap: Spacing.base,
  },
  confirmationCard: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  centerBadge: {
    alignSelf: 'center',
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
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
  },
});
