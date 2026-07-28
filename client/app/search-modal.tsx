import { DEFAULT_AVATAR_URL } from '../lib/api';
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  InteractionManager
} from "react-native";
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { searchUsers } from "../lib/firebaseHelpers/index";
import { safeRouterBack } from '@/lib/safeRouterBack';
import { apiService } from '@/src/_services/apiService';
import PostViewerModal from '@/src/_components/PostViewerModal';
import { getVideoThumbnailUrl } from '@/lib/imageHelpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SEARCH_HISTORY_KEY = 'search_history_v2';
const DEFAULT_CARD_IMAGE = 'https://images.unsplash.com/photo-1516280440614-37939bbacd6a?w=500';

type User = {
  uid: string;
  displayName?: string;
  photoURL?: string;
  bio?: string;
  isPrivate?: boolean;
};

type SearchFilter = 'videos' | 'users' | 'location' | 'laugh' | 'tomato';

export default function SearchModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [q, setQ] = useState<string>('');
  const [filter, setFilter] = useState<SearchFilter>('videos');
  const inputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }, [])
  );
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const [postsResults, setPostsResults] = useState<any[]>([]);
  const [usersResults, setUsersResults] = useState<User[]>([]);

  // Post viewer state
  const [postViewerVisible, setPostViewerVisible] = useState<boolean>(false);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number>(0);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load current user and history on mount
  useEffect(() => {
    AsyncStorage.getItem('userId').then(uid => {
      if (uid) setCurrentUserId(uid);
    }).catch(err => console.error('[SearchModal] Failed to get userId:', err));

    AsyncStorage.getItem(SEARCH_HISTORY_KEY).then(val => {
      if (val) {
        try {
          setHistory(JSON.parse(val));
        } catch {}
      }
    }).catch(() => {});
  }, []);

  // Reset when screen is focused
  useFocusEffect(
    useCallback(() => {
      setQ('');
      setHasSearched(false);
      setPostsResults([]);
      setUsersResults([]);
      setError(false);
    }, [])
  );

  const handleSearchSubmit = async (queryText = q) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;
    Keyboard.dismiss();

    // Update history (move search query to the top, limit to 10 entries)
    setHistory(prev => {
      const filtered = prev.filter(h => h.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...filtered].slice(0, 10);
      AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

    setQ(trimmed);
    setHasSearched(true);
    setLoading(true);
    setError(false);

    try {
      if (filter === 'users') {
        const res = await searchUsers(trimmed, 30);
        if (res.success && Array.isArray(res.data)) {
          setUsersResults(res.data);
        } else {
          setUsersResults([]);
        }
      } else {
        const res = await apiService.get('/posts/search', {
          params: { q: trimmed, filter }
        });
        if (res.success && Array.isArray(res.data)) {
          setPostsResults(res.data);
        } else {
          setPostsResults([]);
        }
      }
    } catch (err) {
      console.error('[SearchModal] Search error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Re-run search if user changes filter tab while viewing search results
  useEffect(() => {
    if (hasSearched && q.trim()) {
      handleSearchSubmit(q);
    }
  }, [filter]);

  const deleteHistoryItem = (itemToDelete: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h !== itemToDelete);
      AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const handleClearSearch = () => {
    setQ('');
    setHasSearched(false);
    setPostsResults([]);
    setUsersResults([]);
  };

  const formatCount = (num: number): string => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  };

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderPostItem = ({ item, index }: { item: any; index: number }) => {
    const mainMediaUrl = item.mediaUrl || item.imageUrl || (Array.isArray(item.media) ? item.media[0]?.url : '') || (Array.isArray(item.mediaUrls) ? item.mediaUrls[0] : '');
    const isVideo = item.mediaType === 'video' || (mainMediaUrl && mainMediaUrl.includes('.mp4'));
    const thumbUrl = item.thumbnailUrl || (isVideo ? getVideoThumbnailUrl(mainMediaUrl) : mainMediaUrl) || DEFAULT_CARD_IMAGE;
    const views = item.viewCount || item.views || 0;
    const laughs = item.laughCount || item.laughs || 0;
    const tomatoes = item.tomatoCount || item.tomatoes || 0;
    const timeText = item.createdAt ? formatTimeAgo(new Date(item.createdAt)) : '1d ago';

    return (
      <TouchableOpacity
        style={styles.gridCard}
        onPress={() => {
          setSelectedPostIndex(index);
          setPostViewerVisible(true);
        }}
      >
        <View style={styles.thumbnailContainer}>
          <ExpoImage
            source={{ uri: thumbUrl }}
            style={styles.thumbnail}
            contentFit="cover"
          />
          {/* Stats Overlay */}
          <View style={styles.statsOverlayRow}>
            <View style={styles.statOverlayItem}>
              <Feather name="play" size={10} color="#fff" style={{ marginRight: 2 }} />
              <Text style={styles.statOverlayText}>{formatCount(views)}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={[styles.statOverlayItem, { marginRight: 6 }]}>
              <Text style={styles.statOverlayText}>{laughs} 😂</Text>
            </View>
            <View style={styles.statOverlayItem}>
              <Text style={styles.statOverlayText}>{tomatoes} 🍅</Text>
            </View>
          </View>
        </View>
        <Text style={styles.gridCaption} numberOfLines={2}>
          {item.caption || item.content || ''}
        </Text>
        <View style={styles.creatorRow}>
          <ExpoImage
            source={{ uri: item.userAvatar || item.creator?.avatar || DEFAULT_AVATAR_URL }}
            style={styles.creatorAvatar}
            contentFit="cover"
          />
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorName} numberOfLines={1}>
              {item.userName || item.creator?.displayName || 'Creator'}
            </Text>
            <Text style={styles.timeText}>{timeText}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={{ flex: 1, paddingTop: Math.max(insets.top + 2, 0) }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          
          {/* Header Bar */}
          <View style={styles.searchHeader}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                if (hasSearched) {
                  setHasSearched(false);
                } else {
                  safeRouterBack();
                }
              }}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>

            <View style={styles.searchBarContainer}>
              <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
              <TextInput
                ref={inputRef}
                autoFocus={true}
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor="#999"
                value={q}
                onChangeText={setQ}
                onSubmitEditing={() => handleSearchSubmit()}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {q.length > 0 && (
                <TouchableOpacity onPress={handleClearSearch} style={styles.clearBtn}>
                  <Feather name="x" size={16} color="#777" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => handleSearchSubmit()}
              style={styles.searchSubmitBtn}
            >
              <Text style={styles.searchSubmitBtnText}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <View style={{ flex: 1, backgroundColor: '#fff' }}>
            {!hasSearched ? (
              /* Search History List */
              <FlatList
                data={history}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <View style={styles.historyRow}>
                    <TouchableOpacity
                      style={styles.historyClickable}
                      onPress={() => handleSearchSubmit(item)}
                    >
                      <Feather name="clock" size={16} color="#8e8e93" style={{ marginRight: 12 }} />
                      <Text style={styles.historyText}>{item}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteHistoryItem(item)}
                      style={styles.historyDeleteBtn}
                    >
                      <Feather name="x" size={16} color="#c7c7cc" />
                    </TouchableOpacity>
                  </View>
                )}
                ListHeaderComponent={
                  history.length > 0 ? (
                    <Text style={styles.historyHeader}>Recent Searches</Text>
                  ) : null
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Feather name="search" size={48} color="#e5e5ea" style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyText}>Search comedy videos, creators, or tags</Text>
                  </View>
                }
              />
            ) : (
              /* Search Results view */
              <View style={{ flex: 1 }}>
                {/* Horizontal Filter Pills */}
                <View style={styles.filterPillsContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterPillsRow}
                  >
                    {[
                      { key: 'videos', label: 'Videos' },
                      { key: 'users', label: 'Users' },
                      { key: 'location', label: 'Location' },
                      { key: 'laugh', label: 'Most 😂' },
                      { key: 'tomato', label: 'Most 🍅' }
                    ].map((item) => {
                      const isActive = filter === item.key;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setFilter(item.key as SearchFilter);
                          }}
                          style={[
                            styles.filterPill,
                            isActive ? styles.filterPillActive : styles.filterPillInactive
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterPillText,
                              isActive ? styles.filterPillTextActive : styles.filterPillTextInactive
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* List/Grid of Results */}
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF8D00" />
                  </View>
                ) : error ? (
                  <View style={styles.emptyContainer}>
                    <Text style={{ color: '#ff3b30', fontSize: 15 }}>Failed to load results. Please try again.</Text>
                  </View>
                ) : filter === 'users' ? (
                  /* Users Results list */
                  <FlatList
                    key="users-search-list"
                    data={usersResults}
                    keyExtractor={(item) => item.uid}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                      const isOwn = currentUserId === item.uid;
                      return (
                        <View style={styles.userResultRow}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                              if (isOwn) {
                                router.push('/(tabs)/profile');
                              } else {
                                router.push(`/user-profile/${item.uid}` as any);
                              }
                            }}
                          >
                            <ExpoImage
                              source={{ uri: item.photoURL || DEFAULT_AVATAR_URL }}
                              style={styles.avatarImage}
                              contentFit="cover"
                            />
                            <View style={{ marginLeft: 16, flex: 1 }}>
                              <Text style={styles.userDisplayName}>
                                {item.displayName || 'Creator'}{isOwn ? ' (You)' : ''}
                              </Text>
                              {!!item.bio && (
                                <Text style={styles.userBio} numberOfLines={1}>{item.bio}</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        </View>
                      );
                    }}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No users matched your query</Text>
                      </View>
                    }
                  />
                ) : (
                  /* Video Posts Results grid */
                  <FlatList
                    key="posts-search-grid"
                    data={postsResults}
                    keyExtractor={(item) => item._id || item.id}
                    numColumns={2}
                    keyboardShouldPersistTaps="handled"
                    columnWrapperStyle={styles.gridColumnWrapper}
                    renderItem={renderPostItem}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No posts matched your query</Text>
                      </View>
                    }
                  />
                )}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Full screen Post Viewer */}
      {postViewerVisible && React.createElement(PostViewerModal as any, {
        visible: postViewerVisible,
        onClose: () => setPostViewerVisible(false),
        posts: postsResults,
        selectedPostIndex: selectedPostIndex,
        authUser: currentUserId ? { _id: currentUserId, id: currentUserId, uid: currentUserId } : null,
        title: "Search Results",
      })}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  backBtn: {
    padding: 6,
    marginRight: 4,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  searchSubmitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  searchSubmitBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF8D00',
  },
  historyHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f2f2f7',
  },
  historyClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyText: {
    fontSize: 16,
    color: '#333',
  },
  historyDeleteBtn: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 20,
  },
  filterPillsContainer: {
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#f2f2f7',
  },
  filterPillsRow: {
    paddingHorizontal: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: '#FF8D00',
    borderColor: '#FF8D00',
  },
  filterPillInactive: {
    backgroundColor: '#fff',
    borderColor: '#e5e5ea',
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  filterPillTextInactive: {
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  userResultRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f2f2f7',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f2f2f7',
  },
  userDisplayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  userBio: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  gridCard: {
    width: (SCREEN_WIDTH - 32) / 2,
    marginBottom: 16,
  },
  thumbnailContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f2f2f7',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  statsOverlayRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statOverlayItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statOverlayText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  gridCaption: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111',
    marginTop: 6,
    lineHeight: 17,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  creatorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f2f2f7',
    marginRight: 8,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: 12,
    fontWeight: '400',
    color: '#666',
  },
  timeText: {
    fontSize: 10,
    color: '#999',
    marginTop: 1,
  },
});
