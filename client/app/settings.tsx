import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hapticLight } from '@/lib/haptics';
import { safeRouterBack } from '@/lib/safeRouterBack';
import { permanentlyDeleteAccount } from '@/lib/gdprCompliance';
import { resolveCanonicalUserId } from '@/lib/currentUser';
import { auth } from '@/config/firebase';
import AsyncStorage from '@/lib/storage';
import { withdrawalService, type WithdrawalRecord } from '@/src/_services/withdrawalService';

export default function SettingsScreen() {
  const router = useRouter();
  const [payoutHistory, setPayoutHistory] = useState<WithdrawalRecord[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutTotalPages, setPayoutTotalPages] = useState(1);

  const loadPayoutHistory = useCallback(async (page = 1) => {
    setPayoutLoading(true);
    try {
      const res = await withdrawalService.getPayoutHistory(page, 10);
      if (res.success) {
        setPayoutHistory(res.data);
        setPayoutPage(res.pagination?.page || 1);
        setPayoutTotalPages(res.pagination?.totalPages || 1);
      }
    } catch (e) {
      console.warn('[Settings] Error loading payout history:', e);
    } finally {
      setPayoutLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayoutHistory();
  }, [loadPayoutHistory]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            safeRouterBack();
          }}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity
          style={styles.feedbackBtn}
          onPress={() => {
            hapticLight();
            Alert.alert(
              'Send Feedback',
              'Email your feedback or report an issue to oceanshah86@gmail.com',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Email', onPress: () => {
                    Linking.openURL('mailto:oceanshah86@gmail.com?subject=App Feedback');
                  }
                }
              ]
            );
          }}
        >
          <Feather name="message-circle" size={18} color="#FF8D00" />
          <Text style={styles.feedbackText}>Send Feedback / Report Issue</Text>
        </TouchableOpacity>

        {/* Blocked Users Section */}
        <TouchableOpacity
          style={[styles.settingsItem, { backgroundColor: '#fff5f5', borderColor: '#ffcfcf' }]}
          onPress={() => {
            hapticLight();
            router.push('/blocked-users' as any);
          }}
        >
          <Feather name="slash" size={20} color="#e74c3c" style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsTitle}>Blocked Users</Text>
            <Text style={styles.settingsSubtitle}>Manage users you have blocked</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#ccc" />
        </TouchableOpacity>

        {/* Payout History Section */}
        <View style={styles.payoutSection}>
          <View style={styles.payoutHeader}>
            <Feather name="credit-card" size={18} color="#2e7d32" style={{ marginRight: 8 }} />
            <Text style={styles.payoutSectionTitle}>Payout History</Text>
          </View>
          {payoutLoading ? (
            <ActivityIndicator size="small" color="#007aff" style={{ padding: 20 }} />
          ) : payoutHistory.length > 0 ? (
            <>
              {payoutHistory.map((payout) => (
                <View key={payout.id} style={styles.payoutRow}>
                  <View style={styles.payoutInfo}>
                    <Text style={styles.payoutAmount}>{payout.amountFormatted}</Text>
                    <Text style={styles.payoutDate}>
                      {new Date(payout.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={[
                    styles.payoutStatusBadge,
                    payout.status === 'paid' && styles.payoutStatusPaid,
                    payout.status === 'processing' && styles.payoutStatusProcessing,
                    payout.status === 'pending' && styles.payoutStatusProcessing,
                    payout.status === 'failed' && styles.payoutStatusFailed,
                  ]}>
                    <Text style={[
                      styles.payoutStatusText,
                      payout.status === 'paid' && styles.payoutStatusTextPaid,
                      payout.status === 'processing' && styles.payoutStatusTextProcessing,
                      payout.status === 'pending' && styles.payoutStatusTextProcessing,
                      payout.status === 'failed' && styles.payoutStatusTextFailed,
                    ]}>
                      {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                    </Text>
                  </View>
                </View>
              ))}
              {/* Pagination */}
              {payoutTotalPages > 1 && (
                <View style={styles.payoutPagination}>
                  <TouchableOpacity
                    style={[styles.pageBtn, payoutPage <= 1 && styles.pageBtnDisabled]}
                    disabled={payoutPage <= 1}
                    onPress={() => { hapticLight(); loadPayoutHistory(payoutPage - 1); }}
                  >
                    <Feather name="chevron-left" size={16} color={payoutPage <= 1 ? '#ccc' : '#007aff'} />
                  </TouchableOpacity>
                  <Text style={styles.pageText}>Page {payoutPage} of {payoutTotalPages}</Text>
                  <TouchableOpacity
                    style={[styles.pageBtn, payoutPage >= payoutTotalPages && styles.pageBtnDisabled]}
                    disabled={payoutPage >= payoutTotalPages}
                    onPress={() => { hapticLight(); loadPayoutHistory(payoutPage + 1); }}
                  >
                    <Feather name="chevron-right" size={16} color={payoutPage >= payoutTotalPages ? '#ccc' : '#007aff'} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View style={styles.payoutEmpty}>
              <Feather name="inbox" size={28} color="#ccc" />
              <Text style={styles.payoutEmptyText}>No payouts yet</Text>
              <Text style={styles.payoutEmptySubtext}>Your withdrawal history will appear here</Text>
            </View>
          )}
        </View>

        {/* App Version & About Section */}
        <View style={styles.aboutBox}>
          <Text style={styles.aboutTitle}>About Comedy App</Text>
          <Text style={styles.aboutText}>Version 1.0.0</Text>
          <Text style={styles.aboutText}>© 2025 hussain2125. All rights reserved.</Text>
          <Text style={styles.aboutText}>For help or feedback, email support@comedyapp.com</Text>
        </View>

        {/* Legal Section */}
        <View style={styles.legalBox}>
          <Text style={styles.legalTitle}>Legal</Text>
          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => {
              hapticLight();
              router.push('/legal/privacy' as any);
            }}
          >
            <Feather name="shield" size={18} color="#667eea" style={{ marginRight: 10 }} />
            <Text style={styles.legalText}>Privacy Policy</Text>
            <Feather name="chevron-right" size={18} color="#ccc" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => {
              hapticLight();
              router.push('/legal/terms' as any);
            }}
          >
            <Feather name="file-text" size={18} color="#667eea" style={{ marginRight: 10 }} />
            <Text style={styles.legalText}>Terms of Service</Text>
            <Feather name="chevron-right" size={18} color="#ccc" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={[styles.legalBox, { marginTop: 20, borderColor: '#ffcfcf' }]}>
          <Text style={[styles.legalTitle, { color: '#e74c3c' }]}>Danger Zone</Text>
          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => {
              hapticLight();
              Alert.alert(
                'Delete Account',
                'Are you sure you want to delete your account? This action is permanent and cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const userId = await resolveCanonicalUserId();
                        if (userId) {
                          await permanentlyDeleteAccount(userId);
                        }
                        // Logout locally regardless of API success to ensure they are logged out
                        if (auth) {
                          await auth.signOut();
                        }
                        await AsyncStorage.clear();
                        router.replace('/auth/welcome' as any);
                      } catch (err) {
                        console.error('Failed to delete account:', err);
                        Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
                      }
                    }
                  }
                ]
              );
            }}
          >
            <Feather name="trash-2" size={18} color="#e74c3c" style={{ marginRight: 10 }} />
            <Text style={[styles.legalText, { color: '#e74c3c' }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  feedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbe6',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    margin: 16,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#ffe0a3',
    shadowColor: '#FF8D00',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  feedbackText: {
    marginLeft: 10,
    color: '#FF8D00',
    fontWeight: '600',
    fontSize: 15,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  aboutBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 0,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbf5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#ffe0a3',
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  settingsSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  aboutTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
    marginBottom: 6,
  },
  aboutText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  legalBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    margin: 16,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#eee',
  },
  legalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  legalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f2',
  },
  legalText: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '500',
  },
  // Payout history styles
  payoutSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e8f5e9',
  },
  payoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  payoutSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f2',
  },
  payoutInfo: {
    flex: 1,
  },
  payoutAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  payoutDate: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 2,
    fontWeight: '500',
  },
  payoutStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  payoutStatusPaid: {
    backgroundColor: '#e8f5e9',
  },
  payoutStatusProcessing: {
    backgroundColor: '#fff3e0',
  },
  payoutStatusFailed: {
    backgroundColor: '#fce4ec',
  },
  payoutStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  payoutStatusTextPaid: {
    color: '#2e7d32',
  },
  payoutStatusTextProcessing: {
    color: '#e65100',
  },
  payoutStatusTextFailed: {
    color: '#c62828',
  },
  payoutEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  payoutEmptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  payoutEmptySubtext: {
    fontSize: 12,
    color: '#bbb',
  },
  payoutPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 12,
    gap: 12,
  },
  pageBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f5f5f7',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
});
