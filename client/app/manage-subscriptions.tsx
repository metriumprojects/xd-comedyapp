import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeHeaderInsets } from '@/hooks/useSafeHeaderInsets';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import COLORS from '@/src/theme/colors';
import { resolveCanonicalUserId } from '@/lib/currentUser';
import { subscriptionService, TierResponse } from '@/src/_services/subscriptionService';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face';

type TierTab = 'active' | 'archived';

export default function TierManagementScreen() {
  const router = useRouter();
  const { top: safeTop, bottom: safeBottom, insets } = useSafeHeaderInsets();
  const queryClient = useQueryClient();
  const [creatorId, setCreatorId] = useState<string>('');

  const [activeTab, setActiveTab] = useState<TierTab>('active');
  const [refreshing, setRefreshing] = useState(false);

  // Member Drilldown View
  const [selectedTierForMembers, setSelectedTierForMembers] = useState<TierResponse | null>(null);
  const [tierSubscribers, setTierSubscribers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Create / Edit Modal State
  const [showTierModal, setShowTierModal] = useState(false);
  const [editingTier, setEditingTier] = useState<TierResponse | null>(null);
  const [tierTitle, setTierTitle] = useState('');
  const [tierDesc, setTierDesc] = useState('');
  const [tierPrice, setTierPrice] = useState('');
  const [tierGroupChat, setTierGroupChat] = useState(false);
  const [tierBenefits, setTierBenefits] = useState<string[]>(['Early access to new videos']);
  const [newBenefitInput, setNewBenefitInput] = useState('');
  const [savingTier, setSavingTier] = useState(false);
  const [togglingVisibilityId, setTogglingVisibilityId] = useState<string | null>(null);

  useEffect(() => {
    resolveCanonicalUserId().then((id) => {
      if (id) setCreatorId(id);
    });
  }, []);

  // TanStack Query for Creator Tiers (Instant Stale-While-Revalidate caching)
  const {
    data: tiersData,
    isLoading: loadingTiers,
    refetch: refetchTiers,
  } = useQuery({
    queryKey: ['creatorTiers', creatorId],
    queryFn: async () => {
      const res = await subscriptionService.getTiers(creatorId);
      return res?.success && Array.isArray(res?.data) ? (res.data as TierResponse[]) : [];
    },
    enabled: !!creatorId,
    staleTime: 1000 * 60 * 3, // 3 minutes fresh cache
  });

  // TanStack Query for Subscribers
  const {
    data: subscribersData,
    refetch: refetchSubscribers,
  } = useQuery({
    queryKey: ['creatorSubscribers', creatorId],
    queryFn: async () => {
      const res = await subscriptionService.getMySubscribers();
      return res?.success && Array.isArray(res?.data) ? res.data : [];
    },
    enabled: !!creatorId,
    staleTime: 1000 * 60 * 3, // 3 minutes fresh cache
  });

  // Derived state directly from instant cache
  const rawTiers: TierResponse[] = tiersData || [];
  const activeTiers = useMemo(
    () => rawTiers.filter((t: any) => !(t?.isArchived || t?.isActive === false)),
    [rawTiers]
  );
  const archivedTiers = useMemo(
    () => rawTiers.filter((t: any) => (t?.isArchived || t?.isActive === false)),
    [rawTiers]
  );
  const allSubscribers = subscribersData || [];

  // Only show blocking spinner if there is zero cached data on cold start
  const isInitialLoading = loadingTiers && !tiersData;

  const refreshData = useCallback(async () => {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['creatorTiers', creatorId] }),
      queryClient.invalidateQueries({ queryKey: ['creatorSubscribers', creatorId] }),
    ]);
  }, [queryClient, creatorId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await Promise.allSettled([refetchTiers(), refetchSubscribers()]);
    setRefreshing(false);
  }, [refetchTiers, refetchSubscribers]);

  // Count active subscribers for a specific tier
  // Prefer backend subscriberCount, fallback to local filtering
  const getTierSubscriberCount = useCallback(
    (tier: TierResponse) => {
      if (typeof tier.subscriberCount === 'number' && tier.subscriberCount > 0) {
        return tier.subscriberCount;
      }
      return allSubscribers.filter((s: any) => String(s?.tier?.id || s?.tier?._id || '') === String(tier._id)).length;
    },
    [allSubscribers]
  );

  // Drilldown: Open Tier Members View
  const handleOpenTierMembers = async (tier: TierResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedTierForMembers(tier);
    setLoadingMembers(true);
    try {
      const res = await subscriptionService.getMySubscribers(tier._id);
      if (res.success && Array.isArray(res.data)) {
        setTierSubscribers(res.data);
      } else {
        // Fallback filter from local subscribers
        const filtered = allSubscribers.filter(
          (s: any) => String(s?.tier?.id || s?.tier?._id || '') === String(tier._id)
        );
        setTierSubscribers(filtered);
      }
    } catch {
      const filtered = allSubscribers.filter(
        (s: any) => String(s?.tier?.id || s?.tier?._id || '') === String(tier._id)
      );
      setTierSubscribers(filtered);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Close Drilldown
  const handleCloseTierMembers = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedTierForMembers(null);
    setTierSubscribers([]);
  };

  // Toggle Archived Tier Visibility (Public / Private)
  const handleToggleArchivedVisibility = async (tier: TierResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const currentIsPrivate = tier.isPrivate !== false;
    const newIsPrivate = !currentIsPrivate;
    setTogglingVisibilityId(tier._id);

    try {
      const res = await subscriptionService.updateTierVisibility(tier._id, newIsPrivate);
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        queryClient.setQueryData(['creatorTiers', creatorId], (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((t: any) => (t._id === tier._id ? { ...t, isPrivate: newIsPrivate } : t));
        });
        refreshData();
      } else {
        Alert.alert('Error', 'Failed to update tier visibility.');
      }
    } catch {
      Alert.alert('Error', 'Could not update visibility setting.');
    } finally {
      setTogglingVisibilityId(null);
    }
  };

  // Open Create Tier Form
  const handleOpenCreateTier = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setEditingTier(null);
    setTierTitle('');
    setTierDesc('');
    setTierPrice('');
    setTierGroupChat(false);
    setTierBenefits(['Early access to new videos', 'Exclusive subscriber-only reels']);
    setNewBenefitInput('');
    setShowTierModal(true);
  };

  // Open Edit Tier Form
  const handleOpenEditTier = (tier: TierResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setEditingTier(tier);
    setTierTitle(tier.title);
    setTierDesc(tier.description);
    setTierPrice(tier.price || (tier.priceInCents ? (tier.priceInCents / 100).toFixed(2) : ''));
    setTierGroupChat(!!tier.createGroupChat);
    setTierBenefits(Array.isArray(tier.benefits) && tier.benefits.length > 0 ? [...tier.benefits] : ['Early access']);
    setNewBenefitInput('');
    setShowTierModal(true);
  };

  // Benefit Helpers
  const handleAddBenefit = () => {
    if (!newBenefitInput.trim()) return;
    setTierBenefits([...tierBenefits, newBenefitInput.trim()]);
    setNewBenefitInput('');
  };

  const handleRemoveBenefit = (index: number) => {
    setTierBenefits(tierBenefits.filter((_, i) => i !== index));
  };

  // Save Tier
  const handleSaveTier = async () => {
    if (!tierTitle.trim()) {
      Alert.alert('Missing Field', 'Please enter a title for this tier.');
      return;
    }
    const parsedPrice = parseFloat(tierPrice);
    if (isNaN(parsedPrice) || parsedPrice < 1.0) {
      Alert.alert('Invalid Price', 'Minimum price is $1.00 USD per month.');
      return;
    }

    setSavingTier(true);
    try {
      const payload: any = {
        title: tierTitle.trim(),
        description: tierDesc.trim() || 'Exclusive subscriber access.',
        price: parsedPrice.toFixed(2),
        benefits: tierBenefits.filter(Boolean),
        createGroupChat: tierGroupChat,
      };

      if (editingTier?._id) {
        payload.tierId = editingTier._id;
      }

      const res = await subscriptionService.createTier(payload);
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setShowTierModal(false);
        refreshData();
        Alert.alert(
          editingTier ? 'Tier Updated' : 'Tier Created',
          editingTier
            ? `"${tierTitle.trim()}" has been updated successfully.`
            : `"${tierTitle.trim()}" is now live! Fans can subscribe to it from your profile.`
        );
      } else {
        Alert.alert('Error', 'Failed to save tier.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong.');
    } finally {
      setSavingTier(false);
    }
  };

  // Archive Tier
  const handleArchiveTier = (tier: TierResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    Alert.alert(
      'Archive Tier?',
      `Are you sure you want to archive "${tier.title}"?\n\nNew users will no longer see or join this tier. Existing subscribers will keep access until their billing cycle finishes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await subscriptionService.deleteTier(tier._id);
              if (res.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                refreshData();
              }
            } catch {
              Alert.alert('Error', 'Failed to archive tier.');
            }
          },
        },
      ]
    );
  };

  // Restore Tier
  const handleRestoreTier = (tier: TierResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert('Restore Tier?', `Make "${tier.title}" an active plan again?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          try {
            const res = await subscriptionService.restoreTier(tier._id);
            if (res.success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              refreshData();
            }
          } catch {
            Alert.alert('Error', 'Failed to restore tier.');
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.safeArea, { paddingTop: safeTop, paddingBottom: safeBottom }]}>
      {/* ========================================================================= */}
      {/* HEADER BAR */}
      {/* ========================================================================= */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            if (selectedTierForMembers) {
              handleCloseTierMembers();
            } else {
              router.back();
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {selectedTierForMembers ? `${selectedTierForMembers.title}` : 'Tier Management'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {selectedTierForMembers
              ? `Subscribed Members (${tierSubscribers.length})`
              : 'Active & Archived Subscription Plans'}
          </Text>
        </View>

        {!selectedTierForMembers && (
          <TouchableOpacity style={styles.newTierHeaderBtn} onPress={handleOpenCreateTier}>
            <Ionicons name="add" size={22} color={COLORS.white} />
          </TouchableOpacity>
        )}
      </View>

      {/* ========================================================================= */}
      {/* VIEW A: TIER MEMBERS LIST (DRILLDOWN) */}
      {/* ========================================================================= */}
      {selectedTierForMembers ? (
        <View style={styles.container}>
          {/* Member Tier Header Card */}
          <View style={styles.memberTierSummaryCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberTierSummaryPrice}>
                ${selectedTierForMembers.price} <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.85)' }}>/ month</Text>
              </Text>
              <Text style={styles.memberTierSummaryDesc}>
                {selectedTierForMembers.description || 'Exclusive tier content & perks.'}
              </Text>
            </View>
            <View style={styles.memberCountPill}>
              <Ionicons name="people" size={14} color="#0095F6" style={{ marginRight: 4 }} />
              <Text style={styles.memberCountPillText}>{tierSubscribers.length} Members</Text>
            </View>
          </View>

          {loadingMembers ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0095F6" />
              <Text style={styles.loadingText}>Loading members...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.container}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
              showsVerticalScrollIndicator={false}
            >
              {tierSubscribers.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="people-outline" size={42} color={COLORS.textMuted} style={{ marginBottom: 10 }} />
                  <Text style={styles.emptyTitle}>No members in this tier</Text>
                  <Text style={styles.emptyDesc}>
                    Users who subscribe to "{selectedTierForMembers.title}" will appear in this list.
                  </Text>
                </View>
              ) : (
                tierSubscribers.map((item) => {
                  const subUser = item.subscriber;
                  const joinDate = item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '';

                  return (
                    <View key={item.id} style={styles.subscriberRow}>
                      <ExpoImage
                        source={{ uri: subUser?.avatar || DEFAULT_AVATAR }}
                        style={styles.subscriberAvatar}
                        contentFit="cover"
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.subscriberName}>{subUser?.displayName || 'Subscriber'}</Text>
                        <Text style={styles.subscriberHandle}>@{subUser?.username || 'user'}</Text>
                        {joinDate ? <Text style={styles.subscriberJoined}>Joined {joinDate}</Text> : null}
                      </View>

                      <View style={styles.subscriberActions}>
                        <View style={styles.activeStatusPill}>
                          <Text style={styles.activeStatusPillText}>Active</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.subscriberMsgBtn}
                          onPress={() => {
                            if (subUser?.id) {
                              router.push({ pathname: '/dm', params: { targetUserId: subUser.id } } as any);
                            }
                          }}
                        >
                          <Ionicons name="chatbubble-outline" size={16} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      ) : (
        /* ========================================================================= */
        /* VIEW B: TIERS LIST (ACTIVE & ARCHIVED TABS) */
        /* ========================================================================= */
        <View style={styles.container}>
          {/* Minimal Tab Switcher */}
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveTab('active');
              }}
            >
              <Text style={[styles.tabBtnText, activeTab === 'active' && styles.tabBtnTextActive]}>
                Active Plans ({activeTiers.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'archived' && styles.tabBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveTab('archived');
              }}
            >
              <Text style={[styles.tabBtnText, activeTab === 'archived' && styles.tabBtnTextActive]}>
                Archived ({archivedTiers.length})
              </Text>
            </TouchableOpacity>
          </View>

          {isInitialLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0095F6" />
              <Text style={styles.loadingText}>Loading tiers...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.container}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0095F6" />}
            >
              {/* =================== TAB: ACTIVE TIERS =================== */}
              {activeTab === 'active' && (
                <View>
                  {activeTiers.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Feather name="layers" size={40} color={COLORS.textMuted} style={{ marginBottom: 10 }} />
                      <Text style={styles.emptyTitle}>No Active Tiers</Text>
                      <Text style={styles.emptyDesc}>
                        Create your first subscription tier to let fans support your work.
                      </Text>
                      <TouchableOpacity style={styles.emptyCreateBtn} onPress={handleOpenCreateTier}>
                        <Ionicons name="add" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
                        <Text style={styles.emptyCreateBtnText}>Create a Tier</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    activeTiers.map((tier) => {
                      const memberCount = getTierSubscriberCount(tier);

                      return (
                        <View key={tier._id} style={styles.tierCard}>
                          {/* Card Header: Title, Price, and Members */}
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => handleOpenTierMembers(tier)}
                            style={styles.tierCardHeader}
                          >
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={styles.tierTitle}>{tier.title}</Text>
                              <Text style={styles.tierPriceText}>
                                ${tier.price} <Text style={styles.perMonthText}>/ month</Text>
                              </Text>
                            </View>

                            <View style={styles.tierMembersBadge}>
                              <Ionicons name="people" size={13} color="#0095F6" style={{ marginRight: 4 }} />
                              <Text style={styles.tierMembersBadgeText}>{memberCount}</Text>
                              <Feather name="chevron-right" size={14} color="#0095F6" style={{ marginLeft: 3 }} />
                            </View>
                          </TouchableOpacity>

                          {/* Description */}
                          {tier.description ? (
                            <Text style={styles.tierDescription} numberOfLines={2}>
                              {tier.description}
                            </Text>
                          ) : null}

                          {/* Benefits Preview */}
                          {Array.isArray(tier.benefits) && tier.benefits.length > 0 && (
                            <View style={styles.perksList}>
                              {tier.benefits.slice(0, 3).map((b, i) => (
                                <View key={i} style={styles.perkItem}>
                                  <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                                  <Text style={styles.perkText} numberOfLines={1}>{b}</Text>
                                </View>
                              ))}
                              {tier.benefits.length > 3 && (
                                <Text style={styles.morePerksText}>+{tier.benefits.length - 3} more perks</Text>
                              )}
                            </View>
                          )}

                          {/* Card Action Buttons - Edit & Archive only */}
                          <View style={styles.tierActionsRow}>
                            <TouchableOpacity
                              style={styles.actionBtnWhite}
                              onPress={() => handleOpenEditTier(tier)}
                            >
                              <Feather name="edit-2" size={13} color="#0095F6" style={{ marginRight: 6 }} />
                              <Text style={styles.actionBtnWhiteText}>Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.actionBtnGlass}
                              onPress={() => handleArchiveTier(tier)}
                            >
                              <Feather name="archive" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <Text style={styles.actionBtnGlassText}>Archive</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* =================== TAB: ARCHIVED TIERS =================== */}
              {activeTab === 'archived' && (
                <View>
                  {archivedTiers.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Feather name="archive" size={38} color={COLORS.textMuted} style={{ marginBottom: 10 }} />
                      <Text style={styles.emptyTitle}>No Archived Tiers</Text>
                      <Text style={styles.emptyDesc}>
                        When you archive a tier, it will appear here with visibility controls.
                      </Text>
                    </View>
                  ) : (
                    archivedTiers.map((tier) => {
                      const memberCount = getTierSubscriberCount(tier);
                      const isPrivate = tier.isPrivate !== false;
                      const isToggling = togglingVisibilityId === tier._id;

                      return (
                        <View key={tier._id} style={[styles.tierCard, styles.archivedCard]}>
                          {/* Header: Title + Privacy tag + Members badge */}
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => handleOpenTierMembers(tier)}
                            style={styles.tierCardHeader}
                          >
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Text style={styles.tierTitle}>{tier.title}</Text>
                                <View style={[styles.privacyTag, isPrivate ? styles.privacyTagPrivate : styles.privacyTagPublic]}>
                                  <Feather
                                    name={isPrivate ? 'lock' : 'globe'}
                                    size={10}
                                    color="#FFFFFF"
                                    style={{ marginRight: 3 }}
                                  />
                                  <Text style={styles.privacyTagText}>
                                    {isPrivate ? 'Private' : 'Public'}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.tierPriceText}>
                                ${tier.price} <Text style={styles.perMonthText}>/ month</Text>
                              </Text>
                            </View>

                            <View style={styles.tierMembersBadge}>
                              <Ionicons name="people" size={13} color="#0095F6" style={{ marginRight: 4 }} />
                              <Text style={styles.tierMembersBadgeText}>{memberCount}</Text>
                              <Feather name="chevron-right" size={14} color="#0095F6" style={{ marginLeft: 3 }} />
                            </View>
                          </TouchableOpacity>

                          {/* Description */}
                          {tier.description ? (
                            <Text style={styles.tierDescription} numberOfLines={2}>
                              {tier.description}
                            </Text>
                          ) : null}

                          {/* Benefits Preview */}
                          {Array.isArray(tier.benefits) && tier.benefits.length > 0 && (
                            <View style={styles.perksList}>
                              {tier.benefits.slice(0, 3).map((b, i) => (
                                <View key={i} style={styles.perkItem}>
                                  <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
                                  <Text style={styles.perkText} numberOfLines={1}>{b}</Text>
                                </View>
                              ))}
                              {tier.benefits.length > 3 && (
                                <Text style={styles.morePerksText}>+{tier.benefits.length - 3} more perks</Text>
                              )}
                            </View>
                          )}

                          {/* 2 Action Buttons: Make Public/Private + Restore */}
                          <View style={styles.tierActionsRow}>
                            <TouchableOpacity
                              style={styles.actionBtnWhite}
                              disabled={isToggling}
                              onPress={() => handleToggleArchivedVisibility(tier)}
                            >
                              {isToggling ? (
                                <ActivityIndicator size="small" color="#0095F6" />
                              ) : (
                                <>
                                  <Feather
                                    name={isPrivate ? 'globe' : 'lock'}
                                    size={13}
                                    color="#0095F6"
                                    style={{ marginRight: 6 }}
                                  />
                                  <Text style={styles.actionBtnWhiteText}>
                                    {isPrivate ? 'Make Public' : 'Make Private'}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.actionBtnGlass}
                              onPress={() => handleRestoreTier(tier)}
                            >
                              <Ionicons name="refresh" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <Text style={styles.actionBtnGlassText}>Restore</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT TIER */}
      {/* ========================================================================= */}
      <Modal
        visible={showTierModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTierModal(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalSafeArea} edges={['bottom']}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingTier ? 'Edit Subscription Tier' : 'New Subscription Tier'}
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowTierModal(false)}
                >
                  <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Tier Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. VIP Club, Super Fans"
                  placeholderTextColor={COLORS.textMuted}
                  value={tierTitle}
                  onChangeText={setTierTitle}
                  maxLength={60}
                />

                <Text style={styles.fieldLabel}>Monthly Price (USD)</Text>
                {editingTier ? (
                  <View style={styles.priceLockedWrapper}>
                    <View style={styles.priceInputWrapper}>
                      <Text style={styles.priceCurrencySymbol}>$</Text>
                      <Text style={[styles.priceInput, { paddingVertical: 12, color: COLORS.textMuted }]}>
                        {tierPrice || '0.00'}
                      </Text>
                      <Text style={styles.pricePeriodSuffix}>/month</Text>
                      <Feather name="lock" size={14} color={COLORS.textMuted} style={{ marginLeft: 6 }} />
                    </View>
                    <Text style={styles.priceLockedNote}>
                      Price cannot be changed for existing tiers. To use a different price, archive this tier and create a new one.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.priceInputWrapper}>
                    <Text style={styles.priceCurrencySymbol}>$</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="4.99"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="decimal-pad"
                      value={tierPrice}
                      onChangeText={setTierPrice}
                    />
                    <Text style={styles.pricePeriodSuffix}>/month</Text>
                  </View>
                )}

                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Tell your subscribers what they get..."
                  placeholderTextColor={COLORS.textMuted}
                  value={tierDesc}
                  onChangeText={setTierDesc}
                  multiline
                  numberOfLines={2}
                  maxLength={200}
                />

                <TouchableOpacity
                  style={styles.toggleRow}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (editingTier && tierGroupChat) {
                      // Warn when turning OFF group chat on existing tier
                      Alert.alert(
                        'Disable Group Chat?',
                        'Turning this off will not delete the existing group chat, but new subscribers will no longer be added automatically.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Turn Off', style: 'destructive', onPress: () => setTierGroupChat(false) },
                        ]
                      );
                    } else {
                      setTierGroupChat(!tierGroupChat);
                    }
                  }}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.toggleTitle}>Include Tier Group Chat</Text>
                    <Text style={styles.toggleSubtitle}>
                      Automatically adds active subscribers to an exclusive chat.
                    </Text>
                  </View>
                  <View style={[styles.checkboxBox, tierGroupChat && styles.checkboxBoxChecked]}>
                    {tierGroupChat && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
                  </View>
                </TouchableOpacity>

                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Benefits / Perks</Text>
                {tierBenefits.map((item, index) => (
                  <View key={index} style={styles.benefitInputRow}>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.success} style={{ marginRight: 8 }} />
                    <Text style={styles.benefitItemText}>{item}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveBenefit(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="x" size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.addBenefitRow}>
                  <TextInput
                    style={styles.addBenefitInput}
                    placeholder="Add a perk (e.g. 48hr early video access)"
                    placeholderTextColor={COLORS.textMuted}
                    value={newBenefitInput}
                    onChangeText={setNewBenefitInput}
                    onSubmitEditing={handleAddBenefit}
                  />
                  <TouchableOpacity
                    style={[styles.addBenefitBtn, !newBenefitInput.trim() && { opacity: 0.5 }]}
                    onPress={handleAddBenefit}
                    disabled={!newBenefitInput.trim()}
                  >
                    <Ionicons name="add" size={20} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.saveTierButton, savingTier && { opacity: 0.7 }]}
                  disabled={savingTier}
                  onPress={handleSaveTier}
                >
                  {savingTier ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.saveTierButtonText}>
                      {editingTier ? 'Update Tier' : 'Create Tier'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // Header Bar
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  newTierHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0095F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab Switcher
  tabSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  tabBtnActive: {
    backgroundColor: '#0095F6',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Tier Card - Blue Bubble Design
  tierCard: {
    backgroundColor: '#0095F6',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  archivedCard: {
    backgroundColor: '#1E3A5F', // Deep navy marine blue for archived
    borderColor: 'transparent',
  },
  tierCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tierPriceText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
    marginTop: 2,
  },
  perMonthText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tierMembersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tierMembersBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0095F6',
  },
  tierDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    lineHeight: 18,
  },
  perksList: {
    marginTop: 10,
    gap: 5,
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  perkText: {
    fontSize: 12,
    color: '#FFFFFF',
    flex: 1,
  },
  morePerksText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    fontStyle: 'italic',
    marginTop: 2,
  },
  tierActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    gap: 10,
  },
  // Solid white button (primary action)
  actionBtnWhite: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 11,
    borderRadius: 22,
  },
  actionBtnWhiteText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0095F6',
  },
  // Glass/transparent button (secondary action)
  actionBtnGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  actionBtnGlassText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Tags
  privacyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  privacyTagPrivate: {
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  privacyTagPublic: {
    backgroundColor: 'rgba(16, 185, 129, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  privacyTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Member Drilldown View
  memberTierSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    backgroundColor: '#0095F6',
    borderRadius: 20,
  },
  memberTierSummaryPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  memberTierSummaryDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 3,
  },
  memberCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  memberCountPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0095F6',
  },
  subscriberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  subscriberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.border,
  },
  subscriberName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subscriberHandle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  subscriberJoined: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  subscriberActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  activeStatusPill: {
    backgroundColor: '#E8F8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
  },
  subscriberMsgBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Empty Card
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0095F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  emptyCreateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSafeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  priceLockedWrapper: {
    marginBottom: 14,
  },
  priceLockedNote: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 15,
    marginTop: 4,
    paddingHorizontal: 2,
    fontStyle: 'italic',
  },
  priceCurrencySymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  pricePeriodSuffix: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  toggleSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#0095F6',
    borderColor: '#0095F6',
  },
  benefitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  benefitItemText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  addBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 24,
  },
  addBenefitInput: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addBenefitBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0095F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  saveTierButton: {
    backgroundColor: '#0095F6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTierButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
