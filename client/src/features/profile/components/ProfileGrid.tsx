import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  RefreshControl,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProfileGridItem from '@/src/_components/profile/ProfileGridItem';
import { ProfileStatistics } from '@/src/_components/profile/ProfileStatistics';
import { ProfileSubscriptions } from '@/src/_components/profile/ProfileSubscriptions';
import ProfileSections from '@/src/_components/profile/ProfileSections';
import COLORS from '@/src/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_ORDER: ('grid' | 'tagged' | 'heart' | 'star' | 'stats')[] = ['grid', 'tagged', 'heart', 'star', 'stats'];

const SkeletonGrid = () => {
  const itemSize = SCREEN_WIDTH / 2;
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 6 }).map((_, idx) => (
        <View key={idx} style={[styles.skeletonItem, { width: itemSize, height: itemSize }]}>
          <View style={styles.skeletonShimmer} />
        </View>
      ))}
    </View>
  );
};

const RenderGridPage = ({
  posts,
  loading,
  emptyIcon,
  emptyTitle,
  emptySub,
  onPressPost,
  normalizeMediaUrl,
  isVideoUrl,
  DEFAULT_IMAGE_URL,
}: {
  posts: any[];
  loading: boolean;
  emptyIcon: string;
  emptyTitle: string;
  emptySub?: string;
  onPressPost: (item: any, index: number) => void;
  normalizeMediaUrl: (url: string) => string;
  isVideoUrl: (url: string) => boolean;
  DEFAULT_IMAGE_URL: string;
}) => {
  if (loading && posts.length === 0) {
    return <SkeletonGrid />;
  }

  if (posts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name={emptyIcon as any} size={48} color={COLORS.border} />
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        {!!emptySub && <Text style={styles.emptySub}>{emptySub}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.gridRow}>
      {posts.map((item, index) => (
        <ProfileGridItem
          key={item.id || item._id || `post-${index}`}
          item={item}
          index={index}
          onPress={onPressPost}
          normalizeMediaUrl={normalizeMediaUrl}
          isVideoUrl={isVideoUrl}
          DEFAULT_IMAGE_URL={DEFAULT_IMAGE_URL}
        />
      ))}
    </View>
  );
};

interface ProfileGridProps {
  scrollX: Animated.Value;
  gridPosts: any[];
  taggedPosts: any[];
  likedPosts: any[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  renderHeader: React.ReactElement;
  onPressPost: (item: any, index: number) => void;
  normalizeMediaUrl: (url: string) => string;
  isVideoUrl: (url: string) => boolean;
  DEFAULT_IMAGE_URL: string;
  insetsBottom: number;
  segmentTab: 'grid' | 'tagged' | 'heart' | 'star' | 'stats';
  onSelectTab?: (tab: 'grid' | 'tagged' | 'heart' | 'star' | 'stats') => void;
  currentUserId?: string | null;
  creatorPosts?: any[];

  // Sections props for Tab 0 Saved Collections
  mergedSections?: any[];
  selectedSection?: string | null;
  onSelectSection?: (secName: string | null) => void;
  subscriptionTitle?: string;
  isSubscribed?: boolean;
  sectionSourcePosts?: any[];
  getPostId?: (post: any) => string;
  isOwnProfile?: boolean;
  onEditSections?: () => void;
}

const ProfileGrid: React.FC<ProfileGridProps> = ({
  scrollX,
  gridPosts,
  taggedPosts,
  likedPosts,
  loading,
  refreshing,
  onRefresh,
  renderHeader,
  onPressPost,
  normalizeMediaUrl,
  isVideoUrl,
  DEFAULT_IMAGE_URL,
  insetsBottom,
  segmentTab,
  onSelectTab,
  currentUserId = null,
  creatorPosts = [],
  mergedSections,
  selectedSection,
  onSelectSection,
  subscriptionTitle,
  isSubscribed,
  sectionSourcePosts,
  getPostId,
  isOwnProfile,
  onEditSections,
}) => {
  const horizontalScrollRef = useRef<ScrollView>(null);
  const lastScrolledIndexRef = useRef<number>(TAB_ORDER.indexOf(segmentTab));

  useEffect(() => {
    const targetIdx = TAB_ORDER.indexOf(segmentTab);
    if (targetIdx >= 0 && targetIdx !== lastScrolledIndexRef.current && horizontalScrollRef.current) {
      lastScrolledIndexRef.current = targetIdx;
      horizontalScrollRef.current.scrollTo({
        x: targetIdx * SCREEN_WIDTH,
        animated: true,
      });
    }
  }, [segmentTab]);

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / SCREEN_WIDTH);
    const newTab = TAB_ORDER[pageIndex];
    if (newTab) {
      lastScrolledIndexRef.current = pageIndex;
      if (newTab !== segmentTab) {
        onSelectTab?.(newTab);
      }
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insetsBottom + 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {renderHeader}

      {/* Instagram-style Native Horizontal Paging Carousel */}
      <ScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {/* Page 0: Grid (with ProfileSections at top) */}
        <View style={{ width: SCREEN_WIDTH }}>
          {mergedSections && (mergedSections.length > 0 || isOwnProfile) && (
            <View style={{ marginTop: 8, marginBottom: 4 }}>
              <ProfileSections
                sections={mergedSections}
                selectedSection={selectedSection || null}
                onSelectSection={(secName) => {
                  onSelectSection?.(secName);
                  if (secName) {
                    onSelectTab?.('grid');
                  }
                }}
                subscriptionSectionName={subscriptionTitle}
                isSubscribed={isSubscribed}
                sectionSourcePosts={sectionSourcePosts}
                getPostId={getPostId}
                isOwnProfile={isOwnProfile}
                currentUserId={currentUserId}
                onEditSections={onEditSections}
              />
            </View>
          )}
          <RenderGridPage
            posts={gridPosts}
            loading={loading}
            emptyIcon="grid-outline"
            emptyTitle="No posts yet"
            onPressPost={onPressPost}
            normalizeMediaUrl={normalizeMediaUrl}
            isVideoUrl={isVideoUrl}
            DEFAULT_IMAGE_URL={DEFAULT_IMAGE_URL}
          />
        </View>

        {/* Page 1: Tagged */}
        <View style={{ width: SCREEN_WIDTH }}>
          <RenderGridPage
            posts={taggedPosts}
            loading={loading}
            emptyIcon="person-outline"
            emptyTitle="No tagged posts yet"
            onPressPost={onPressPost}
            normalizeMediaUrl={normalizeMediaUrl}
            isVideoUrl={isVideoUrl}
            DEFAULT_IMAGE_URL={DEFAULT_IMAGE_URL}
          />
        </View>

        {/* Page 2: Liked */}
        <View style={{ width: SCREEN_WIDTH }}>
          <RenderGridPage
            posts={likedPosts}
            loading={loading}
            emptyIcon="heart-outline"
            emptyTitle="No liked reels yet"
            emptySub="Reels liked by this user will appear here."
            onPressPost={onPressPost}
            normalizeMediaUrl={normalizeMediaUrl}
            isVideoUrl={isVideoUrl}
            DEFAULT_IMAGE_URL={DEFAULT_IMAGE_URL}
          />
        </View>

        {/* Page 3: Star (Subscriptions) */}
        <View style={{ width: SCREEN_WIDTH }}>
          <ProfileSubscriptions currentUserId={currentUserId} />
        </View>

        {/* Page 4: Stats */}
        <View style={{ width: SCREEN_WIDTH }}>
          <ProfileStatistics creatorPosts={creatorPosts} currentUserId={currentUserId} />
        </View>
      </ScrollView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: SCREEN_WIDTH,
  },
  skeletonItem: {
    padding: 1,
  },
  skeletonShimmer: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderRadius: 2,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    width: SCREEN_WIDTH,
  },
  emptyTitle: {
    marginTop: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  emptySub: {
    marginTop: 4,
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: SCREEN_WIDTH,
  },
});

export default ProfileGrid;
