// components/ui/OverdueAlertBanner.tsx
// Red alert banner shown on dashboard when there are overdue shops.
// Tapping it opens the OverdueShopsModal.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { formatPKR } from '@/utils/format';
import { OverdueShop } from '@/services/storage';
import { getCachedOverdueShops } from '@/utils/overdueCalculator';

export function OverdueAlertBanner() {
  const [overdueShops, setOverdueShops] = useState<OverdueShop[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchOverdue = useCallback(async () => {
    const shops = await getCachedOverdueShops();
    setOverdueShops(shops);
  }, []);

  useEffect(() => {
    fetchOverdue();
    // Refresh every 60 seconds
    const interval = setInterval(fetchOverdue, 60000);
    return () => clearInterval(interval);
  }, [fetchOverdue]);

  if (overdueShops.length === 0) return null;

  const totalPending = overdueShops.reduce((sum, s) => sum + s.balance, 0);

  return (
    <>
      <Pressable
        style={styles.banner}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.bannerLeft}>
          <View style={styles.iconWrap}>
            <MaterialIcons name="warning" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>{overdueShops.length} Overdue Shops</Text>
            <Text style={styles.bannerSubtitle}>{formatPKR(totalPending)} pending recovery</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#FFFFFF" />
      </Pressable>

      {/* Overdue Shops Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <MaterialIcons name="warning" size={24} color="#DC2626" />
                <View>
                  <Text style={styles.modalTitle}>Overdue Shops</Text>
                  <Text style={styles.modalSubtitle}>
                    {overdueShops.length} shops · {formatPKR(totalPending)} pending
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
                hitSlop={8}
              >
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {/* List */}
            <FlatList
              data={overdueShops}
              keyExtractor={(item) => item.shopId}
              renderItem={({ item, index }) => (
                <View style={styles.shopRow}>
                  <View style={styles.shopInfo}>
                    <Text style={styles.shopName}>{item.shopName}</Text>
                    {item.shopArea ? (
                      <Text style={styles.shopArea}>{item.shopArea}</Text>
                    ) : null}
                    <Text style={styles.shopMeta}>
                      {item.daysOverdue >= 999
                        ? 'Never recovered'
                        : `${item.daysOverdue} days since last recovery`}
                    </Text>
                  </View>
                  <View style={styles.shopRight}>
                    <Text style={styles.shopBalance}>{formatPKR(item.balance)}</Text>
                    <Text style={styles.shopBalanceLabel}>Balance</Text>
                  </View>
                </View>
              )}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#DC2626',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  bannerSubtitle: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '80%',
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  shopArea: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  shopMeta: {
    fontSize: FontSize.xs,
    color: '#DC2626',
    marginTop: 4,
    fontWeight: FontWeight.medium,
  },
  shopRight: {
    alignItems: 'flex-end',
  },
  shopBalance: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#DC2626',
  },
  shopBalanceLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
});
