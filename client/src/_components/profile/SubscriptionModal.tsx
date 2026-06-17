import React, { useState, useEffect, useMemo } from 'react';
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
  Alert
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@/lib/storage';
import * as Haptics from 'expo-haptics';

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  isOwnProfile: boolean;
  creatorId: string;
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
  creatorId
}) => {
  const [step, setStep] = useState<'form' | 'confirm' | 'membership'>('form');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [createGroupChat, setCreateGroupChat] = useState(false);
  const [included, setIncluded] = useState<string[]>(['Access videos 48H before everyone else']);
  const [newItem, setNewItem] = useState('');
  const [isAddingBenefit, setIsAddingBenefit] = useState(false);
  
  // Storage keys
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserFirebaseUid, setCurrentUserFirebaseUid] = useState<string | null>(null);
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [savedSub, setSavedSub] = useState<SubscriptionData | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const storageKey = `sub_tier_${creatorId}`;
  const subscribedKey = currentUserId ? `sub_subscribed_${currentUserId}_to_${creatorId}` : null;

  // Load current user ID and aliases
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('userId'),
      AsyncStorage.getItem('firebaseUid'),
      AsyncStorage.getItem('uid')
    ]).then(([uid, fuid, uuid]) => {
      setCurrentUserId(uid || '');
      setCurrentUserFirebaseUid(fuid || '');
      setCurrentUserUid(uuid || '');
    }).catch(() => {
      setCurrentUserId('');
      setCurrentUserFirebaseUid('');
      setCurrentUserUid('');
    });
  }, []);

  const resolvedIsOwnProfile = useMemo(() => {
    if (isOwnProfile) return true;
    if (!creatorId) return false;
    const selfIds = [currentUserId, currentUserFirebaseUid, currentUserUid]
      .filter(Boolean)
      .map(id => String(id).toLowerCase());
    return selfIds.includes(String(creatorId).toLowerCase());
  }, [isOwnProfile, creatorId, currentUserId, currentUserFirebaseUid, currentUserUid]);

  // Load existing subscription from AsyncStorage
  useEffect(() => {
    if (visible && creatorId) {
      AsyncStorage.getItem(storageKey)
        .then((data) => {
          if (data) {
            const parsed = JSON.parse(data) as SubscriptionData;
            setSavedSub(parsed);
            setTitle(parsed.title);
            setDescription(parsed.description);
            setPrice(parsed.price);
            setCreateGroupChat(parsed.createGroupChat);
            setIncluded(parsed.included || []);
            setStep('membership');
          } else {
            if (currentUserId !== null || isOwnProfile) {
              if (!resolvedIsOwnProfile) {
                Alert.alert(
                  'Subscription Not Available',
                  'This creator has not set up any subscription offers yet.',
                  [{ text: 'OK', onPress: onClose }]
                );
              } else {
                setSavedSub(null);
                setTitle('');
                setDescription('');
                setPrice('');
                setCreateGroupChat(false);
                setIncluded(['Access videos 48H before everyone else']);
                setStep('form');
              }
            }
          }
        })
        .catch(() => {});
    }
  }, [visible, creatorId, resolvedIsOwnProfile, currentUserId, isOwnProfile, onClose]);

  // Load subscribed status for visitors
  useEffect(() => {
    if (visible && subscribedKey) {
      AsyncStorage.getItem(subscribedKey)
        .then((val) => {
          setIsSubscribed(val === 'true');
        })
        .catch(() => {});
    }
  }, [visible, subscribedKey]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setStep('confirm');
  };

  const handleCreateSubscription = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const payload: SubscriptionData = {
      title: title.trim(),
      description: description.trim(),
      price: price.trim(),
      createGroupChat,
      included
    };

    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(payload));
      setSavedSub(payload);
      setStep('membership');
      Alert.alert('Success', 'Subscription tier has been created successfully!');
    } catch {
      Alert.alert('Error', 'Failed to save subscription tier.');
    }
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStep('form');
  };

  const handleSubscribeToggle = async () => {
    if (!subscribedKey) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    
    const metaKey = currentUserId ? `sub_meta_${currentUserId}_to_${creatorId}` : null;

    if (isSubscribed) {
      Alert.alert(
        'Unsubscribe',
        `Are you sure you want to unsubscribe from ${title}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Unsubscribe', 
            style: 'destructive',
            onPress: async () => {
              await AsyncStorage.removeItem(subscribedKey);
              setIsSubscribed(false);
              
              if (metaKey) {
                try {
                  const metaVal = await AsyncStorage.getItem(metaKey);
                  if (metaVal) {
                    const parsed = JSON.parse(metaVal);
                    parsed.status = 'canceled';
                    parsed.canceledAt = Date.now();
                    await AsyncStorage.setItem(metaKey, JSON.stringify(parsed));
                  } else {
                    await AsyncStorage.setItem(metaKey, JSON.stringify({
                      creatorId,
                      title: title || 'One Creator',
                      price: price || '10.00',
                      subscribedAt: Date.now() - 86400000,
                      status: 'canceled',
                      canceledAt: Date.now()
                    }));
                  }
                } catch (e) {}
              }

              Alert.alert('Unsubscribed', `You have unsubscribed from ${title}.`);
            } 
          }
        ]
      );
    } else {
      await AsyncStorage.setItem(subscribedKey, 'true');
      setIsSubscribed(true);

      if (metaKey) {
        try {
          await AsyncStorage.setItem(metaKey, JSON.stringify({
            creatorId,
            title: title || 'One Creator',
            price: price || '10.00',
            subscribedAt: Date.now(),
            status: 'active'
          }));
        } catch (e) {}
      }

      Alert.alert('Subscribed!', `You are now subscribed to ${title} for $${price}/month!`);
    }
  };

  const renderForm = () => (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Title (max 100 characters)"
          placeholderTextColor="#8e8e93"
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
          placeholderTextColor="#8e8e93"
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
          placeholder="Price in dollars"
          placeholderTextColor="#8e8e93"
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
          {createGroupChat && <Ionicons name="checkmark" size={14} color="#fff" />}
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
              <Feather name="x" size={16} color="#8e8e93" />
            </TouchableOpacity>
          </View>
        ))}

        {isAddingBenefit ? (
          <View style={styles.addIncludedRow}>
            <TextInput
              style={styles.addInput}
              placeholder="Add benefit..."
              placeholderTextColor="#8e8e93"
              value={newItem}
              onChangeText={setNewItem}
              onSubmitEditing={handleAddIncluded}
              autoFocus
            />
            <TouchableOpacity style={styles.addConfirmBtn} onPress={handleAddIncluded}>
              <Feather name="check" size={18} color="#007aff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addCancelBtn} onPress={() => { setIsAddingBenefit(false); setNewItem(''); }}>
              <Feather name="x" size={18} color="#ff3b30" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.addTriggerBtn} 
            onPress={() => setIsAddingBenefit(true)}
          >
            <Feather name="plus" size={14} color="#007aff" style={{ marginRight: 4 }} />
            <Text style={styles.addTriggerText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={handleNext}>
        <Text style={styles.primaryBtnText}>Next</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderConfirm = () => (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Title</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={title}
          editable={false}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea, styles.disabledInput]}
          value={description}
          multiline
          numberOfLines={3}
          editable={false}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Price</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={`$${price}`}
          editable={false}
        />
      </View>

      <View style={[styles.checkboxRow, { opacity: 0.7 }]}>
        <View style={[styles.checkbox, createGroupChat && styles.checkboxChecked]}>
          {createGroupChat && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <Text style={styles.checkboxLabel}>
          Create a group chat with the members of this subscription tier.
        </Text>
      </View>

      <View style={styles.includedSection}>
        <Text style={styles.includedHeader}>What is included?</Text>
        {included.map((item, idx) => (
          <View key={idx} style={styles.includedRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Feather name="check" size={14} color="#007aff" style={{ marginRight: 8 }} />
              <Text style={styles.includedText}>{item}</Text>
            </View>
            <TouchableOpacity onPress={() => handleRemoveIncluded(idx)}>
              <Feather name="x" size={16} color="#8e8e93" />
            </TouchableOpacity>
          </View>
        ))}

        {isAddingBenefit ? (
          <View style={styles.addIncludedRow}>
            <TextInput
              style={styles.addInput}
              placeholder="Add benefit..."
              placeholderTextColor="#8e8e93"
              value={newItem}
              onChangeText={setNewItem}
              onSubmitEditing={handleAddIncluded}
              autoFocus
            />
            <TouchableOpacity style={styles.addConfirmBtn} onPress={handleAddIncluded}>
              <Feather name="check" size={18} color="#007aff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addCancelBtn} onPress={() => { setIsAddingBenefit(false); setNewItem(''); }}>
              <Feather name="x" size={18} color="#ff3b30" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.addTriggerBtn} 
            onPress={() => setIsAddingBenefit(true)}
          >
            <Feather name="plus" size={14} color="#007aff" style={{ marginRight: 4 }} />
            <Text style={styles.addTriggerText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateSubscription}>
        <Text style={styles.primaryBtnText}>Create subscription</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('form')}>
        <Text style={styles.secondaryBtnText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderMembership = () => (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.tierSelector}>
        <View style={styles.tierChipActive}>
          <Text style={styles.tierChipTextActive}>{title || 'One creator'}</Text>
        </View>
      </View>

      <View style={styles.membershipCard}>
        <Text style={styles.membershipTitle}>{title || 'One creator'}</Text>
        <Text style={styles.membershipDesc}>{description}</Text>

        <View style={styles.membershipBenefits}>
          {included.map((item, idx) => (
            <View key={idx} style={styles.benefitRow}>
              <Feather name="check" size={14} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.benefitText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.membershipPrice}>${price || '0'} per month</Text>

        {!resolvedIsOwnProfile ? (
          <TouchableOpacity 
            style={[styles.subscribeBtn, isSubscribed && styles.subscribedBtnActive]} 
            onPress={handleSubscribeToggle}
          >
            <Feather name={isSubscribed ? "check" : "star"} size={16} color={isSubscribed ? "#fff" : "#000"} style={{ marginRight: 8 }} />
            <Text style={[styles.subscribeBtnText, isSubscribed && styles.subscribedBtnTextActive]}>
              {isSubscribed ? 'Subscribed' : 'Subscribe'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ gap: 10 }}>
            <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {resolvedIsOwnProfile && (
        <View style={{ gap: 10, marginTop: 20 }}>
          <TouchableOpacity 
            style={styles.primaryBtn} 
            onPress={() => {
              Alert.alert('Info', 'Only one subscription tier is supported in the current version.');
            }}
          >
            <Text style={styles.primaryBtnText}>Create subscription</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.deleteBtn} 
            onPress={() => {
              Alert.alert(
                'Delete Tier',
                'Are you sure you want to delete this subscription tier?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Delete', 
                    style: 'destructive',
                    onPress: async () => {
                      await AsyncStorage.removeItem(storageKey);
                      setSavedSub(null);
                      setStep('form');
                    } 
                  }
                ]
              );
            }}
          >
            <Text style={styles.deleteBtnText}>Delete Subscription</Text>
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
              <Feather name="x" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          {step === 'form' && renderForm()}
          {step === 'confirm' && renderConfirm()}
          {step === 'membership' && renderMembership()}
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
    backgroundColor: '#fff',
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
    color: '#000',
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8e8e93',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5ea',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: '#f2f2f7',
    color: '#8e8e93',
    borderColor: '#e5e5ea',
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
    borderColor: '#7a828a',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    lineHeight: 18,
  },
  includedSection: {
    marginBottom: 24,
  },
  includedHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  includedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  includedText: {
    fontSize: 13,
    color: '#1c1c1e',
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
    borderColor: '#e5e5ea',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#fafafa',
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
    color: '#007aff',
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#000',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
  },
  secondaryBtnText: {
    color: '#333',
    fontSize: 15,
    fontWeight: '600',
  },
  tierSelector: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  tierChipActive: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  tierChipTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  membershipCard: {
    backgroundColor: '#00a2ff',
    borderRadius: 24,
    padding: 20,
  },
  membershipTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
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
    color: '#fff',
  },
  membershipPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  subscribeBtn: {
    backgroundColor: '#FFD60A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 24,
  },
  subscribeBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  subscribedBtnActive: {
    backgroundColor: '#34c759',
  },
  subscribedBtnTextActive: {
    color: '#fff',
  },
  editBtn: {
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 24,
  },
  editBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  deleteBtnText: {
    color: '#ff3b30',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
