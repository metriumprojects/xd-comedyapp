import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { feedEventEmitter } from '../../lib/feedEventEmitter';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PostCard from './PostCard';
import COLORS from '@/src/theme/colors';

interface Post {
  id: string;
  _id?: string;
  imageUrl?: string;
  imageUrls?: string[];
  caption?: string;
  userId: any;
  likes?: string[];
  savedBy?: string[];
  commentsCount?: number;
  comments?: any[];
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

  const [activePostId, setActivePostId] = useState<string | null>(() => {
    if (Array.isArray(displayPosts) && displayPosts.length > 0) {
      const p = displayPosts[0];
      return String(p?.id || p?._id || '');
    }
    return null;
  });

  // When displayPosts or visible changes, sync activePostId to the top post
  useEffect(() => {
    if (visible && Array.isArray(displayPosts) && displayPosts.length > 0) {
      const p = displayPosts[0];
      setActivePostId(String(p?.id || p?._id || ''));
      flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [visible, displayPosts]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
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
    itemVisiblePercentThreshold: 35,
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
          estimatedItemSize={500}
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
            const isItemActive = displayPosts.length <= 1 || (activePostId ? itemId === activePostId : false);
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
