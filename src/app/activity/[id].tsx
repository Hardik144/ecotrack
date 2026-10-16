import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  OptionPillGroup,
  ScreenContainer,
  ThemedText,
} from '@/components';
import { ACTIVITY_CATEGORIES, Spacing } from '@/constants';
import { useEcoTrack } from '@/context';
import { useTheme } from '@/hooks';
import type { ActivityCategory, ImpactDirection } from '@/types';
import {
  applyEmissionFormula,
  formatCarbonKg,
  formatFactorDisplay,
  formatShortDate,
  toLocalDateKey,
  validateActivityDateInput,
} from '@/utils';

export default function ActivityDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { activities, updateActivity, deleteActivity } = useEcoTrack();

  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [categoryDraft, setCategoryDraft] = useState<ActivityCategory>('transport');
  const [directionDraft, setDirectionDraft] = useState<ImpactDirection>('emission');
  const [quantityDraft, setQuantityDraft] = useState('');
  const [manualEmissionsDraft, setManualEmissionsDraft] = useState('');
  const [dateDraft, setDateDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const activity = activities.find((item) => item.id === id);

  if (!activity) {
    return (
      <ScreenContainer edges={['bottom']}>
        <EmptyState
          icon="document-text-outline"
          title="Activity not found"
          description="This footprint entry may have been removed or cleared."
          actionLabel="Back to Dashboard"
          onActionPress={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  const categoryMeta = ACTIVITY_CATEGORIES.find(
    (item) => item.key === activity.category
  );

  const hasUnitFactor =
    activity.emissionFactorKg !== null && activity.emissionFactorKg !== undefined;

  const parsedQtyDraft = Number(quantityDraft);
  const previewEmissionsKg =
    hasUnitFactor && Number.isFinite(parsedQtyDraft) && parsedQtyDraft > 0
      ? applyEmissionFormula(parsedQtyDraft, activity.emissionFactorKg!)
      : Number(manualEmissionsDraft);

  const startEditing = () => {
    setTitleDraft(activity.title);
    setCategoryDraft(activity.category);
    setDirectionDraft(activity.direction);
    setQuantityDraft(
      activity.quantity !== undefined ? String(activity.quantity) : '1'
    );
    setManualEmissionsDraft(String(activity.emissionsKg));
    setDateDraft(toLocalDateKey(activity.occurredAt));
    setNotesDraft(activity.notes ?? '');
    setActionError(null);
    setActionNotice(null);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setActionError(null);
    setActionNotice(null);

    const parsedQty = Number(quantityDraft);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setActionError('Enter a valid quantity greater than 0.');
      return;
    }

    const nextEmissionsKg = hasUnitFactor
      ? applyEmissionFormula(parsedQty, activity.emissionFactorKg!)
      : Number(manualEmissionsDraft);

    if (!Number.isFinite(nextEmissionsKg) || nextEmissionsKg < 0) {
      setActionError('Enter a valid non-negative CO₂e amount.');
      return;
    }

    const dateCheck = validateActivityDateInput(dateDraft);
    if (!dateCheck.ok || !dateCheck.value) {
      setActionError(dateCheck.error ?? 'Enter a valid date (YYYY-MM-DD).');
      return;
    }

    setIsSaving(true);
    const result = await updateActivity(activity.id, {
      activityId: activity.activityId,
      title: titleDraft,
      category: categoryDraft,
      direction: directionDraft,
      quantity: parsedQty,
      unitLabel: activity.unitLabel ?? 'unit',
      emissionsKg: nextEmissionsKg,
      emissionFactorKg: activity.emissionFactorKg ?? null,
      regionCode: activity.regionCode ?? null,
      methodologySource: activity.methodologySource ?? null,
      assumptions: hasUnitFactor
        ? `${parsedQty} ${activity.unitLabel ?? 'units'} × ${formatFactorDisplay(activity.emissionFactorKg!)} kg CO₂e/${activity.unitLabel ?? 'unit'} = ${nextEmissionsKg.toFixed(3)} kg CO₂e`
        : activity.assumptions ?? null,
      notes: notesDraft.trim() || undefined,
      occurredAt: dateCheck.value,
    });
    setIsSaving(false);

    if (!result.ok) {
      setActionError(result.error ?? 'Unable to update activity.');
      return;
    }

    setIsEditing(false);
    setActionNotice('Activity updated and analytics refreshed.');
  };

  const handleDelete = async () => {
    setActionError(null);
    setIsDeleting(true);
    const result = await deleteActivity(activity.id);
    setIsDeleting(false);

    if (!result.ok) {
      setActionError(result.error ?? 'Unable to remove this entry.');
      return;
    }

    router.back();
  };

  return (
    <ScreenContainer
      edges={['bottom']}
      keyboardAvoiding
      keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 0}>
      <Animated.View entering={FadeInDown.duration(260)} style={styles.stack}>
        <Card variant="elevated" padding="lg" style={styles.card}>
          <View style={styles.badgeRow}>
            <Badge
              label={categoryMeta?.label ?? activity.category}
              tone="secondary"
              icon={categoryMeta?.icon}
            />
            <Badge
              label={activity.direction === 'offset' ? 'Eco Offset' : 'Emission'}
              tone={activity.direction === 'offset' ? 'success' : 'neutral'}
            />
          </View>

          <ThemedText variant="h1">{activity.title}</ThemedText>
          <ThemedText variant="display" color="primary">
            {activity.direction === 'offset' ? '-' : ''}
            {formatCarbonKg(activity.emissionsKg)}
          </ThemedText>

          <View style={[styles.metaGrid, { borderTopColor: colors.border }]}>
            <View style={styles.metaItem}>
              <ThemedText variant="caption" color="textMuted">
                Date
              </ThemedText>
              <ThemedText variant="bodyMedium">
                {formatShortDate(activity.occurredAt)}
              </ThemedText>
            </View>

            {activity.quantity ? (
              <View style={styles.metaItem}>
                <ThemedText variant="caption" color="textMuted">
                  Quantity
                </ThemedText>
                <ThemedText variant="bodyMedium">
                  {activity.quantity} {activity.unitLabel ?? 'units'}
                </ThemedText>
              </View>
            ) : null}

            {activity.emissionFactorKg !== null &&
            activity.emissionFactorKg !== undefined ? (
              <View style={styles.metaItem}>
                <ThemedText variant="caption" color="textMuted">
                  Emission Factor
                </ThemedText>
                <ThemedText variant="bodyMedium">
                  {formatFactorDisplay(activity.emissionFactorKg)} kg/
                  {activity.unitLabel ?? 'unit'}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {activity.methodologySource || activity.assumptions || activity.regionCode ? (
            <Card variant="outlined" padding="md" style={styles.notesCard}>
              <ThemedText variant="label" color="primary">
                Calculation Audit & Sources
              </ThemedText>
              {activity.regionCode ? (
                <ThemedText variant="caption" color="textSecondary">
                  Regional Grid: {activity.regionCode.toUpperCase()}
                </ThemedText>
              ) : null}
              {activity.assumptions ? (
                <ThemedText variant="caption" color="textSecondary">
                  {activity.assumptions}
                </ThemedText>
              ) : null}
              {activity.methodologySource ? (
                <ThemedText variant="caption" color="textMuted">
                  Source: {activity.methodologySource}
                </ThemedText>
              ) : null}
            </Card>
          ) : null}

          {activity.notes ? (
            <Card variant="mint" padding="md" style={styles.notesCard}>
              <ThemedText variant="label" color="primary">
                Notes
              </ThemedText>
              <ThemedText variant="body" color="textSecondary">
                {activity.notes}
              </ThemedText>
            </Card>
          ) : null}
        </Card>

        {actionNotice ? (
          <Card
            variant="mint"
            padding="md"
            style={styles.feedbackCard}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <ThemedText variant="caption" color="success" style={styles.errorText}>
              {actionNotice}
            </ThemedText>
          </Card>
        ) : null}

        {isEditing ? (
          <Card variant="elevated" padding="lg" style={styles.card}>
            <ThemedText variant="h3">Modify Activity Record</ThemedText>

            <Input
              label="Activity Title"
              value={titleDraft}
              onChangeText={setTitleDraft}
              placeholder="e.g. City bus commute"
            />

            <OptionPillGroup
              label="Category"
              selectedKey={categoryDraft}
              onSelect={setCategoryDraft}
              items={ACTIVITY_CATEGORIES.map((cat) => ({
                key: cat.key,
                label: cat.shortLabel,
              }))}
            />

            <OptionPillGroup
              label="Impact Type"
              selectedKey={directionDraft}
              onSelect={setDirectionDraft}
              items={[
                { key: 'emission', label: 'Emission (+)' },
                { key: 'offset', label: 'Eco Offset (-)' },
              ]}
            />

            <Input
              label={`Quantity (${activity.unitLabel ?? 'unit'})`}
              value={quantityDraft}
              onChangeText={setQuantityDraft}
              keyboardType="decimal-pad"
            />

            {hasUnitFactor ? (
              <ThemedText variant="caption" color="primary">
                Recalculated Impact:{' '}
                {Number.isFinite(previewEmissionsKg)
                  ? formatCarbonKg(previewEmissionsKg)
                  : '--'}{' '}
                ({formatFactorDisplay(activity.emissionFactorKg!)} kg/
                {activity.unitLabel ?? 'unit'})
              </ThemedText>
            ) : (
              <Input
                label="CO₂e Amount (kg)"
                value={manualEmissionsDraft}
                onChangeText={setManualEmissionsDraft}
                keyboardType="decimal-pad"
              />
            )}

            <Input
              label="Local Date (YYYY-MM-DD)"
              value={dateDraft}
              onChangeText={setDateDraft}
              placeholder="2026-11-15"
              autoCapitalize="none"
            />

            <Input
              label="Notes (Optional)"
              value={notesDraft}
              onChangeText={setNotesDraft}
              multiline
              numberOfLines={3}
            />

            <View style={styles.editActions}>
              <Button
                label="Save Changes"
                variant="primary"
                loading={isSaving}
                leftIcon="checkmark-circle-outline"
                onPress={() => {
                  void handleSaveEdit();
                }}
              />
              <Button
                label="Cancel Edit"
                variant="secondary"
                onPress={() => {
                  setActionError(null);
                  setIsEditing(false);
                }}
              />
            </View>
          </Card>
        ) : null}

        {actionError ? (
          <Card
            variant="outlined"
            padding="md"
            style={[styles.feedbackCard, { borderColor: colors.error }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <ThemedText variant="caption" color="error" style={styles.errorText}>
              {actionError}
            </ThemedText>
          </Card>
        ) : null}

        <View style={styles.actions}>
          {!isEditing ? (
            <Button
              label="Modify Entry"
              variant="primary"
              leftIcon="create-outline"
              onPress={startEditing}
            />
          ) : null}
          <Button
            label="Back to Dashboard"
            variant="secondary"
            leftIcon="arrow-back"
            onPress={() => router.back()}
          />
          <Button
            label="Remove Entry"
            variant="outline"
            loading={isDeleting}
            leftIcon="trash-outline"
            style={{ borderColor: colors.error }}
            onPress={() => {
              void handleDelete();
            }}
          />
        </View>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  card: {
    gap: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  metaItem: {
    gap: Spacing.xxs,
  },
  notesCard: {
    gap: Spacing.xs,
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
  },
  editActions: {
    gap: Spacing.sm,
  },
  actions: {
    gap: Spacing.sm,
  },
});
