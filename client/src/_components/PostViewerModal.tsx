import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { feedEventEmitter } from '../../lib/feedEventEmitter';
import { probeBatchPostRatios } from '../media/mediaRatioCache';
import { prefetchVideo } from '../media/videoCache';
import { getOptimizedMediaUrl, isVideoUrl } from '@/lib/utils/media';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PostCard from './PostCard';
import COLORS from '@/src/theme/colors';

interface Post {
  id: string;
  _id?: string;
  imageUrl?: string;
  imageUrls?: string[];
  media?: any[];
  mediaUrl?: string;
  mediaUrls?: string[];
  thumbnailUrl?: string;
  gridThumb?: string;
  aspectRatio?: number;
  caption?: string;
  userId: any;
  likes?: string[];
  savedBy?: string[];
  commentsCount?: number;
  comments?: any[];
  [key: string]: any;
}

interface Profile {
  avatar?: string;
  username?: string;
  name?: string;
}

interface AuthUser {
  uid?: string;
  _id?: string;
}

interface PostViewerModalProps {
  visible: boolean;
  onClose: () => void;
  posts: Post[];
  selectedPostIndex: number;
  profile: Profile | null;
  authUser: AuthUser | null;
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  handleLikePost: (post: Post) => void;
  handleSavePost: (post: Post) => void;
  handleSharePost: (post: Post) => void;
  setCommentModalPostId: (id: string | null) => void;
  setCommentModalAvatar: (avatar: string) => void;
  setCommentModalVisible: (visible: boolean) => void;
  title?: string;
}

export default function PostViewerModal({
  visible,
  onClose,
  posts,
  selectedPostIndex,
  profile,
  authUser,
  likedPosts,
  savedPosts,
  handleLikePost,
  handleSavePost,
  handleSharePost,
  setCommentModalPostId,
  setCommentModalAvatar,
  setCommentModalVisible,
  title = "Posts",
}: PostViewerModalProps): React.ReactElement {
  const flashListRef = useRef<FlashList<any>>(null);
  const insets = useSafeAreaInsets();

  // Slice posts from selectedPostIndex so the tapped post is placed right at the top (index 0),
  // perfectly matching Instagram's behavior and completely avoiding any layout/offset glitches!
  const displayPosts = useMemo(() => {
    if (!Array.isArray(posts) || posts.length === 0) return [];
    if (selectedPostIndex > 0 && selectedPostIndex < posts.length) {
      return posts.slice(selectedPostIndex);
    }
    return posts;
  }, [posts, selectedPostIndex]);

  useEffect(() => {
    const subscription = feedEventEmitter.addListener('closePostViewer', () => {
      onClose();
    });
    return () => subscription.remove();
  }, [onClose]);

  const firstPostId = useMemo(() => {
    if (Array.isArray(displayPosts) && displayPosts.length > 0) {
      const p = displayPosts[0];
      return String(p?.id || p?._id || '');
    }
    return null;
  }, [displayPosts]);

  const [activePostId, setActivePostId] = useState<string | null>(firstPostId);

  // Sync activePostId immediately when visible transitions to true or firstPostId changes
  useEffect(() => {
    if (visible && firstPostId) {
      setActivePostId(firstPostId);
      flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [visible, firstPostId]);

  // Synchronous resolution prevents any 1-frame delayed playback on modal open
  const effectiveActivePostId = (activePostId && displayPosts.some(p => String(p?.id || p?._id || '') === activePostId))
    ? activePostId
    : firstPostId;

  // Proactively probe all post aspect ratios so scrolling has zero layout shifts / jhatka
  useEffect(() => {
    if (visible && displayPosts.length > 0) {
      probeBatchPostRatios(displayPosts);
    }
  }, [visible, displayPosts]);

  // Auto-prefetch upcoming videos in the background for 0ms start on scroll
  useEffect(() => {
    if (!visible || !displayPosts.length) return;
    const activeIdx = effectiveActivePostId
      ? displayPosts.findIndex((p: any) => String(p?.id || p?._id || '') === effectiveActivePostId)
      : 0;
    const startIdx = Math.max(0, activeIdx);
    const endIdx = Math.min(displayPosts.length, startIdx + 3);

    for (let i = startIdx; i < endIdx; i++) {
      const p = displayPosts[i];
      const mediaList = Array.isArray(p?.media) && p.media.length > 0 ? p.media : [];
      let vidUrl = '';
      if (mediaList.length > 0) {
        const m = mediaList[0];
        if (m.type === 'video' || isVideoUrl(m.url)) vidUrl = m.url;
      } else if (p?.mediaUrl && isVideoUrl(p.mediaUrl)) {
        vidUrl = p.mediaUrl;
      } else if (Array.isArray(p?.mediaUrls) && p.mediaUrls.length > 0 && isVideoUrl(p.mediaUrls[0])) {
        vidUrl = p.mediaUrls[0];
      }

      if (vidUrl && vidUrl.startsWith('http')) {
        const optUrl = getOptimizedMediaUrl(vidUrl);
        prefetchVideo(optUrl).catch(() => {});
      }
    }
  }, [visible, effectiveActivePostId, displayPosts]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (Array.isArray(viewableItems) && viewableItems.length > 0) {
      const visibleItem = viewableItems[0]?.item;
      if (visibleItem) {
        const id = String(visibleItem.id || visibleItem._id || '');
        if (id) {
          setActivePostId(id);
        }
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    waitForInteraction: false,
  }).current;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onClose();
      }}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onClose();
            }}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlashList
          ref={flashListRef}
          data={displayPosts}
          keyExtractor={(item, index) => String(item?.id || item?._id || index)}
          estimatedItemSize={620}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          decelerationRate="normal"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          // Each cell hosts PostCard's comment sheet; on Android clipping detaches and reattaches
          // its native subtree, which swallows the first touch inside the sheet.
          removeClippedSubviews={false}
          renderItem={({ item }) => {
            const itemId = String(item?.id || item?._id || '');
            const isItemActive = displayPosts.length <= 1 || (effectiveActivePostId ? itemId === effectiveActivePostId : false);
            return (
              <PostCard
                post={item}
                currentUser={authUser}
                showMenu={true}
                isActive={isItemActive}
                onCloseOuterModal={onClose}
                onCommentPress={(pid, avatar) => {
                  setCommentModalPostId(pid);
                  setCommentModalAvatar(avatar);
                  setCommentModalVisible(true);
                }}
              />
            );
          }}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
