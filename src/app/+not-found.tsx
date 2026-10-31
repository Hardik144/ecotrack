import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Card, ScreenContainer, ThemedText } from '@/components';
import { Radii, Spacing } from '@/constants';
import { useTheme } from '@/hooks';

export default function NotFoundScreen() {
  const { colors } = useTheme();

  return (
    <ScreenContainer scrollable={false}>
      <View style={styles.centerWrap}>
        <Card variant="elevated" padding="lg" style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
            <Ionicons name="compass-outline" size={30} color={colors.primary} />
          </View>
          <ThemedText variant="h2" style={styles.centerText}>
            Screen not found
          </ThemedText>
          <ThemedText
            variant="body"
            color="textSecondary"
            style={styles.centerText}>
            The route you navigated to does not exist yet in EcoTrack.
          </ThemedText>
          <Button
            label="Go to Home"
            variant="primary"
            fullWidth
            leftIcon="home-outline"
            onPress={() => router.replace('/(tabs)')}
          />
        </Card>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: Radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
});
