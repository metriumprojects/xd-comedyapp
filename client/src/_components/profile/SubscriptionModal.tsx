import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@/lib/storage';
import * as Haptics from 'expo-haptics';
import { useStripe, PaymentSheet } from '@stripe/stripe-react-native';
import { subscriptionService, TierResponse } from '@/src/_services/subscriptionService';
import { resolveCanonicalUserId } from '@/lib/currentUser';
import { feedEventEmitter } from '@/lib/feedEventEmitter';
import COLORS from '@/src/theme/colors';

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  isOwnProfile: boolean;
  creatorId: string;
  onSubscriptionChange?: (subscribed: boolean) => void;
  initialTierId?: string;
  autoPromptCancel?: boolean;
}

export interface SubscriptionData {
  title: string;
  description: string;
  price: string;
  createGroupChat: boolean;
  included: string[];
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  visible,
  onClose,
  isOwnProfile,
  creatorId,
  onSubscriptionChange,
  initialTierId,
  autoPromptCancel,
}) => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [step, setStep] = useState<'membership' | 'form' | 'benefits'>('membership');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [createGroupChat, setCreateGroupChat] = useState(false);
  const [included, setIncluded] = useState<string[]>(['Access videos 48H before everyone else']);
  const [newItem, setNewItem] = useState('');
  const [isAddingBenefit, setIsAddingBenefit] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserFirebaseUid, setCurrentUserFirebaseUid] = useState<string | null>(null);
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);

  const [savedTiers, setSavedTiers] = useState<TierResponse[]>([]);
  const [selectedTier, setSelectedTier] = useState<TierResponse | null>(null);
  const [activeTierIds, setActiveTierIds] = useState<string[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const fetchUserIds = async () => {
      try {
        const [uid, fuid, uuid] = await Promise.all([
          resolveCanonicalUserId(),
          AsyncStorage.getItem('firebaseUid'),
          AsyncStorage.getItem('uid')
        ]);
        setCurrentUserId(uid || '');
        setCurrentUserFirebaseUid(fuid || '');
        setCurrentUserUid(uuid || '');
      } catch {
        setCurrentUserId('');
        setCurrentUserFirebaseUid('');
        setCurrentUserUid('');
      }
    };
    fetchUserIds();
  }, [visible]);

  const resolvedIsOwnProfile = useMemo(() => {
    if (isOwnProfile) return true;
    if (!creatorId) return false;
    const selfIds = [currentUserId, currentUserFirebaseUid, currentUserUid]
      .filter(Boolean)
      .map(id => String(id).toLowerCase());
    return selfIds.includes(String(creatorId).toLowerCase());
  }, [isOwnProfile, creatorId, currentUserId, currentUserFirebaseUid, currentUserUid]);

  useEffect(() => {
    if (!visible || !creatorId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const tiersResponse = await subscriptionService.getTiers(creatorId);

        // Filter out archived (soft-deleted) tiers — those still live on the
        // profile as read-only "Archived" folders for owner + existing subscribers,
        // but Manage Subscription should only surface tiers that can actively be
        // edited or subscribed to. Everything else would just confuse the user.
        const activeTiers = (tiersResponse.success && Array.isArray(tiersResponse.data))
          ? tiersResponse.data.filter((t: any) => !(t?.isArchived || (t as any)?.isActive === false))
          : [];

        if (activeTiers.length > 0) {
          setSavedTiers(activeTiers);

          let targetTier: any = activeTiers[0];
          setSelectedTier((prev) => {
            if (prev && activeTiers.some((t: any) => t._id === prev._id)) {
              targetTier = activeTiers.find((t: any) => t._id === prev._id)!;
            } else if (initialTierId && activeTiers.some((t: any) => t._id === initialTierId)) {
              targetTier = activeTiers.find((t: any) => t._id === initialTierId)!;
            } else {
              targetTier = activeTiers[0];
            }
            return targetTier;
          });

          setTitle(targetTier.title);
          setDescription(targetTier.description);
          setPrice(targetTier.price);
          setCreateGroupChat(targetTier.createGroupChat);
          setIncluded(targetTier.benefits || []);
          setStep('membership');
        } else {
          setSavedTiers([]);
          setSelectedTier(null);
          if (currentUserId !== null || isOwnProfile) {
            if (!resolvedIsOwnProfile) {
              Alert.alert(
                'Subscription Not Available',
                'This creator has not set up any subscription offers yet.',
                [{ text: 'OK', onPress: onClose }]
              );
            } else {
              // No active tiers → owner sees the create form so they can start a new one.
              setTitle('');
              setDescription('');
              setPrice('');
              setCreateGroupChat(false);
              setIncluded(['Access videos 48H before everyone else']);
              setStep('form');
            }
          }
        }

        if (!resolvedIsOwnProfile && currentUserId) {
          try {
            const statusResponse = await subscriptionService.checkSubscriptionStatus(creatorId);
            if (statusResponse.success) {
              const freshSubscribed = statusResponse.data.isSubscribed;
              setIsSubscribed(freshSubscribed);
              
              const activeTiers = statusResponse.data.activeTierIds || [];
              setActiveTierIds(activeTiers);
              setSubscriptions(statusResponse.data.subscriptions || []);

              const key = `sub_subscribed_${currentUserId}_to_${creatorId}`;
              await AsyncStorage.setItem(key, freshSubscribed ? 'true' : 'false');

              for (const tierId of activeTiers) {
                await AsyncStorage.setItem(`sub_subscribed_${currentUserId}_to_tier_${tierId}`, 'true');
              }
              
              if (onSubscriptionChange) {
                onSubscriptionChange(freshSubscribed);
              }
            }
          } catch (e) {
            console.warn('[SubscriptionModal] Error checking subscription status:', e);
          }
        }
      } catch (error) {
        console.warn('[SubscriptionModal] Error loading data:', error);
        if (resolvedIsOwnProfile) {
          setStep('form');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [visible, creatorId, currentUserId, isOwnProfile, initialTierId]);

  const handleAddIncluded = () => {
    if (!newItem.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIncluded([...included, newItem.trim()]);
    setNewItem('');
    setIsAddingBenefit(false);
  };

  const handleRemoveIncluded = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIncluded(included.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (!title.trim() || !description.trim() || !price.trim()) {
      Alert.alert('Fields Required', 'Please fill in the title, description, and price.');
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 1) {
      Alert.alert('Invalid Price', 'Price must be at least $1.00.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setStep('confirm');
  };

  const handleCreateSubscription = async () => {
    setIsLoading(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      const response = await subscriptionService.createTier({
        tierId: selectedTier?._id || undefined,
        title: title.trim(),
        description: description.trim(),
        price: price.trim(),
        benefits: included,
        createGroupChat,
      });

      if (response.success && response.data) {
        const tiersRes = await subscriptionService.getTiers(creatorId);
        if (tiersRes.success) {
          setSavedTiers(tiersRes.data);
          const updatedTier = tiersRes.data.find(t => t.title === response.data.title) || response.data;
          setSelectedTier(updatedTier);
          setTitle(updatedTier.title);
          setDescription(updatedTier.description);
          setPrice(updatedTier.price);
          setCreateGroupChat(updatedTier.createGroupChat);
          setIncluded(updatedTier.benefits || []);
        } else {
          setSelectedTier(response.data);
        }
        setStep('membership');
        Alert.alert('Success', 'Subscription tier has been saved successfully!');
      } else {
        Alert.alert('Error', 'Failed to save subscription tier.');
      }
    } catch (error: any) {
      console.error('[SubscriptionModal] Create tier error:', error);
      Alert.alert('Error', error?.response?.data?.error || 'Failed to save subscription tier.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStep('form');
  };

  const isSelectedTierSubscribed = useMemo(() => {
    if (!selectedTier) return false;
    return activeTierIds.includes(selectedTier._id);
  }, [selectedTier, activeTierIds]);

  const selectedSubscription = useMemo(() => {
    if (!selectedTier || !subscriptions) return null;
    return subscriptions.find(s => String(s.tierId) === String(selectedTier._id)) || null;
  }, [selectedTier, subscriptions]);

  const selectedSubscriptionId = selectedSubscription?.id || null;
  const isSelectedTierCancelAtPeriodEnd = selectedSubscription?.cancelAtPeriodEnd || false;
  const selectedTierPeriodEnd = selectedSubscription?.currentPeriodEnd || null;

  const handleSubscribeToggle = useCallback(async () => {
    if (!selectedTier?._id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    if (isSelectedTierSubscribed) {
      if (isSelectedTierCancelAtPeriodEnd) {
        Alert.alert(
          'Already Canceled',
          `Your subscription to ${selectedTier.title} has already been canceled. You will continue to have full access until ${selectedTierPeriodEnd ? new Date(selectedTierPeriodEnd).toLocaleDateString() : 'the end of your billing period'}.`
        );
        return;
      }

      if (!selectedSubscriptionId) {
        Alert.alert('Error', 'No active subscription found to cancel.');
        return;
      }

      Alert.alert(
        'Unsubscribe',
        `Are you sure you want to unsubscribe from ${selectedTier.title}? You'll keep access until the end of your billing period.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unsubscribe',
            style: 'destructive',
            onPress: async () => {
              setIsLoading(true);
              try {
                const result = await subscriptionService.cancelSubscription(selectedSubscriptionId);
                if (result.success) {
                  setSubscriptions(prev => prev.map(s => {
                    if (s.id === selectedSubscriptionId) {
                      return {
                        ...s,
                        cancelAtPeriodEnd: true,
                        currentPeriodEnd: result.data.currentPeriodEnd || s.currentPeriodEnd,
                      };
                    }
                    return s;
                  }));

                  await AsyncStorage.removeItem(`sub_subscribed_${currentUserId}_to_tier_${selectedTier._id}`);

                  const statusResponse = await subscriptionService.checkSubscriptionStatus(creatorId);
                  if (statusResponse.success) {
                    const freshSubscribed = statusResponse.data.isSubscribed;
                    setIsSubscribed(freshSubscribed);
                    setActiveTierIds(statusResponse.data.activeTierIds || []);
                    if (onSubscriptionChange) {
                      onSubscriptionChange(freshSubscribed);
                    }
                  }

                  Alert.alert(
                    'Unsubscribed',
                    `Your subscription to ${selectedTier.title} will end at the end of your billing period.`
                  );
                }
              } catch (error: any) {
                console.error('[SubscriptionModal] Cancel error:', error);
                Alert.alert('Error', error?.response?.data?.error || 'Failed to cancel subscription.');
              } finally {
                setIsLoading(false);
              }
            }
          }
        ]
      );
    } else {
      setIsPaymentLoading(true);
      try {
        const response = await subscriptionService.subscribe(selectedTier._id);

        if (!response.success || !response.data?.clientSecret) {
          throw new Error('Failed to initiate subscription');
        }

        const { clientSecret, customerId } = response.data;

        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          customerId: customerId,
          merchantDisplayName: 'Travel Social',
          style: 'automatic',
          defaultBillingDetails: {
            name: '',
          },
          billingDetailsCollectionConfiguration: {
            address: PaymentSheet.AddressCollectionMode.NEVER,
          },
        });

        if (initError) {
          console.error('[SubscriptionModal] Payment Sheet init error:', initError);
          Alert.alert('Error', 'Unable to initialize payment. Please try again.');
          return;
        }

        const { error: presentError } = await presentPaymentSheet();

        if (presentError) {
          if (presentError.code === 'Canceled') {
            return;
          }
          console.error('[SubscriptionModal] Payment Sheet error:', presentError);
          Alert.alert('Payment Failed', presentError.message || 'Something went wrong. Please try again.');
          return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        
        // Cache immediately for instant UI unlock
        await AsyncStorage.setItem(`sub_subscribed_${currentUserId}_to_tier_${selectedTier._id}`, 'true');
        await AsyncStorage.setItem(`sub_subscribed_${currentUserId}_to_${creatorId}`, 'true');

        // CRITICAL: Confirm the subscription with the backend first.
        // This syncs Stripe's live status to our DB, bypassing the webhook delay.
        // Without this, the DB record stays "incomplete" and status checks fail.
        try {
          await subscriptionService.confirmSubscription(response.data.subscriptionId);
          console.log('[SubscriptionModal] Subscription confirmed with backend');
        } catch (confirmErr) {
          console.warn('[SubscriptionModal] Confirm call failed (webhook will handle it):', confirmErr);
        }

        // Now check status — the DB should be updated
        const statusResponse = await subscriptionService.checkSubscriptionStatus(creatorId);
        if (statusResponse.success && statusResponse.data.isSubscribed) {
          setIsSubscribed(true);
          setActiveTierIds(statusResponse.data.activeTierIds || []);
          setSubscriptions(statusResponse.data.subscriptions || []);
          
          if (onSubscriptionChange) {
            onSubscriptionChange(true);
          }
        } else {
          // Fallback: even if the status check didn't return active yet,
          // we know payment succeeded — set UI state optimistically
          setIsSubscribed(true);
          setActiveTierIds(prev => [...new Set([...prev, selectedTier._id])]);
          if (onSubscriptionChange) {
            onSubscriptionChange(true);
          }
        }

        // Emit event to unlock posts in the feed and profile grid
        feedEventEmitter.emitUserSubscribed(creatorId);

        Alert.alert('Subscribed!', `You are now subscribed to ${selectedTier.title} for $${selectedTier.price}/month!`);

      } catch (error: any) {
        console.error('[SubscriptionModal] Subscribe error:', error);
        const errorMsg = error?.response?.data?.error || error?.message || 'Failed to subscribe. Please try again.';
        Alert.alert('Error', errorMsg);
      } finally {
        setIsPaymentLoading(false);
      }
    }
  }, [
    isSelectedTierSubscribed,
    selectedSubscriptionId,
    selectedTier,
    initPaymentSheet,
    presentPaymentSheet,
    currentUserId,
    creatorId,
    onSubscriptionChange,
    activeTierIds,
  ]);

  const hasAutoPromptedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      hasAutoPromptedRef.current = false;
      return;
    }

    if (autoPromptCancel && !hasAutoPromptedRef.current && selectedTier && isSelectedTierSubscribed && !isSelectedTierCancelAtPeriodEnd) {
      hasAutoPromptedRef.current = true;
      const timer = setTimeout(() => {
        handleSubscribeToggle();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [visible, autoPromptCancel, selectedTier?._id, isSelectedTierSubscribed, isSelectedTierCancelAtPeriodEnd, handleSubscribeToggle]);

  const renderForm = () => (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Title (max 100 characters)"
          placeholderTextColor={COLORS.textMuted}
          maxLength={100}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Description (max 300 characters)"
          placeholderTextColor={COLORS.textMuted}
          maxLength={300}
          multiline
          numberOfLines={3}
          value={description}
          onChangeText={setDescription}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Price</Text>
        <TextInput
          style={styles.input}
          placeholder="Price in dollars (min $1.00)"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
        />
      </View>

      <TouchableOpacity 
        style={styles.checkboxRow} 
        activeOpacity={0.8}
        onPress={() => setCreateGroupChat(!createGroupChat)}
      >
        <View style={[styles.checkbox, createGroupChat && styles.checkboxChecked]}>
          {createGroupChat && <Ionicons name="checkmark" size={14} color={COLORS.textLight} />}
        </View>
        <Text style={styles.checkboxLabel}>
          Create a group chat with the members of this subscription tier.
        </Text>
      </TouchableOpacity>

      <View style={styles.includedSection}>
        <Text style={styles.includedHeader}>What is included?</Text>
        
        {included.map((item, idx) => (
          <View key={idx} style={styles.includedRow}>
            <Text style={styles.includedText}>{item}</Text>
            <TouchableOpacity onPress={() => handleRemoveIncluded(idx)}>
              <Feather name="x" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        ))}

        {isAddingBenefit ? (
          <View style={styles.addIncludedRow}>
            <TextInput
              style={styles.addInput}
              placeholder="E.g., Early video access"
              placeholderTextColor={COLORS.textMuted}
              value={newItem}
              onChangeText={setNewItem}
              onSubmitEditing={handleAddIncluded}
              autoFocus
            />
            <TouchableOpacity style={styles.addConfirmBtn} onPress={handleAddIncluded}>
              <Feather name="check" size={18} color={COLORS.info} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addCancelBtn} onPress={() => { setIsAddingBenefit(false); setNewItem(''); }}>
              <Feather name="x" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.addTriggerBtn} 
            onPress={() => setIsAddingBenefit(true)}
          >
            <Feather name="plus" size={14} color={COLORS.info} style={{ marginRight: 4 }} />
            <Text style={styles.addTriggerText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.primaryBtn, isLoading && { opacity: 0.6 }]} 
        onPress={handleNext}
        disabled={isLoading}
      >
        <Text style={styles.primaryBtnText}>Next</Text>
      </TouchableOpacity>
      
      {savedTiers.length > 0 && (
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('membership')}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  const renderConfirm = () => (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.confirmHeader}>
        <Text style={styles.confirmHeaderTitle}>Confirm details</Text>
        <Text style={styles.confirmHeaderSub}>Please review subscription details before saving.</Text>
      </View>

      <View style={styles.confirmCard}>
        <Text style={styles.confirmTitleLabel}>Title</Text>
        <Text style={styles.confirmTitleValue}>{title}</Text>

        <Text style={styles.confirmDescLabel}>Description</Text>
        <Text style={styles.confirmDescValue}>{description}</Text>

        <Text style={styles.confirmPriceLabel}>Monthly Price</Text>
        <Text style={styles.confirmPriceValue}>${price}/month</Text>

        <View style={styles.confirmGroupChatRow}>
          <Feather 
            name={createGroupChat ? "message-square" : "slash"} 
            size={16} 
            color={createGroupChat ? COLORS.info : COLORS.textMuted} 
            style={{ marginRight: 8 }}
          />
          <Text style={styles.confirmGroupChatText}>
            {createGroupChat ? 'Create member group chat' : 'No group chat creation'}
          </Text>
        </View>

        <View style={styles.confirmBenefitsSection}>
          <Text style={styles.confirmBenefitsLabel}>Included Perks:</Text>
          {included.map((item, idx) => (
            <View key={idx} style={styles.confirmBenefitRow}>
              <Feather name="check" size={12} color={COLORS.info} style={{ marginRight: 6 }} />
              <Text style={styles.confirmBenefitText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.primaryBtn, isLoading && { opacity: 0.6 }]} 
        onPress={handleCreateSubscription}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={COLORS.textLight} size="small" />
        ) : (
          <Text style={styles.primaryBtnText}>
            {selectedTier ? 'Save Changes' : 'Create subscription'}
          </Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('form')}>
        <Text style={styles.secondaryBtnText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderMembership = () => (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 16 }}
      >
        {savedTiers.map((tier) => {
          const isSel = selectedTier?._id === tier._id;
          const isSub = activeTierIds.includes(tier._id);
          return (
            <TouchableOpacity
              key={tier._id}
              style={[
                styles.tierChip,
                isSel && styles.tierChipActive,
                !isSel && isSub && { borderColor: COLORS.success, borderWidth: 1 }
              ]}
              onPress={() => {
                setSelectedTier(tier);
                setTitle(tier.title);
                setDescription(tier.description);
                setPrice(tier.price);
                setCreateGroupChat(tier.createGroupChat);
                setIncluded(tier.benefits || []);
              }}
            >
              <Text style={[
                styles.tierChipText,
                isSel && styles.tierChipTextActive,
                !isSel && isSub && { color: COLORS.success }
              ]}>
                {tier.title} {isSub ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
        {resolvedIsOwnProfile && (
          <TouchableOpacity
            style={[styles.tierChip, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}
            onPress={() => {
              setSelectedTier(null);
              setTitle('');
              setDescription('');
              setPrice('');
              setCreateGroupChat(false);
              setIncluded(['Access videos 48H before everyone else']);
              setStep('form');
            }}
          >
            <Text style={[styles.tierChipText, { color: COLORS.info }]}>+ Add Tier</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {selectedTier && (
        <View style={styles.membershipCard}>
          <Text style={styles.membershipTitle}>{title}</Text>
          <Text style={styles.membershipDesc}>{description}</Text>

          <View style={styles.membershipBenefits}>
            {included.map((item, idx) => (
              <View key={idx} style={styles.benefitRow}>
                <Feather name="check" size={14} color={COLORS.textLight} style={{ marginRight: 8 }} />
                <Text style={styles.benefitText}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.membershipPrice}>${price} per month</Text>

          {isSelectedTierCancelAtPeriodEnd && selectedTierPeriodEnd && (
            <View style={styles.cancelNotice}>
              <Feather name="info" size={14} color={COLORS.warning} style={{ marginRight: 6 }} />
              <Text style={styles.cancelNoticeText}>
                Cancels {new Date(selectedTierPeriodEnd).toLocaleDateString()}
              </Text>
            </View>
          )}

          {!resolvedIsOwnProfile ? (
            <TouchableOpacity 
              style={[
                styles.subscribeBtn, 
                isSelectedTierSubscribed && styles.subscribedBtnActive,
                isSelectedTierCancelAtPeriodEnd && { backgroundColor: '#6c757d', borderColor: '#6c757d' },
                (isPaymentLoading || isLoading) && { opacity: 0.6 },
              ]} 
              onPress={handleSubscribeToggle}
              disabled={isPaymentLoading || isLoading || isSelectedTierCancelAtPeriodEnd}
              activeOpacity={0.8}
            >
              {isPaymentLoading ? (
                <ActivityIndicator color={isSelectedTierSubscribed ? COLORS.textLight : COLORS.black} size="small" />
              ) : (
                <>
                  <Feather 
                    name={isSelectedTierCancelAtPeriodEnd ? "clock" : (isSelectedTierSubscribed ? "check" : "star")} 
                    size={16} 
                    color={isSelectedTierSubscribed ? COLORS.textLight : COLORS.black} 
                    style={{ marginRight: 8 }} 
                  />
                  <Text style={[styles.subscribeBtnText, isSelectedTierSubscribed && styles.subscribedBtnTextActive]}>
                    {isSelectedTierCancelAtPeriodEnd 
                      ? 'Canceled' 
                      : (isSelectedTierSubscribed ? 'Subscribed' : 'Subscribe')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 10 }}>
              <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {resolvedIsOwnProfile && selectedTier && (
        <View style={{ gap: 10, marginTop: 20 }}>
          <TouchableOpacity 
            style={styles.deleteBtn} 
            onPress={() => {
              Alert.alert(
                'Delete Tier',
                'Are you sure you want to delete this subscription tier? Active subscribers will keep access until their billing period ends.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Delete', 
                    style: 'destructive',
                    onPress: async () => {
                      setIsLoading(true);
                      try {
                        await subscriptionService.deleteTier(selectedTier._id);

                        const res = await subscriptionService.getTiers(creatorId);
                        const remainingActive = (res.success && Array.isArray(res.data))
                          ? res.data.filter((t: any) => !(t?.isArchived || (t as any)?.isActive === false))
                          : [];

                        if (remainingActive.length > 0) {
                          setSavedTiers(remainingActive);
                          const dt = remainingActive[0];
                          setSelectedTier(dt);
                          setTitle(dt.title);
                          setDescription(dt.description);
                          setPrice(dt.price);
                          setCreateGroupChat(dt.createGroupChat);
                          setIncluded(dt.benefits || []);
                        } else {
                          setSavedTiers([]);
                          setSelectedTier(null);
                          setStep('form');
                          setTitle('');
                          setDescription('');
                          setPrice('');
                          setIncluded(['Access videos 48H before everyone else']);
                        }
                        Alert.alert('Deleted', 'Subscription tier has been removed.');
                      } catch (error: any) {
                        console.error('[SubscriptionModal] Delete error:', error);
                        Alert.alert('Error', 'Failed to delete subscription tier.');
                      } finally {
                        setIsLoading(false);
                      }
                    } 
                  }
                ]
              );
            }}
          >
            <Text style={styles.deleteBtnText}>Delete Subscription Tier</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>
              {step === 'membership' ? 'Membership' : 'Create subscription'}
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Feather name="x" size={20} color={COLORS.black} />
            </TouchableOpacity>
          </View>

          {isLoading && step !== 'confirm' && step !== 'membership' ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.info} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (
            <>
              {step === 'form' && renderForm()}
              {step === 'confirm' && renderConfirm()}
              {step === 'membership' && renderMembership()}
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '50%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.black,
    backgroundColor: COLORS.surface,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: COLORS.textPrimary,
    borderColor: COLORS.textPrimary,
  },
  checkboxLabel: {
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  includedSection: {
    marginBottom: 24,
  },
  includedHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  includedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  includedText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 10,
  },
  addIncludedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: COLORS.surface,
  },
  addConfirmBtn: {
    padding: 8,
  },
  addCancelBtn: {
    padding: 8,
  },
  addTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  addTriggerText: {
    fontSize: 13,
    color: COLORS.info,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: COLORS.black,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: COLORS.textLight,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  secondaryBtnText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  tierChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
  },
  tierChipActive: {
    borderWidth: 1,
    borderColor: COLORS.black,
    backgroundColor: COLORS.black,
  },
  tierChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tierChipTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  membershipCard: {
    backgroundColor: COLORS.info,
    borderRadius: 24,
    padding: 20,
  },
  membershipTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 6,
  },
  membershipDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    marginBottom: 16,
  },
  membershipBenefits: {
    gap: 10,
    marginBottom: 20,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  membershipPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 16,
  },
  cancelNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  cancelNoticeText: {
    fontSize: 12,
    color: COLORS.warning,
    fontWeight: '600',
  },
  subscribeBtn: {
    backgroundColor: COLORS.warning,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 24,
  },
  subscribeBtnText: {
    color: COLORS.black,
    fontSize: 15,
    fontWeight: '700',
  },
  subscribedBtnActive: {
    backgroundColor: COLORS.success,
  },
  subscribedBtnTextActive: {
    color: COLORS.textLight,
  },
  editBtn: {
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 24,
  },
  editBtnText: {
    color: COLORS.textLight,
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  deleteBtnText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  confirmHeader: {
    marginBottom: 20,
  },
  confirmHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 6,
  },
  confirmHeaderSub: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  confirmCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    backgroundColor: COLORS.surface,
  },
  confirmTitleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  confirmTitleValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 16,
  },
  confirmDescLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  confirmDescValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 16,
  },
  confirmPriceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  confirmPriceValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 16,
  },
  confirmGroupChatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmGroupChatText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  confirmBenefitsSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
  },
  confirmBenefitsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  confirmBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  confirmBenefitText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
