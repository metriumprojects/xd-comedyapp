import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  InteractionManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Platform,
  RefreshControl
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { useReelsStore } from "@/store/useReelsStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from '@/lib/storage';
import { useIsFocused } from '@react-navigation/native';

import ReelItem from "../../src/_components/ReelItem";
import { HomeReelSkeleton } from "../../src/_components/HomeReelSkeleton";
import NotificationsModal from "../../src/_components/NotificationsModal";
import GroupsDrawer from "../../src/_components/GroupsDrawer";

import { useHomeFeed } from '@/hooks/useHomeFeed';
import { useCategories } from '@/hooks/useCategories';
import { useFeedEvents } from '@/hooks/useFeedEvents';
import { useNetworkStatus } from '../../hooks/useOffline';
import { resolveCanonicalUserId } from '../../lib/currentUser';
import { apiService } from '@/src/_services/apiService';
import { useNotifications } from '../../hooks/useNotifications';
import { useUIStore } from '../../store/useUIStore';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchOwnProfile } from '@/src/features/profile/hooks/useProfileData';
import { useTabEvent } from './_layout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const filter = (params.filter as string) || '';

  const { isOnline } = useNetworkStatus();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);

  // 1. Load feed and categories
  const {
    posts,
    setPosts,
    setAllLoadedPosts,
    loading,
    loadingMore,
    loadInitialFeed,
    loadMorePosts
  } = useHomeFeed(currentUserId, !!isOnline);

  const { categories, loadCategories } = useCategories();

  // 2. State for overlays & controls
  const isScreenFocused = useIsFocused();
  const activeIndex = useReelsStore((state) => state.activeIndex);
  const setActiveIndex = useReelsStore((state) => state.setActiveIndex);
  const [isMuted, setIsMuted] = useState(true);
  const [containerHeight, setContainerHeight] = useState(SCREEN_HEIGHT);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [groupsDrawerVisible, setGroupsDrawerVisible] = useState(false);
  const [unreadMsg, setUnreadMsg] = useState(0);

  const [followedStories, setFollowedStories] = useState<any[]>([]);

  const fetchFollowedStories = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const { getAllStoriesForFeed } = await import('../../lib/firebaseHelpers/index');
      const res = await getAllStoriesForFeed();
      if (res.success && Array.isArray(res.data)) {
        const grouped = new Map<string, any>();
        for (const story of res.data) {
          const userId = String(story.userId?._id || story.userId || '');
          if (!userId) continue;

          // Format story for StoriesViewer compatibility
          const transformed = {
            ...story,
            id: story._id || story.id,
            imageUrl: story.image || story.imageUrl || story.mediaUrl || '',
            videoUrl: story.video || story.videoUrl || '',
            mediaType: (story.video || story.videoUrl || story.mediaType === 'video') ? 'video' : 'image',
            thumbnailUrl: story.thumbnail || story.thumbnailUrl || ''
          };

          if (!grouped.has(userId)) {
            grouped.set(userId, {
              userId,
              userName: story.userName || 'User',
              userAvatar: story.userAvatar || '',
              stories: [],
            });
          }
          grouped.get(userId).stories.push(transformed);
        }
        setFollowedStories(Array.from(grouped.values()));
      }
    } catch (err) {
      console.warn('[Home] Failed to load followed stories:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      fetchFollowedStories();
    }
  }, [currentUserId, fetchFollowedStories]);

  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const { setTabBarVisible } = useUIStore();

  // Hide tab navigation bar on fullscreen mode
  useEffect(() => {
    setTabBarVisible(!isScreenFocused || !isFullscreenMode);
  }, [isFullscreenMode, isScreenFocused, setTabBarVisible]);

  const flatListRef = useRef<FlatList>(null);
  const prevContainerHeightRef = useRef(containerHeight);

  // 3. User notification counts
  const { notifications, unreadCount, fetchNotifications, markAllAsRead } = useNotifications(currentUserId || '', 60000);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const promises: Promise<any>[] = [
        loadInitialFeed(0, { bypassDedupe: true, _t: Date.now() }),
        loadCategories()
      ];
      if (currentUserId) {
        promises.push(fetchFollowedStories());
        promises.push(fetchNotifications());
      }
      await Promise.allSettled(promises);
    } catch (e) {
      console.warn('[Home] Refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  }, [loadInitialFeed, loadCategories, currentUserId, fetchFollowedStories, fetchNotifications]);

  const tabEvent = useTabEvent();
  useEffect(() => {
    if (!tabEvent) return;
    const unsubscribe = tabEvent.subscribeHomeTabPress(() => {
      if (isScreenFocused) {
        if (flatListRef.current) {
          flatListRef.current.scrollToOffset({ offset: 0, animated: true });
        }
        handleRefresh();
      }
    });
    return unsubscribe;
  }, [tabEvent, isScreenFocused, handleRefresh]);



  // Initial user setup
  useEffect(() => {
    const getUserId = async () => {
      try {
        const eulaAccepted = await AsyncStorage.getItem('eula_accepted_v2');
        if (eulaAccepted !== 'true') {
          router.replace('/auth/eula-screen');
          return;
        }

        const userId = await resolveCanonicalUserId();
        setCurrentUserId(userId);

        if (userId) {
          try {
            const response = await apiService.getUser(userId);
            if (response?.success && response?.data) {
              setCurrentUserData(response.data);
            }
          } catch (error) { }
          prefetchOwnProfile(queryClient, userId);
        }
      } catch (error) { }
    };
    getUserId();
  }, [queryClient]);

  // Defer non-critical focus work so tab switches stay instant
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const task = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        loadCategories();
        if (currentUserId) {
          fetchNotifications();
          fetchFollowedStories();
          import('../../lib/firebaseHelpers/conversation').then(({ getUserConversations }) => {
            if (cancelled) return;
            getUserConversations(currentUserId).then((msgRes) => {
              if (cancelled || !Array.isArray(msgRes)) return;
              const unreadMsgs = msgRes.reduce((sum: number, convo: any) => sum + (convo.unread || 0), 0);
              setUnreadMsg(unreadMsgs);
            }).catch(() => { });
          }).catch(() => { });
        }
      });
      return () => {
        cancelled = true;
        task.cancel?.();
      };
    }, [loadCategories, currentUserId, fetchFollowedStories, fetchNotifications])
  );

  useFeedEvents(setPosts, setAllLoadedPosts, !!isOnline, loadInitialFeed);

  // Prepend or reorder Podium category to always be the first chip
  const finalCategories = useMemo(() => {
    const hasPodium = categories.some((c: any) => c.name.toLowerCase() === 'podium');
    if (!hasPodium) {
      return [{ name: 'Podium', image: '' }, ...categories];
    }
    const filtered = categories.filter((c: any) => c.name.toLowerCase() !== 'podium');
    return [{ name: 'Podium', image: '' }, ...filtered];
  }, [categories]);

  // Filter posts based on selected category and search query
  const filteredPosts = useMemo(() => {
    let result = posts;

    // Filter by category chip
    if (filter) {
      result = result.filter(
        (p: any) => p.category?.toLowerCase() === filter.toLowerCase()
      );
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p: any) =>
          p.caption?.toLowerCase().includes(query) ||
          p.userName?.toLowerCase().includes(query) ||
          p.locationData?.name?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [posts, filter, searchQuery]);

  // Correct FlatList scroll offset immediately when container height changes to prevent jumping glitches
  useEffect(() => {
    if (prevContainerHeightRef.current !== containerHeight) {
      prevContainerHeightRef.current = containerHeight;
      if (flatListRef.current && filteredPosts.length > activeIndex) {
        flatListRef.current.scrollToOffset({
          offset: activeIndex * containerHeight,
          animated: false,
        });
      }
    }
  }, [containerHeight, activeIndex, filteredPosts.length]);

  const handleScroll = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / containerHeight);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  }, [containerHeight, activeIndex]);

  const onLayout = useCallback((e: any) => {
    const { height } = e.nativeEvent.layout;
    setContainerHeight(height);
  }, []);

  const handleCategoryPress = useCallback((catName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    if (catName.toLowerCase() === 'podium') {
      router.push('/podium');
      return;
    }
    const next = catName === filter ? '' : catName;
    router.push(next ? `/(tabs)/home?filter=${encodeURIComponent(next)}` : `/(tabs)/home`);
  }, [filter, router]);

  const handleSearchSubmit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    // Trigger local filtering or reload initial feed with query params if supported
  };

  const toggleMute = useCallback(() => setIsMuted(prev => !prev), []);
  const toggleFullscreen = useCallback(() => setIsFullscreenMode(prev => !prev), []);

  const renderReelItem = useCallback(({ item, index }: { item: any; index: number }) => {
    return (
      <ReelItem
        post={item}
        currentUser={currentUserData || currentUserId}
        index={index}
        isScreenFocused={isScreenFocused}
        isMuted={isMuted}
        toggleMute={toggleMute}
        containerHeight={containerHeight}
        isFullscreenMode={isFullscreenMode}
        onToggleFullscreen={toggleFullscreen}
        followedStories={followedStories}
      />
    );
  }, [currentUserData, currentUserId, isMuted, containerHeight, isFullscreenMode, isScreenFocused, followedStories, toggleMute, toggleFullscreen]);

  const keyExtractor = useCallback((item: any, index: number) => {
    const id = item?.id || item?._id;
    return id ? `reel-${String(id)}` : `reel-fallback-${index}`;
  }, []);

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* 1. Main full-screen vertical swipe Reels list */}
      {filteredPosts.length > 0 ? (
        <FlatList
          ref={flatListRef}
          data={filteredPosts}
          renderItem={renderReelItem}
          keyExtractor={keyExtractor}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onEndReached={loadMorePosts}
          onEndReachedThreshold={1.5}
          decelerationRate="fast"
          snapToInterval={containerHeight}
          snapToAlignment="start"
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={1}
          removeClippedSubviews={Platform.OS === 'android'}
          getItemLayout={(data, index) => ({
            length: containerHeight,
            offset: containerHeight * index,
            index,
          })}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#fff"
              colors={["#FF8D00"]}
            />
          }
        />
      ) : loading ? (
        <HomeReelSkeleton height={containerHeight} />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-off-outline" size={48} color="#888" />
          <Text style={styles.emptyText}>No comedy reels found</Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
          >
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. Absolute Top Overlays (Header controls, Search, Categories) */}
      {!isFullscreenMode && (
        <View style={[styles.topOverlays, { paddingTop: insets.top || 8 }]} pointerEvents="box-none">

          {/* Header navigation and controls */}
          <View style={styles.headerRow} pointerEvents="box-none">
            {filter || searchQuery ? (
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => {
                  router.push("/(tabs)/home");
                  setSearchQuery("");
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#ffffff" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 36 }} />
            )}

            <View style={styles.headerRight} pointerEvents="box-none">
              {/* Notification bell button */}
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={async () => {
                  setNotificationsVisible(true);
                  try {
                    await markAllAsRead();
                    await fetchNotifications({ force: true });
                  } catch { }
                }}
              >
                <Feather name="bell" size={22} color="#ffffff" />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Messages/Inbox button */}
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => router.push('/inbox')}
              >
                <Feather name="message-square" size={20} color="#ffffff" />
                {unreadMsg > 0 && (
                  <View style={[styles.badge, { backgroundColor: '#FF8D00' }]}>
                    <Text style={styles.badgeText}>
                      {unreadMsg > 99 ? '99+' : unreadMsg}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Search funny videos bar */}
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color="#ffffff" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search funny videos"
              placeholderTextColor="rgba(255,255,255,0.8)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearchSubmit}>
              <Text style={styles.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Horizontal scrollable category chips */}
          <View style={styles.categoriesRow} pointerEvents="box-none">
            <FlatList
              data={finalCategories}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.name}
              contentContainerStyle={styles.categoriesList}
              renderItem={({ item }) => {
                const isActive = filter.toLowerCase() === item.name.toLowerCase();
                return (
                  <TouchableOpacity
                    style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    onPress={() => handleCategoryPress(item.name)}
                  >
                    {item.name === 'Podium' && (
                      <Ionicons
                        name="stats-chart"
                        size={14}
                        color={isActive ? '#000000' : '#ffffff'}
                        style={{ marginRight: 4 }}
                      />
                    )}
                    <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>)}

      {/* 3. Notifications Modal */}
      <NotificationsModal
        visible={notificationsVisible}
        onClose={() => setNotificationsVisible(false)}
      />

      {/* 4. Groups Drawer */}
      <GroupsDrawer
        visible={groupsDrawerVisible}
        onClose={() => setGroupsDrawerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#888888',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  refreshBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  refreshBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
  topOverlays: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 38,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ff3b30',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'transparent',
    marginHorizontal: 10,
    marginTop: 4,
    paddingLeft: 12,
    paddingRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  clearBtn: {
    paddingHorizontal: 4,
    marginRight: 6,
  },
  searchBtn: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 8,
  },
  searchBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '400',
  },
  categoriesRow: {
    marginTop: 10,
  },
  categoriesList: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    marginHorizontal: -5,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  categoryChipText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#000000',
  },
});
