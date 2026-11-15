import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

import {
  clearChatHistory,
  createEmissionRecordsBatch,
  deleteEmissionRecord,
  fetchCarbonActivitiesCatalog,
  fetchChallengesSnapshot,
  fetchChatHistory,
  fetchEmissionRecords,
  fetchLeaderboard,
  fetchOrCreateUserProfile,
  fetchRewardHistory,
  fetchUserAchievements,
  getFallbackPresets,
  incrementUserChallengeProgress,
  joinUserChallenge,
  loadPersistedSession,
  MAX_CHAT_PROMPT_CHARS,
  saveLocalChatCache,
  sendAssistantPrompt,
  sendPasswordReset,
  signInWithEmail,
  signOutSession,
  signUpWithEmail,
  subscribeAuthSession,
  updateAccountPassword,
  updateEmissionRecord,
  updateUserProfile,
  uploadUserAvatar,
  verifyStoredSession,
  type AuthActionResult,
  type AuthSession,
  type AuthUser,
} from '@/services';
import type {
  AiQuotaStatus,
  CarbonActivity,
  CarbonActivityPresetItem,
  ChallengeActionResult,
  ChatMessage,
  DailyEmissionPoint,
  DashboardAnalyticsSnapshot,
  EcoBadge,
  ElectricityRegionCode,
  GreenChallenge,
  LeaderboardEntry,
  MonthlyComparisonPoint,
  RewardHistoryEntry,
  SustainabilityProgressSummary,
  UserPreferences,
  UserProfile,
} from '@/types';
import {
  buildAssistantContextSummary,
  buildAssistantSuggestions,
  buildWelcomeAssistantMessage,
  computeSustainabilityProgressSummary,
  REQUIRED_BADGE_DEFINITIONS,
  type AssistantContextSummary,
} from '@/utils';
import {
  computeDailyTrendSeries,
  computeDashboardSummary,
  resolveAnalyticsDateRange,
  toLocalDateKey,
} from '@/utils/analyticsEngine';
import {
  resolveElectricityRegion,
} from '@/utils/carbonCalculator';
import { isBackendConfigured } from '@/utils/env';
import { validateDailyBudget, type EmissionRecordInput } from '@/utils/validation';

export type NewActivityPayload = EmissionRecordInput;

const EMPTY_USER: UserProfile = {
  id: '',
  email: '',
  fullName: 'Eco Explorer',
  avatarUrl: null,
  createdAt: new Date(0).toISOString(),
  memberSince: 'Recently joined',
  dailyCarbonBudgetKg: 12.0,
  ecoStreakDays: 0,
  sustainabilityScore: 50,
  ecoPoints: 0,
  levelTitle: 'Seedling Explorer',
  onboardingCompleted: false,
};

const DEFAULT_PREFERENCES: UserPreferences = {
  notificationsEnabled: true,
  weeklyDigestEnabled: true,
  leaderboardOptIn: true,
  preferredUnit: 'metric',
  electricityRegion: 'global',
  customElectricityFactorKg: null,
};

function sortActivitiesDescending(items: CarbonActivity[]): CarbonActivity[] {
  return [...items].sort((a, b) => {
    const timeA = new Date(a.occurredAt).getTime();
    const timeB = new Date(b.occurredAt).getTime();
    if (Number.isNaN(timeA) && Number.isNaN(timeB)) return 0;
    if (Number.isNaN(timeA)) return 1;
    if (Number.isNaN(timeB)) return -1;
    return timeB - timeA;
  });
}

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export interface MutationResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface EcoTrackContextValue {
  isAuthInitializing: boolean;
  isDataLoading: boolean;
  isAuthenticated: boolean;
  isPasswordRecovery: boolean;
  session: AuthSession | null;
  dataError: string | null;
  user: UserProfile;
  preferences: UserPreferences;
  activityPresets: CarbonActivityPresetItem[];
  activities: CarbonActivity[];
  challenges: GreenChallenge[];
  badges: EcoBadge[];
  rewardHistory: RewardHistoryEntry[];
  leaderboard: LeaderboardEntry[];
  isLeaderboardLoading: boolean;
  leaderboardError: string | null;
  totalCompletedChallenges: number;
  sustainabilityProgress: SustainabilityProgressSummary;
  lastRewardNotice: string | null;
  chatMessages: ChatMessage[];
  isAiTyping: boolean;
  aiError: string | null;
  aiQuota: AiQuotaStatus | null;
  aiRetryAfterSeconds: number;
  assistantContextSummary: AssistantContextSummary;
  assistantSuggestions: string[];
  todayEmissionsKg: number;
  todayOffsetsKg: number;
  todayNetKg: number;
  weeklyNetKg: number;
  weeklySeries: DailyEmissionPoint[];
  monthlySeries: MonthlyComparisonPoint[];
  dashboardAnalytics: DashboardAnalyticsSnapshot;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<AuthActionResult>;
  logout: () => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  completePasswordReset: (newPassword: string) => Promise<AuthActionResult>;
  clearPasswordRecovery: () => void;
  refreshUserData: () => Promise<void>;
  refreshLeaderboard: () => Promise<void>;
  clearLastRewardNotice: () => void;
  updateProfileDetails: (patch: {
    fullName: string;
    avatarUrl?: string | null;
  }) => Promise<MutationResult>;
  uploadAvatarPhoto: (asset: {
    base64: string;
    mimeType?: string;
  }) => Promise<MutationResult>;
  removeAvatarPhoto: () => Promise<MutationResult>;
  updateDailyBudget: (budgetKg: number) => Promise<MutationResult>;
  togglePreference: (
    key: 'notificationsEnabled' | 'weeklyDigestEnabled' | 'leaderboardOptIn'
  ) => Promise<MutationResult>;
  updatePreferredUnit: (unit: 'metric' | 'imperial') => Promise<MutationResult>;
  updateRegionalElectricitySetting: (
    regionCode: ElectricityRegionCode,
    customFactorKg?: number | null
  ) => Promise<MutationResult>;
  completeOnboarding: () => Promise<void>;
  addActivity: (
    payload: NewActivityPayload
  ) => Promise<MutationResult<CarbonActivity>>;
  addActivitiesBatch: (
    payloads: NewActivityPayload[]
  ) => Promise<MutationResult<CarbonActivity[]>>;
  updateActivity: (
    id: string,
    payload: NewActivityPayload
  ) => Promise<MutationResult<CarbonActivity>>;
  deleteActivity: (id: string) => Promise<MutationResult>;
  joinChallenge: (id: string) => Promise<MutationResult<ChallengeActionResult>>;
  incrementChallengeProgress: (
    id: string,
    actionNote?: string
  ) => Promise<MutationResult<ChallengeActionResult>>;
  sendChatMessage: (text: string) => Promise<void>;
  retryLastChatMessage: () => Promise<void>;
  clearChat: () => Promise<MutationResult>;
  clearAiError: () => void;
}

const EcoTrackContext = createContext<EcoTrackContextValue | null>(null);

export function EcoTrackProvider({ children }: PropsWithChildren) {
  const [isAuthInitializing, setIsAuthInitializing] = useState(() =>
    isBackendConfigured()
  );
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [user, setUser] = useState<UserProfile>(EMPTY_USER);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [activityPresets, setActivityPresets] = useState<CarbonActivityPresetItem[]>(
    () => getFallbackPresets()
  );
  const [activities, setActivities] = useState<CarbonActivity[]>([]);
  const [challenges, setChallenges] = useState<GreenChallenge[]>([]);
  const [badges, setBadges] = useState<EcoBadge[]>([]);
  const [rewardHistory, setRewardHistory] = useState<RewardHistoryEntry[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [totalCompletedChallenges, setTotalCompletedChallenges] = useState(0);
  const [lastRewardNotice, setLastRewardNotice] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiQuota, setAiQuota] = useState<AiQuotaStatus | null>(null);
  const [aiRetryAfterSeconds, setAiRetryAfterSeconds] = useState(0);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [referenceNow, setReferenceNow] = useState<Date>(() => new Date());

  const hydratedUserIdRef = useRef<string | null>(null);
  const isAiRequestInFlightRef = useRef<boolean>(false);

  const resetSignedOutState = useCallback(() => {
    hydratedUserIdRef.current = null;
    isAiRequestInFlightRef.current = false;
    setUser(EMPTY_USER);
    setPreferences(DEFAULT_PREFERENCES);
    setActivityPresets(getFallbackPresets());
    setActivities([]);
    setChallenges([]);
    setBadges([]);
    setRewardHistory([]);
    setLeaderboard([]);
    setIsLeaderboardLoading(false);
    setLeaderboardError(null);
    setTotalCompletedChallenges(0);
    setLastRewardNotice(null);
    setChatMessages([]);
    setDataError(null);
    setIsAiTyping(false);
    setAiError(null);
    setAiQuota(null);
    setAiRetryAfterSeconds(0);
    setLastFailedPrompt(null);
    setIsDataLoading(false);
  }, []);

  const hydrateAuthenticatedUser = useCallback(
    async (authUser: AuthUser, options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsDataLoading(true);
      }
      setDataError(null);
      const now = new Date();
      setReferenceNow(now);

      try {
        const metadataName = authUser.fullName;

        const { profile, preferences: nextPrefs } = await fetchOrCreateUserProfile({
          userId: authUser.id,
          email: authUser.email ?? '',
          fallbackName: metadataName,
        });

        setUser(profile);
        setPreferences(nextPrefs);

        const isInitialUserHydration = hydratedUserIdRef.current !== authUser.id;

        const [
          catalogRes,
          recordsRes,
          challengesRes,
          achievementsRes,
          rewardHistoryRes,
          leaderboardRes,
          historyRes,
        ] = await Promise.allSettled([
          fetchCarbonActivitiesCatalog(),
          fetchEmissionRecords(authUser.id),
          fetchChallengesSnapshot(authUser.id, now),
          fetchUserAchievements(authUser.id),
          fetchRewardHistory(authUser.id),
          fetchLeaderboard(),
          isInitialUserHydration
            ? fetchChatHistory(authUser.id)
            : Promise.resolve<ChatMessage[] | null>(null),
        ]);

        const loadedRecords =
          recordsRes.status === 'fulfilled'
            ? sortActivitiesDescending(recordsRes.value)
            : [];
        const loadedChallenges =
          challengesRes.status === 'fulfilled'
            ? challengesRes.value.challenges
            : [];
        const loadedTotalCompleted =
          challengesRes.status === 'fulfilled'
            ? challengesRes.value.totalCompletedChallenges
            : 0;
        const loadedBadges =
          achievementsRes.status === 'fulfilled' ? achievementsRes.value : [];

        if (catalogRes.status === 'fulfilled') {
          setActivityPresets(catalogRes.value);
        }
        if (recordsRes.status === 'fulfilled') {
          setActivities(loadedRecords);
        }
        if (challengesRes.status === 'fulfilled') {
          setChallenges(loadedChallenges);
          setTotalCompletedChallenges(loadedTotalCompleted);
        }
        if (achievementsRes.status === 'fulfilled') {
          setBadges(loadedBadges);
        }
        if (rewardHistoryRes.status === 'fulfilled') {
          setRewardHistory(rewardHistoryRes.value);
        }
        if (leaderboardRes.status === 'fulfilled') {
          setLeaderboard(leaderboardRes.value);
          setLeaderboardError(null);
        } else {
          setLeaderboardError(
            leaderboardRes.reason instanceof Error
              ? leaderboardRes.reason.message
              : 'Unable to load community rankings.'
          );
        }

        const errors: string[] = [];
        for (const res of [recordsRes, challengesRes, achievementsRes]) {
          if (res.status === 'rejected') {
            errors.push(
              res.reason instanceof Error ? res.reason.message : 'Database sync error'
            );
          }
        }
        if (errors.length > 0) {
          setDataError(errors[0]);
        }

        // Load persisted AI chat history or show a personalized greeting once per user session
        if (isInitialUserHydration) {
          const persistedHistory =
            historyRes.status === 'fulfilled' && Array.isArray(historyRes.value)
              ? historyRes.value
              : [];

          if (persistedHistory.length > 0) {
            setChatMessages(persistedHistory);
          } else {
            const completedCount = Math.max(
              loadedTotalCompleted,
              loadedChallenges.filter((c) => c.completed).length
            );
            const initialAnalytics = computeDashboardSummary(
              loadedRecords,
              profile.dailyCarbonBudgetKg,
              completedCount,
              profile.sustainabilityScore,
              'all',
              now
            );
            const initialSummary = buildAssistantContextSummary({
              activities: loadedRecords,
              dashboardAnalytics: initialAnalytics,
              badges: loadedBadges,
              challenges: loadedChallenges,
              preferences: nextPrefs,
            });
            setChatMessages([
              buildWelcomeAssistantMessage({
                user: profile,
                dashboardAnalytics: initialAnalytics,
                summary: initialSummary,
              }),
            ]);
          }
        }

        hydratedUserIdRef.current = authUser.id;
      } catch (err) {
        setDataError(
          err instanceof Error
            ? err.message
            : 'Failed to load profile from the EcoTrack Node server.'
        );
      } finally {
        if (!options?.silent) {
          setIsDataLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const now = new Date();
        setReferenceNow((prev) =>
          toLocalDateKey(prev) !== toLocalDateKey(now) ? now : prev
        );
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isBackendConfigured()) {
      return undefined;
    }

    let isMounted = true;

    void loadPersistedSession()
      .then(async (storedSession) => {
        if (!isMounted) return;

        if (!storedSession?.user) {
          setSession(null);
          resetSignedOutState();
          setIsAuthInitializing(false);
          return;
        }

        const verifiedSession = await verifyStoredSession();
        if (!isMounted) return;

        setSession(verifiedSession);
        if (verifiedSession?.user) {
          await hydrateAuthenticatedUser(verifiedSession.user);
        } else {
          resetSignedOutState();
        }

        if (isMounted) {
          setIsAuthInitializing(false);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setSession(null);
        resetSignedOutState();
        setIsAuthInitializing(false);
      });

    const unsubscribe = subscribeAuthSession((event, nextSession) => {
      if (!isMounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        return;
      }

      setSession(nextSession);

      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        setIsPasswordRecovery(false);
        resetSignedOutState();
        setIsAuthInitializing(false);
        return;
      }

      if (
        event === 'SIGNED_IN' ||
        event === 'USER_UPDATED' ||
        hydratedUserIdRef.current !== nextSession.user.id
      ) {
        void hydrateAuthenticatedUser(nextSession.user);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [hydrateAuthenticatedUser, resetSignedOutState]);

  const completedChallengesCount = useMemo(
    () =>
      Math.max(
        totalCompletedChallenges,
        challenges.filter((c) => c.completed).length
      ),
    [challenges, totalCompletedChallenges]
  );

  const sustainabilityProgress = useMemo<SustainabilityProgressSummary>(
    () =>
      computeSustainabilityProgressSummary({
        challenges,
        badges,
        rewardHistory,
        ecoPoints: user.ecoPoints,
        ecoStreakDays: user.ecoStreakDays,
        totalCompletedHistorical: totalCompletedChallenges,
        now: referenceNow,
      }),
    [
      badges,
      challenges,
      referenceNow,
      rewardHistory,
      totalCompletedChallenges,
      user.ecoPoints,
      user.ecoStreakDays,
    ]
  );

  const dashboardAnalytics = useMemo<DashboardAnalyticsSnapshot>(
    () =>
      computeDashboardSummary(
        activities,
        user.dailyCarbonBudgetKg,
        completedChallengesCount,
        user.sustainabilityScore,
        'all',
        referenceNow
      ),
    [
      activities,
      completedChallengesCount,
      referenceNow,
      user.dailyCarbonBudgetKg,
      user.sustainabilityScore,
    ]
  );

  const weeklySeries = useMemo<DailyEmissionPoint[]>(() => {
    const { range } = resolveAnalyticsDateRange('7d', activities, undefined, referenceNow);
    return computeDailyTrendSeries(activities, range, user.dailyCarbonBudgetKg).map(
      (point) => ({
        label: point.label,
        emissionsKg: point.netKg,
        targetKg: point.targetKg,
      })
    );
  }, [activities, referenceNow, user.dailyCarbonBudgetKg]);

  const monthlySeries = useMemo<MonthlyComparisonPoint[]>(
    () =>
      dashboardAnalytics.monthlyComparison.buckets.map((bucket) => ({
        label: bucket.label,
        currentKg: bucket.netKg,
        previousKg: bucket.grossKg,
      })),
    [dashboardAnalytics.monthlyComparison.buckets]
  );

  const refreshUserData = useCallback(async () => {
    if (!session?.user) return;
    await hydrateAuthenticatedUser(session.user);
  }, [hydrateAuthenticatedUser, session]);

  const login = useCallback(async (email: string, password: string) => {
    return signInWithEmail(email, password);
  }, []);

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      return signUpWithEmail({ fullName, email, password });
    },
    []
  );

  const logout = useCallback(async () => {
    const res = await signOutSession();
    if (res.ok) {
      setSession(null);
      setIsPasswordRecovery(false);
      resetSignedOutState();
    }
    return res;
  }, [resetSignedOutState]);

  const requestPasswordReset = useCallback(async (email: string) => {
    return sendPasswordReset(email);
  }, []);

  const completePasswordReset = useCallback(
    async (newPassword: string) => {
      const res = await updateAccountPassword(newPassword);
      if (res.ok) {
        setIsPasswordRecovery(false);
      }
      return res;
    },
    []
  );

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const updateProfileDetails = useCallback(
    async (patch: { fullName: string; avatarUrl?: string | null }): Promise<MutationResult> => {
      if (!session?.user) {
        return { ok: false, error: 'You must be signed in to update your profile.' };
      }

      try {
        const updated = await updateUserProfile(session.user.id, patch);
        setUser(updated.profile);
        setPreferences(updated.preferences);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Unable to update profile.',
        };
      }
    },
    [session]
  );

  const uploadAvatarPhoto = useCallback(
    async (asset: { base64: string; mimeType?: string }): Promise<MutationResult> => {
      if (!session?.user) {
        return { ok: false, error: 'You must be signed in to upload a profile image.' };
      }

      try {
        const updated = await uploadUserAvatar(session.user.id, asset);
        setUser(updated.profile);
        setPreferences(updated.preferences);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Unable to upload profile image.',
        };
      }
    },
    [session]
  );

  const removeAvatarPhoto = useCallback(async (): Promise<MutationResult> => {
    if (!session?.user) {
      return { ok: false, error: 'You must be signed in to update your profile image.' };
    }

    try {
      const updated = await updateUserProfile(session.user.id, { avatarUrl: null });
      setUser(updated.profile);
      setPreferences(updated.preferences);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to remove profile image.',
      };
    }
  }, [session]);

  const updateDailyBudget = useCallback(
    async (budgetKg: number): Promise<MutationResult> => {
      if (!session?.user) {
        return { ok: false, error: 'You must be signed in to update settings.' };
      }

      const check = validateDailyBudget(budgetKg);
      if (!check.ok || check.value === undefined) {
        return { ok: false, error: check.error };
      }

      const previousBudget = user.dailyCarbonBudgetKg;
      setUser((prev) => ({ ...prev, dailyCarbonBudgetKg: check.value! }));

      try {
        const updated = await updateUserProfile(session.user.id, {
          dailyCarbonBudgetKg: check.value,
        });
        setUser(updated.profile);
        return { ok: true };
      } catch (err) {
        setUser((prev) => ({ ...prev, dailyCarbonBudgetKg: previousBudget }));
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Failed to save daily budget.',
        };
      }
    },
    [session, user.dailyCarbonBudgetKg]
  );

  const togglePreference = useCallback(
    async (
      key: 'notificationsEnabled' | 'weeklyDigestEnabled' | 'leaderboardOptIn'
    ): Promise<MutationResult> => {
      if (!session?.user) {
        return { ok: false, error: 'You must be signed in to update preferences.' };
      }

      const previous = preferences;
      const nextValue = !preferences[key];
      setPreferences((prev) => ({ ...prev, [key]: nextValue }));

      try {
        const updated = await updateUserProfile(session.user.id, {
          [key]: nextValue,
        });
        setPreferences(updated.preferences);

        if (key === 'leaderboardOptIn') {
          try {
            const rows = await fetchLeaderboard();
            setLeaderboard(rows);
            setLeaderboardError(null);
          } catch {
            // Non-blocking leaderboard reload after privacy change
          }
        }

        return { ok: true };
      } catch (err) {
        setPreferences(previous);
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Failed to update preference.',
        };
      }
    },
    [preferences, session]
  );

  const updatePreferredUnit = useCallback(
    async (unit: 'metric' | 'imperial'): Promise<MutationResult> => {
      if (!session?.user) {
        return { ok: false, error: 'You must be signed in to update units.' };
      }

      const previous = preferences;
      setPreferences((prev) => ({ ...prev, preferredUnit: unit }));

      try {
        const updated = await updateUserProfile(session.user.id, {
          preferredUnit: unit,
        });
        setPreferences(updated.preferences);
        return { ok: true };
      } catch (err) {
        setPreferences(previous);
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Failed to update unit preference.',
        };
      }
    },
    [preferences, session]
  );

  const updateRegionalElectricitySetting = useCallback(
    async (
      regionCode: ElectricityRegionCode,
      customFactorKg?: number | null
    ): Promise<MutationResult> => {
      const check = resolveElectricityRegion(regionCode, customFactorKg);
      if (!check.ok || !check.data) {
        return { ok: false, error: check.error ?? 'Invalid regional electricity setting.' };
      }

      if (!session?.user) {
        return { ok: false, error: 'You must be signed in to save regional settings.' };
      }

      const previous = preferences;
      const nextCustom =
        regionCode === 'custom' ? check.data.factorKgPerKwh : customFactorKg ?? null;
      setPreferences((prev) => ({
        ...prev,
        electricityRegion: regionCode,
        customElectricityFactorKg: nextCustom,
      }));

      try {
        const updated = await updateUserProfile(session.user.id, {
          electricityRegion: regionCode,
          customElectricityFactorKg: nextCustom,
        });
        setPreferences(updated.preferences);
        return { ok: true };
      } catch (err) {
        setPreferences(previous);
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to save regional electricity factor.',
        };
      }
    },
    [preferences, session]
  );

  const completeOnboarding = useCallback(async () => {
    if (!session?.user || user.onboardingCompleted) return;
    try {
      const updated = await updateUserProfile(session.user.id, {
        onboardingCompleted: true,
      });
      setUser(updated.profile);
    } catch {
      // Non-blocking onboarding flag update
    }
  }, [session, user.onboardingCompleted]);

  const syncProfileAndBadgesAfterLog = useCallback(
    async (userId: string, fallbackEmail: string) => {
      const [profileRes, achievementsRes] = await Promise.allSettled([
        fetchOrCreateUserProfile({
          userId,
          email: fallbackEmail,
          fallbackName: user.fullName,
        }),
        fetchUserAchievements(userId),
      ]);

      if (profileRes.status === 'fulfilled') {
        setUser(profileRes.value.profile);
        setPreferences(profileRes.value.preferences);
      }
      if (achievementsRes.status === 'fulfilled') {
        setBadges(achievementsRes.value);
      }
    },
    [user.fullName]
  );

  const addActivitiesBatch = useCallback(
    async (
      payloads: NewActivityPayload[]
    ): Promise<MutationResult<CarbonActivity[]>> => {
      if (!session?.user) {
        return { ok: false, error: 'Please sign in before logging activities.' };
      }

      try {
        const created = await createEmissionRecordsBatch(session.user.id, payloads);
        setActivities((prev) => sortActivitiesDescending([...created, ...prev]));
        await syncProfileAndBadgesAfterLog(
          session.user.id,
          session.user.email ?? user.email
        );
        return { ok: true, data: created };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Unable to save activities.',
        };
      }
    },
    [session, syncProfileAndBadgesAfterLog, user.email]
  );

  const addActivity = useCallback(
    async (
      payload: NewActivityPayload
    ): Promise<MutationResult<CarbonActivity>> => {
      const res = await addActivitiesBatch([payload]);
      if (!res.ok || !res.data?.[0]) {
        return { ok: false, error: res.error ?? 'Unable to save activity.' };
      }
      return { ok: true, data: res.data[0] };
    },
    [addActivitiesBatch]
  );

  const updateActivity = useCallback(
    async (
      id: string,
      payload: NewActivityPayload
    ): Promise<MutationResult<CarbonActivity>> => {
      if (!session?.user) {
        return { ok: false, error: 'You must be signed in to update an activity.' };
      }

      try {
        const updated = await updateEmissionRecord(session.user.id, id, payload);
        setActivities((prev) =>
          sortActivitiesDescending(
            prev.map((item) => (item.id === id ? updated : item))
          )
        );
        await syncProfileAndBadgesAfterLog(
          session.user.id,
          session.user.email ?? user.email
        );
        return { ok: true, data: updated };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Unable to update activity.',
        };
      }
    },
    [session, syncProfileAndBadgesAfterLog, user.email]
  );

  const deleteActivity = useCallback(
    async (id: string): Promise<MutationResult> => {
      if (!session?.user) {
        return { ok: false, error: 'You must be signed in to delete an activity.' };
      }

      try {
        await deleteEmissionRecord(session.user.id, id);
        setActivities((prev) => prev.filter((item) => item.id !== id));
        await syncProfileAndBadgesAfterLog(
          session.user.id,
          session.user.email ?? user.email
        );
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Unable to delete activity.',
        };
      }
    },
    [session, syncProfileAndBadgesAfterLog, user.email]
  );

  const clearLastRewardNotice = useCallback(() => {
    setLastRewardNotice(null);
  }, []);

  const refreshLeaderboard = useCallback(async (): Promise<void> => {
    if (!session?.user) {
      setLeaderboard([]);
      setLeaderboardError(null);
      return;
    }

    setIsLeaderboardLoading(true);
    try {
      const rows = await fetchLeaderboard();
      setLeaderboard(rows);
      setLeaderboardError(null);
    } catch (err) {
      setLeaderboardError(
        err instanceof Error
          ? err.message
          : 'Unable to load community leaderboard.'
      );
    } finally {
      setIsLeaderboardLoading(false);
    }
  }, [session?.user]);

  const syncAfterChallengeAction = useCallback(
    async (userId: string, email: string, fallbackName: string) => {
      const now = new Date();
      const [
        challengesRes,
        profileRes,
        achievementsRes,
        rewardHistoryRes,
        leaderboardRes,
      ] = await Promise.allSettled([
        fetchChallengesSnapshot(userId, now),
        fetchOrCreateUserProfile({
          userId,
          email,
          fallbackName,
        }),
        fetchUserAchievements(userId),
        fetchRewardHistory(userId),
        fetchLeaderboard(),
      ]);

      if (challengesRes.status === 'fulfilled') {
        setChallenges(challengesRes.value.challenges);
        setTotalCompletedChallenges(challengesRes.value.totalCompletedChallenges);
      }
      if (profileRes.status === 'fulfilled') {
        setUser(profileRes.value.profile);
        setPreferences(profileRes.value.preferences);
      }
      if (achievementsRes.status === 'fulfilled') {
        setBadges(achievementsRes.value);
      }
      if (rewardHistoryRes.status === 'fulfilled') {
        setRewardHistory(rewardHistoryRes.value);
      }
      if (leaderboardRes.status === 'fulfilled') {
        setLeaderboard(leaderboardRes.value);
        setLeaderboardError(null);
      }
    },
    []
  );

  const notifyForChallengeResult = useCallback(
    (challengeTitle: string, unitLabel: string, result: ChallengeActionResult) => {
      if (result.duplicateBlocked) {
        setLastRewardNotice(
          `"${challengeTitle}" is already completed for ${result.periodKey}. Duplicate Eco Points are blocked.`
        );
        return;
      }

      if (result.newlyCompleted) {
        const badgeNames = result.unlockedBadges
          .map(
            (key) =>
              REQUIRED_BADGE_DEFINITIONS.find((def) => def.badgeKey === key)
                ?.title ?? key
          )
          .filter(Boolean);
        const badgeText =
          badgeNames.length > 0
            ? ` · Badge unlocked: ${badgeNames.join(', ')}!`
            : '';
        setLastRewardNotice(
          `Completed "${challengeTitle}" (+${result.pointsAwarded} Eco Pts)${badgeText}`
        );
        return;
      }

      if (result.progress > 0) {
        setLastRewardNotice(
          `Logged progress (${result.progress}/${result.targetCount} ${unitLabel}) on "${challengeTitle}".`
        );
      }
    },
    []
  );

  const joinChallenge = useCallback(
    async (id: string): Promise<MutationResult<ChallengeActionResult>> => {
      if (!session?.user) {
        return { ok: false, error: 'You must be signed in to join a challenge.' };
      }

      const targetChallenge = challenges.find((item) => item.id === id);
      if (!targetChallenge) {
        return { ok: false, error: 'Challenge could not be found.' };
      }

      try {
        const actionResult = await joinUserChallenge(
          session.user.id,
          targetChallenge
        );
        if (!actionResult.duplicateBlocked) {
          await syncAfterChallengeAction(
            session.user.id,
            session.user.email ?? user.email,
            user.fullName
          );
        }
        notifyForChallengeResult(
          targetChallenge.title,
          targetChallenge.unitLabel,
          actionResult
        );
        return { ok: true, data: actionResult };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Unable to join challenge.',
        };
      }
    },
    [
      challenges,
      notifyForChallengeResult,
      session,
      syncAfterChallengeAction,
      user.email,
      user.fullName,
    ]
  );

  const incrementChallengeProgress = useCallback(
    async (
      id: string,
      actionNote?: string
    ): Promise<MutationResult<ChallengeActionResult>> => {
      if (!session?.user) {
        return {
          ok: false,
          error: 'You must be signed in to update challenge progress.',
        };
      }

      const targetChallenge = challenges.find((item) => item.id === id);
      if (!targetChallenge) {
        return { ok: false, error: 'Challenge could not be found.' };
      }

      try {
        const actionResult = await incrementUserChallengeProgress(
          session.user.id,
          targetChallenge,
          actionNote
        );

        if (!actionResult.duplicateBlocked) {
          await syncAfterChallengeAction(
            session.user.id,
            session.user.email ?? user.email,
            user.fullName
          );
        }

        notifyForChallengeResult(
          targetChallenge.title,
          targetChallenge.unitLabel,
          actionResult
        );

        return { ok: true, data: actionResult };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Unable to record challenge progress.',
        };
      }
    },
    [
      challenges,
      notifyForChallengeResult,
      session,
      syncAfterChallengeAction,
      user.email,
      user.fullName,
    ]
  );

  const chatMessagesRef = useRef<ChatMessage[]>(chatMessages);
  const chatGenerationRef = useRef(0);

  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    if (aiRetryAfterSeconds <= 0) return;
    const timer = setInterval(() => {
      setAiRetryAfterSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [aiRetryAfterSeconds]);

  const assistantContextSummary = useMemo(
    () =>
      buildAssistantContextSummary({
        activities,
        dashboardAnalytics,
        badges,
        challenges,
        preferences,
      }),
    [activities, dashboardAnalytics, badges, challenges, preferences]
  );

  const assistantSuggestions = useMemo(
    () =>
      buildAssistantSuggestions({
        activities,
        dashboardAnalytics,
        badges,
        preferences,
      }),
    [activities, dashboardAnalytics, badges, preferences]
  );

  const clearAiError = useCallback(() => {
    setAiError(null);
  }, []);

  const sendChatMessage = useCallback(
    async (text: string): Promise<void> => {
      const cleaned = text.trim();
      if (!cleaned) return;
      if (isAiRequestInFlightRef.current) return;

      if (aiRetryAfterSeconds > 0) {
        setAiError(
          `Rate limit cooldown active. Please wait ${aiRetryAfterSeconds}s before trying again.`
        );
        return;
      }

      const activeUserId = session?.user?.id;
      if (!activeUserId) {
        setAiError('Please sign in to chat with the EcoTrack Sustainability Assistant.');
        return;
      }

      if (cleaned.length > MAX_CHAT_PROMPT_CHARS) {
        setAiError(`Messages must be ${MAX_CHAT_PROMPT_CHARS} characters or fewer.`);
        return;
      }

      setAiError(null);
      setLastFailedPrompt(null);

      // Deduplicate immediately preceding failed attempt + error bubble on retry
      const baseHistory = [...chatMessagesRef.current];
      const hasMatchingFailure = baseHistory.some(
        (m) => m.isError && m.failedPrompt === cleaned
      );
      const cleanedHistory = baseHistory.filter((m) => !m.isError);
      if (
        hasMatchingFailure &&
        cleanedHistory.length > 0 &&
        cleanedHistory[cleanedHistory.length - 1].sender === 'user' &&
        cleanedHistory[cleanedHistory.length - 1].text === cleaned
      ) {
        cleanedHistory.pop();
      }

      const userMessage: ChatMessage = {
        id: `msg-user-${Date.now()}`,
        sender: 'user',
        text: cleaned,
        timestamp: formatClockTime(new Date()),
        createdAt: new Date().toISOString(),
      };

      const requestGen = chatGenerationRef.current;
      const optimisticThread = [...cleanedHistory, userMessage];
      setChatMessages(optimisticThread);
      isAiRequestInFlightRef.current = true;
      setIsAiTyping(true);

      try {
        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const result = await sendAssistantPrompt({
          userId: activeUserId,
          prompt: cleaned,
          history: cleanedHistory,
          localDateKey: toLocalDateKey(new Date()),
          timezone,
        });

        // Ignore response if user signed out or cleared chat mid-request
        if (
          chatGenerationRef.current !== requestGen ||
          hydratedUserIdRef.current !== activeUserId
        ) {
          return;
        }

        if (result.quota) {
          setAiQuota(result.quota);
        }

        if (result.ok) {
          const updatedThread = [...optimisticThread, result.message];
          setChatMessages(updatedThread);
          void saveLocalChatCache(activeUserId, updatedThread);
        } else {
          setAiError(result.error);
          setLastFailedPrompt(cleaned);
          if (result.retryAfterSeconds && result.retryAfterSeconds > 0) {
            setAiRetryAfterSeconds(result.retryAfterSeconds);
          }

          const errorBubble: ChatMessage = {
            id: `msg-err-${Date.now()}`,
            sender: 'assistant',
            text: result.error,
            timestamp: formatClockTime(new Date()),
            actionTag:
              result.code === 'RATE_LIMITED' ? 'Rate Limit' : 'Assistant Error',
            isError: true,
            failedPrompt: cleaned,
          };
          setChatMessages([...optimisticThread, errorBubble]);
        }
      } finally {
        isAiRequestInFlightRef.current = false;
        setIsAiTyping(false);
      }
    },
    [aiRetryAfterSeconds, session?.user?.id]
  );

  const retryLastChatMessage = useCallback(async (): Promise<void> => {
    if (!lastFailedPrompt || aiRetryAfterSeconds > 0) return;
    await sendChatMessage(lastFailedPrompt);
  }, [aiRetryAfterSeconds, lastFailedPrompt, sendChatMessage]);

  const clearChat = useCallback(async (): Promise<MutationResult> => {
    chatGenerationRef.current += 1;
    setAiError(null);
    setLastFailedPrompt(null);
    const activeUserId = session?.user?.id;
    const previousMessages = chatMessagesRef.current;
    setChatMessages([]);

    if (!activeUserId) {
      return { ok: true };
    }

    try {
      await clearChatHistory(activeUserId);
      return { ok: true };
    } catch (err) {
      setChatMessages(previousMessages);
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to clear conversation history right now.';
      setAiError(message);
      return { ok: false, error: message };
    }
  }, [session?.user?.id]);

  const isAuthenticated = Boolean(session?.user);

  const value = useMemo<EcoTrackContextValue>(
    () => ({
      isAuthInitializing,
      isDataLoading,
      isAuthenticated,
      isPasswordRecovery,
      session,
      dataError,
      user,
      preferences,
      activityPresets,
      activities,
      challenges,
      badges,
      rewardHistory,
      leaderboard,
      isLeaderboardLoading,
      leaderboardError,
      totalCompletedChallenges,
      sustainabilityProgress,
      lastRewardNotice,
      chatMessages,
      isAiTyping,
      aiError,
      aiQuota,
      aiRetryAfterSeconds,
      assistantContextSummary,
      assistantSuggestions,
      todayEmissionsKg: dashboardAnalytics.dailyGrossKg,
      todayOffsetsKg: dashboardAnalytics.dailyAvoidedKg,
      todayNetKg: dashboardAnalytics.dailyNetKg,
      weeklyNetKg: dashboardAnalytics.weeklyNetKg,
      weeklySeries,
      monthlySeries,
      dashboardAnalytics,
      login,
      register,
      logout,
      requestPasswordReset,
      completePasswordReset,
      clearPasswordRecovery,
      refreshUserData,
      refreshLeaderboard,
      clearLastRewardNotice,
      updateProfileDetails,
      uploadAvatarPhoto,
      removeAvatarPhoto,
      updateDailyBudget,
      togglePreference,
      updatePreferredUnit,
      updateRegionalElectricitySetting,
      completeOnboarding,
      addActivity,
      addActivitiesBatch,
      updateActivity,
      deleteActivity,
      joinChallenge,
      incrementChallengeProgress,
      sendChatMessage,
      retryLastChatMessage,
      clearChat,
      clearAiError,
    }),
    [
      isAuthInitializing,
      isDataLoading,
      isAuthenticated,
      isPasswordRecovery,
      session,
      dataError,
      user,
      preferences,
      activityPresets,
      activities,
      challenges,
      badges,
      rewardHistory,
      leaderboard,
      isLeaderboardLoading,
      leaderboardError,
      totalCompletedChallenges,
      sustainabilityProgress,
      lastRewardNotice,
      chatMessages,
      isAiTyping,
      aiError,
      aiQuota,
      aiRetryAfterSeconds,
      assistantContextSummary,
      assistantSuggestions,
      dashboardAnalytics,
      weeklySeries,
      monthlySeries,
      login,
      register,
      logout,
      requestPasswordReset,
      completePasswordReset,
      clearPasswordRecovery,
      refreshUserData,
      refreshLeaderboard,
      clearLastRewardNotice,
      updateProfileDetails,
      uploadAvatarPhoto,
      removeAvatarPhoto,
      updateDailyBudget,
      togglePreference,
      updatePreferredUnit,
      updateRegionalElectricitySetting,
      completeOnboarding,
      addActivity,
      addActivitiesBatch,
      updateActivity,
      deleteActivity,
      joinChallenge,
      incrementChallengeProgress,
      sendChatMessage,
      retryLastChatMessage,
      clearChat,
      clearAiError,
    ]
  );

  return (
    <EcoTrackContext.Provider value={value}>
      {children}
    </EcoTrackContext.Provider>
  );
}

export function useEcoTrack(): EcoTrackContextValue {
  const ctx = useContext(EcoTrackContext);
  if (!ctx) {
    throw new Error('useEcoTrack must be used inside EcoTrackProvider');
  }
  return ctx;
}
