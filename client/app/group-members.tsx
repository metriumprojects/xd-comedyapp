import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { safeRouterBack } from '@/lib/safeRouterBack';
import { DEFAULT_AVATAR_URL } from '@/lib/api';
import { apiService } from '@/src/_services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { resolveCanonicalUserId } from '@/lib/currentUser';
import { cacheUserProfile, getCachedUserProfile } from '@/hooks/useUserProfile';
import { feedEventEmitter } from '@/lib/feedEventEmitter';
import { isMissingOrDefaultAvatar } from '@/lib/utils/avatar';
import COLORS from '@/src/theme/colors';
import UserAvatar from '@/src/_components/UserAvatar';
import AsyncStorage from '@/lib/storage';

interface MemberItem {
  uid: string;
  _id?: string;
  id?: string;
  displayName?: string;
  name?: string;
  userName?: string;
  username?: string;
  photoURL?: string;
  avatar?: string;
  profilePicture?: string;
  isSelf?: boolean;
}

export default function GroupMembersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const conversationId = String((params as any)?.conversationId || '').trim();
  const groupId = String((params as any)?.groupId || '').trim();
  const targetId = groupId || conversationId;
  const groupName = String((params as any)?.groupName || 'Group').trim();

  const { userId: storeUserId, userProfile: storeUserProfile } = useAppStore();
  const [currentUser, setCurrentUser] = useState<any>(storeUserProfile);
  const [currentUserId, setCurrentUserId] = useState<string | null>(storeUserId);
  const [myIds, setMyIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (storeUserId) s.add(String(storeUserId).trim().toLowerCase());
    return s;
  });

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Admins state
  const [adminIds, setAdminIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    const pAdmin = (params as any)?.adminId;
    if (pAdmin) s.add(String(pAdmin).toLowerCase());
    try {
      const parsedAdmins = (params as any)?.groupAdminIds ? JSON.parse((params as any).groupAdminIds) : null;
      if (Array.isArray(parsedAdmins)) {
        parsedAdmins.forEach((id: any) => id && s.add(String(id).toLowerCase()));
      }
    } catch {}
    return s;
  });

  // Action Sheet Modal state for member 3-dots
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  // Add Member Modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [searchCandidates, setSearchCandidates] = useState<any[]>([]);
  const [searchingCandidates, setSearchingCandidates] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const storeUserProfileRef = useRef(storeUserProfile);
  storeUserProfileRef.current = storeUserProfile;

  // Sync current user profile
  useEffect(() => {
    if (storeUserProfile) setCurrentUser(storeUserProfile);
  }, [storeUserProfile]);

  useEffect(() => {
    resolveCanonicalUserId().then((uid) => {
      if (uid) setCurrentUserId(uid);
    }).catch(() => {});
  }, [storeUserId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = new Set<string>();
      if (storeUserId) ids.add(String(storeUserId).trim().toLowerCase());
      if (currentUserId) ids.add(String(currentUserId).trim().toLowerCase());
      try {
        const stored = await AsyncStorage.getItem('userId');
        if (stored) ids.add(String(stored).trim().toLowerCase());
        const firebaseUid = await AsyncStorage.getItem('firebaseUid');
        if (firebaseUid) ids.add(String(firebaseUid).trim().toLowerCase());
        const canon = await resolveCanonicalUserId().catch(() => null);
        if (canon) ids.add(String(canon).trim().toLowerCase());
      } catch {}

      if (!cancelled && ids.size > 0) {
        setMyIds((prev) => {
          let hasNew = false;
          for (const id of ids) {
            if (!prev.has(id)) {
              hasNew = true;
              break;
            }
          }
          if (!hasNew) return prev;
          const next = new Set(prev);
          ids.forEach((id) => next.add(id));
          return next;
        });
      }
    })();
    return () => { cancelled = true; };
  }, [storeUserId, currentUserId]);

  const myIdsRef = useRef(myIds);
  myIdsRef.current = myIds;

  const adminIdsRef = useRef(adminIds);
  adminIdsRef.current = adminIds;

  const checkIsSelf = useCallback((item: any): boolean => {
    if (!item) return false;
    if (item.isSelf === true) return true;
    const candidates = [
      item.uid,
      item._id,
      item.id,
      item.userId,
      item.userName,
      item.username,
    ];
    for (const c of candidates) {
      if (c && myIdsRef.current.has(String(c).trim().toLowerCase())) {
        return true;
      }
    }
    return false;
  }, []);

  const checkIsAdmin = useCallback((item: any): boolean => {
    if (!item) return false;
    const isSelf = checkIsSelf(item);
    if (isSelf) {
      for (const myId of myIdsRef.current) {
        if (adminIdsRef.current.has(myId)) return true;
      }
      return false;
    }
    const candidates = [item.uid, item._id, item.id, item.userName, item.username];
    for (const c of candidates) {
      if (c && adminIdsRef.current.has(String(c).trim().toLowerCase())) {
        return true;
      }
    }
    return false;
  }, [checkIsSelf]);

  const viewerIsAdmin = useMemo(() => {
    for (const myId of myIds) {
      if (adminIds.has(myId)) return true;
    }
    return (params as any)?.isAdmin === '1';
  }, [adminIds, myIds, params]);

  // Load and sync group members
  const loadMembers = useCallback(async () => {
    if (!targetId) {
      setLoading(false);
      return;
    }

    try {
      const res: any = await apiService.get(`/conversations/${targetId}`).catch(() => null);
      const data: any = res?.data || res;

      if (Array.isArray(data?.groupAdminIds)) {
        setAdminIds((prev) => {
          const incoming = data.groupAdminIds.map((a: any) => String(a).toLowerCase());
          const isSame = incoming.length === prev.size && incoming.every((a: string) => prev.has(a));
          if (isSame) return prev;
          return new Set(incoming);
        });
      }

      const rawMembers = data?.members || data?.participants || [];
      const formattedMap = new Map<string, MemberItem>();

      // Always add self first
      const resolvedMyId = currentUserId || storeUserId || (await resolveCanonicalUserId().catch(() => null));
      const myProfile = currentUserRef.current || storeUserProfileRef.current || (resolvedMyId ? getCachedUserProfile(resolvedMyId) : null);
      const selfItem: MemberItem = {
        uid: String(resolvedMyId || 'self'),
        _id: String(resolvedMyId || 'self'),
        displayName: myProfile?.displayName || myProfile?.name || 'You',
        userName: myProfile?.userName || myProfile?.username,
        photoURL: myProfile?.photoURL || myProfile?.avatar || myProfile?.profilePicture || DEFAULT_AVATAR_URL,
        avatar: myProfile?.photoURL || myProfile?.avatar || myProfile?.profilePicture || DEFAULT_AVATAR_URL,
        isSelf: true,
      };
      formattedMap.set('self', selfItem);

      if (Array.isArray(rawMembers)) {
        for (const m of rawMembers) {
          if (!m) continue;
          const uid = String(typeof m === 'string' ? m : (m?.uid || m?._id || m?.id || m?.userId || '')).trim();
          const uname = String(m?.userName || m?.username || '').trim();
          const isSelf = checkIsSelf(m) || (uid && myIdsRef.current.has(uid.toLowerCase())) || (uname && myIdsRef.current.has(uname.toLowerCase()));

          if (isSelf) continue; // Already added as 'self'

          const rawName = String(m?.displayName || m?.name || m?.userName || m?.username || '').trim();
          const cached = uid ? getCachedUserProfile(uid) : null;
          const resolvedName = rawName || (cached?.name !== 'User' ? (cached?.name || cached?.displayName) : null) || 'User';
          const resolvedAvatar = m?.photoURL || m?.avatar || m?.profilePicture || cached?.avatar || cached?.photoURL || DEFAULT_AVATAR_URL;
          const resolvedUname = uname || cached?.username || undefined;

          const key = uid ? uid.toLowerCase() : uname ? uname.toLowerCase() : String(Math.random());
          formattedMap.set(key, {
            uid: uid || key,
            _id: uid || key,
            displayName: resolvedName,
            userName: resolvedUname,
            photoURL: resolvedAvatar,
            avatar: resolvedAvatar,
            isSelf: false,
          });
        }
      }

      setMembers(Array.from(formattedMap.values()));
    } catch (e) {
      console.warn('[group-members] Error loading members:', e);
    } finally {
      setLoading(false);
    }
  }, [targetId, currentUserId, storeUserId, checkIsSelf]);

  const seededRef = useRef(false);

  useEffect(() => {
    // Seed initial members from params once if provided
    if (!seededRef.current && (params as any)?.members) {
      seededRef.current = true;
      try {
        const parsed = typeof (params as any).members === 'string' ? JSON.parse((params as any).members) : (params as any).members;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMembers(parsed);
          setLoading(false);
        }
      } catch {}
    }
    loadMembers();
  }, [targetId, loadMembers]);

  // Filtered members by search query
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = [...members].sort((a, b) => {
      const aSelf = Boolean(a.isSelf || checkIsSelf(a));
      const bSelf = Boolean(b.isSelf || checkIsSelf(b));
      if (aSelf && !bSelf) return -1;
      if (!aSelf && bSelf) return 1;
      return 0;
    });

    if (!q) return sorted;
    return sorted.filter((m) => {
      const name = (m.displayName || m.name || '').toLowerCase();
      const uname = (m.userName || m.username || '').toLowerCase();
      return name.includes(q) || uname.includes(q);
    });
  }, [members, searchQuery, checkIsSelf]);

  // Navigate to profile
  const handleOpenProfile = (member: MemberItem) => {
    const isSelf = Boolean(member.isSelf || checkIsSelf(member));
    if (isSelf) {
      router.push('/profile' as any);
      return;
    }
    const targetUid = member.uid || member._id || member.id;
    if (targetUid && targetUid !== 'self') {
      router.push({ pathname: '/user-profile', params: { uid: targetUid } } as any);
    }
  };

  // Open 3-dots action sheet
  const handleOpenActionMenu = (member: MemberItem) => {
    setSelectedMember(member);
    setActionModalVisible(true);
  };

  // Kick member handler
  const handleKickMember = () => {
    if (!selectedMember || !targetId) return;
    const targetUid = selectedMember.uid || selectedMember._id || selectedMember.id;
    const memberName = selectedMember.displayName || selectedMember.userName || 'this member';

    setActionModalVisible(false);

    Alert.alert(
      'Remove from Group',
      `Are you sure you want to remove ${memberName} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress(true);
            try {
              const res: any = await apiService.patch(`/conversations/${targetId}/group-members`, {
                removeMemberIds: [targetUid],
              });

              if (res?.success || res?.data) {
                const nextMembers = members.filter(
                  (m) => (m.uid || m._id || m.id) !== targetUid
                );
                setMembers(nextMembers);

                // Notify other screens
                feedEventEmitter.emit('groupMembersUpdated', {
                  conversationId: targetId,
                  members: nextMembers,
                  adminIds: Array.from(adminIds),
                });

                Alert.alert('Removed', `${memberName} has been removed from the group.`);
              } else {
                Alert.alert('Error', res?.error || 'Failed to remove member');
              }
            } catch (err: any) {
              const errMsg = err?.response?.data?.error || err?.message || 'Failed to remove member';
              Alert.alert('Error', errMsg);
            } finally {
              setActionInProgress(false);
            }
          },
        },
      ]
    );
  };

  // Make admin / Dismiss as admin handler
  const handleToggleAdminRole = () => {
    if (!selectedMember || !targetId) return;
    const targetUid = selectedMember.uid || selectedMember._id || selectedMember.id;
    const memberName = selectedMember.displayName || selectedMember.userName || 'this member';
    const isCurrentlyAdmin = checkIsAdmin(selectedMember);

    setActionModalVisible(false);

    if (isCurrentlyAdmin) {
      Alert.alert(
        'Dismiss as Admin?',
        `Remove ${memberName} as group admin? They will remain a regular member of the group.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Dismiss',
            style: 'destructive',
            onPress: async () => {
              setActionInProgress(true);
              try {
                const res: any = await apiService.patch(`/conversations/${targetId}/group-admins`, {
                  removeAdminIds: [targetUid],
                });

                if (res?.success || res?.data) {
                  const nextAdmins = new Set(adminIds);
                  if (targetUid) nextAdmins.delete(String(targetUid).toLowerCase());
                  setAdminIds(nextAdmins);

                  feedEventEmitter.emit('groupMembersUpdated', {
                    conversationId: targetId,
                    members,
                    adminIds: Array.from(nextAdmins),
                  });

                  Alert.alert('Updated', `${memberName} is no longer an admin.`);
                } else {
                  Alert.alert('Error', res?.error || 'Failed to update admin role');
                }
              } catch (err: any) {
                const errMsg = err?.response?.data?.error || err?.message || 'Failed to update admin role';
                Alert.alert('Error', errMsg);
              } finally {
                setActionInProgress(false);
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Make Group Admin?',
        `Make ${memberName} an admin of this group? Group admins can manage members, edit group name and avatar.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Make Admin',
            onPress: async () => {
              setActionInProgress(true);
              try {
                const res: any = await apiService.patch(`/conversations/${targetId}/group-admins`, {
                  addAdminIds: [targetUid],
                });

                if (res?.success || res?.data) {
                  const nextAdmins = new Set(adminIds);
                  if (targetUid) nextAdmins.add(String(targetUid).toLowerCase());
                  setAdminIds(nextAdmins);

                  feedEventEmitter.emit('groupMembersUpdated', {
                    conversationId: targetId,
                    members,
                    adminIds: Array.from(nextAdmins),
                  });

                  Alert.alert('Success', `${memberName} is now a group admin.`);
                } else {
                  Alert.alert('Error', res?.error || 'Failed to promote member');
                }
              } catch (err: any) {
                const errMsg = err?.response?.data?.error || err?.message || 'Failed to promote member';
                Alert.alert('Error', errMsg);
              } finally {
                setActionInProgress(false);
              }
            },
          },
        ]
      );
    }
  };

  // Search users to add
  const membersRef = useRef(members);
  membersRef.current = members;

  useEffect(() => {
    if (!addModalVisible) return;
    const q = addSearchQuery.trim();
    if (!q) {
      setSearchCandidates([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingCandidates(true);
      try {
        const res: any = await apiService.get('/users/search', {
          q,
          requesterUserId: currentUserId || storeUserId,
          limit: 20,
        });
        const list = Array.isArray(res?.data) ? res.data : [];
        // Filter out users already in the group
        const existingIds = new Set(
          membersRef.current.map((m) => String(m.uid || m._id || m.id || '').toLowerCase())
        );
        const filtered = list.filter((u: any) => {
          const uId = String(u?._id || u?.id || u?.uid || '').toLowerCase();
          return uId && !existingIds.has(uId);
        });
        setSearchCandidates(filtered);
      } catch (err) {
        setSearchCandidates([]);
      } finally {
        setSearchingCandidates(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [addSearchQuery, addModalVisible, currentUserId, storeUserId]);

  // Add member to group
  const handleAddMemberToGroup = async (user: any) => {
    const userIdToAdd = String(user?._id || user?.id || user?.uid || '');
    if (!userIdToAdd || !targetId) return;

    setAddingMemberId(userIdToAdd);
    try {
      const res: any = await apiService.patch(`/conversations/${targetId}/group-members`, {
        addMemberIds: [userIdToAdd],
      });

      if (res?.success || res?.data) {
        const newMember: MemberItem = {
          uid: userIdToAdd,
          _id: userIdToAdd,
          displayName: user?.displayName || user?.name || user?.username || 'User',
          userName: user?.username || user?.userName,
          photoURL: user?.avatar || user?.photoURL || DEFAULT_AVATAR_URL,
          avatar: user?.avatar || user?.photoURL || DEFAULT_AVATAR_URL,
          isSelf: false,
        };

        const nextMembers = [...members, newMember];
        setMembers(nextMembers);

        // Remove from candidates
        setSearchCandidates((prev) => prev.filter((u) => String(u?._id || u?.id) !== userIdToAdd));

        feedEventEmitter.emit('groupMembersUpdated', {
          conversationId: targetId,
          members: nextMembers,
          adminIds: Array.from(adminIds),
        });

        Alert.alert('Added', `${newMember.displayName} added to the group!`);
      } else {
        Alert.alert('Error', res?.error || 'Failed to add member');
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || 'Failed to add member';
      Alert.alert('Error', errMsg);
    } finally {
      setAddingMemberId(null);
    }
  };

  // Render individual member item
  const renderMemberItem = ({ item }: { item: MemberItem }) => {
    const isSelf = Boolean(item.isSelf || checkIsSelf(item));
    const isItemAdmin = checkIsAdmin(item);
    const targetUid = item.uid || item._id || item.id;

    const rawName = item.displayName || item.userName || item.name || '';
    const displayName = isSelf && (rawName === 'You' || !rawName)
      ? (currentUser?.displayName || currentUser?.name || 'You')
      : (rawName || (isSelf ? 'You' : 'User'));

    return (
      <View style={styles.memberCardContainer}>
        {/* Tappable Card area (Avatar + Name + Badge) */}
        <TouchableOpacity
          style={styles.memberCardContent}
          activeOpacity={0.7}
          onPress={() => handleOpenProfile(item)}
        >
          <UserAvatar
            uri={item.photoURL || item.avatar || item.profilePicture || (isSelf ? (currentUser?.avatar || currentUser?.photoURL) : undefined)}
            name={displayName}
            size={46}
            style={styles.avatar}
          />
          <View style={styles.memberInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.memberName} numberOfLines={1}>
                {displayName}
              </Text>
              {isSelf ? <Text style={styles.selfBadge}> (You)</Text> : null}
            </View>
            {item.userName ? (
              <Text style={styles.memberUsername} numberOfLines={1}>
                @{item.userName}
              </Text>
            ) : null}
          </View>

          {isItemAdmin ? (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={13} color={COLORS.primary || '#FF6B00'} style={{ marginRight: 3 }} />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        {/* 3-Dots Action Button on Right */}
        {!isSelf ? (
          <TouchableOpacity
            style={styles.threeDotsBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => handleOpenActionMenu(item)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#666" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => safeRouterBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Members</Text>
          <Text style={styles.headerSubtitle}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </Text>
        </View>

        {viewerIsAdmin ? (
          <TouchableOpacity
            style={styles.addMemberBtn}
            onPress={() => {
              setAddSearchQuery('');
              setSearchCandidates([]);
              setAddModalVisible(true);
            }}
          >
            <Ionicons name="person-add" size={18} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.addMemberBtnText}>Add</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* In-List Search Bar */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#8E8E93" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#8E8E93" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Main Members List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary || '#FF6B00'} />
        </View>
      ) : (
        <FlatList
          data={filteredMembers}
          keyExtractor={(item, index) => item.uid || item._id || (item.isSelf ? 'self' : String(index))}
          renderItem={renderMemberItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No members found</Text>
              <Text style={styles.emptySub}>
                {searchQuery ? 'Try searching with a different name or username' : 'This group has no other members'}
              </Text>
            </View>
          }
        />
      )}

      {/* 3-Dots Action Sheet Modal */}
      <Modal
        visible={actionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setActionModalVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />

            {/* Selected User Header */}
            {selectedMember && (
              <View style={styles.selectedUserHeader}>
                <UserAvatar
                  uri={selectedMember.photoURL || selectedMember.avatar || DEFAULT_AVATAR_URL}
                  name={selectedMember.displayName || 'User'}
                  size={52}
                />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.selectedUserName} numberOfLines={1}>
                    {selectedMember.displayName || selectedMember.userName || 'User'}
                  </Text>
                  {selectedMember.userName ? (
                    <Text style={styles.selectedUserHandle} numberOfLines={1}>
                      @{selectedMember.userName}
                    </Text>
                  ) : null}
                  {checkIsAdmin(selectedMember) ? (
                    <View style={styles.modalAdminBadge}>
                      <Text style={styles.modalAdminBadgeText}>Group Admin</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}

            <View style={styles.modalDivider} />

            {/* Admin Actions */}
            {viewerIsAdmin && selectedMember ? (
              <>
                {/* Make or Dismiss Admin */}
                <TouchableOpacity
                  style={styles.modalActionItem}
                  onPress={handleToggleAdminRole}
                  disabled={actionInProgress}
                >
                  <View style={[styles.modalActionIconWrap, { backgroundColor: '#F0F4FF' }]}>
                    <Ionicons
                      name={checkIsAdmin(selectedMember) ? 'shield-outline' : 'shield-checkmark'}
                      size={20}
                      color="#2563EB"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalActionTitle}>
                      {checkIsAdmin(selectedMember) ? 'Dismiss as Admin' : 'Make Group Admin'}
                    </Text>
                    <Text style={styles.modalActionSub}>
                      {checkIsAdmin(selectedMember)
                        ? 'Remove admin privileges from this user'
                        : 'Allow this user to manage members & group details'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Kick Member */}
                <TouchableOpacity
                  style={styles.modalActionItem}
                  onPress={handleKickMember}
                  disabled={actionInProgress}
                >
                  <View style={[styles.modalActionIconWrap, { backgroundColor: '#FFF1F0' }]}>
                    <Ionicons name="person-remove" size={20} color="#FF3B30" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalActionTitle, { color: '#FF3B30' }]}>
                      Remove from Group
                    </Text>
                    <Text style={styles.modalActionSub}>
                      Kick this user out of {groupName}
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : null}

            {/* View Profile Option */}
            <TouchableOpacity
              style={styles.modalActionItem}
              onPress={() => {
                setActionModalVisible(false);
                if (selectedMember) handleOpenProfile(selectedMember);
              }}
            >
              <View style={[styles.modalActionIconWrap, { backgroundColor: '#F4F4F5' }]}>
                <Ionicons name="person-outline" size={20} color="#333" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalActionTitle}>View Profile</Text>
                <Text style={styles.modalActionSub}>Visit profile and view posts</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#C7C7CC" />
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setActionModalVisible(false)}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Members Modal Sheet */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <SafeAreaView style={styles.addModalContainer}>
          <View style={styles.addModalHeader}>
            <TouchableOpacity onPress={() => setAddModalVisible(false)} style={styles.backBtn}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Members</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.searchBarWrap}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#8E8E93" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search people to add..."
                placeholderTextColor="#8E8E93"
                value={addSearchQuery}
                onChangeText={setAddSearchQuery}
                autoFocus
                autoCapitalize="none"
              />
              {addSearchQuery ? (
                <TouchableOpacity onPress={() => setAddSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#8E8E93" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {searchingCandidates ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color={COLORS.primary || '#FF6B00'} />
            </View>
          ) : (
            <FlatList
              data={searchCandidates}
              keyExtractor={(item) => String(item?._id || item?.id || Math.random())}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
              renderItem={({ item }) => {
                const uid = String(item?._id || item?.id || '');
                const isAdding = addingMemberId === uid;
                const dName = item?.displayName || item?.name || item?.username || 'User';

                return (
                  <View style={styles.candidateRow}>
                    <UserAvatar
                      uri={item?.avatar || item?.photoURL || DEFAULT_AVATAR_URL}
                      name={dName}
                      size={44}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.memberName} numberOfLines={1}>{dName}</Text>
                      {item?.username ? (
                        <Text style={styles.memberUsername} numberOfLines={1}>@{item.username}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[styles.addCandidateBtn, isAdding && { opacity: 0.6 }]}
                      disabled={isAdding}
                      onPress={() => handleAddMemberToGroup(item)}
                    >
                      {isAdding ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.addCandidateBtnText}>Add</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptySub}>
                    {addSearchQuery
                      ? 'No users found matching your search'
                      : 'Type a name or username above to find users'}
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 1,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary || '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addMemberBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  memberCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  memberCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    maxWidth: '80%',
  },
  selfBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary || '#FF6B00',
  },
  memberUsername: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#FFE0CC',
    marginRight: 8,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary || '#FF6B00',
  },
  threeDotsBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 4,
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    alignSelf: 'center',
    marginBottom: 16,
  },
  selectedUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedUserName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  selectedUserHandle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  modalAdminBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF4EC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  modalAdminBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary || '#FF6B00',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 12,
  },
  modalActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  modalActionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  modalActionSub: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  modalCancelBtn: {
    marginTop: 12,
    backgroundColor: '#F2F2F7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },

  // Add modal container
  addModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  addModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  addCandidateBtn: {
    backgroundColor: COLORS.primary || '#FF6B00',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
  },
  addCandidateBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
