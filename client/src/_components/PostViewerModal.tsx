import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
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
  const didInitialScrollRef = useRef(false);
  const targetIndexRef = useRef(0);

  useEffect(() => {
    if (!visible) {
      didInitialScrollRef.current = false;
      return;
    }
    if (!flashListRef.current) return;
    if (!Array.isArray(posts) || posts.length === 0) return;
    if (selectedPostIndex < 0 || selectedPostIndex >= posts.length) return;

    targetIndexRef.current = selectedPostIndex;
    if (selectedPostIndex === 0) {
      didInitialScrollRef.current = true;
    } else {
      didInitialScrollRef.current = false;
    }
    
    // FlashList initial positioning is much faster
    const timer = setTimeout(() => {
      if (!flashListRef.current) return;
      try {
        if (selectedPostIndex > 0) {
          flashListRef.current.scrollToIndex({ 
            index: selectedPostIndex, 
            animated: false
          });
        }
        didInitialScrollRef.current = true;
      } catch (e) {
        didInitialScrollRef.current = true;
      }
    }, 30);

    return () => clearTimeout(timer);
  }, [visible, selectedPostIndex]);

  useEffect(() => {
    const subscription = feedEventEmitter.addListener('closePostViewer', () => {
      onClose();
    });
    return () => subscription.remove();
  }, [onClose]);

  const [activePostId, setActivePostId] = useState<string | null>(() => {
    if (Array.isArray(posts) && selectedPostIndex >= 0 && selectedPostIndex < posts.length) {
      const p = posts[selectedPostIndex];
      return String(p?.id || p?._id || '');
    }
    return null;
  });

  // When selectedPostIndex or visible changes, sync activePostId
  useEffect(() => {
    if (visible && Array.isArray(posts) && selectedPostIndex >= 0 && selectedPostIndex < posts.length) {
      const p = posts[selectedPostIndex];
      setActivePostId(String(p?.id || p?._id || ''));
      if (selectedPostIndex === 0) {
        didInitialScrollRef.current = true;
      } else {
        didInitialScrollRef.current = false;
      }
    }
  }, [visible, selectedPostIndex, posts]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    // Before initial scroll completes to selectedPostIndex, don't let index 0 overwrite activePostId
    if (!didInitialScrollRef.current && targetIndexRef.current > 0) {
      return;
    }
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
          data={posts}
          keyExtractor={(item, index) => String(item?.id || item?._id || index)}
          estimatedItemSize={SCREEN_HEIGHT * 0.75}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => {
            didInitialScrollRef.current = true;
          }}
          initialScrollIndex={selectedPostIndex >= 0 && selectedPostIndex < posts.length ? selectedPostIndex : undefined}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          // Each cell hosts PostCard's comment sheet; on Android clipping detaches and reattaches
          // its native subtree, which swallows the first touch inside the sheet.
          removeClippedSubviews={false}
          renderItem={({ item }) => {
            const itemId = String(item?.id || item?._id || '');
            const isItemActive = posts.length <= 1 || (activePostId ? itemId === activePostId : true);
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
