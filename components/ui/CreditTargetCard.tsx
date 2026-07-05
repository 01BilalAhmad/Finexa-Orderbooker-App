// components/ui/CreditTargetCard.tsx
// Shows orderbooker's credit closing target progress on dashboard
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ApiService } from '@/services/api';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { formatPKR } from '@/utils/format';

interface CreditTargetData {
  target: {
    openingCredit: number | null;
    targetClosingCredit: number | null;
    maxCreditThisMonth: number | null;
  } | null;
  stats: {
    currentCredit: number;
    recoveryDone: number;
    recoveryNeeded: number;
    progress: number;
    status: string;
  };
}

const statusConfig: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  achieved: { color: '#10B981', bg: '#D1FAE5', label: 'Achieved', icon: 'trophy' },
  on_track: { color: '#3B82F6', bg: '#DBEAFE', label: 'On Track', icon: 'check-circle' },
  behind: { color: '#F59E0B', bg: '#FEF3C7', label: 'Behind', icon: 'schedule' },
  critical: { color: '#EF4444', bg: '#FEE2E2', label: 'Critical', icon: 'warning' },
  no_target: { color: '#6B7280', bg: '#F3F4F6', label: 'No Target', icon: 'info' },
};

export function CreditTargetCard({ orderbookerId }: { orderbookerId: string }) {
  const [data, setData] = useState<CreditTargetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchTarget = async () => {
      try {
        setError(null);
        const result = await ApiService.getCreditTarget(orderbookerId);
        if (mounted) setData(result);
      } catch (err) {
        console.warn('[CreditTargetCard] Failed to fetch:', err);
        if (mounted) setError('Could not load target');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchTarget();
    return () => { mounted = false; };
  }, [orderbookerId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading credit target...</Text>
        </View>
      </View>
    );
  }

  // If API failed, show error state (so user knows something is wrong)
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorRow}>
          <MaterialIcons name="error-outline" size={18} color="#EF4444" />
          <Text style={styles.errorText}>Could not load credit target</Text>
        </View>
      </View>
    );
  }

  // If no target set, show empty state (so OB knows admin hasn't set it yet)
  if (!data || !data.target || data.target.targetClosingCredit === null) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyRow}>
          <View style={[styles.iconWrap, { backgroundColor: '#F3F4F6' }]}>
            <MaterialIcons name="flag" size={18} color="#6B7280" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Credit Target</Text>
            <Text style={styles.subtitle}>No target set for this month yet</Text>
          </View>
        </View>
      </View>
    );
  }

  const { stats } = data;
  const statusInfo = statusConfig[stats.status] || statusConfig.no_target;
  const progress = stats.progress;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrap, { backgroundColor: statusInfo.bg }]}>
            <MaterialIcons name={statusInfo.icon as any} size={20} color={statusInfo.color} />
          </View>
          <View>
            <Text style={styles.title}>Credit Target</Text>
            <Text style={styles.subtitle}>Close at {formatPKR(data.target.targetClosingCredit)}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Current Credit</Text>
          <Text style={[styles.statValue, { color: '#EF4444' }]}>{formatPKR(stats.currentCredit)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Recovery Done</Text>
          <Text style={[styles.statValue, { color: '#3B82F6' }]}>{formatPKR(stats.recoveryDone)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Still Needed</Text>
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>{formatPKR(stats.recoveryNeeded)}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: statusInfo.color,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{progress}% Complete</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: '#EF4444',
    fontWeight: FontWeight.medium,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.borderLight,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  progressSection: {
    marginTop: Spacing.xs,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'right',
  },
});
