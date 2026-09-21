import React from 'react';
import { ScrollView, Pressable, View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '@/lib/haptics';
import { DEFAULT_AVATAR_URL } from '@/lib/api';
import COLORS from '@/src/theme/colors';

interface ProfileSectionsProps {
  sections: any[];
  selectedSection: string | null;
  onSelectSection: (sectionName: string | null) => void;
  sectionSourcePosts: any[];
  getPostId: (post: any) => string;
  isOwnProfile: boolean;
  currentUserId: string | null;
  onEditSections?: () => void;
  subscriptionSectionName?: string;
  isSubscribed?: boolean;
  activeSubscribedTierIds?: string[];
}

const ProfileSections: React.FC<ProfileSectionsProps> = ({
  sections,
  selectedSection,
  onSelectSection,
  sectionSourcePosts,
  getPostId,
  isOwnProfile,
  currentUserId,
  onEditSections,
  subscriptionSectionName,
  isSubscribed = false,
  activeSubscribedTierIds = [],
}) => {
  const visibleSections = (sections as any[]).filter(s => {
    if (isOwnProfile) return true;
    if (!s.visibility || s.visibility === 'public') return true;
    const collaborators = Array.isArray(s.collaborators) ? s.collaborators : [];
    const viewerId = String(currentUserId || '');
    return collaborators.some((c: any) => {
      const cid = typeof c === 'string' ? c : (c.userId || c.uid || c._id || c.firebaseUid);
      return String(cid) === viewerId;
    });
  });

  if (visibleSections.length === 0 && !isOwnProfile) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {visibleSections.map((s, idx) => {
        const isActive = selectedSection === s.name;
        const isSubscriptionFolder = !!(s as any).isSubscriptionFolder || (!!subscriptionSectionName && s.name === subscriptionSectionName);
        const firstPostInRange = sectionSourcePosts.find(p => s.postIds?.includes?.(getPostId(p)));
        const rawCover = s.coverImage || firstPostInRange?.imageUrl || firstPostInRange?.mediaUrl || firstPostInRange?.media?.[0]?.url || firstPostInRange?.mediaUrls?.[0] || null;
        const hasCover = !!rawCover && rawCover !== DEFAULT_AVATAR_URL && !rawCover.includes('avatardefault');

        // Per-tier lock: unlock only if the viewer is subscribed to THIS specific tier.
        // Falls back to the aggregate `isSubscribed` when the tier id isn't attached (legacy folder).
        const tierId = (s as any)?.tierId ? String((s as any).tierId) : '';
        const subscribedToThisTier = tierId
          ? activeSubscribedTierIds.includes(tierId)
          : isSubscribed;
        const isArchivedTier = !!(s as any)?.isArchived;
        const showLock = isSubscriptionFolder && !isOwnProfile && !subscribedToThisTier;

        // Never render an archived tier folder to viewers who are neither the creator nor an active subscriber
        if (isArchivedTier && !isOwnProfile && !subscribedToThisTier) {
          return null;
        }

        return (
          <Pressable
            key={`section-${String((s as any)?._id || s.name)}-${idx}`}
            onPress={() => {
              hapticLight();
              onSelectSection(isActive ? null : s.name);
            }}
            hitSlop={8}
            style={({ pressed }) => [styles.sectionItem, pressed && { opacity: 0.7 }]}
          >
            <View style={[
              styles.imageContainer,
              isActive && styles.activeImageContainer,
              isArchivedTier && styles.archivedImageContainer,
            ]}>
              {hasCover ? (
                <ExpoImage
                  source={{ uri: rawCover }}
                  style={[styles.image, isArchivedTier && { opacity: 0.55 }]}
                  contentFit="cover"
                  transition={0}
                />
              ) : (
                <View style={styles.placeholderContainer}>
                  <Feather 
                    name={isSubscriptionFolder ? "star" : "folder"} 
                    size={22} 
                    color={isActive ? COLORS.primary : COLORS.textMuted} 
                  />
                </View>
              )}
              {isArchivedTier && (
                <View style={styles.archivedBadge}>
                  <Text style={styles.archivedBadgeText}>Archived</Text>
                </View>
              )}
              {showLock && !isArchivedTier && (
                <View style={styles.lockOverlay}>
                  <Feather name="lock" size={14} color={COLORS.textLight} />
                </View>
              )}
            </View>
            <View style={styles.labelRow}>
              {showLock && !isArchivedTier && (
                <Feather name="lock" size={10} color={isActive ? '#007aff' : '#333'} style={{ marginRight: 2 }} />
              )}
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  isActive && styles.activeLabel,
                  showLock && styles.labelWithLock,
                  isArchivedTier && styles.archivedLabel,
                ]}
              >
                {s.name}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {isOwnProfile && (
        <Pressable
          onPress={() => {
            hapticLight();
            onEditSections?.();
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.sectionItem, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.newButtonContainer}>
            <Feather name="plus" size={24} color="#666" />
          </View>
          <Text style={styles.label}>New</Text>
        </Pressable>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    gap: 14,
    paddingVertical: 0,
    marginBottom: 8,
  },
  sectionItem: {
    alignItems: 'center',
    width: 64,
  },
  imageContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#eee',
    borderWidth: 0,
  },
  activeImageContainer: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  archivedImageContainer: {
    borderWidth: 1,
    borderColor: '#c7c7cc',
    borderStyle: 'dashed',
  },
  archivedBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  archivedBadgeText: {
    color: COLORS.textLight,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  archivedLabel: {
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  labelRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
  },
  label: {
    fontSize: 11,
    fontWeight: '400',
    color: COLORS.textPrimary,
    textAlign: 'center',
    maxWidth: 64,
  },
  labelWithLock: {
    maxWidth: 50,
  },
  lockOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeLabel: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  newButtonContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#f5f5f7',
    borderWidth: 1,
    borderColor: '#e5e5ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(ProfileSections);
