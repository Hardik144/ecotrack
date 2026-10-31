import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { exchangeRecoveryCode } from '@/services';
import { ROUTES } from '@/types';
import { validatePassword } from '@/utils';

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const { isAuthenticated, completePasswordReset, clearPasswordRecovery } =
    useEcoTrack();
  const params = useLocalSearchParams<{ code?: string }>();
  const incomingUrl = Linking.useURL();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let code = typeof params.code === 'string' ? params.code : undefined;

    if (!code && incomingUrl) {
      const parsed = Linking.parse(incomingUrl);
      if (typeof parsed.queryParams?.code === 'string') {
        code = parsed.queryParams.code;
      }
    }

    if (!code) return;

    void exchangeRecoveryCode(code).then((res) => {
      if (!res.ok) {
        setErrorMessage(
          res.message ?? 'Recovery link has expired or is invalid. Request a new one.'
        );
      }
    });
  }, [incomingUrl, params.code]);

  const passwordValidation = validatePassword(newPassword);
  const passwordError =
    submitted && !passwordValidation.ok ? passwordValidation.error : undefined;
  const confirmError =
    submitted && confirmPassword !== newPassword
      ? 'Passwords do not match.'
      : undefined;

  const handleSubmit = async () => {
    setSubmitted(true);
    setErrorMessage(null);

    if (!passwordValidation.ok || confirmPassword !== newPassword) {
      return;
    }

    setIsUpdating(true);
    const res = await completePasswordReset(newPassword);
    setIsUpdating(false);

    if (!res.ok) {
      setErrorMessage(
        res.message ?? 'Could not update password. Open your latest recovery email link.'
      );
      return;
    }

    setUpdated(true);
  };

  return (
    <ScreenContainer keyboardAvoiding edges={['top', 'bottom']}>
      <Animated.View entering={FadeInDown.duration(260)} style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
          hitSlop={8}
          onPress={() => {
            clearPasswordRecovery();
            router.replace(isAuthenticated ? ROUTES.home : ROUTES.login);
          }}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>

        <View style={styles.header}>
          <ThemedText variant="h1">Choose a new password</ThemedText>
          <ThemedText variant="body" color="textSecondary">
            Create a strong password for your EcoTrack account.
          </ThemedText>
        </View>

        {updated ? (
          <Card variant="mint" padding="lg" style={styles.successCard}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primary }]}>
              <Ionicons
                name="checkmark-done"
                size={26}
                color={colors.textOnPrimary}
              />
            </View>
            <Badge
              label="Password Updated"
              tone="primary"
              style={styles.centerBadge}
            />
            <ThemedText variant="h2" style={styles.center}>
              You’re all set
            </ThemedText>
            <ThemedText variant="body" color="textSecondary" style={styles.center}>
              Your EcoTrack password has been updated securely.
            </ThemedText>
            <Button
              label={isAuthenticated ? 'Continue to Dashboard' : 'Sign In'}
              variant="primary"
              fullWidth
              onPress={() =>
                router.replace(isAuthenticated ? ROUTES.home : ROUTES.login)
              }
            />
          </Card>
        ) : (
          <Card variant="elevated" padding="lg" style={styles.formCard}>
            {errorMessage ? (
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
                  {errorMessage}
                </ThemedText>
              </View>
            ) : null}

            <Input
              label="New Password"
              placeholder="Minimum 6 characters"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={newPassword}
              onChangeText={setNewPassword}
              leftIcon="lock-closed-outline"
              errorText={passwordError}
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
              label="Confirm New Password"
              placeholder="Re-enter password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              leftIcon="shield-checkmark-outline"
              errorText={confirmError}
            />

            <Button
              label="Update Password"
              variant="primary"
              size="lg"
              fullWidth
              loading={isUpdating}
              rightIcon="checkmark-circle-outline"
              onPress={() => {
                void handleSubmit();
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
