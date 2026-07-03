import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert, ScrollView } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticLight } from '@/lib/haptics';
import { DEFAULT_AVATAR_URL } from '@/lib/api';

interface ProfileHeaderProps {
  profile: any;
  userStories: any[];
  isOwnProfile: boolean;
  isPrivate: boolean;
  approvedFollower: boolean;
  onPressAvatar: () => void;
  onAddStory: () => void;
  onPressPassport: () => void;
  onEditProfile?: () => void;
  onManageSubscription?: () => void;
  onSubscribe?: () => void;
  isFollowing?: boolean;
  followRequestPending?: boolean;
  followLoading?: boolean;
  onFollowToggle?: () => void;
  onMessage?: () => void;
  followersCount?: number;
  followingCount?: number;
  onPressFollowers?: () => void;
  onPressFollowing?: () => void;
  postsCount?: number;
  laughsCount?: number;
  isSubscribed?: boolean;
  hasSubscriptionTier?: boolean;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profile,
  userStories,
  isOwnProfile,
  isPrivate,
  approvedFollower,
  onPressAvatar,
  onAddStory,
  onPressPassport,
  onEditProfile,
  onManageSubscription,
  onSubscribe,
  isFollowing,
  followRequestPending,
  followLoading,
  onFollowToggle,
  onMessage,
  followersCount = 0,
  followingCount = 0,
  onPressFollowers,
  onPressFollowing,
  postsCount = 0,
  laughsCount = 0,
  isSubscribed = false,
  hasSubscriptionTier = true,
}) => {
  const avatar = profile?.avatar || profile?.photoURL || profile?.profilePicture;
  const dimmed = isPrivate && !isOwnProfile && !approvedFollower;

  const avatarSize = 80;
  const storyRingSize = avatarSize + 10;
  const storyRingInnerSize = avatarSize + 4;
  const avatarBorderRadius = avatarSize / 2;

  const formatStatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return String(num);
  };

  // Split interests into sky-blue category chips
  const interestsList = React.useMemo(() => {
    const rawInterests = profile?.interests || '';
    if (typeof rawInterests === 'string' && rawInterests.trim()) {
      let parts = rawInterests.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.includes('Stand') || parts.includes('Up')) {
        parts = parts.filter(p => p !== 'Stand' && p !== 'Up');
        parts.push('Stand Up');
      }
      return Array.from(new Set(parts));
    }
    return ['Stand Up', 'Pranks', 'Comics']; // Default fallback category chips
  }, [profile?.interests]);

  return (
    <View style={styles.container}>
      {/* Top block: Left Avatar, Right Name & Stats Grid */}
      <View style={styles.profileMetaBlock}>
        {/* Avatar Section (Left Column) */}
        <View style={[styles.avatarWrapper, { width: storyRingSize, height: storyRingSize }]}>
          <View style={styles.avatarContainer}>
            {userStories.length > 0 && (
              <LinearGradient
                colors={['#F58529', '#DD2A7B', '#8134AF']}
                style={[styles.storyRing, { width: storyRingSize, height: storyRingSize, borderRadius: storyRingSize / 2 }]}
              >
                <View style={[styles.storyRingInner, { width: storyRingInnerSize, height: storyRingInnerSize, borderRadius: storyRingInnerSize / 2 }]} />
              </LinearGradient>
            )}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity activeOpacity={0.8} onPress={onPressAvatar}>
                <ExpoImage
                  source={{ uri: avatar || DEFAULT_AVATAR_URL }}
                  style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarBorderRadius }, dimmed && { opacity: 0.3 }]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                {dimmed && (
                  <View style={[styles.lockOverlay, { borderRadius: avatarBorderRadius }]}>
                    <Ionicons name="lock-closed" size={28} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              {isOwnProfile && onAddStory && (
                <TouchableOpacity
                  style={styles.editBadge}
                  activeOpacity={0.9}
                  onPress={() => {
                    hapticLight();
                    onAddStory();
                  }}
                >
                  <LinearGradient
                    colors={['#007aff', '#0055ff']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Feather name="plus" size={12} color="#fff" style={{ zIndex: 1 }} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Right Info Section: Name + Stats Boxes */}
        <View style={styles.infoWrapper}>
          <Text style={styles.displayName}>{profile?.displayName || profile?.name || 'Creator'}</Text>
          {!!profile?.username && <Text style={styles.username}>@{profile.username}</Text>}

          {/* Stats Boxes (Laughs, Posts, Followers, Following) */}
          <View style={styles.statsRow}>
            {/* Box 1: Laughs */}
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{formatStatNumber(laughsCount)}</Text>
              <Text style={styles.statLbl}>Laughs</Text>
            </View>

            {/* Box 2: Posts */}
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{formatStatNumber(postsCount)}</Text>
              <Text style={styles.statLbl}>Posts</Text>
            </View>

            {/* Box 3: Followers */}
            <TouchableOpacity
              style={styles.statBox}
              onPress={() => { hapticLight(); onPressFollowers?.(); }}
              disabled={dimmed}
            >
              <Text style={styles.statNum}>{formatStatNumber(followersCount)}</Text>
              <Text style={styles.statLbl}>Followers</Text>
            </TouchableOpacity>

            {/* Box 4: Following */}
            <TouchableOpacity
              style={styles.statBox}
              onPress={() => { hapticLight(); onPressFollowing?.(); }}
              disabled={dimmed}
            >
              <Text style={styles.statNum}>{formatStatNumber(followingCount)}</Text>
              <Text style={styles.statLbl}>Following</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Row 2: Action Buttons */}
      <View style={styles.actionsAndTagsRow}>
        {isOwnProfile ? (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.actionBtnBlack}
              onPress={onEditProfile}
            >
              <Feather name="settings" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtnBlack, { backgroundColor: '#FFD60A' }]}
              onPress={onManageSubscription}
            >
              <Feather name="star" size={14} color="#000" style={{ marginRight: 6 }} />
              <Text style={[styles.actionBtnText, { color: '#000' }]}>Manage Subscription</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.actionBtnBlack}
              onPress={onFollowToggle}
              disabled={followLoading || followRequestPending}
            >
              <Feather
                name={followRequestPending ? "clock" : (isFollowing ? "check" : "user-plus")}
                size={14}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.actionBtnText}>
                {followRequestPending ? 'Requested' : (isFollowing ? 'Following' : 'Follow')}
              </Text>
            </TouchableOpacity>

            {hasSubscriptionTier && (
              <TouchableOpacity
                style={[
                  styles.actionBtnBlack, 
                  isSubscribed 
                    ? { backgroundColor: '#ff3b30' }
                    : { backgroundColor: '#FFD60A' }
                ]}
                onPress={onSubscribe}
              >
                <Feather 
                  name={isSubscribed ? "x-circle" : "star"} 
                  size={14} 
                  color={isSubscribed ? "#fff" : "#000"} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={[styles.actionBtnText, { color: isSubscribed ? "#fff" : "#000" }]}>
                  {isSubscribed ? 'Cancel Subscription' : 'Subscribe'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Row 2.5: Wrapped Tag Chips */}
      {interestsList.length > 0 && (
        <View style={styles.tagsContainer}>
          {interestsList.map((tag, idx) => (
            <View key={idx} style={styles.tagChip}>
              <Text style={styles.tagChipText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Row 3: Bio & Links */}
      <View style={styles.bioContainer}>
        {!!profile?.bio && <Text style={styles.bioText}>{profile.bio}</Text>}

        {!!profile?.website && (
          <TouchableOpacity
            onPress={() => Linking.openURL(profile.website).catch(() => Alert.alert('Error', 'Cannot open link'))}
            style={styles.websiteLink}
          >
            <Feather name="link" size={12} color="#007aff" style={{ marginRight: 4 }} />
            <Text style={styles.websiteText} numberOfLines={1}>{profile.website}</Text>
          </TouchableOpacity>
        )}

        {!!profile?.location && (
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={12} color="#666" style={{ marginRight: 4 }} />
            <Text style={styles.locationText}>{profile.location}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    // paddingTop: 2,
    backgroundColor: '#fff',
  },
  profileMetaBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  avatarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRing: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRingInner: {
    backgroundColor: '#fff',
  },
  avatar: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  editBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
    overflow: 'hidden',
  },
  infoWrapper: {
    flex: 1,
    marginLeft: 16,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 2,
  },
  username: {
    fontSize: 12,
    color: '#888',
    marginTop: 1,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5ea',
  },
  statNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
  },
  statLbl: {
    fontSize: 9,
    color: '#666',
    marginTop: 1,
  },
  actionsAndTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  actionBtnBlack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    borderRadius: 18,
    height: 32,
    paddingHorizontal: 16,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tagChip: {
    backgroundColor: '#00a2ff',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    width: '100%',
  },
  bioContainer: {
    marginTop: 10,
    paddingBottom: 8,
  },
  bioText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  websiteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  websiteText: {
    fontSize: 13,
    color: '#007aff',
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
  },
});

export default ProfileHeader;
