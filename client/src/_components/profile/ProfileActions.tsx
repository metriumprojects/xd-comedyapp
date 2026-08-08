import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { hapticLight } from '@/lib/haptics';
import COLORS from '@/src/theme/colors';

interface ProfileActionsProps {
  isOwnProfile: boolean;
  isFollowing: boolean;
  followRequestPending: boolean;
  followLoading: boolean;
  isPrivate: boolean;
  approvedFollower: boolean;
  onFollowToggle: () => void;
  onMessage: () => void;
  onEditProfile: () => void;
  onViewCollections: () => void;
}

const ProfileActions: React.FC<ProfileActionsProps> = ({
  isOwnProfile,
  isFollowing,
  followRequestPending,
  followLoading,
  isPrivate,
  approvedFollower,
  onFollowToggle,
  onMessage,
  onEditProfile,
  onViewCollections
}) => {
  if (isOwnProfile) {
    return null;
  }

  return (
    <View style={styles.pillRow}>
      <TouchableOpacity
        style={[styles.followBtn, (isFollowing || followRequestPending) && styles.followingBtn]}
        onPress={onFollowToggle}
        disabled={followLoading || followRequestPending}
      >
        <Text style={[styles.followText, (isFollowing || followRequestPending) && styles.followingText]}>
          {followRequestPending ? 'Requested' : (isFollowing ? 'Following' : 'Follow')}
        </Text>
      </TouchableOpacity>
      
      {(!isPrivate || approvedFollower) && (
        <TouchableOpacity style={styles.pillBtn} onPress={onMessage}>
          <Ionicons name="chatbubble-outline" size={16} color={COLORS.black} style={{ marginRight: 6 }} />
          <Text style={styles.pillText}>Message</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 10,
    marginBottom: 16,
  },
  pillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.inputBg,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  followBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.info,
    paddingVertical: 10,
    borderRadius: 8,
  },
  followingBtn: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  followText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  followingText: {
    color: COLORS.black,
  }
});

export default ProfileActions;
