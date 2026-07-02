import React from 'react';
import { ScrollView, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '@/lib/haptics';
import { DEFAULT_AVATAR_URL } from '@/lib/api';

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
    >
      {visibleSections.map((s, idx) => {
        const isActive = selectedSection === s.name;
        const isSubscriptionFolder = !!(s as any).isSubscriptionFolder || (!!subscriptionSectionName && s.name === subscriptionSectionName);
        const firstPostInRange = sectionSourcePosts.find(p => s.postIds?.includes?.(getPostId(p)));
        const coverUri = s.coverImage || firstPostInRange?.imageUrl || DEFAULT_AVATAR_URL;
        const showLock = isSubscriptionFolder && !isOwnProfile && !isSubscribed;

        return (
          <TouchableOpacity
            key={`section-${String((s as any)?._id || s.name)}-${idx}`}
            activeOpacity={0.8}
            onPress={() => {
              hapticLight();
              onSelectSection(isActive ? null : s.name);
            }}
            style={styles.sectionItem}
          >
            <View style={[
              styles.imageContainer,
              isActive && styles.activeImageContainer
            ]}>
              <ExpoImage
                source={{ uri: coverUri }}
                style={styles.image}
                contentFit="cover"
                transition={0}
              />
              {showLock && (
                <View style={styles.lockOverlay}>
                  <Feather name="lock" size={14} color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.labelRow}>
              {showLock && (
                <Feather name="lock" size={10} color={isActive ? '#007aff' : '#333'} style={{ marginRight: 2 }} />
              )}
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  isActive && styles.activeLabel,
                  showLock && styles.labelWithLock,
                ]}
              >
                {s.name}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {isOwnProfile && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            hapticLight();
            onEditSections?.();
          }}
          style={styles.sectionItem}
        >
          <View style={styles.newButtonContainer}>
            <Feather name="plus" size={24} color="#666" />
          </View>
          <Text style={styles.label}>New</Text>
        </TouchableOpacity>
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
    borderColor: '#007aff',
  },
  image: {
    width: '100%',
    height: '100%',
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
    color: '#333',
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
    color: '#007aff',
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
