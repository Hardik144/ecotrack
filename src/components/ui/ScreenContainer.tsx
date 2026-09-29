import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export interface ScreenContainerProps extends PropsWithChildren {
  scrollable?: boolean;
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

/**
 * Standard EcoTrack page shell handling SafeArea, background color,
 * responsive max-width centering, and optional scrolling/keyboard avoidance.
 */
export function ScreenContainer({
  children,
  scrollable = true,
  keyboardAvoiding = false,
  keyboardVerticalOffset = 0,
  refreshing = false,
  onRefresh,
  edges = ['top'],
  contentStyle,
  style,
}: ScreenContainerProps) {
  const { colors, layout } = useTheme();

  const innerContent = (
    <View
      style={[
        styles.inner,
        {
          maxWidth: layout.maxContentWidth,
          paddingHorizontal: layout.screenPaddingHorizontal,
        },
        contentStyle,
      ]}>
      {children}
    </View>
  );

  const body = scrollable ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
      contentContainerStyle={styles.scrollContent}>
      {innerContent}
    </ScrollView>
  ) : (
    <View style={styles.nonScrollBody}>{innerContent}</View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safeArea, { backgroundColor: colors.background }, style]}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          keyboardVerticalOffset={keyboardVerticalOffset}
          behavior={Platform.OS === 'web' ? undefined : 'padding'}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
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
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  nonScrollBody: {
    flex: 1,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    gap: Spacing.lg,
  },
});
