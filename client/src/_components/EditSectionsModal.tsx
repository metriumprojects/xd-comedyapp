import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  NestableScrollContainer,
  NestableDraggableFlatList,
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@/lib/storage';
import { apiService } from '../_services/apiService';
import { getUserSectionsSorted } from '../../lib/firebaseHelpers/getUserSectionsSorted';
import { addUserSection, deleteUserSection, updateUserSection } from '../../lib/firebaseHelpers/index';
import { updateUserSectionsOrder } from '../../lib/firebaseHelpers/updateUserSectionsOrder';
import COLORS from '@/src/theme/colors';

const SECTION_NAME_MIN = 2;
const SECTION_NAME_MAX = 30;
/** Letters, numbers, spaces, and light punctuation only — no emojis/symbols. */
const SECTION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _\-'.]*$/;

function normalizeSectionName(raw: string): string {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

function validateSectionName(
  raw: string,
  existingNames: string[],
  opts?: { ignoreName?: string }
): { ok: true; name: string } | { ok: false; error: string } {
  const name = normalizeSectionName(raw);
  if (!name) {
    return { ok: false, error: 'Please enter a section name' };
  }
  if (name.length < SECTION_NAME_MIN) {
    return { ok: false, error: `Name must be at least ${SECTION_NAME_MIN} characters` };
  }
  if (name.length > SECTION_NAME_MAX) {
    return { ok: false, error: `Name must be ${SECTION_NAME_MAX} characters or less` };
  }
  if (!SECTION_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      error: "Use letters, numbers, spaces, and - _ ' . only",
    };
  }
  const ignore = normalizeSectionName(opts?.ignoreName || '').toLowerCase();
  const duplicate = existingNames.some((n) => {
    const existing = normalizeSectionName(n).toLowerCase();
    if (!existing) return false;
    if (ignore && existing === ignore) return false;
    return existing === name.toLowerCase();
  });
  if (duplicate) {
    return { ok: false, error: 'A section with this name already exists' };
  }
  return { ok: true, name };
}

type Section = {
  _id?: string;
  name: string;
  postIds: string[];
  coverImage?: string;
  visibility?: 'public' | 'private' | 'specific';
  collaborators?: any[];
  allowedUsers?: string[]; // IDs for specific visibility
  allowedGroups?: string[]; // Group IDs for specific visibility
  userId?: string; // Owner ID
};

type Post = {
  _id: string;
  id?: string;
  imageUrl?: string;
  imageUrls?: string[];
};

type EditSectionsModalProps = {
  visible: boolean;
  onClose: () => void;
  userId: string; // The owner of the sections being viewed/edited
  currentUserId: string; // The logged-in user
  sections: Section[];
  posts: Post[];
  onSectionsUpdate: (sections: Section[]) => void;
};

export default function EditSectionsModal({
  visible,
  onClose,
  userId,
  currentUserId,
  sections,
  posts,
  onSectionsUpdate,
}: EditSectionsModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedSectionForEdit, setSelectedSectionForEdit] = useState<string | null>(null);
  const [sectionMode, setSectionMode] = useState<'select' | 'cover' | 'visibility' | 'collaborators'>('select');
  const [newSectionName, setNewSectionName] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const errorAnim = useRef(new Animated.Value(0)).current;
  const [collaboratorInput, setCollaboratorInput] = useState('');
  const isCreatingRef = useRef(false);

  const showValidationError = (msg: string) => {
    setCreateError(msg);
    errorAnim.setValue(0);
    Animated.spring(errorAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  };

  const hideValidationError = () => {
    if (createError) {
      setCreateError(null);
    }
  };

  // Groups and Followers for Visibility/Collabs
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [tempSelectedGroups, setTempSelectedGroups] = useState<string[]>([]);

  // Synchronous local state for immediate reordering and smooth UI updates
  const [localSections, setLocalSections] = useState<Section[]>(() => sections || []);

  useEffect(() => {
    if (visible && sections && sections.length > 0) {
      setLocalSections(sections);
    }
  }, [visible]);

  const isOwner = userId === currentUserId;
  const selectedSection = localSections.find(s => s.name === selectedSectionForEdit);
  const isCollaborator = selectedSection?.collaborators?.includes(currentUserId);
  const canManagePosts = isOwner || isCollaborator;

  const normalizeSections = (data: any): Section[] => {
    const arr = Array.isArray(data) ? data : [];
    return arr
      .map((s: any) => ({
        _id: s?._id ? String(s._id) : (s?.id ? String(s.id) : undefined),
        name: String(s?.name || ''),
        postIds: (Array.isArray(s?.postIds) ? s.postIds : []).filter((id: any): id is string => typeof id === 'string'),
        coverImage: typeof s?.coverImage === 'string' ? s.coverImage : undefined,
        visibility: (s?.visibility === 'public' || s?.visibility === 'private' || s?.visibility === 'specific') ? s.visibility : 'private',
        collaborators: Array.isArray(s?.collaborators) ? s.collaborators : [],
        allowedUsers: Array.isArray(s?.allowedUsers) ? s.allowedUsers : [],
        allowedGroups: Array.isArray(s?.allowedGroups) ? s.allowedGroups : [],
        userId: s?.userId,
      }))
      .filter((s: Section) => !!s.name);
  };

  const handleCreateSection = async () => {
    if (isCreatingRef.current || creatingSection) return;
    if (!userId) return;

    const validation = validateSectionName(
      newSectionName,
      localSections.map((s) => s.name)
    );
    if (!validation.ok) {
      showValidationError(validation.error);
      return;
    }
    hideValidationError();

    isCreatingRef.current = true;
    setCreatingSection(true);
    Keyboard.dismiss();

    try {
      const createResult = await addUserSection(userId, {
        name: validation.name,
        postIds: [],
        visibility: 'public',
        collaborators: [],
        allowedGroups: [],
      });

      if (createResult && createResult.success === false) {
        throw new Error(createResult.error || 'Failed to create section');
      }

      const res = await getUserSectionsSorted(userId);
      if (res.success && res.data) {
        const sectionsData = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data.data)
            ? res.data.data
            : [];
        const normalized = normalizeSections(sectionsData);
        setLocalSections(normalized);
        onSectionsUpdate(normalized);
      }

      setNewSectionName('');
      setShowCreateInput(false);
      setCreateError(null);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to create section');
    } finally {
      isCreatingRef.current = false;
      setCreatingSection(false);
    }
  };

  const handleDeleteSection = async (sectionName: string) => {
    if (!userId || !isOwner) return;
    Alert.alert('Delete section', `Delete "${sectionName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLocalSections(prev => prev.filter(s => s.name !== sectionName));
          const res = await deleteUserSection(userId, sectionName);
          if (!res.success) {
            Alert.alert('Error', res.error || 'Failed to delete section');
            const refreshed = await getUserSectionsSorted(userId);
            if (refreshed.success && refreshed.data) {
              const sectionsData = Array.isArray(refreshed.data) ? refreshed.data : (Array.isArray(refreshed.data.data) ? refreshed.data.data : []);
              const normalized = normalizeSections(sectionsData);
              setLocalSections(normalized);
              onSectionsUpdate(normalized);
            }
            return;
          }
          const refreshed = await getUserSectionsSorted(userId);
          if (refreshed.success && refreshed.data) {
            const sectionsData = Array.isArray(refreshed.data) ? refreshed.data : (Array.isArray(refreshed.data.data) ? refreshed.data.data : []);
            const normalized = normalizeSections(sectionsData);
            setLocalSections(normalized);
            onSectionsUpdate(normalized);
          }
          if (selectedSectionForEdit === sectionName) {
            setSelectedSectionForEdit(null);
          }
        },
      },
    ]);
  };

  const handleSelectSection = (sectionName: string) => {
    // Toggle: if same section clicked again, close it; otherwise open the new section
    if (selectedSectionForEdit === sectionName) {
      setSelectedSectionForEdit(null);
    } else {
      Keyboard.dismiss();
      setSelectedSectionForEdit(sectionName);
      setSectionMode('select');
      
      // Reset temp states for this section
      const section = localSections.find(s => s.name === sectionName);
      if (section) {
          setTempSelectedGroups(section.allowedGroups || []);
      }
    }
  };

  const loadGroups = async () => {
    if (!currentUserId) return;
    setLoadingGroups(true);
    try {
      const res = await apiService.get(`/groups?userId=${currentUserId}`);
      if (res?.success && Array.isArray(res.data)) setGroups(res.data);
    } catch (e) {
      console.error('loadGroups error', e);
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadFollowers = async () => {
    if (!currentUserId) return;
    setLoadingFollowers(true);
    try {
      const res = await apiService.get(`/follow/users/${currentUserId}/followers`);
      const list = res?.data || res || [];
      setFollowers(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('loadFollowers error', e);
    } finally {
      setLoadingFollowers(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (collaboratorInput.trim().length > 1) {
        setSearching(true);
        try {
          const res = await apiService.get(`/users/search?q=${encodeURIComponent(collaboratorInput)}&requesterUserId=${currentUserId}`);
          const list = Array.isArray(res) ? res : (res?.data || []);
          const normalized = list.map((u: any) => ({
            ...u,
            uid: u._id || u.firebaseUid,
            name: u.displayName || u.name || 'User',
            avatar: u.avatar || u.photoURL || u.profilePicture || ''
          }));
          setSearchResults(normalized);
        } catch (e) { console.error('search error', e); }
        finally { setSearching(false); }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [collaboratorInput, currentUserId]);

  useEffect(() => {
    if (visible && currentUserId) {
      loadGroups();
      loadFollowers();
    }
    if (!visible) {
      isCreatingRef.current = false;
      setCreatingSection(false);
      setShowCreateInput(false);
      setNewSectionName('');
      setCreateError(null);
    }
  }, [visible, currentUserId]);

  const handlePostSelection = async (post: Post) => {
    if (!userId || !selectedSectionForEdit) return;
    const section = localSections.find(s => s.name === selectedSectionForEdit);
    if (!section) return;

    const postId = post._id || post.id;
    if (!postId) return;
    console.log('Post selected:', postId, 'Mode:', sectionMode);

    if (sectionMode === 'cover') {
      const uri = post.imageUrl || post.imageUrls?.[0];
      console.log('Setting cover image:', uri);
      
      // Cover is just a thumbnail, don't add post to section automatically
      // Update local state immediately for instant feedback
      const updatedSections = localSections.map(s => 
        s.name === selectedSectionForEdit 
          ? { ...s, coverImage: uri }
          : s
      );
      setLocalSections(updatedSections);
      onSectionsUpdate(updatedSections);
      
      // Then save to Firebase - use section._id if available, otherwise name
      const sectionIdentifier = section._id || section.name;
      console.log('ðŸ’¾ Updating section with ID/name:', sectionIdentifier);
      const result = await updateUserSection(userId, sectionIdentifier, {
        name: section.name,
        postIds: section.postIds,
        coverImage: uri,
        visibility: section.visibility,
        collaborators: section.collaborators,
        allowedUsers: section.allowedUsers,
        allowedGroups: (section as any).allowedGroups
      }, currentUserId);
      console.log('âœ… Cover update result:', result);
      
      // Refresh from Firebase to ensure consistency
      const res = await getUserSectionsSorted(userId);
      console.log('ðŸ“‹ Fetched sections after cover update:', res);
      if (res.success && res.data) {
        const sectionsData = Array.isArray(res.data) ? res.data : (Array.isArray(res.data.data) ? res.data.data : []);
        console.log('ðŸ“‹ Extracted sections data:', sectionsData.length, 'sections');
        if (sectionsData.length > 0) {
          const normalized = normalizeSections(sectionsData);
          setLocalSections(normalized);
          onSectionsUpdate(normalized);
        } else {
          console.warn('âš ï¸ Sections data is empty, keeping current state');
        }
      } else {
        console.error('âŒ Failed to fetch sections after update:', res);
      }
    } else {
      const safePostIds = (Array.isArray(section.postIds) ? section.postIds : []).filter((id): id is string => typeof id === 'string');
      const newPostIds = safePostIds.includes(postId)
        ? safePostIds.filter(id => id !== postId)
        : [...safePostIds, postId];
      console.log('ðŸ“ Updating postIds:', newPostIds);
      
      // Update local state immediately for instant feedback
      const updatedSections = localSections.map(s => 
        s.name === selectedSectionForEdit 
          ? { ...s, postIds: newPostIds }
          : s
      );
      setLocalSections(updatedSections);
      onSectionsUpdate(updatedSections);
      
      // Then save to Firebase - use section._id if available, otherwise name
      const sectionIdentifier = section._id || section.name;
      console.log('ðŸ’¾ Updating section with ID/name:', sectionIdentifier);
      const result = await updateUserSection(userId, sectionIdentifier, {
        name: section.name,
        postIds: newPostIds,
        coverImage: section.coverImage,
        visibility: section.visibility,
        collaborators: section.collaborators,
        allowedUsers: section.allowedUsers,
        allowedGroups: (section as any).allowedGroups
      }, currentUserId);
      console.log('âœ… Post selection update result:', result);
      
      // Refresh from Firebase to ensure consistency
      const res = await getUserSectionsSorted(userId);
      console.log('ðŸ“‹ Fetched sections after post update:', res);
      if (res.success && res.data) {
        const sectionsData = Array.isArray(res.data) ? res.data : (Array.isArray(res.data.data) ? res.data.data : []);
        console.log('ðŸ“‹ Extracted sections data:', sectionsData.length, 'sections');
        if (sectionsData.length > 0) {
          const normalized = normalizeSections(sectionsData);
          setLocalSections(normalized);
          onSectionsUpdate(normalized);
        } else {
          console.warn('âš ï¸ Sections data is empty, keeping current state');
        }
      } else {
        console.error('âŒ Failed to fetch sections after update:', res);
      }
    }
  };

  const handleSave = () => {
    Keyboard.dismiss();
    setSelectedSectionForEdit(null);
    setSectionMode('select');
    setShowCreateInput(false);
    setCollaboratorInput('');
    onSectionsUpdate(localSections);
    onClose();
  };

  const renameSection = async (oldName: string, newName: string): Promise<boolean> => {
    if (!userId || !isOwner) return false;
    const validation = validateSectionName(
      newName,
      localSections.map((s) => s.name),
      { ignoreName: oldName }
    );
    if (!validation.ok) {
      Alert.alert('Invalid name', validation.error);
      return false;
    }
    if (validation.name === oldName) return true;

    const section = localSections.find(s => s.name === oldName);
    if (!section) return false;

    // Disallow renaming subscription folders
    const isSub = (section as any).isSubscriptionFolder || !!(section as any).tierId || String(section._id || '').startsWith('subscription-folder-');
    if (isSub) {
      Alert.alert('Cannot rename', 'Subscription tier sections cannot be renamed from here.');
      return false;
    }

    const sectionIdentifier = section._id || section.name;

    const resUpdate = await updateUserSection(userId, sectionIdentifier, {
      name: validation.name,
      postIds: section.postIds || [],
      coverImage: section.coverImage,
      visibility: section.visibility,
      collaborators: section.collaborators,
      allowedUsers: section.allowedUsers,
      allowedGroups: section.allowedGroups
    }, currentUserId);

    if (!resUpdate.success) {
      Alert.alert('Error', resUpdate.error || 'Failed to rename section');
      return false;
    }

    // Successfully saved on backend! Update local state and selected name in the same render
    const updatedSections = localSections.map(s =>
      s.name === oldName ? { ...s, name: validation.name } : s
    );
    setLocalSections(updatedSections);
    if (selectedSectionForEdit === oldName) {
      setSelectedSectionForEdit(validation.name);
    }
    onSectionsUpdate(updatedSections);
    return true;
  };

  const handleReorderSections = async (data: Section[]) => {
    // Immediately update local state synchronously to prevent ghost snapping
    setLocalSections(data);
    // Save order to Firebase / backend in background without triggering heavy refetchAll during drag
    if (userId && isOwner) {
      updateUserSectionsOrder(userId, data).catch((err) => {
        console.error('Failed to update sections order:', err);
      });
    }
  };

  const handleToggleVisibility = async (sectionName: string, v?: 'public' | 'private' | 'specific') => {
    if (!userId || !isOwner) return;
    const section = localSections.find(s => s.name === sectionName);
    if (!section) return;

    const newVisibility = v || (section.visibility === 'private' ? 'public' : 'private');

    // If specific, we might need to handle allowedUsers later
    const updatedSections = localSections.map(s =>
      s.name === sectionName ? { ...s, visibility: newVisibility } : s
    );
    setLocalSections(updatedSections);
    onSectionsUpdate(updatedSections);

    const sectionIdentifier = section._id || section.name;
    await updateUserSection(userId, sectionIdentifier, {
      name: section.name,
      postIds: section.postIds,
      coverImage: section.coverImage,
      visibility: newVisibility,
      collaborators: section.collaborators,
      allowedUsers: section.allowedUsers,
      allowedGroups: section.allowedGroups // Pass existing or updated
    }, currentUserId);
  };

  const updateSectionAllowedUsers = async (sectionName: string, allowedUsers: string[]) => {
    if (!userId || !isOwner) return;
    const section = localSections.find(s => s.name === sectionName);
    if (!section) return;

    const updatedSections = localSections.map(s =>
      s.name === sectionName ? { ...s, allowedUsers } : s
    );
    setLocalSections(updatedSections);
    onSectionsUpdate(updatedSections);

    const sectionIdentifier = section._id || section.name;
    await updateUserSection(userId, sectionIdentifier, {
      name: section.name,
      postIds: section.postIds,
      coverImage: section.coverImage,
      visibility: section.visibility,
      collaborators: section.collaborators,
      allowedUsers: allowedUsers,
      allowedGroups: tempSelectedGroups // Sync groups too
    }, currentUserId);
  };

  const toggleGroupSelection = (group: any) => {
    const section = localSections.find(s => s.name === selectedSectionForEdit);
    if (!section) return;

    setTempSelectedGroups(prev => {
      const exists = prev.some(sid => String(sid) === String(group._id));
      const nextGroups = exists 
        ? prev.filter(sid => String(sid) !== String(group._id)) 
        : [...prev, String(group._id)];
      
      // Calculate resulting allowedUsers
      let allMembers: string[] = [];
      groups.filter(g => nextGroups.some(sid => String(sid) === String(g._id))).forEach(g => {
        if (Array.isArray(g.members)) allMembers = [...allMembers, ...g.members];
      });
      const uniqueMembers = [...new Set(allMembers)];
      
      updateSectionAllowedUsers(section.name, uniqueMembers);
      return nextGroups;
    });
  };

  const isSameUser = (u1: any, u2: any) => {
    if (!u1 || !u2) return false;
    if (typeof u1 === 'string' && typeof u2 === 'string') return u1 === u2;
    
    const getIds = (u: any) => {
      if (typeof u === 'string') return [u];
      return [
        u._id ? String(u._id) : null,
        u.id ? String(u.id) : null,
        u.uid ? String(u.uid) : null,
        u.firebaseUid ? String(u.firebaseUid) : null
      ].filter(Boolean);
    };
    const ids1 = getIds(u1);
    const ids2 = getIds(u2);
    return ids1.some(id => ids2.includes(id));
  };

  const handleAddCollaboratorById = async (targetId: string) => {
    if (!userId || !isOwner || !selectedSectionForEdit || !targetId) return;
    const section = localSections.find(s => s.name === selectedSectionForEdit);
    if (!section) return;

    // Check if already a collaborator (could be ID or object)
    const exists = section.collaborators?.some((c: any) => isSameUser(c, targetId));
    if (exists) return;

    const newCollaborators = [...(section.collaborators || []), targetId];
    const updatedSections = localSections.map(s =>
      s.name === selectedSectionForEdit ? { ...s, collaborators: newCollaborators } : s
    );
    setLocalSections(updatedSections);
    onSectionsUpdate(updatedSections);

    const sectionIdentifier = section._id || section.name;
    await updateUserSection(userId, sectionIdentifier, {
      name: section.name,
      postIds: section.postIds,
      coverImage: section.coverImage,
      visibility: section.visibility,
      collaborators: newCollaborators,
      allowedUsers: section.allowedUsers,
      allowedGroups: tempSelectedGroups
    }, currentUserId);
  };

  const handleAddCollaborator = async () => {
      // Legacy support for text input if needed, but we mostly use by ID now
      handleAddCollaboratorById(collaboratorInput.trim());
      setCollaboratorInput('');
  };

  const handleRemoveCollaborator = async (collabId: string) => {
    if (!userId || !isOwner || !selectedSectionForEdit) return;
    const section = localSections.find(s => s.name === selectedSectionForEdit);
    if (!section) return;

    const newCollaborators = (section.collaborators || []).filter((c: any) => !isSameUser(c, collabId));
    const updatedSections = localSections.map(s =>
      s.name === selectedSectionForEdit ? { ...s, collaborators: newCollaborators } : s
    );
    setLocalSections(updatedSections);
    onSectionsUpdate(updatedSections);

    const sectionIdentifier = section._id || section.name;
    await updateUserSection(userId, sectionIdentifier, {
      name: section.name,
      postIds: section.postIds,
      coverImage: section.coverImage,
      visibility: section.visibility,
      collaborators: newCollaborators,
      allowedUsers: section.allowedUsers,
      allowedGroups: tempSelectedGroups
    }, currentUserId);
  };

  const renderSectionItem = ({ item, drag, isActive }: RenderItemParams<Section>) => (
    <SectionRow
      item={item}
      isSelected={selectedSectionForEdit === item.name}
      isActive={isActive}
      onPress={() => handleSelectSection(item.name)}
      onCloseCard={() => setSelectedSectionForEdit(null)}
      onDelete={() => handleDeleteSection(item.name)}
      onRename={renameSection}
      onToggleVisibility={() => handleToggleVisibility(item.name)}
      drag={drag}
      isOwner={isOwner}
    />
  );

  // Safety check: Don't render if no userId
  if (!userId) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? Math.max(insets.top, 44) : Math.max(insets.top, 12) }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleSave} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={COLORS.black} />
              </TouchableOpacity>
              <Text style={styles.title}>Edit sections</Text>
              <View style={{ width: 40 }} />
            </View>

            <NestableScrollContainer contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]} keyboardShouldPersistTaps="handled">
              {/* Create new section button */}
              {!showCreateInput && isOwner ? (
                <TouchableOpacity
                  style={styles.createSectionBtn}
                  onPress={() => setShowCreateInput(true)}
                >
                  <Ionicons name="add" size={20} color={COLORS.black} style={{ marginRight: 8 }} />
                  <Text style={styles.createSectionText}>Create a new section</Text>
                </TouchableOpacity>
              ) : (isOwner && showCreateInput) ? (
                <View style={styles.createInputContainer}>
                  {createError ? (
                    <Animated.View
                      style={[
                        styles.errorBubbleWrapper,
                        {
                          opacity: errorAnim,
                          transform: [
                            {
                              translateY: errorAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-6, 0],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <View style={styles.errorBubble}>
                        <Ionicons name="alert-circle" size={14} color={COLORS.danger} />
                        <Text style={styles.errorBubbleText}>{createError}</Text>
                      </View>
                      <View style={styles.errorBubbleArrow} />
                    </Animated.View>
                  ) : null}
                  <View style={styles.createInputRow}>
                    <TextInput
                      style={[styles.createInput, !!createError && styles.createInputError]}
                      placeholder="Section name (2–30 characters)"
                      placeholderTextColor={COLORS.textMuted}
                      value={newSectionName}
                      onChangeText={(text) => {
                        if (createError) setCreateError(null);
                        setNewSectionName(text.slice(0, SECTION_NAME_MAX));
                      }}
                      autoFocus
                      maxLength={SECTION_NAME_MAX}
                      editable={!creatingSection}
                      returnKeyType="done"
                      onSubmitEditing={handleCreateSection}
                    />
                    <TouchableOpacity
                      onPress={handleCreateSection}
                      style={[styles.createConfirmBtn, creatingSection && { opacity: 0.6 }]}
                      disabled={creatingSection}
                    >
                      {creatingSection ? (
                        <ActivityIndicator size="small" color={COLORS.textLight} />
                      ) : (
                        <Ionicons name="checkmark" size={20} color={COLORS.textLight} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setShowCreateInput(false);
                        setNewSectionName('');
                        setCreateError(null);
                      }}
                      style={styles.createCancelBtn}
                      disabled={creatingSection}
                    >
                      <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.createHint}>
                    Letters, numbers, spaces · {normalizeSectionName(newSectionName).length}/{SECTION_NAME_MAX}
                  </Text>
                </View>
              ) : null}

          {/* Draggable Sections list */}
          <NestableDraggableFlatList
            data={localSections}
            onDragBegin={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }}
            onPlaceholderIndexChange={() => {
              Haptics.selectionAsync().catch(() => {});
            }}
            onDragEnd={({ data }) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              handleReorderSections(data);
            }}
            keyExtractor={(item) => String(item._id || item.name)}
            renderItem={renderSectionItem}
            extraData={selectedSectionForEdit}
            animationConfig={{
              damping: 25,
              mass: 0.2,
              stiffness: 150,
            }}
            autoscrollSpeed={100}
            autoscrollThreshold={40}
          />

          {/* Section management instructions */}
          {selectedSectionForEdit && (
            <View style={styles.managementSection}>
              {canManagePosts ? (
                <Text style={styles.instructionTitle}>Select post below to add to this section</Text>
              ) : (
                <Text style={styles.instructionTitle}>Viewing posts in this section</Text>
              )}
              {canManagePosts && (
                <View style={styles.modeToggle}>
                  <TouchableOpacity
                    style={[styles.modeBtn, sectionMode === 'select' && styles.modeBtnActive]}
                    onPress={() => setSectionMode('select')}
                  >
                    <Text style={[styles.modeBtnText, sectionMode === 'select' && styles.modeBtnTextActive]}>
                      Select posts
                    </Text>
                  </TouchableOpacity>
                  {isOwner && (
                    <>
                      <TouchableOpacity
                        style={[styles.modeBtn, sectionMode === 'visibility' && styles.modeBtnActive]}
                        onPress={() => setSectionMode('visibility')}
                      >
                        <Text style={[styles.modeBtnText, sectionMode === 'visibility' && styles.modeBtnTextActive]}>
                          Visibility
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modeBtn, sectionMode === 'collaborators' && styles.modeBtnActive]}
                        onPress={() => setSectionMode('collaborators')}
                      >
                        <Text style={[styles.modeBtnText, sectionMode === 'collaborators' && styles.modeBtnTextActive]}>
                          Invite
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {sectionMode === 'visibility' && isOwner && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.instructionTitle}>Who can see this collection?</Text>
                  <View style={styles.visibilityOptions}>
                    {['public', 'private'].map((v: any) => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.visOpt, selectedSection?.visibility === v && styles.visOptActive]}
                        onPress={() => handleToggleVisibility(selectedSection!.name, v)}
                      >
                        <Ionicons 
                          name={v === 'public' ? 'globe-outline' : 'lock-closed-outline'} 
                          size={16} 
                          color={selectedSection?.visibility === v ? COLORS.textLight : COLORS.textSecondary} 
                        />
                        <Text style={[styles.visOptText, selectedSection?.visibility === v && styles.visOptTextActive]}>
                          {v.charAt(0) + v.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {sectionMode === 'collaborators' && isOwner && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.instructionTitle}>Invite Collaborators</Text>
                  <View style={[styles.searchWrapEdit, { height: 46, borderRadius: 23, backgroundColor: '#f5f7fa', borderWidth: 1, borderColor: '#eef0f2', marginVertical: 8 }]}>
                    <Ionicons name="search" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.searchInputEdit, { fontSize: 15 }]}
                      placeholder="Search people to invite..."
                      placeholderTextColor="#99aab5"
                      value={collaboratorInput}
                      onChangeText={setCollaboratorInput}
                      autoFocus={false}
                    />
                    {collaboratorInput.length > 0 && (
                      <TouchableOpacity onPress={() => setCollaboratorInput('')}>
                        <Ionicons name="close-circle" size={18} color={COLORS.border} />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <ScrollView style={{ maxHeight: 200, marginTop: 8 }} keyboardShouldPersistTaps="handled">
                    {searching ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (collaboratorInput.trim().length > 1 ? searchResults : followers.filter(f => 
                        (f.name || f.username || '').toLowerCase().includes(collaboratorInput.toLowerCase())
                      )).map(f => {
                        const isCollab = selectedSection?.collaborators?.some((c: any) => isSameUser(c, f));
                        return (
                          <TouchableOpacity
                            key={f._id || f.uid || f.firebaseUid}
                            style={styles.followerRowEdit}
                            onPress={() => isCollab ? handleRemoveCollaborator(f.firebaseUid || f.uid || f._id) : handleAddCollaboratorById(f.firebaseUid || f.uid || f._id)}
                          >
                            <ExpoImage source={{ uri: f.avatar }} style={styles.followerAvatarEdit} />
                            <Text style={styles.followerNameEdit}>{f.name || f.username}</Text>
                            <Ionicons
                              name={isCollab ? "remove-circle" : "add-circle"}
                              size={24}
                              color={isCollab ? COLORS.danger : "#4CAF50"}
                            />
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                </View>
              )}

              {(sectionMode === 'select' || sectionMode === 'cover') && (
                <View style={styles.grid}>
                  {posts.map((p) => {
                    const postId = p._id || p.id;
                    const section = localSections.find(s => s.name === selectedSectionForEdit);
                    if (!postId) return null;
                    const safeSectionPostIds = (Array.isArray(section?.postIds) ? section?.postIds : []).filter((id): id is string => typeof id === 'string');
                    const isSelected = sectionMode === 'select' && safeSectionPostIds.includes(postId);
                    const isCoverSelected = sectionMode === 'cover' && section?.coverImage === (p.imageUrl || p.imageUrls?.[0]);
                    const imageUri = p.imageUrl || p.imageUrls?.[0];
                    return (
                      <TouchableOpacity
                        key={postId}
                        style={styles.gridItem}
                        activeOpacity={0.7}
                        onPress={() => canManagePosts && handlePostSelection(p)}
                        disabled={!canManagePosts}
                      >
                        <ExpoImage
                          source={{ uri: imageUri }}
                          style={styles.gridImage}
                          contentFit="cover"
                          transition={200}
                        />
                        {isSelected && (
                          <View style={styles.checkmark}>
                            <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                          </View>
                        )}
                        {isCoverSelected && (
                          <View style={styles.coverBadge}>
                            <Ionicons name="star" size={20} color="#FFD700" />
                            <Text style={styles.coverBadgeText}>Cover</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Bottom actions */}
          {canManagePosts && (
            <View style={[styles.bottomActions, { justifyContent: 'flex-end' }]}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
            </NestableScrollContainer>
          </View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

type SectionRowProps = {
  item: Section;
  isSelected: boolean;
  isActive?: boolean;
  onPress: () => void;
  onCloseCard: () => void;
  onDelete: () => void;
  onRename: (oldName: string, newName: string) => Promise<boolean>;
  onToggleVisibility: () => void;
  drag: () => void;
  isOwner: boolean;
};

const SectionRow = ({ item, isOwner, isSelected, isActive, onPress, onCloseCard, onDelete, onRename, onToggleVisibility, drag }: SectionRowProps) => {
  const [sectionName, setSectionName] = useState(item.name);
  const [renaming, setRenaming] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const isSubscription = !!(item as any).isSubscriptionFolder || !!(item as any).tierId || String(item._id || '').startsWith('subscription-folder-');

  // Reset sectionName whenever item.name updates or when selection changes (reverting unconfirmed changes)
  useEffect(() => {
    setSectionName(item.name);
  }, [item.name, isSelected]);

  const hasChanges = isOwner && !isSubscription && sectionName.trim() !== item.name && sectionName.trim().length > 0;

  const handleNameUpdate = async () => {
    const trimmed = sectionName.trim();
    if (!trimmed || trimmed === item.name) {
      setSectionName(item.name);
      return;
    }
    if (!isOwner || isSubscription) {
      setSectionName(item.name);
      return;
    }
    setRenaming(true);
    Keyboard.dismiss();
    try {
      const ok = await onRename(item.name, trimmed);
      if (!ok) {
        setSectionName(item.name);
      }
    } catch {
      setSectionName(item.name);
    } finally {
      setRenaming(false);
    }
  };

  const handleClose = () => {
    if (renaming) return;
    Keyboard.dismiss();
    setSectionName(item.name); // Revert unconfirmed changes
    onCloseCard();
  };

  const isPrivate = item.visibility === 'private';

  return (
    <ScaleDecorator activeScale={1.03}>
      <View style={[
        { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
        isActive && styles.activeRowWrapper
      ]}>
        <TouchableOpacity
          onPressIn={isOwner ? drag : undefined}
          style={[styles.dragHandle, isSelected && { marginRight: 0 }]}
          disabled={!isOwner}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="menu" size={24} color={isOwner ? (isActive ? COLORS.primary : COLORS.textMuted) : COLORS.border} />
        </TouchableOpacity>
        {isSelected ? (
          <View style={[styles.selectedSectionCard, isActive && styles.cardDragging]}>
            {/* Header row with Input/Title and Close ('X') icon */}
            <View style={styles.selectedSectionHeaderRow}>
              {isSubscription ? (
                <View style={styles.selectedSectionTitleRow}>
                  <Text style={styles.selectedSectionTitleText} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {isPrivate && (
                    <Ionicons name="lock-closed" size={14} color={COLORS.textLight} style={{ marginLeft: 6 }} />
                  )}
                  <View style={styles.subscriptionBadge}>
                    <Ionicons name="star" size={11} color="#FFD700" style={{ marginRight: 3 }} />
                    <Text style={styles.subscriptionBadgeText}>Tier</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.selectedSectionInputContainer}>
                  <TextInput
                    ref={inputRef}
                    style={styles.selectedSectionActiveInput}
                    value={sectionName}
                    onChangeText={(text) => setSectionName(text.slice(0, SECTION_NAME_MAX))}
                    editable={!renaming && isOwner}
                    maxLength={SECTION_NAME_MAX}
                    placeholder="Section name"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                  {renaming ? (
                    <View style={styles.inputActionSlot}>
                      <ActivityIndicator size="small" color={COLORS.textLight} />
                    </View>
                  ) : hasChanges ? (
                    <TouchableOpacity
                      onPress={handleNameUpdate}
                      style={styles.inputActionSlot}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Save section name"
                    >
                      <Ionicons name="checkmark-circle" size={24} color={COLORS.textLight} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              {/* Cross icon directly on the open section card to collapse it */}
              <TouchableOpacity
                onPress={handleClose}
                style={[styles.closeCardBtn, renaming && { opacity: 0.5 }]}
                disabled={renaming}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Close section"
              >
                <Ionicons name="close" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <View style={styles.selectedSectionActions}>
              <View style={styles.selectedSectionActionRow}>
                <Ionicons name="albums-outline" size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
                <Text style={styles.selectedSectionActionText}>{item.postIds?.length || 0} Posts</Text>
              </View>

              {!isSubscription && (
                <TouchableOpacity
                  style={[styles.selectedSectionActionRow, renaming && { opacity: 0.5 }]}
                  onPress={onToggleVisibility}
                  disabled={!isOwner || renaming}
                >
                  <Ionicons name={isPrivate ? "lock-closed-outline" : "globe-outline"} size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
                  <Text style={styles.selectedSectionActionText}>{isPrivate ? "Private" : "Public"} Collection</Text>
                </TouchableOpacity>
              )}

              {!isSubscription && isOwner && (
                <TouchableOpacity
                  key="delete-action"
                  style={[styles.selectedSectionActionRow, renaming && { opacity: 0.5 }]}
                  onPress={onDelete}
                  disabled={renaming}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
                  <Text style={styles.selectedSectionActionText}>Delete this section</Text>
                </TouchableOpacity>
              )}

              {isSubscription && (
                <View style={styles.selectedSectionActionRow}>
                  <Ionicons name="information-circle-outline" size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
                  <Text style={[styles.selectedSectionActionText, { fontSize: 13, opacity: 0.95 }]}>
                    Subscription Tier · Manage in Tiers
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.sectionRowSimple, isActive && styles.rowActive]}
            onPress={onPress}
            onLongPress={isOwner ? drag : undefined}
            delayLongPress={220}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.sectionRowTitle}>{item.name}</Text>
                  {isPrivate && <Ionicons name="lock-closed" size={12} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />}
                  {isSubscription && (
                    <View style={[styles.subscriptionBadge, { backgroundColor: '#fff3cd' }]}>
                      <Ionicons name="star" size={10} color="#b7791f" style={{ marginRight: 2 }} />
                      <Text style={[styles.subscriptionBadgeText, { color: '#b7791f' }]}>Tier</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sectionRowCount}>{item.postIds?.length || 0} Posts</Text>
              </View>
              {item.collaborators && item.collaborators.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="people" size={14} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{item.collaborators.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>
    </ScaleDecorator>
  );
};

const styles = StyleSheet.create({
    selectedSectionCard: {
      flex: 1,
      backgroundColor: COLORS.primary,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: COLORS.primary,
      padding: 12,
      justifyContent: 'center',
      shadowColor: COLORS.primary,
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    selectedSectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    selectedSectionTitleRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: 2,
      marginRight: 8,
    },
    selectedSectionTitleText: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textLight,
      flexShrink: 1,
    },
    selectedSectionInputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.16)',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: Platform.OS === 'ios' ? 8 : 4,
      marginRight: 8,
      minHeight: 40,
    },
    selectedSectionActiveInput: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textLight,
      padding: 0,
      margin: 0,
    },
    inputActionSlot: {
      paddingLeft: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeCardBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 6,
    },
    subscriptionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.25)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      marginLeft: 8,
    },
    subscriptionBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FFD700',
    },
    selectedSectionInputWrap: {
      backgroundColor: COLORS.card,
      borderRadius: 8,
      marginBottom: 10,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    selectedSectionActions: {
      marginTop: 2,
    },
    selectedSectionActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    selectedSectionActionText: {
      color: COLORS.textLight,
      fontSize: 15,
      fontWeight: '500',
    },
    sectionRowSimple: {
      flex: 1,
      backgroundColor: 'transparent',
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 8,
      justifyContent: 'center',
    },
    activeRowWrapper: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 6,
      zIndex: 999,
    },
    rowActive: {
      backgroundColor: '#f8fafc',
      borderColor: COLORS.primary,
      borderWidth: 1.5,
      borderRadius: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    cardDragging: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  closeBtn: { padding: 8 },
  title: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  content: { padding: 16 },
  createSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  createSectionText: { fontSize: 15, fontWeight: '500' },
  createInputContainer: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  createInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  createInputError: {
    borderColor: COLORS.danger,
  },
  errorBubbleWrapper: {
    marginBottom: 4,
    alignSelf: 'flex-start',
    zIndex: 10,
  },
  errorBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  errorBubbleText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  errorBubbleArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.danger,
    marginLeft: 16,
    marginTop: -0.5,
  },
  createHint: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.textMuted,
    paddingHorizontal: 2,
  },
  createConfirmBtn: {
    width: 42,
    height: 42,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createCancelBtn: {
    width: 42,
    height: 42,
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 16,
    paddingLeft: 4,
    paddingRight: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionRowActive: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  sectionRowDragging: {
    backgroundColor: COLORS.card,
    elevation: 5,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  dragHandle: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
  },
  sectionRowContent: {
    flex: 1,
    paddingLeft: 8,
  },
  sectionRowTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  sectionRowCount: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteText: { color: COLORS.danger, fontSize: 13, fontWeight: '500' },
  managementSection: { marginTop: 24 },
  instructionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  modeToggle: { flexDirection: 'row', gap: 8, marginTop: 12 },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeBtnText: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  modeBtnTextActive: { color: COLORS.textLight },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  gridItem: { width: '33.3333%', aspectRatio: 1, padding: 1 },
  gridImage: { width: '100%', height: '100%' },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.black,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  coverBadgeText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingBottom: 40,
  },
  clearText: { fontSize: 16, color: COLORS.textSecondary },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.textLight },
  collaboratorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
    followerNameEdit: {
      fontSize: 14,
      color: COLORS.textPrimary,
      flex: 1,
    },
    visibilityOptions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    visOpt: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: COLORS.inputBg,
      gap: 6,
    },
    visOptActive: {
      backgroundColor: COLORS.primary,
    },
    visOptText: {
      fontSize: 12,
      color: COLORS.textSecondary,
      fontWeight: '500',
    },
    visOptTextActive: {
      color: COLORS.textLight,
    },
    specificGroups: {
      backgroundColor: COLORS.surface,
      padding: 10,
      borderRadius: 8,
      marginTop: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    groupRowEdit: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 10,
    },
    groupNameEdit: {
      fontSize: 14,
      color: COLORS.textSecondary,
    },
    groupNameSelectedEdit: {
      color: COLORS.primary,
      fontWeight: '600',
    },
    infoText: {
      fontSize: 12,
      color: COLORS.textMuted,
      fontStyle: 'italic',
    },
    searchWrapEdit: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.inputBg,
      borderRadius: 23,
      paddingHorizontal: 16,
      marginTop: 8,
      marginHorizontal: 16,
      height: 46,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    searchInputEdit: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      fontSize: 14,
    },
    followerRowEdit: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
      gap: 12,
    },
    followerAvatarEdit: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: COLORS.inputBg,
    },
  collaboratorText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
});
