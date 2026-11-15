import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Badge,
  Card,
  EmptyState,
  LoadingState,
  ThemedText,
} from '@/components';
import { Radii, Spacing } from '@/constants';
import { useEcoTrack } from '@/context';
import { useAppConfig, useTheme } from '@/hooks';
import { MAX_CHAT_PROMPT_CHARS } from '@/services';
import { hasExposedGeminiApiKeyInEnv } from '@/utils/env';

export default function AiAssistantScreen() {
  const { colors, layout, shadows } = useTheme();
  const { geminiConfigured } = useAppConfig();
  const {
    chatMessages,
    isAiTyping,
    aiError,
    aiQuota,
    aiRetryAfterSeconds,
    assistantContextSummary,
    assistantSuggestions,
    sendChatMessage,
    retryLastChatMessage,
    clearChat,
    clearAiError,
  } = useEcoTrack();

  const [draft, setDraft] = useState('');
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const exposedClientKey = hasExposedGeminiApiKeyInEnv();
  const isBusy = isAiTyping || isClearing;
  const isSendBlocked = isBusy || aiRetryAfterSeconds > 0;

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [chatMessages.length, isAiTyping]);

  const handleSend = (textOverride?: string) => {
    const content = (textOverride ?? draft).trim();
    if (!content || isSendBlocked) return;
    if (!textOverride) {
      setDraft('');
    }
    setConfirmingClear(false);
    void sendChatMessage(content);
  };

  const handleConfirmClear = async () => {
    if (isClearing) return;
    setIsClearing(true);
    try {
      await clearChat();
      setConfirmingClear(false);
    } finally {
      setIsClearing(false);
    }
  };

  const statusConfig = (() => {
    if (exposedClientKey) {
      return {
        dotColor: colors.error,
        label: 'Security Alert • Remove Client Key',
      };
    }
    if (isAiTyping) {
      return {
        dotColor: colors.primary,
        label: 'Analyzing records with Gemini AI...',
      };
    }
    if (aiRetryAfterSeconds > 0) {
      return {
        dotColor: colors.warning,
        label: `Rate limit cooldown • Wait ${aiRetryAfterSeconds}s`,
      };
    }
    if (!geminiConfigured) {
      return {
        dotColor: colors.warning,
        label: 'Backend AI Endpoint Setup Needed',
      };
    }
    return {
      dotColor: colors.success,
      label: 'Gemini AI • Deterministic Calculator',
    };
  })();

  const samplePrompt = assistantSuggestions[0] ?? 'Analyze my recent carbon activities';

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <View
          style={[
            styles.pageWrapper,
            { maxWidth: layout.maxContentWidth },
          ]}>
          {/* Header */}
          <View
            style={[
              styles.headerBar,
              {
                borderBottomColor: colors.border,
                paddingHorizontal: layout.screenPaddingHorizontal,
              },
            ]}>
            <View style={styles.headerLeft}>
              <View
                style={[styles.aiAvatar, { backgroundColor: colors.primary }]}>
                <Ionicons
                  name="sparkles"
                  size={18}
                  color={colors.textOnPrimary}
                />
              </View>
              <View style={styles.headerTitleCol}>
                <ThemedText variant="h3">EcoTrack AI Assistant</ThemedText>
                <View style={styles.statusInline}>
                  <View
                    style={[
                      styles.onlineDot,
                      { backgroundColor: statusConfig.dotColor },
                    ]}
                  />
                  <ThemedText variant="caption" color="textMuted" numberOfLines={1}>
                    {statusConfig.label}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.headerActions}>
              {aiQuota ? (
                <Badge
                  label={`${aiQuota.remainingDaily}/${aiQuota.dailyLimit} left`}
                  tone={aiQuota.remainingDaily <= 10 ? 'warning' : 'neutral'}
                />
              ) : null}

              {chatMessages.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear conversation"
                  disabled={isBusy}
                  hitSlop={8}
                  onPress={() => setConfirmingClear((prev) => !prev)}
                  style={[
                    styles.clearBtn,
                    {
                      backgroundColor: confirmingClear
                        ? colors.errorSoft
                        : colors.surface,
                      borderColor: confirmingClear
                        ? colors.error
                        : colors.border,
                    },
                  ]}>
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={confirmingClear ? colors.error : colors.textSecondary}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Inline Clear Confirmation Bar */}
          {confirmingClear ? (
            <View
              style={[
                styles.confirmBar,
                {
                  backgroundColor: colors.errorSoft,
                  borderBottomColor: colors.border,
                  paddingHorizontal: layout.screenPaddingHorizontal,
                },
              ]}>
              <ThemedText
                variant="caption"
                style={{ color: colors.error, flex: 1 }}>
                Clear your AI conversation history?
              </ThemedText>
              <View style={styles.confirmBtnRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmingClear(false)}
                  style={[
                    styles.confirmActionBtn,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}>
                  <ThemedText variant="caption" color="textSecondary">
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isClearing}
                  onPress={() => void handleConfirmClear()}
                  style={[
                    styles.confirmActionBtn,
                    {
                      backgroundColor: colors.error,
                      borderColor: colors.error,
                    },
                  ]}>
                  <ThemedText variant="caption" color="textOnPrimary">
                    {isClearing ? 'Clearing...' : 'Clear'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Personalized Context Dossier Bar */}
          <View
            style={[
              styles.dossierBar,
              {
                backgroundColor: colors.surfaceMuted,
                borderBottomColor: colors.border,
                paddingHorizontal: layout.screenPaddingHorizontal,
              },
            ]}>
            <View style={styles.dossierLeft}>
              <Ionicons
                name="analytics-outline"
                size={14}
                color={colors.primary}
              />
              <ThemedText variant="caption" color="textSecondary" numberOfLines={1} style={styles.dossierText}>
                {assistantContextSummary.totalRecords > 0
                  ? `${assistantContextSummary.totalRecords} logs · Top: ${assistantContextSummary.topCategoryLabel} · Score ${assistantContextSummary.sustainabilityScore}/100 · ${assistantContextSummary.regionShortLabel} grid`
                  : `0 logs yet · Grid: ${assistantContextSummary.regionShortLabel} · Score ${assistantContextSummary.sustainabilityScore}/100`}
              </ThemedText>
            </View>
            {assistantContextSummary.totalRecords === 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(tabs)/calculate')}
                style={[
                  styles.logQuickBtn,
                  { backgroundColor: colors.secondary },
                ]}>
                <ThemedText variant="caption" style={{ color: colors.primary }}>
                  Log Entry
                </ThemedText>
              </Pressable>
            ) : (
              <Badge
                label={`${assistantContextSummary.earnedBadgesCount}/${assistantContextSummary.totalBadgesCount} badges`}
                tone="secondary"
              />
            )}
          </View>

          {/* Error Banner */}
          {aiError ? (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: colors.errorSoft,
                  borderBottomColor: colors.border,
                  paddingHorizontal: layout.screenPaddingHorizontal,
                },
              ]}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={colors.error}
              />
              <ThemedText
                variant="caption"
                style={[styles.errorBannerText, { color: colors.error }]}>
                {aiError}
              </ThemedText>
              <View style={styles.errorActions}>
                {aiRetryAfterSeconds === 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSendBlocked}
                    onPress={() => void retryLastChatMessage()}
                    style={[
                      styles.errorActionPill,
                      { backgroundColor: colors.surface, borderColor: colors.error },
                    ]}>
                    <ThemedText variant="caption" style={{ color: colors.error }}>
                      Retry
                    </ThemedText>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss error"
                  hitSlop={8}
                  onPress={clearAiError}>
                  <Ionicons name="close" size={16} color={colors.error} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={[
              styles.messagesContent,
              { paddingHorizontal: layout.screenPaddingHorizontal },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {chatMessages.length === 0 ? (
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon="sparkles-outline"
                  title="Start a sustainability conversation"
                  description="Ask EcoTrack AI to analyze your emissions, explain sustainability concepts, or run commute, electricity, and meal calculations using verified factors."
                  actionLabel="Ask Sample Question"
                  onActionPress={() => handleSend(samplePrompt)}
                />
              </View>
            ) : (
              chatMessages.map((message) => {
                const isUser = message.sender === 'user';
                const isErrorBubble = Boolean(message.isError);

                return (
                  <Animated.View
                    key={message.id}
                    entering={FadeInUp.duration(220)}
                    style={[
                      styles.bubbleRow,
                      isUser ? styles.bubbleRowUser : styles.bubbleRowAi,
                    ]}>
                    {!isUser ? (
                      <View
                        style={[
                          styles.smallAiBadge,
                          {
                            backgroundColor: isErrorBubble
                              ? colors.errorSoft
                              : colors.secondary,
                          },
                        ]}>
                        <Ionicons
                          name={isErrorBubble ? 'warning-outline' : 'leaf'}
                          size={14}
                          color={isErrorBubble ? colors.error : colors.primary}
                        />
                      </View>
                    ) : null}

                    <View
                      style={[
                        styles.bubble,
                        isUser
                          ? {
                              backgroundColor: colors.primary,
                              borderBottomRightRadius: Radii.xs,
                            }
                          : isErrorBubble
                            ? {
                                backgroundColor: colors.errorSoft,
                                borderColor: colors.error,
                                borderWidth: 1,
                                borderBottomLeftRadius: Radii.xs,
                              }
                            : {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                                borderWidth: 1,
                                borderBottomLeftRadius: Radii.xs,
                                ...shadows.sm,
                              },
                      ]}>
                      {!isUser && message.actionTag ? (
                        <View style={styles.bubbleMetaRow}>
                          <Badge
                            label={message.actionTag}
                            tone={isErrorBubble ? 'error' : 'secondary'}
                          />
                          {!isErrorBubble && message.estimatedSavingsKg ? (
                            <Badge
                              label={`-${message.estimatedSavingsKg.toFixed(1)} kg CO₂e`}
                              tone="success"
                            />
                          ) : null}
                        </View>
                      ) : null}

                      <ThemedText
                        variant="body"
                        style={{
                          color: isUser
                            ? colors.textOnPrimary
                            : isErrorBubble
                              ? colors.error
                              : colors.text,
                        }}>
                        {message.text}
                      </ThemedText>

                      {/* Verified Deterministic Calculation Citations */}
                      {!isUser &&
                      !isErrorBubble &&
                      message.calculations &&
                      message.calculations.length > 0 ? (
                        <View
                          style={[
                            styles.calcCardList,
                            {
                              backgroundColor: colors.surfaceElevated,
                              borderColor: colors.border,
                            },
                          ]}>
                          <View style={styles.calcHeaderRow}>
                            <Ionicons
                              name="calculator-outline"
                              size={13}
                              color={colors.primary}
                            />
                            <ThemedText
                              variant="caption"
                              style={{ color: colors.primary, fontWeight: '600' }}>
                              Verified Calculation Engine
                            </ThemedText>
                          </View>

                          {message.calculations.map((calc, index) => {
                            const isSavings =
                              calc.direction === 'offset' ||
                              calc.direction === 'savings';
                            return (
                              <View
                                key={`${calc.label}-${index}`}
                                style={[
                                  styles.calcRow,
                                  index > 0 && {
                                    borderTopColor: colors.border,
                                    borderTopWidth: StyleSheet.hairlineWidth,
                                    paddingTop: Spacing.xs,
                                  },
                                ]}>
                                <View style={styles.calcTitleRow}>
                                  <ThemedText
                                    variant="caption"
                                    style={{
                                      color: colors.text,
                                      fontWeight: '600',
                                      flex: 1,
                                    }}>
                                    {calc.label}
                                  </ThemedText>
                                  <ThemedText
                                    variant="caption"
                                    style={{
                                      color: isSavings
                                        ? colors.success
                                        : colors.primary,
                                      fontWeight: '700',
                                    }}>
                                    {isSavings ? '-' : ''}
                                    {Math.abs(calc.resultKg).toFixed(2)} kg CO₂e
                                  </ThemedText>
                                </View>
                                <ThemedText variant="caption" color="textSecondary">
                                  {calc.formula}
                                </ThemedText>
                                <ThemedText variant="caption" color="textMuted">
                                  Source: {calc.source}
                                </ThemedText>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}

                      {/* Inline Follow-Up Suggestions */}
                      {!isUser &&
                      !isErrorBubble &&
                      message.suggestedFollowUps &&
                      message.suggestedFollowUps.length > 0 ? (
                        <View style={styles.followUpsWrap}>
                          {message.suggestedFollowUps.map((followUp) => (
                            <Pressable
                              key={followUp}
                              accessibilityRole="button"
                              disabled={isSendBlocked}
                              onPress={() => handleSend(followUp)}
                              style={({ pressed }) => [
                                styles.followUpChip,
                                {
                                  backgroundColor: pressed
                                    ? colors.secondaryPressed
                                    : colors.surfaceMuted,
                                  borderColor: colors.border,
                                  opacity: isSendBlocked ? 0.55 : 1,
                                },
                              ]}>
                              <ThemedText
                                variant="caption"
                                style={{ color: colors.primary }}>
                                {followUp}
                              </ThemedText>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}

                      {/* Retry Failed Question Button */}
                      {isErrorBubble && message.failedPrompt ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={isSendBlocked}
                          onPress={() => handleSend(message.failedPrompt)}
                          style={[
                            styles.retryBubbleBtn,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.error,
                              opacity: isSendBlocked ? 0.55 : 1,
                            },
                          ]}>
                          <Ionicons
                            name="refresh"
                            size={13}
                            color={colors.error}
                          />
                          <ThemedText variant="caption" style={{ color: colors.error }}>
                            {aiRetryAfterSeconds > 0
                              ? `Retry in ${aiRetryAfterSeconds}s`
                              : 'Retry Question'}
                          </ThemedText>
                        </Pressable>
                      ) : null}

                      <View style={styles.timestampRow}>
                        {!isUser && message.modelUsed ? (
                          <ThemedText variant="caption" color="textMuted">
                            {message.modelUsed}
                          </ThemedText>
                        ) : null}
                        <ThemedText
                          variant="caption"
                          style={[
                            styles.timestamp,
                            {
                              color: isUser
                                ? 'rgba(255, 255, 255, 0.78)'
                                : colors.textMuted,
                            },
                          ]}>
                          {message.timestamp}
                        </ThemedText>
                      </View>
                    </View>
                  </Animated.View>
                );
              })
            )}

            {isAiTyping ? (
              <View style={[styles.bubbleRow, styles.bubbleRowAi]}>
                <View
                  style={[
                    styles.smallAiBadge,
                    { backgroundColor: colors.secondary },
                  ]}>
                  <Ionicons name="leaf" size={14} color={colors.primary} />
                </View>
                <Card variant="outlined" padding="sm" style={styles.typingCard}>
                  <LoadingState
                    compact
                    label="Checking carbon records & calculating..."
                  />
                </Card>
              </View>
            ) : null}
          </ScrollView>

          {/* Composer & Personalized Suggested Questions */}
          <View
            style={[
              styles.composerArea,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.suggestionsRow,
                { paddingHorizontal: layout.screenPaddingHorizontal },
              ]}>
              {assistantSuggestions.map((prompt) => (
                <Pressable
                  key={prompt}
                  accessibilityRole="button"
                  disabled={isSendBlocked}
                  onPress={() => handleSend(prompt)}
                  style={({ pressed }) => [
                    styles.suggestionChip,
                    {
                      backgroundColor: pressed
                        ? colors.secondaryPressed
                        : colors.surface,
                      borderColor: colors.border,
                      opacity: isSendBlocked ? 0.55 : 1,
                    },
                  ]}>
                  <Ionicons
                    name="sparkles-outline"
                    size={13}
                    color={colors.primary}
                  />
                  <ThemedText variant="caption" color="textSecondary">
                    {prompt}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <View
              style={[
                styles.inputBarWrap,
                { paddingHorizontal: layout.screenPaddingHorizontal },
              ]}>
              <View
                style={[
                  styles.inputShell,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}>
                <TextInput
                  placeholder={
                    aiRetryAfterSeconds > 0
                      ? `Wait ${aiRetryAfterSeconds}s before sending another question...`
                      : 'Ask about your emissions, transit, energy, meals...'
                  }
                  placeholderTextColor={colors.textMuted}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  maxLength={MAX_CHAT_PROMPT_CHARS}
                  style={[styles.textInput, { color: colors.text }]}
                />

                {draft.length > 750 ? (
                  <ThemedText
                    variant="caption"
                    style={{
                      color:
                        draft.length >= MAX_CHAT_PROMPT_CHARS
                          ? colors.warning
                          : colors.textMuted,
                      marginBottom: Spacing.xs,
                    }}>
                    {draft.length}/{MAX_CHAT_PROMPT_CHARS}
                  </ThemedText>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  disabled={!draft.trim() || isSendBlocked}
                  onPress={() => handleSend()}
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor:
                        draft.trim() && !isSendBlocked
                          ? colors.primary
                          : colors.surfaceElevated,
                    },
                  ]}>
                  {aiRetryAfterSeconds > 0 ? (
                    <ThemedText variant="caption" color="textMuted">
                      {aiRetryAfterSeconds}
                    </ThemedText>
                  ) : (
                    <Ionicons
                      name="arrow-up"
                      size={18}
                      color={
                        draft.trim() && !isSendBlocked
                          ? colors.textOnPrimary
                          : colors.textMuted
                      }
                    />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  pageWrapper: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  aiAvatar: {
    width: 38,
    height: 38,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: Radii.pill,
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  confirmActionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  dossierBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  dossierLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  dossierText: {
    flex: 1,
  },
  logQuickBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs + 1,
    borderRadius: Radii.pill,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  errorBannerText: {
    flex: 1,
  },
  errorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorActionPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs + 1,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    paddingVertical: Spacing.base,
    gap: Spacing.md,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAi: {
    justifyContent: 'flex-start',
  },
  smallAiBadge: {
    width: 28,
    height: 28,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxs,
  },
  bubble: {
    maxWidth: '84%',
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  bubbleMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.xxs,
  },
  calcCardList: {
    marginTop: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  calcHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  calcRow: {
    gap: 2,
  },
  calcTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  followUpsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  followUpChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs + 2,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  retryBubbleBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.pill,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xxs,
  },
  timestamp: {
    fontSize: 11,
  },
  typingCard: {
    borderRadius: Radii.lg,
  },
  composerArea: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  suggestionsRow: {
    gap: Spacing.sm,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  inputBarWrap: {
    width: '100%',
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: Radii.xl,
    borderWidth: 1,
    paddingLeft: Spacing.base,
    paddingRight: Spacing.xs + 2,
    paddingVertical: Spacing.xs + 2,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 96,
    paddingVertical: Spacing.xs + 2,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
