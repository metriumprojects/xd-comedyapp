import { DEFAULT_AVATAR_URL } from '../lib/api';
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState, useCallback } from "react";
import AsyncStorage from '@/lib/storage';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  StyleSheet, 
  Keyboard, 
  Platform, 
  ActivityIndicator, 
  FlatList,
  Dimensions,
  KeyboardAvoidingView
} from "react-native";
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { searchUsers } from "../lib/firebaseHelpers/index";
import { safeRouterBack } from '@/lib/safeRouterBack';
import { getVideoThumbnailUrl } from '../lib/imageHelpers';
import { useLazyLoad } from '../hooks/usePerformance';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RECENT_SEARCHES_KEY = 'recent_searches_comedy_reels';

type TabType = 'posts' | 'videos' | 'image' | 'users' | 'location' | 'laugh' | 'tomato';

export default function SearchModal() {
  const isReady = useLazyLoad();
  const [q, setQ] = useState<string>('');
  const [searchActive, setSearchActive] = useState<boolean>(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Load current user and search history on mount
  useEffect(() => {
    AsyncStorage.getItem('userId').then(uid => {
      if (uid) setCurrentUserId(uid);
    }).catch(err => console.error('[Search] Failed to get userId:', err));

    const loadRecentSearches = async () => {
      try {
        const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
        if (stored) {
          setRecentSearches(JSON.parse(stored));
        } else {
          const defaults = ['Funny prank video', 'Cat videos', 'Stand ups'];
          setRecentSearches(defaults);
          await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(defaults));
        }
      } catch (e) {
        setRecentSearches(['Funny prank video', 'Cat videos', 'Stand ups']);
      }
    };
    loadRecentSearches();
  }, []);

  // Execute Search query
  const executeSearch = useCallback(async (query: string, tab: TabType) => {
    setLoading(true);
    try {
      if (tab === 'users') {
        const result = await searchUsers(query, 20);
        if (result.success && Array.isArray(result.data)) {
          setUsers(result.data);
        } else {
          setUsers([]);
        }
        setPosts([]);
      } else {
        const { apiService } = await import('@/src/_services/apiService');
        const response = await apiService.get('/posts/search', {
          params: {
            q: query,
            filter: tab,
            limit: 30
          }
        });
        if (response.success && Array.isArray(response.data)) {
          setPosts(response.data);
        } else {
          setPosts([]);
        }
        setUsers([]);
      }
    } catch (err) {
      console.error('[Search] Failed execution:', err);
      setPosts([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-run search if filter pill changes while search is active
  useEffect(() => {
    if (searchActive) {
      executeSearch(q, activeTab);
    }
  }, [activeTab, searchActive]);

  if (!isReady) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.headerSearchRow}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              safeRouterBack();
            }}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={24} color="#111" />
          </TouchableOpacity>

          <View style={styles.searchBarContainer}>
            <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search funny posts..."
              placeholderTextColor="#999"
              editable={false}
            />
          </View>
          <View style={styles.searchButton}>
            <Text style={styles.searchButtonText}>Search</Text>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#007aff" />
        </View>
      </SafeAreaView>
    );
  }

  // Handle submit/execute search action
  const handleSearchSubmit = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setSearchActive(true);
    
    // Add to search history
    const filtered = recentSearches.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
    const updated = [trimmed, ...filtered].slice(0, 10);
    setRecentSearches(updated);
    try {
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}

    executeSearch(trimmed, activeTab);
  };

  // Delete search item from history
  const handleRemoveRecent = async (item: string) => {
    const updated = recentSearches.filter(s => s !== item);
    setRecentSearches(updated);
    try {
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  // Clear query resets search status
  const handleClearInput = () => {
    setQ('');
    setSearchActive(false);
    setPosts([]);
    setUsers([]);
  };

  // Format relative time helper
  const getTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    try {
      const now = new Date();
      const past = new Date(dateString);
      const diffMs = now.getTime() - past.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  // Render video reel card
  const renderPostItem = ({ item }: { item: any }) => {
    const views = item.viewsCount || Math.floor((item.laughCount || 0) * 12.4 + (item.tomatoCount || 0) * 4.3 + 12);
    const formattedViews = views >= 1000 ? `${(views / 1000).toFixed(1)}K` : views;

    const creatorAvatar = item.userId?.avatar || item.userAvatar || DEFAULT_AVATAR_URL;
    const creatorName = item.userId?.displayName || item.userId?.name || item.userName || 'User';
    const isVideo = item.mediaType === 'video';
    const mainMediaUrl = item.imageUrl || item.mediaUrl || (Array.isArray(item.mediaUrls) && item.mediaUrls[0]) || '';
    const displayUri = item.thumbnailUrl || (isVideo ? getVideoThumbnailUrl(mainMediaUrl) : mainMediaUrl) || 'https://images.pexels.com/photos/2810816/pexels-photo-2810816.jpeg?auto=compress&cs=tinysrgb&w=300';
    const timeAgo = getTimeAgo(item.createdAt);

    return (
      <TouchableOpacity 
        style={styles.gridCard}
        activeOpacity={0.9}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push({ pathname: '/post-detail', params: { id: item._id || item.id } });
        }}
      >
        <View style={styles.thumbnailContainer}>
          <ExpoImage
            source={{ uri: displayUri }}
            style={styles.thumbnail}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
          {/* Overlays */}
          <View style={styles.thumbnailOverlayBottom}>
            <View style={styles.statLeft}>
              <Feather name={isVideo ? "play" : "image"} size={10} color="#fff" style={{ marginRight: 2 }} />
              {isVideo ? <Text style={styles.statText}>{formattedViews}</Text> : null}
            </View>
            <View style={styles.statRight}>
              <Text style={styles.statText}>😂 {item.laughCount || 0}</Text>
              <Text style={styles.statText}> 🍅 {item.tomatoCount || 0}</Text>
            </View>
          </View>
        </View>
        {/* Caption and Creator details below card */}
        <View style={styles.cardDetails}>
          <Text style={styles.cardCaption} numberOfLines={2}>
            {item.caption || item.content || ''}
          </Text>
          <View style={styles.creatorRow}>
            <ExpoImage
              source={{ uri: creatorAvatar }}
              style={styles.creatorAvatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={styles.creatorName} numberOfLines={1}>{creatorName}</Text>
              <Text style={styles.timeAgo}>{timeAgo}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render user row
  const renderUserItem = ({ item }: { item: any }) => {
    const targetUserId = item.firebaseUid || item._id || item.uid;
    const isOwnProfile = !!currentUserId && !!targetUserId && currentUserId === targetUserId;
    const userAvatar = item.photoURL || item.avatar || DEFAULT_AVATAR_URL;
    return (
      <View style={styles.userResultRow}>
        <TouchableOpacity
          style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            if (isOwnProfile) {
              router.push('/(tabs)/profile');
            } else if (targetUserId) {
              router.push(`/user-profile?uid=${targetUserId}`);
            }
          }}
        >
          <ExpoImage 
            source={{ uri: userAvatar }} 
            style={styles.userAvatarImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.userDisplayName}>
              {item.displayName || 'Creator'}{isOwnProfile ? ' (You)' : ''}
            </Text>
            {!!item.bio && <Text style={styles.userBio} numberOfLines={1}>{item.bio}</Text>}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        {/* Header Search Input */}
        <View style={styles.headerSearchRow}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              safeRouterBack();
            }}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={24} color="#111" />
          </TouchableOpacity>

          <View style={styles.searchBarContainer}>
            <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search funny posts..."
              placeholderTextColor="#999"
              value={q}
              onChangeText={setQ}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => handleSearchSubmit(q)}
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={handleClearInput} style={styles.clearBtnInput}>
                <Feather name="x" size={16} color="#777" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            onPress={() => handleSearchSubmit(q)}
            style={styles.searchButton}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Views: Results vs History */}
        {!searchActive ? (
          /* Search History state */
          <ScrollView 
            style={styles.historyScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.historyTitle}>Recent Searches</Text>
            {recentSearches.map((item, idx) => (
              <View key={idx} style={styles.historyRow}>
                <TouchableOpacity 
                  style={styles.historyQueryBtn}
                  onPress={() => {
                    setQ(item);
                    handleSearchSubmit(item);
                  }}
                >
                  <Feather name="clock" size={16} color="#999" style={{ marginRight: 12 }} />
                  <Text style={styles.historyQueryText}>{item}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => handleRemoveRecent(item)}
                  style={styles.removeHistoryBtn}
                >
                  <Feather name="x" size={16} color="#999" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : (
          /* Search Results state */
          <View style={{ flex: 1 }}>
            {/* Horizontal Scrollable Pills */}
            <View style={styles.filterPillWrapper}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterPillScroll}
              >
                {(['posts', 'videos', 'image', 'users', 'location', 'laugh', 'tomato'] as TabType[]).map((tab) => {
                  const isActive = activeTab === tab;
                  let label = 'Posts';
                  if (tab === 'videos') label = 'Videos';
                  if (tab === 'image') label = 'Images';
                  if (tab === 'users') label = 'Users';
                  if (tab === 'location') label = 'Location';
                  if (tab === 'laugh') label = 'Most 😂';
                  if (tab === 'tomato') label = 'Most 🍅';

                  return (
                    <TouchableOpacity
                      key={tab}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setActiveTab(tab);
                      }}
                      style={[
                        styles.filterPill,
                        isActive && styles.filterPillActive
                      ]}
                    >
                      <Text style={[
                        styles.filterPillText,
                        isActive && styles.filterPillTextActive
                      ]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Results Grid / List */}
            {loading ? (
              <View style={styles.centerSpinner}>
                <ActivityIndicator size="large" color="#FF8D00" />
              </View>
            ) : activeTab === 'users' ? (
              <FlatList
                key="users-search-list"
                data={users}
                keyExtractor={(item, index) => item.firebaseUid || item._id || item.uid || String(index)}
                renderItem={renderUserItem}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                ListEmptyComponent={
                  <Text style={styles.emptyResultsText}>No creators found</Text>
                }
              />
            ) : (
              <FlatList
                key="posts-search-grid"
                data={posts}
                keyExtractor={(item) => item._id || item.id}
                renderItem={renderPostItem}
                numColumns={2}
                keyboardShouldPersistTaps="handled"
                columnWrapperStyle={styles.gridColumnWrapper}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                ListEmptyComponent={
                  <Text style={styles.emptyResultsText}>No posts found</Text>
                }
              />
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    paddingRight: 10,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
    borderRadius: 20,
    height: 40,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111',
    paddingVertical: 0,
  },
  clearBtnInput: {
    padding: 4,
  },
  searchButton: {
    paddingLeft: 12,
    justifyContent: 'center',
    height: 40,
  },
  searchButtonText: {
    color: '#007aff',
    fontWeight: '600',
    fontSize: 15,
  },
  historyScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 16,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  historyQueryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyQueryText: {
    fontSize: 15,
    color: '#333',
  },
  removeHistoryBtn: {
    padding: 4,
  },
  filterPillWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  filterPillScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#f5f5f7',
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  filterPillActive: {
    backgroundColor: '#007aff',
    borderColor: '#007aff',
  },
  filterPillText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  centerSpinner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    height: 180,
    width: '100%',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  statLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  cardDetails: {
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  cardCaption: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
    lineHeight: 16,
    height: 32,
    marginBottom: 6,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  creatorName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#555',
  },
  timeAgo: {
    fontSize: 9,
    color: '#999',
    marginTop: 1,
  },
  emptyResultsText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 15,
  },
  userResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  userAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
  },
  userDisplayName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  userBio: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
});
