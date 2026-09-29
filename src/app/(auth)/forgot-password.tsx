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
import { validateEmail } from '@/utils';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const { requestPasswordReset } = useEcoTrack();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const emailValidation = validateEmail(email);
  const emailError =
    submitted && !emailValidation.ok ? emailValidation.error : undefined;

  const handleReset = async () => {
    setSubmitted(true);
    setResetError(null);
    if (!emailValidation.ok) return;

    setIsLoading(true);
    const result = await requestPasswordReset(email);
    setIsLoading(false);

    if (!result.ok) {
      setResetError(
        result.message ?? 'Could not send reset email. Please try again.'
      );
      return;
    }

    setRecoveryCode(result.recoveryCode ?? null);
    setSent(true);
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
          <ThemedText variant="h1">Reset password</ThemedText>
          <ThemedText variant="body" color="textSecondary">
            Enter the email linked to your EcoTrack account and we’ll send a
            recovery link.
          </ThemedText>
        </View>

        {sent ? (
          <Card variant="mint" padding="lg" style={styles.successCard}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primary }]}>
              <Ionicons
                name="mail-open-outline"
                size={26}
                color={colors.textOnPrimary}
              />
            </View>
            <Badge
              label={recoveryCode ? 'Recovery Ready' : 'Recovery Link Sent'}
              tone="primary"
              style={styles.centerBadge}
            />
            <ThemedText variant="h2" style={styles.center}>
              {recoveryCode ? 'Local recovery code ready' : 'Check your inbox'}
            </ThemedText>
            <ThemedText
              variant="body"
              color="textSecondary"
              style={styles.center}>
              {recoveryCode
                ? `Use local Node verification code ${recoveryCode} to reset the password for `
                : 'We sent password reset instructions to '}
              <ThemedText variant="bodyMedium">{email.trim()}</ThemedText>.
            </ThemedText>
            {recoveryCode ? (
              <Button
                label="Choose New Password"
                variant="primary"
                fullWidth
                onPress={() =>
                  router.push({
                    pathname: '/reset-password',
                    params: { code: recoveryCode },
                  })
                }
              />
            ) : null}
            <Button
              label="Back to Sign In"
              variant={recoveryCode ? 'outline' : 'primary'}
              fullWidth
              onPress={() => router.replace(ROUTES.login)}
            />
            <Button
              label="Try a different email"
              variant="ghost"
              size="sm"
              onPress={() => {
                setSent(false);
                setRecoveryCode(null);
                setSubmitted(false);
                setResetError(null);
              }}
            />
          </Card>
        ) : (
          <Card variant="elevated" padding="lg" style={styles.formCard}>
            {resetError ? (
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
                  {resetError}
                </ThemedText>
              </View>
            ) : null}

            <Input
              label="Account Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={(val) => {
                setEmail(val);
                if (resetError) setResetError(null);
              }}
              leftIcon="mail-outline"
              errorText={emailError}
            />

            <Button
              label="Send Reset Link"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              rightIcon="paper-plane-outline"
              onPress={() => {
                void handleReset();
              }}
            />
          </Card>
        )}
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
  successCard: {
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
});
