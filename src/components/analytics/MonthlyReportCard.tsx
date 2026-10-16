import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { ProgressBar } from '@/components/common/PlaceholderNotice';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ThemedText } from '@/components/ui/ThemedText';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { CarbonActivity, MonthlyReport } from '@/types/carbon';
import {
  formatActivitiesCsv,
  formatMonthlyReportText,
} from '@/utils/analyticsEngine';
import { formatCarbonKg } from '@/utils/formatters';
import { getCategoryMeta } from './chartHelpers';

export interface MonthlyReportCardProps {
  report: MonthlyReport;
  monthRecords: CarbonActivity[];
  userName: string;
  canStepBack: boolean;
  canStepForward: boolean;
  onStepMonth: (deltaMonths: -1 | 1) => void;
}

function downloadTextOnWeb(filename: string, content: string, mime: string): boolean {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') {
    return false;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Monthly Sustainability Report card with month navigation and share/CSV export.
 */
export const MonthlyReportCard = memo(function MonthlyReportCard({
  report,
  monthRecords,
  userName,
  canStepBack,
  canStepForward,
  onStepMonth,
}: MonthlyReportCardProps) {
  const { colors } = useTheme();
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const handleShareSummary = async () => {
    setExportStatus(null);
    const text = formatMonthlyReportText(report, userName);
    try {
      if (Platform.OS === 'web') {
        const downloaded = downloadTextOnWeb(
          `ecotrack-report-${report.monthKey}.txt`,
          text,
          'text/plain;charset=utf-8'
        );
        setExportStatus(
          downloaded
            ? `Downloaded ecotrack-report-${report.monthKey}.txt`
            : 'Report ready.'
        );
        return;
      }

      await Share.share({
        title: `EcoTrack Report — ${report.monthLabel}`,
        message: text,
      });
      setExportStatus('Monthly sustainability report shared.');
    } catch (err) {
      setExportStatus(
        err instanceof Error ? err.message : 'Unable to share report.'
      );
    }
  };

  const handleExportCsv = async () => {
    setExportStatus(null);
    const csv = formatActivitiesCsv(monthRecords);
    try {
      if (Platform.OS === 'web') {
        const downloaded = downloadTextOnWeb(
          `ecotrack-activities-${report.monthKey}.csv`,
          csv,
          'text/csv;charset=utf-8'
        );
        setExportStatus(
          downloaded
            ? `Downloaded ecotrack-activities-${report.monthKey}.csv`
            : 'CSV ready.'
        );
        return;
      }

      await Share.share({
        title: `EcoTrack CSV — ${report.monthLabel}`,
        message: csv,
      });
      setExportStatus('CSV activity export ready.');
    } catch (err) {
      setExportStatus(
        err instanceof Error ? err.message : 'Unable to export CSV.'
      );
    }
  };

  const momLabel =
    report.monthOverMonthDeltaKg === null
      ? 'No prior month data'
      : `${report.monthOverMonthDeltaKg > 0 ? '+' : ''}${report.monthOverMonthDeltaKg.toFixed(1)} kg (${
          report.monthOverMonthDeltaPct !== null
            ? `${report.monthOverMonthDeltaPct > 0 ? '+' : ''}${report.monthOverMonthDeltaPct}%`
            : '—'
        })`;

  return (
    <Card variant="elevated" padding="lg" style={styles.card}>
      <View style={styles.switcherRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month report"
          disabled={!canStepBack}
          onPress={() => onStepMonth(-1)}
          style={[
            styles.navBtn,
            {
              backgroundColor: colors.surfaceElevated,
              opacity: canStepBack ? 1 : 0.4,
            },
          ]}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
        </Pressable>

        <View style={styles.monthTitleWrap}>
          <ThemedText variant="h3">{report.monthLabel}</ThemedText>
          <ThemedText variant="caption" color="textMuted">
            {report.totalRecords} records • {report.loggedDays} active days
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month report"
          disabled={!canStepForward}
          onPress={() => onStepMonth(1)}
          style={[
            styles.navBtn,
            {
              backgroundColor: colors.surfaceElevated,
              opacity: canStepForward ? 1 : 0.4,
            },
          ]}>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {report.totalRecords === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title={`No logs recorded for ${report.monthLabel}`}
          description="Step to another month or log a carbon activity to generate a monthly sustainability statement."
        />
      ) : (
        <>
          <View style={styles.scoreRow}>
            <View
              style={[
                styles.gradeBadge,
                { backgroundColor: colors.secondary },
              ]}>
              <ThemedText variant="caption" color="primary">
                GRADE
              </ThemedText>
              <ThemedText variant="h1" color="primary">
                {report.grade}
              </ThemedText>
            </View>
            <View style={styles.scoreMeta}>
              <ThemedText variant="label" color="textMuted">
                MONTHLY NET FOOTPRINT
              </ThemedText>
              <ThemedText variant="h2" color="primary">
                {formatCarbonKg(report.netEmissionsKg)}
              </ThemedText>
              <ThemedText variant="caption" color="textSecondary">
                Score {report.sustainabilityScore}/100 • {report.daysWithinBudget}/
                {report.loggedDays} active days within target
              </ThemedText>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View
              style={[
                styles.gridItem,
                { backgroundColor: colors.surfaceElevated },
              ]}>
              <ThemedText variant="caption" color="textMuted">
                Gross Emissions
              </ThemedText>
              <ThemedText variant="bodyMedium">
                {formatCarbonKg(report.grossEmissionsKg)}
              </ThemedText>
            </View>
            <View
              style={[
                styles.gridItem,
                { backgroundColor: colors.surfaceElevated },
              ]}>
              <ThemedText variant="caption" color="textMuted">
                Avoided Offsets
              </ThemedText>
              <ThemedText variant="bodyMedium" color="success">
                -{formatCarbonKg(report.estimatedAvoidedKg)}
              </ThemedText>
            </View>
            <View
              style={[
                styles.gridItem,
                { backgroundColor: colors.surfaceElevated },
              ]}>
              <ThemedText variant="caption" color="textMuted">
                Logged Day Avg
              </ThemedText>
              <ThemedText variant="bodyMedium">
                {report.loggedDayAverageNetKg.toFixed(2)} kg/d
              </ThemedText>
            </View>
            <View
              style={[
                styles.gridItem,
                { backgroundColor: colors.surfaceElevated },
              ]}>
              <ThemedText variant="caption" color="textMuted">
                vs Prior Month
              </ThemedText>
              <ThemedText variant="bodyMedium">{momLabel}</ThemedText>
            </View>
          </View>

          {report.highestCategory ? (
            <View style={styles.categorySection}>
              <ThemedText variant="label" color="primary">
                Top Driver: {getCategoryMeta(report.highestCategory.category).label} (
                {report.highestCategory.sharePct.toFixed(0)}%)
              </ThemedText>
              {report.categories
                .filter((c) => c.grossKg > 0 || c.offsetsKg > 0)
                .map((cat) => {
                  const meta = getCategoryMeta(cat.category);
                  return (
                    <View key={cat.category} style={styles.catBarRow}>
                      <View style={styles.catBarHeader}>
                        <ThemedText variant="caption" color="textSecondary">
                          {meta.shortLabel}
                        </ThemedText>
                        <ThemedText variant="caption" color="text">
                          {cat.grossKg.toFixed(1)} kg ({cat.sharePct.toFixed(0)}%)
                        </ThemedText>
                      </View>
                      <ProgressBar progress={cat.sharePct / 100} height={6} />
                    </View>
                  );
                })}
            </View>
          ) : null}

          {report.topEmitters.length > 0 ? (
            <View
              style={[
                styles.emittersBox,
                { borderTopColor: colors.border },
              ]}>
              <ThemedText variant="label" color="textMuted">
                HIGHEST-EMISSION LOGS IN {report.monthLabel.toUpperCase()}
              </ThemedText>
              {report.topEmitters.map((item) => (
                <View key={item.id} style={styles.emitterRow}>
                  <ThemedText
                    variant="caption"
                    color="text"
                    numberOfLines={1}
                    style={styles.emitterTitle}>
                    • {item.title}
                  </ThemedText>
                  <Badge
                    label={`${item.emissionsKg.toFixed(2)} kg`}
                    tone="secondary"
                  />
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.exportRow}>
            <View style={styles.exportBtnWrap}>
              <Button
                label="Share Report"
                size="sm"
                variant="primary"
                fullWidth
                leftIcon="share-outline"
                onPress={() => {
                  void handleShareSummary();
                }}
              />
            </View>
            <View style={styles.exportBtnWrap}>
              <Button
                label="Export CSV"
                size="sm"
                variant="secondary"
                fullWidth
                leftIcon="download-outline"
                onPress={() => {
                  void handleExportCsv();
                }}
              />
            </View>
          </View>

          {exportStatus ? (
            <ThemedText variant="caption" color="success">
              {exportStatus}
            </ThemedText>
          ) : null}
        </>
      )}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  gradeBadge: {
    width: 68,
    height: 68,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreMeta: {
    flex: 1,
    gap: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  gridItem: {
    width: '47%',
    flexGrow: 1,
    padding: Spacing.sm + 2,
    borderRadius: Radii.md,
    gap: 2,
  },
  categorySection: {
    gap: Spacing.xs + 2,
  },
  catBarRow: {
    gap: 4,
  },
  catBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emittersBox: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    gap: Spacing.xs + 2,
  },
  emitterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  emitterTitle: {
    flex: 1,
  },
  exportRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  exportBtnWrap: {
    flex: 1,
  },
});
