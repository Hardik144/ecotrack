import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  ListRowItem,
  OptionPillGroup,
  RegionalGridSelector,
  ScreenContainer,
  SectionHeader,
  StatTile,
  ThemedText,
} from '@/components';
import { APP_CONFIG, Radii, Spacing } from '@/constants';
import { useEcoTrack } from '@/context';
import { useAppConfig, useTheme } from '@/hooks';
import { ROUTES, type ElectricityRegionCode } from '@/types';
import {
  formatPrivacyDisplayName,
  validateAvatarUrlInput,
  validateFullName,
} from '@/utils';
import { hasExposedGeminiApiKeyInEnv } from '@/utils/env';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { appVersion, backendConfigured, geminiConfigured } = useAppConfig();
  const {
    user,
    preferences,
    badges,
    sustainabilityProgress,
    dashboardAnalytics,
    isDataLoading,
    updateProfileDetails,
    uploadAvatarPhoto,
    removeAvatarPhoto,
    updateDailyBudget,
    togglePreference,
    updatePreferredUnit,
    updateRegionalElectricitySetting,
    refreshUserData,
    logout,
  } = useEcoTrack();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [nameDraft, setNameDraft] = useState(user.fullName);
  const [avatarUrlDraft, setAvatarUrlDraft] = useState('');
  const [regionDraft, setRegionDraft] = useState<ElectricityRegionCode | null>(
    null
  );
  const [customFactorDraft, setCustomFactorDraft] = useState<string | null>(
    null
  );
  const [isSavingRegion, setIsSavingRegion] = useState(false);
  const [regionSavedNotice, setRegionSavedNotice] = useState<string | null>(
    null
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  const earnedBadges = badges.filter((item) => item.earned);

  const openEditProfile = () => {
    setNameDraft(user.fullName);
    setAvatarUrlDraft(user.avatarUrl ?? '');
    setProfileError(null);
    setProfileNotice(null);
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    setProfileError(null);
    setProfileNotice(null);

    const nameCheck = validateFullName(nameDraft);
    if (!nameCheck.ok) {
      setProfileError(nameCheck.error ?? 'Invalid name.');
      return;
    }

    const trimmedUrl = avatarUrlDraft.trim();
    const shouldKeepCurrentSignedUrl =
      Boolean(user.avatarUrl) && trimmedUrl === user.avatarUrl;

    if (!shouldKeepCurrentSignedUrl && trimmedUrl.length > 0) {
      const urlCheck = validateAvatarUrlInput(trimmedUrl);
      if (!urlCheck.ok) {
        setProfileError(urlCheck.error ?? 'Invalid image URL.');
        return;
      }
    }

    setIsSavingProfile(true);
    const res = await updateProfileDetails({
      fullName: nameDraft,
      avatarUrl: shouldKeepCurrentSignedUrl
        ? undefined
        : trimmedUrl.length > 0
          ? trimmedUrl
          : null,
    });
    setIsSavingProfile(false);

    if (!res.ok) {
      setProfileError(res.error ?? 'Failed to save profile.');
      return;
    }

    setIsEditingProfile(false);
    setProfileNotice('Profile updated cleanly.');
  };

  const handlePickAvatar = async () => {
    setProfileError(null);
    setProfileNotice(null);

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (pickerResult.canceled || pickerResult.assets.length === 0) {
      return;
    }

    const asset = pickerResult.assets[0];
    if (!asset?.base64) {
      setProfileError(
        'Selected image did not include readable image data. Try another photo.'
      );
      return;
    }

    setIsUploadingPhoto(true);
    const res = await uploadAvatarPhoto({
      base64: asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
    setIsUploadingPhoto(false);

    if (!res.ok) {
      setProfileError(res.error ?? 'Failed to upload profile photo.');
      return;
    }

    setProfileNotice('Profile image updated.');
  };

  const handleRemoveAvatar = async () => {
    setProfileError(null);
    setProfileNotice(null);
    setIsUploadingPhoto(true);
    const res = await removeAvatarPhoto();
    setIsUploadingPhoto(false);

    if (!res.ok) {
      setProfileError(res.error ?? 'Failed to remove profile photo.');
      return;
    }

    setAvatarUrlDraft('');
    setProfileNotice('Profile image removed.');
  };

  const handleBudgetStep = async (nextBudget: number) => {
    setProfileError(null);
    const res = await updateDailyBudget(nextBudget);
    if (!res.ok && res.error) {
      setProfileError(res.error);
    }
  };

  const handleTogglePreference = async (
    key: 'notificationsEnabled' | 'weeklyDigestEnabled' | 'leaderboardOptIn'
  ) => {
    setProfileError(null);
    const res = await togglePreference(key);
    if (!res.ok && res.error) {
      setProfileError(res.error);
    }
  };

  const activeProfileRegion = regionDraft ?? preferences.electricityRegion;
  const activeProfileCustomFactor =
    customFactorDraft ??
    (preferences.customElectricityFactorKg !== null
      ? String(preferences.customElectricityFactorKg)
      : '0.4450');

  const handleSaveRegionalSetting = async () => {
    setProfileError(null);
    setRegionSavedNotice(null);
    const trimmedCustom = activeProfileCustomFactor.trim();
    const strictCustom = trimmedCustom ? Number(trimmedCustom) : null;
    setIsSavingRegion(true);
    const res = await updateRegionalElectricitySetting(
      activeProfileRegion,
      activeProfileRegion === 'custom' ? strictCustom : null
    );
    setIsSavingRegion(false);

    if (!res.ok) {
      setProfileError(res.error ?? 'Failed to save regional electricity setting.');
      return;
    }

    setRegionDraft(null);
    setCustomFactorDraft(null);
    setRegionSavedNotice('Default electricity grid updated.');
  };

  const handleSelectUnit = async (unit: 'metric' | 'imperial') => {
    setProfileError(null);
    const res = await updatePreferredUnit(unit);
    if (!res.ok && res.error) {
      setProfileError(res.error);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const res = await logout();
    setIsLoggingOut(false);

    if (!res.ok) {
      setProfileError(res.message ?? 'Unable to sign out right now.');
      return;
    }

    router.replace(ROUTES.login);
  };

  return (
    <ScreenContainer keyboardAvoiding>
      <Animated.View entering={FadeInDown.duration(260)}>
        <Card variant="elevated" padding="lg" style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Update profile photo"
              disabled={isUploadingPhoto}
              onPress={() => {
                void handlePickAvatar();
              }}
              style={[styles.avatar, { backgroundColor: colors.primary }]}>
              {user.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <ThemedText variant="h2" style={{ color: colors.textOnPrimary }}>
                  {getInitials(user.fullName) || 'EC'}
                </ThemedText>
              )}
              <View
                style={[
                  styles.cameraBadge,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}>
                <Ionicons name="camera" size={12} color={colors.primary} />
              </View>
            </Pressable>

            <View style={styles.profileMeta}>
              <ThemedText variant="h2">{user.fullName}</ThemedText>
              <ThemedText variant="caption" color="textSecondary">
                {user.email}
              </ThemedText>
              <ThemedText variant="caption" color="textMuted">
                Member since {user.memberSince}
              </ThemedText>
            </View>

            {!isEditingProfile ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                hitSlop={8}
                onPress={openEditProfile}
                style={[
                  styles.editIconBtn,
                  { backgroundColor: colors.secondary },
                ]}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.profileBadges}>
            <Badge label={user.levelTitle} tone="primary" icon="leaf" />
            <Badge
              label={`${user.ecoPoints} Eco Points`}
              tone="secondary"
              icon="trophy-outline"
            />
          </View>

          {profileError ? (
            <View
              style={[
                styles.feedbackBanner,
                {
                  borderColor: colors.error,
                  backgroundColor: colors.surfaceElevated,
                },
              ]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
              <ThemedText variant="caption" color="error" style={styles.feedbackText}>
                {profileError}
              </ThemedText>
            </View>
          ) : null}

          {profileNotice ? (
            <View
              style={[
                styles.feedbackBanner,
                {
                  borderColor: colors.primary,
                  backgroundColor: colors.secondary,
                },
              ]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <ThemedText variant="caption" color="primary" style={styles.feedbackText}>
                {profileNotice}
              </ThemedText>
            </View>
          ) : null}

          {isEditingProfile ? (
            <View style={[styles.editSection, { borderTopColor: colors.border }]}>
              <Input
                label="Full Name"
                placeholder="Your full name"
                autoCapitalize="words"
                value={nameDraft}
                onChangeText={setNameDraft}
                leftIcon="person-outline"
              />

              <Input
                label="Profile Image URL (Optional)"
                placeholder="https://example.com/avatar.jpg"
                autoCapitalize="none"
                value={avatarUrlDraft}
                onChangeText={setAvatarUrlDraft}
                leftIcon="image-outline"
                helperText="Or upload directly from your photo library below."
              />

              <View style={styles.photoActionsRow}>
                <View style={styles.flexBtn}>
                  <Button
                    label={isUploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                    variant="secondary"
                    size="sm"
                    fullWidth
                    loading={isUploadingPhoto}
                    leftIcon="cloud-upload-outline"
                    onPress={() => {
                      void handlePickAvatar();
                    }}
                  />
                </View>
                {user.avatarUrl ? (
                  <View style={styles.flexBtn}>
                    <Button
                      label="Remove Photo"
                      variant="outline"
                      size="sm"
                      fullWidth
                      disabled={isUploadingPhoto}
                      leftIcon="trash-outline"
                      onPress={() => {
                        void handleRemoveAvatar();
                      }}
                    />
                  </View>
                ) : null}
              </View>

              <View style={styles.photoActionsRow}>
                <View style={styles.flexBtn}>
                  <Button
                    label="Cancel"
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onPress={() => {
                      setIsEditingProfile(false);
                      setProfileError(null);
                    }}
                  />
                </View>
                <View style={styles.flexBtn}>
                  <Button
                    label="Save Profile"
                    variant="primary"
                    size="sm"
                    fullWidth
                    loading={isSavingProfile}
                    leftIcon="checkmark"
                    onPress={() => {
                      void handleSaveProfile();
                    }}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </Card>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(60).duration(260)}
        style={styles.kpiRow}>
        <StatTile
          label="Eco Score"
          value={`${dashboardAnalytics.sustainabilityScore.score}/100`}
          helper={`${user.ecoStreakDays}-day streak`}
          icon="shield-checkmark-outline"
        />
        <StatTile
          label="Achievements"
          value={`${earnedBadges.length} / ${badges.length}`}
          helper="Badges unlocked"
          icon="ribbon-outline"
          onPress={() => router.push(ROUTES.challenges)}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(100).duration(260)}
        style={styles.section}>
        <SectionHeader
          title="Achievements & Challenges"
          actionLabel="View All"
          onActionPress={() => router.push(ROUTES.challenges)}
        />

        <Card variant="mint" padding="md" style={styles.achievementsCard}>
          <View style={styles.progressSummaryRow}>
            <View style={styles.progressSummaryItem}>
              <ThemedText variant="h3" color="primary">
                {sustainabilityProgress.totalCompletedChallenges}
              </ThemedText>
              <ThemedText variant="caption" color="textMuted">
                Completed
              </ThemedText>
            </View>
            <View style={styles.progressSummaryItem}>
              <ThemedText variant="h3" color="primary">
                {sustainabilityProgress.earnedBadgesCount}/
                {sustainabilityProgress.totalBadgesCount}
              </ThemedText>
              <ThemedText variant="caption" color="textMuted">
                Badges
              </ThemedText>
            </View>
            <View style={styles.progressSummaryItem}>
              <ThemedText variant="h3" color="primary">
                {sustainabilityProgress.ecoStreakDays}d
              </ThemedText>
              <ThemedText variant="caption" color="textMuted">
                Streak
              </ThemedText>
            </View>
            <View style={styles.progressSummaryItem}>
              <ThemedText variant="h3" color="primary">
                {sustainabilityProgress.ecoPoints}
              </ThemedText>
              <ThemedText variant="caption" color="textMuted">
                Eco Pts
              </ThemedText>
            </View>
          </View>

          {earnedBadges.length === 0 ? (
            <EmptyState
              icon="ribbon-outline"
              title="Unlock your first eco badge"
              description="Complete a sustainable daily or weekly challenge to unlock your first achievement badge and Eco Points."
            />
          ) : (
            <View style={styles.badgeStrip}>
              {earnedBadges.slice(0, 4).map((badge) => (
                <View key={badge.id} style={styles.miniBadgeItem}>
                  <View
                    style={[
                      styles.miniBadgeIcon,
                      { backgroundColor: colors.surface },
                    ]}>
                    <Ionicons
                      name={badge.icon as ComponentProps<typeof Ionicons>['name']}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <ThemedText variant="caption" color="primary" numberOfLines={1}>
                    {badge.title}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
          <Button
            label="Open Challenges, Badges & Leaderboard"
            variant="primary"
            size="sm"
            fullWidth
            rightIcon="arrow-forward"
            onPress={() => router.push(ROUTES.challenges)}
          />
          <View style={styles.photoActionsRow}>
            <View style={styles.flexBtn}>
              <Button
                label="Reward History"
                variant="secondary"
                size="sm"
                fullWidth
                leftIcon="ribbon-outline"
                onPress={() =>
                  router.push({
                    pathname: '/challenges',
                    params: { tab: 'rewards' },
                  })
                }
              />
            </View>
            <View style={styles.flexBtn}>
              <Button
                label="Rankings"
                variant="outline"
                size="sm"
                fullWidth
                leftIcon="podium-outline"
                onPress={() =>
                  router.push({
                    pathname: '/challenges',
                    params: { tab: 'leaderboard' },
                  })
                }
              />
            </View>
          </View>
        </Card>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(140).duration(260)}
        style={styles.section}>
        <SectionHeader title="Daily Carbon Target" />
        <Card variant="elevated" padding="md" style={styles.budgetCard}>
          <View style={styles.budgetRow}>
            <View style={styles.budgetText}>
              <ThemedText variant="bodyMedium">Daily Budget Limit</ThemedText>
              <ThemedText variant="caption" color="textMuted">
                Used across dashboard & analytics target lines
              </ThemedText>
            </View>
            <View style={styles.stepperGroup}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease daily budget"
                onPress={() => {
                  void handleBudgetStep(user.dailyCarbonBudgetKg - 1);
                }}
                style={[
                  styles.stepperBtn,
                  { backgroundColor: colors.surfaceElevated },
                ]}>
                <Ionicons name="remove" size={16} color={colors.text} />
              </Pressable>
              <ThemedText variant="h3" color="primary" style={styles.budgetVal}>
                {user.dailyCarbonBudgetKg.toFixed(1)} kg
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase daily budget"
                onPress={() => {
                  void handleBudgetStep(user.dailyCarbonBudgetKg + 1);
                }}
                style={[
                  styles.stepperBtn,
                  { backgroundColor: colors.secondary },
                ]}>
                <Ionicons name="add" size={16} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        </Card>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(160).duration(260)}
        style={styles.section}>
        <SectionHeader
          title="Regional Grid & Units"
          subtitle="Configures default electricity & EV emission factors"
        />

        <RegionalGridSelector
          compact
          regionCode={activeProfileRegion}
          customFactorText={activeProfileCustomFactor}
          onChangeRegion={(code) => {
            setRegionDraft(code);
            setRegionSavedNotice(null);
            setProfileError(null);
          }}
          onChangeCustomFactorText={(val) => {
            setCustomFactorDraft(val);
            setRegionSavedNotice(null);
            setProfileError(null);
          }}
          onSaveAsDefault={() => {
            void handleSaveRegionalSetting();
          }}
          isSavingDefault={isSavingRegion}
          savedNotice={regionSavedNotice}
        />

        <Card variant="outlined" padding="md" style={styles.settingsCard}>
          <OptionPillGroup
            label="Default Input Units"
            items={[
              { key: 'metric' as const, label: 'Metric (km, kg, L)' },
              { key: 'imperial' as const, label: 'Imperial (mi, lb, gal)' },
            ]}
            selectedKey={preferences.preferredUnit}
            onSelect={(unit) => {
              void handleSelectUnit(unit);
            }}
          />
        </Card>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(180).duration(260)}
        style={styles.section}>
        <SectionHeader title="Settings" />

        <Card variant="outlined" padding="md" style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <ThemedText variant="bodyMedium">Daily Eco Reminders</ThemedText>
              <ThemedText variant="caption" color="textMuted">
                Gentle evening nudge to log commute & meals
              </ThemedText>
            </View>
            <Switch
              value={preferences.notificationsEnabled}
              onValueChange={() => {
                void handleTogglePreference('notificationsEnabled');
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <ThemedText variant="bodyMedium">Weekly Carbon Digest</ThemedText>
              <ThemedText variant="caption" color="textMuted">
                AI summary of weekly trends & top swaps
              </ThemedText>
            </View>
            <Switch
              value={preferences.weeklyDigestEnabled}
              onValueChange={() => {
                void handleTogglePreference('weeklyDigestEnabled');
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <ThemedText variant="bodyMedium">Show Me on Leaderboard</ThemedText>
              <ThemedText variant="caption" color="textMuted">
                {preferences.leaderboardOptIn
                  ? `Visible as “${formatPrivacyDisplayName(user.fullName)}” (email & records stay private)`
                  : 'Hidden from community leaderboard rankings'}
              </ThemedText>
            </View>
            <Switch
              value={preferences.leaderboardOptIn}
              onValueChange={() => {
                void handleTogglePreference('leaderboardOptIn');
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <ThemedText variant="bodyMedium">Backend Integrations</ThemedText>
              <ThemedText variant="caption" color="textMuted">
                EcoTrack v{appVersion} • {APP_CONFIG.emissionUnit}
              </ThemedText>
            </View>
            <View style={styles.envBadges}>
              <Badge
                label={backendConfigured ? 'Node API Live' : 'Setup Needed'}
                tone={backendConfigured ? 'success' : 'warning'}
              />
              <Badge
                label={
                  hasExposedGeminiApiKeyInEnv()
                    ? 'Key Exposed!'
                    : geminiConfigured
                      ? 'Gemini Node AI'
                      : 'AI Setup Needed'
                }
                tone={
                  hasExposedGeminiApiKeyInEnv()
                    ? 'error'
                    : geminiConfigured
                      ? 'success'
                      : 'warning'
                }
              />
            </View>
          </View>
        </Card>

        <ListRowItem
          icon="sparkles-outline"
          title="Replay Onboarding Tour"
          subtitle="View the 3-step EcoTrack introduction"
          onPress={() => router.push(ROUTES.onboarding)}
        />

        <ListRowItem
          icon="sync-outline"
          title={isDataLoading ? 'Syncing Account Data...' : 'Sync Account Data'}
          subtitle="Refresh profile, emission records, challenges & badges"
          onPress={() => {
            void refreshUserData();
          }}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(220).duration(260)}
        style={styles.logoutSection}>
        <Button
          label="Log Out"
          variant="outline"
          size="lg"
          fullWidth
          loading={isLoggingOut}
          leftIcon="log-out-outline"
          onPress={() => {
            void handleLogout();
          }}
          style={{ borderColor: colors.error }}
        />
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    gap: Spacing.md,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: Radii.pill,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMeta: {
    flex: 1,
    gap: Spacing.xxs,
  },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radii.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  feedbackText: {
    flex: 1,
  },
  editSection: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  flexBtn: {
    flex: 1,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.sm,
  },
  achievementsCard: {
    gap: Spacing.md,
  },
  progressSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  progressSummaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  badgeStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  miniBadgeItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  miniBadgeIcon: {
    width: 42,
    height: 42,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetCard: {
    gap: Spacing.sm,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  budgetText: {
    flex: 1,
    gap: Spacing.xxs,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetVal: {
    minWidth: 58,
    textAlign: 'center',
  },
  settingsCard: {
    gap: Spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  settingCopy: {
    flex: 1,
    gap: Spacing.xxs,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  envBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  logoutSection: {
    paddingTop: Spacing.xs,
  },
});
