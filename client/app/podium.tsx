import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Platform,
  Modal,
  Alert
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { apiService } from '@/src/_services/apiService';
import { getVideoThumbnailUrl } from '../lib/imageHelpers';
import { normalizeMediaUrl } from '../lib/utils/media';
import { DEFAULT_AVATAR_URL } from '../lib/api';
import AsyncStorage from '@/lib/storage';
import NotificationsModal from '@/src/_components/NotificationsModal';
import { useNotifications } from '../hooks/useNotifications';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { logoutUser } from '@/src/_services/firebaseAuthService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Fallback Mock Data for UI Excellence if DB is empty
const MOCK_CREATORS = [
  {
    creator: {
      id: 'creator-1',
      name: 'Terry Herwitz',
      username: 'terryherwitz',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop'
    },
    totalLaughs: 3986,
    totalVideos: 25,
    rank: 1,
    funniestVideo: {
      id: 'video-1',
      thumbnailUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=300&fit=crop',
      caption: 'How did I manage to build this thing without breaking...',
      laughCount: 2590,
      viewsCount: 32000,
      likesCount: 1325
    }
  },
  {
    creator: {
      id: 'creator-2',
      name: 'Kianna',
      username: 'kianna',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop'
    },
    totalLaughs: 2215,
    totalVideos: 18,
    rank: 2,
    funniestVideo: {
      id: 'video-2',
      thumbnailUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&h=300&fit=crop',
      caption: 'My favorite phone prank 😂',
      laughCount: 1820,
      viewsCount: 24000,
      likesCount: 980
    }
  },
  {
    creator: {
      id: 'creator-3',
      name: 'Alena Donin',
      username: 'alenadonin',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop'
    },
    totalLaughs: 765,
    totalVideos: 12,
    rank: 3,
    funniestVideo: {
      id: 'video-3',
      thumbnailUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=300&h=300&fit=crop',
      caption: 'This dog is the funniest dog with the longest ears',
      laughCount: 650,
      viewsCount: 15000,
      likesCount: 510
    }
  },
  {
    creator: {
      id: 'creator-4',
      name: 'Leo',
      username: 'leo_comedy',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop'
    },
    totalLaughs: 620,
    totalVideos: 10,
    rank: 4,
    funniestVideo: {
      id: 'video-4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=300&h=300&fit=crop',
      caption: 'When the waiter brings the wrong food and you try to be nice',
      laughCount: 480,
      viewsCount: 10000,
      likesCount: 390
    }
  },
  {
    creator: {
      id: 'creator-5',
      name: 'Miracle Rhiel Madsen',
      username: 'miracle',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop'
    },
    totalLaughs: 510,
    totalVideos: 8,
    rank: 5,
    funniestVideo: {
      id: 'video-5',
      thumbnailUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=300&fit=crop',
      caption: 'High school logic makes zero sense',
      laughCount: 410,
      viewsCount: 8000,
      likesCount: 290
    }
  }
];

const MOCK_VIDEOS = MOCK_CREATORS.map(item => ({
  id: item.funniestVideo.id,
  thumbnailUrl: item.funniestVideo.thumbnailUrl,
  mediaUrl: item.funniestVideo.thumbnailUrl,
  caption: item.funniestVideo.caption,
  laughCount: item.funniestVideo.laughCount,
  viewsCount: item.funniestVideo.viewsCount,
  likesCount: item.funniestVideo.likesCount,
  rank: item.rank,
  creator: {
    id: item.creator.id,
    name: item.creator.name,
    username: item.creator.username,
    avatar: item.creator.avatar,
    totalLaughs: item.totalLaughs,
    totalVideos: item.totalVideos
  }
}));

// Resolve a thumbnail URL: prefer thumbnailUrl, fall back to video-to-jpg conversion
const resolveThumbnail = (thumbnailUrl?: string | null, mediaUrl?: string | null): string => {
  if (thumbnailUrl && typeof thumbnailUrl === 'string' && thumbnailUrl.trim()) {
    const cleanUrl = thumbnailUrl.split('?')[0].split('#')[0].toLowerCase();
    const isVideo = cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.m4v') || cleanUrl.endsWith('.3gp') || cleanUrl.endsWith('.quicktime') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.mkv') || thumbnailUrl.includes('video/upload');
    if (!isVideo) {
      return normalizeMediaUrl(thumbnailUrl);
    }
  }
  if (mediaUrl && typeof mediaUrl === 'string' && mediaUrl.trim()) {
    return normalizeMediaUrl(getVideoThumbnailUrl(mediaUrl));
  }
  return '';
};

// Custom image component to dynamically generate thumbnail if it resolved to a local or external video URL
const PodiumMediaImage = ({ thumbnailUrl, mediaUrl, style, contentFit, transition, cachePolicy }: {
  thumbnailUrl?: string | null;
  mediaUrl?: string | null;
  style?: any;
  contentFit?: any;
  transition?: number;
  cachePolicy?: any;
}) => {
  const resolved = useMemo(() => resolveThumbnail(thumbnailUrl, mediaUrl), [thumbnailUrl, mediaUrl]);
  const clean = resolved.split('?')[0].split('#')[0].toLowerCase();
  const isVideo = clean.endsWith('.mp4') || clean.endsWith('.mov') || clean.endsWith('.m4v') || clean.endsWith('.3gp') || clean.endsWith('.quicktime') || clean.endsWith('.webm') || clean.endsWith('.mkv');

  const [localVideoThumb, setLocalVideoThumb] = useState<string>('');

  useEffect(() => {
    let active = true;
    if (isVideo && resolved) {
      VideoThumbnails.getThumbnailAsync(resolved, { time: 0 })
        .then(res => {
          if (active && res?.uri) {
            setLocalVideoThumb(res.uri);
          }
        })
        .catch(() => { });
    }
    return () => { active = false; };
  }, [resolved, isVideo]);

  const finalUri = isVideo ? (localVideoThumb || resolved) : resolved;

  return (
    <ExpoImage
      source={{ uri: finalUri || DEFAULT_AVATAR_URL }}
      style={style}
      contentFit={contentFit}
      transition={transition}
      cachePolicy={cachePolicy}
    />
  );
};

export default function PodiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotifications(currentUserId || '', 60000);

  useEffect(() => {
    AsyncStorage.getItem('userId').then(uid => { if (uid) setCurrentUserId(uid); }).catch(() => { });
  }, []);

  // Navigate to a creator's profile
  const navigateToCreator = (creatorId: string) => {
    if (!creatorId || creatorId.startsWith('creator-')) return; // Skip mock data
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    if (currentUserId && creatorId === currentUserId) {
      router.push('/(tabs)/profile');
    } else {
      router.push({ pathname: '/user-profile', params: { uid: creatorId } });
    }
  };

  // Navigate to a video/post detail
  const navigateToPost = (postId: string) => {
    if (!postId || postId.startsWith('video-')) return; // Skip mock data
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    router.push({ pathname: '/post-detail', params: { id: postId } });
  };

  const [activeType, setActiveType] = useState<'creators' | 'videos'>('creators');
  const [activeTimeframe, setActiveTimeframe] = useState<'weekly' | 'monthly' | 'all'>('weekly');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [rankings, setRankings] = useState<any[]>([]);

  // Fetch rankings from API
  useEffect(() => {
    let isMounted = true;
    const fetchRankings = async () => {
      setLoading(true);
      try {
        const res = await apiService.getPodiumRankings(activeType, activeTimeframe);
        if (isMounted) {
          if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
            setRankings(res.data);
          } else {
            // Use visual mock backups if empty or error
            setRankings(activeType === 'creators' ? MOCK_CREATORS : MOCK_VIDEOS);
          }
        }
      } catch (error) {
        console.warn('[PodiumScreen] API fetch error:', error);
        if (isMounted) {
          setRankings(activeType === 'creators' ? MOCK_CREATORS : MOCK_VIDEOS);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRankings();
    return () => { isMounted = false; };
  }, [activeType, activeTimeframe]);

  const handleTabPress = (type: 'creators' | 'videos') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setActiveType(type);
  };

  const handleTimeframePress = (tf: 'weekly' | 'monthly' | 'all') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setActiveTimeframe(tf);
  };

  const renderRankPill = (rank: number) => {
    if (rank === 1) {
      return (
        <View style={[styles.rankPill, { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' }]}>
          <Text style={[styles.rankPillText, { color: '#D97706' }]}>👑 #1</Text>
        </View>
      );
    }
    if (rank === 2) {
      return (
        <View style={[styles.rankPill, { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' }]}>
          <Text style={[styles.rankPillText, { color: '#4B5563' }]}>🥈 #2</Text>
        </View>
      );
    }
    if (rank === 3) {
      return (
        <View style={[styles.rankPill, { backgroundColor: '#FFF7ED', borderColor: '#F97316' }]}>
          <Text style={[styles.rankPillText, { color: '#C2410C' }]}>🥉 #3</Text>
        </View>
      );
    }
    return (
      <View style={[styles.rankPill, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
        <Text style={[styles.rankPillText, { color: '#64748B' }]}>#{rank}</Text>
      </View>
    );
  };

  const renderTrendIndicator = (rank: number) => {
    if (rank <= 2) {
      return (
        <View style={styles.trendBadgeUp}>
          <Feather name="trending-up" size={13} color="#10B981" />
        </View>
      );
    }
    return (
      <View style={styles.trendBadgeDown}>
        <Feather name="trending-down" size={13} color="#FF9500" />
      </View>
    );
  };

  // Real-time Search Filtered Rankings
  const filteredRankings = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return rankings;
    const q = searchQuery.toLowerCase().trim();
    return rankings.filter((item: any) => {
      const creatorName = (
        item.creator?.name ||
        item.creator?.displayName ||
        item.creator?.username ||
        item.user?.displayName ||
        item.user?.name ||
        item.userName ||
        item.userId?.displayName ||
        item.userId?.name ||
        ''
      ).toLowerCase();

      const caption = (
        item.funniestVideo?.caption ||
        item.caption ||
        item.text ||
        item.title ||
        ''
      ).toLowerCase();

      return creatorName.includes(q) || caption.includes(q);
    });
  }, [rankings, searchQuery]);

  // Top 3 for the visual podium
  const top1 = rankings.find(r => r.rank === 1);
  const top2 = rankings.find(r => r.rank === 2);
  const top3 = rankings.find(r => r.rank === 3);

  // Helper format counts
  const formatCount = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return String(count);
  };

  const renderRankBadge = (rank: number) => {
    let bgColor = '#FFD700';
    let icon = 'hexagon';
    if (rank === 2) {
      bgColor = '#C0C0C0';
      icon = 'square';
    } else if (rank === 3) {
      bgColor = '#CD7F32';
      icon = 'shield';
    }

    return (
      <View style={[styles.rankBadge, { backgroundColor: bgColor }]}>
        <Text style={styles.rankBadgeText}>{rank}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 1. Yellow Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => router.push('/inbox')}>
            <Feather name="message-square" size={22} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={async () => {
            setNotificationsModalVisible(true);
            try {
              await markAllAsRead();
              await fetchNotifications({ force: true });
            } catch { }
          }}>
            <Feather name="bell" size={22} color="#000" />
            {unreadCount > 0 && (
              <View style={{
                position: 'absolute',
                top: -4,
                right: -4,
                backgroundColor: '#ff3b30',
                borderRadius: 7,
                height: 14,
                minWidth: 14,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}>
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { }); setMenuVisible(true); }}>
            <Feather name="more-vertical" size={22} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Yellow Search Area */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search creators or funny videos..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color="#888" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { })}
        >
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Category Pills Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryPillsScrollView}
        contentContainerStyle={styles.categoryPills}
      >
        <TouchableOpacity style={[styles.categoryChip, styles.categoryChipActive]}>
          <Ionicons name="podium" size={14} color="#ffffff" style={{ marginRight: 4 }} />
          <Text style={[styles.categoryChipText, styles.categoryChipTextActive]}>Podium</Text>
        </TouchableOpacity>
        {['Comics', 'Pranks', 'Memes', 'Street pranks', 'Stand Ups'].map((cat) => (
          <TouchableOpacity
            key={cat}
            style={styles.categoryChipInactive}
            onPress={() => router.push(`/(tabs)/home?filter=${encodeURIComponent(cat)}`)}
          >
            <Text style={styles.categoryChipTextInactive}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 4. Sub-tabs navigation */}
      <View style={styles.subTabsRow}>
        <View style={styles.leftToggles}>
          <TouchableOpacity
            style={[styles.subTab, activeType === 'videos' && styles.subTabActive]}
            onPress={() => handleTabPress('videos')}
          >
            <Text style={[styles.subTabText, activeType === 'videos' && styles.subTabTextActive]}>Videos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTab, activeType === 'creators' && styles.subTabActive]}
            onPress={() => handleTabPress('creators')}
          >
            <Text style={[styles.subTabText, activeType === 'creators' && styles.subTabTextActive]}>Creators</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rightToggles}>
          <TouchableOpacity
            style={[styles.subTab, activeTimeframe === 'weekly' && styles.subTabActive]}
            onPress={() => handleTimeframePress('weekly')}
          >
            <Text style={[styles.subTabText, activeTimeframe === 'weekly' && styles.subTabTextActive]}>Weekly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTab, activeTimeframe === 'monthly' && styles.subTabActive]}
            onPress={() => handleTimeframePress('monthly')}
          >
            <Text style={[styles.subTabText, activeTimeframe === 'monthly' && styles.subTabTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTab, activeTimeframe === 'all' && styles.subTabActive]}
            onPress={() => handleTimeframePress('all')}
          >
            <Text style={[styles.subTabText, activeTimeframe === 'all' && styles.subTabTextActive]}>All Time</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Ranking Display */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loaderText}>Fetching Podium Rankings...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* 5. 3D Visual Podium */}
          <View style={styles.podiumContainer}>
            {/* RANK 2 (Left) */}
            {top2 && (
              <View style={styles.podiumCol}>
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={() => activeType === 'creators' ? navigateToCreator(top2.creator.id) : navigateToPost(String(top2.id))}
                >
                  {activeType === 'creators' ? (
                    <ExpoImage source={{ uri: normalizeMediaUrl(top2.creator.avatar) || DEFAULT_AVATAR_URL }} style={[styles.avatarImage, { borderColor: '#C0C0C0', borderWidth: 3 }]} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  ) : (
                    <View style={[styles.videoThumbnailContainer, { borderRadius: 14, borderColor: '#C0C0C0', borderWidth: 2.5 }]}>
                      <PodiumMediaImage thumbnailUrl={top2.thumbnailUrl} mediaUrl={top2.mediaUrl} style={styles.videoThumbnail} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                      <View style={styles.playIconOverlay}>
                        <Ionicons name="play" size={14} color="#fff" />
                      </View>
                    </View>
                  )}
                  {renderRankBadge(2)}
                </TouchableOpacity>
                <Text style={styles.podiumName} numberOfLines={1}>
                  {activeType === 'creators' ? top2.creator.name.split(' ')[0] : top2.creator?.name?.split(' ')[0]}
                </Text>
                <View style={styles.voteBadge}>
                  <Text style={styles.voteText}>😂 {formatCount(top2.laughCount || top2.totalLaughs)}</Text>
                </View>

                <LinearGradient colors={['#0EA5E9', '#0284C7', '#0369A1']} style={[styles.pedestal, { height: 115, width: 108 }]}>
                  <View style={[styles.pedestalTop3D, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]} />
                  <Text style={styles.pedestalNumber}>2</Text>
                </LinearGradient>
              </View>
            )}

            {/* RANK 1 (Center) */}
            {top1 && (
              <View style={styles.podiumCol}>
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={() => activeType === 'creators' ? navigateToCreator(top1.creator.id) : navigateToPost(String(top1.id))}
                >
                  <View style={styles.crownContainer}>
                    <Text style={styles.crownEmoji}>👑</Text>
                  </View>
                  {activeType === 'creators' ? (
                    <ExpoImage source={{ uri: normalizeMediaUrl(top1.creator.avatar) || DEFAULT_AVATAR_URL }} style={[styles.avatarImage, { borderColor: '#FFD700', width: 74, height: 74, borderRadius: 37, borderWidth: 3.5 }]} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  ) : (
                    <View style={[styles.videoThumbnailContainer, { width: 78, height: 78, borderRadius: 16, borderColor: '#FFD700', borderWidth: 3 }]}>
                      <PodiumMediaImage thumbnailUrl={top1.thumbnailUrl} mediaUrl={top1.mediaUrl} style={styles.videoThumbnail} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                      <View style={styles.playIconOverlay}>
                        <Ionicons name="play" size={18} color="#fff" />
                      </View>
                    </View>
                  )}
                  {renderRankBadge(1)}
                </TouchableOpacity>
                <Text style={[styles.podiumName, { fontWeight: '700' }]} numberOfLines={1}>
                  {activeType === 'creators' ? top1.creator.name.split(' ')[0] : top1.creator?.name?.split(' ')[0]}
                </Text>
                <View style={styles.voteBadge}>
                  <Text style={styles.voteText}>😂 {formatCount(top1.laughCount || top1.totalLaughs)}</Text>
                </View>

                <LinearGradient colors={['#10B981', '#059669', '#047857']} style={[styles.pedestal, { height: 165, width: 116 }]}>
                  <View style={[styles.pedestalTop3D, { backgroundColor: 'rgba(255, 215, 0, 0.35)' }]} />
                  <Text style={styles.pedestalNumber}>1</Text>
                </LinearGradient>
              </View>
            )}

            {/* RANK 3 (Right) */}
            {top3 && (
              <View style={styles.podiumCol}>
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={() => activeType === 'creators' ? navigateToCreator(top3.creator.id) : navigateToPost(String(top3.id))}
                >
                  {activeType === 'creators' ? (
                    <ExpoImage source={{ uri: normalizeMediaUrl(top3.creator.avatar) || DEFAULT_AVATAR_URL }} style={[styles.avatarImage, { borderColor: '#CD7F32', borderWidth: 3 }]} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  ) : (
                    <View style={[styles.videoThumbnailContainer, { borderRadius: 14, borderColor: '#CD7F32', borderWidth: 2.5 }]}>
                      <PodiumMediaImage thumbnailUrl={top3.thumbnailUrl} mediaUrl={top3.mediaUrl} style={styles.videoThumbnail} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                      <View style={styles.playIconOverlay}>
                        <Ionicons name="play" size={14} color="#fff" />
                      </View>
                    </View>
                  )}
                  {renderRankBadge(3)}
                </TouchableOpacity>
                <Text style={styles.podiumName} numberOfLines={1}>
                  {activeType === 'creators' ? top3.creator.name.split(' ')[0] : top3.creator?.name?.split(' ')[0]}
                </Text>
                <View style={styles.voteBadge}>
                  <Text style={styles.voteText}>😂 {formatCount(top3.laughCount || top3.totalLaughs)}</Text>
                </View>

                <LinearGradient colors={['#3B82F6', '#1D4ED8', '#1E3A8A']} style={[styles.pedestal, { height: 90, width: 108 }]}>
                  <View style={[styles.pedestalTop3D, { backgroundColor: 'rgba(205, 127, 50, 0.35)' }]} />
                  <Text style={styles.pedestalNumber}>3</Text>
                </LinearGradient>
              </View>
            )}
          </View>

          {/* 6. Rankings list below the podium */}
          <View style={styles.listContainer}>
            {filteredRankings.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="search-outline" size={48} color="#aaa" />
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#444', marginTop: 12 }}>No matching rankings</Text>
                <Text style={{ fontSize: 13, color: '#888', textAlign: 'center', marginTop: 4 }}>
                  No results for "{searchQuery}". Try searching another creator or keyword.
                </Text>
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={{ marginTop: 16, backgroundColor: '#000', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 }}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Clear Search</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredRankings.map((item, index) => {
                if (activeType === 'creators') {
                  const creatorKey = item?.creator?.id || item?.id || `creator_${index}`;
                  return (
                    <TouchableOpacity key={`${creatorKey}_${index}`} style={styles.card} activeOpacity={0.8} onPress={() => navigateToCreator(item.creator.id)}>
                      {/* Main Creator Header */}
                      <View style={styles.creatorHeader}>
                        <ExpoImage source={{ uri: normalizeMediaUrl(item.creator.avatar) || DEFAULT_AVATAR_URL }} style={styles.listAvatar} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                        <View style={styles.creatorInfo}>
                          <Text style={styles.creatorNameText}>{item.creator.name}</Text>
                          <Text style={styles.creatorSubText}>
                            😂 Total {formatCount(item.totalLaughs)}  •  {item.totalVideos} videos
                          </Text>
                        </View>
                        <View style={{ marginLeft: 'auto' }}>
                          {renderRankPill(item.rank)}
                        </View>
                      </View>

                      {/* Nested Funniest Video Box */}
                      {item.funniestVideo && (
                        <TouchableOpacity style={styles.funniestVideoContainer} activeOpacity={0.7} onPress={() => navigateToPost(String(item.funniestVideo.id))}>
                          <View style={styles.videoRow}>
                            <PodiumMediaImage thumbnailUrl={item.funniestVideo.thumbnailUrl} mediaUrl={item.funniestVideo.mediaUrl} style={styles.nestedThumbnail} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                            <View style={styles.videoDetails}>
                              <View style={styles.funniestTitleRow}>
                                <Text style={styles.videoTitleText} numberOfLines={1}>
                                  {item.funniestVideo.caption || 'Top Clip'}
                                </Text>
                                {renderTrendIndicator(item.rank)}
                              </View>
                              <Text style={styles.videoStats}>
                                😂 {formatCount(item.funniestVideo.laughCount)}  •  {formatCount(item.funniestVideo.viewsCount)} Views  •  {formatCount(item.funniestVideo.likesCount)} Likes
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                } else {
                  const videoKey = item?.id || item?._id || `video_${index}`;
                  return (
                    <View key={`${videoKey}_${index}`} style={styles.card}>
                      {/* Main Video Row — tappable to open video */}
                      <TouchableOpacity style={styles.videoRow} activeOpacity={0.7} onPress={() => navigateToPost(String(item.id))}>
                        <View style={styles.thumbnailWrapper}>
                          <PodiumMediaImage thumbnailUrl={item.thumbnailUrl} mediaUrl={item.mediaUrl} style={styles.listThumbnail} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                          <View style={styles.playIconOverlay}>
                            <Ionicons name="play" size={18} color="#fff" />
                          </View>
                        </View>
                        <View style={styles.videoDetails}>
                          <View style={styles.funniestTitleRow}>
                            <Text style={styles.videoTitleText} numberOfLines={1}>
                              {item.caption || 'Funny Video'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              {renderRankPill(item.rank)}
                              {renderTrendIndicator(item.rank)}
                            </View>
                          </View>
                          <Text style={[styles.videoStats, { marginTop: 4 }]}>
                            😂 {formatCount(item.laughCount)}  •  {formatCount(item.viewsCount)} Views  •  {formatCount(item.likesCount)} Likes
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Creator Profile below — tappable to open profile */}
                      <TouchableOpacity style={styles.videoCreatorFooter} activeOpacity={0.7} onPress={() => navigateToCreator(item.creator.id)}>
                        <ExpoImage source={{ uri: normalizeMediaUrl(item.creator.avatar) || DEFAULT_AVATAR_URL }} style={styles.footerAvatar} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                        <View style={styles.footerCreatorInfo}>
                          <Text style={styles.footerCreatorName}>{item.creator.name}</Text>
                          <Text style={styles.footerCreatorStats}>
                            😂 Total {formatCount(item.creator.totalLaughs)}  •  {item.creator.totalVideos} videos
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                }
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Notifications Modal */}
      <NotificationsModal
        visible={notificationsModalVisible}
        onClose={async () => {
          setNotificationsModalVisible(false);
          try {
            await fetchNotifications({ force: true });
          } catch { }
        }}
      />

      {/* Modern Top Menu / Settings Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.menuOverlay}>
          <TouchableOpacity
            style={{ flex: 1, width: '100%' }}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          />
          <View style={{ width: '100%' }}>
            <View style={[styles.igSheet, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}>
              {/* Handle */}
              <View style={styles.handleContainer}>
                <View style={styles.igHandle} />
              </View>

              {/* Menu Items Container */}
              <View style={styles.menuItemsContainer}>
                {/* Settings Group */}
                <View style={styles.menuGroup}>
                  <TouchableOpacity
                    style={styles.igItem}
                    activeOpacity={0.7}
                    onPress={() => { setMenuVisible(false); router.push('/settings'); }}
                  >
                    <LinearGradient
                      colors={['rgba(251, 188, 4, 0.15)', 'rgba(255, 141, 0, 0.15)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.iconContainer}
                    >
                      <Feather name="settings" size={20} color="#FF8D00" />
                    </LinearGradient>
                    <Text style={styles.igText}>Settings</Text>
                    <Feather name="chevron-right" size={18} color="#ccc" style={styles.chevron} />
                  </TouchableOpacity>
                </View>

                {/* Content Group */}
                <View style={styles.menuGroup}>
                  <TouchableOpacity
                    style={styles.igItem}
                    activeOpacity={0.7}
                    onPress={() => { setMenuVisible(false); router.push('/saved'); }}
                  >
                    <LinearGradient
                      colors={['rgba(251, 188, 4, 0.15)', 'rgba(255, 141, 0, 0.15)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.iconContainer}
                    >
                      <Feather name="bookmark" size={20} color="#FF8D00" />
                    </LinearGradient>
                    <Text style={styles.igText}>Saved Posts</Text>
                    <Feather name="chevron-right" size={18} color="#ccc" style={styles.chevron} />
                  </TouchableOpacity>
                </View>

                {/* Legal Group */}
                <View style={styles.menuGroup}>
                  <TouchableOpacity
                    style={styles.igItem}
                    activeOpacity={0.7}
                    onPress={() => { setMenuVisible(false); router.push('/legal/privacy' as any); }}
                  >
                    <LinearGradient
                      colors={['rgba(251, 188, 4, 0.15)', 'rgba(255, 141, 0, 0.15)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.iconContainer}
                    >
                      <Feather name="shield" size={20} color="#FF8D00" />
                    </LinearGradient>
                    <Text style={styles.igText}>Privacy Policy</Text>
                    <Feather name="chevron-right" size={18} color="#ccc" style={styles.chevron} />
                  </TouchableOpacity>

                  <View style={styles.separator} />

                  <TouchableOpacity
                    style={styles.igItem}
                    activeOpacity={0.7}
                    onPress={() => { setMenuVisible(false); router.push('/legal/terms' as any); }}
                  >
                    <LinearGradient
                      colors={['rgba(251, 188, 4, 0.15)', 'rgba(255, 141, 0, 0.15)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.iconContainer}
                    >
                      <Feather name="file-text" size={20} color="#FF8D00" />
                    </LinearGradient>
                    <Text style={styles.igText}>Terms of Service</Text>
                    <Feather name="chevron-right" size={18} color="#ccc" style={styles.chevron} />
                  </TouchableOpacity>
                </View>

                {/* Logout Button */}
                <TouchableOpacity
                  style={styles.igItemLogout}
                  activeOpacity={0.7}
                  onPress={async () => {
                    setMenuVisible(false);
                    try {
                      const result = await logoutUser();
                      if (result.success) {
                        router.replace('/auth/welcome' as any);
                      } else {
                        Alert.alert('Error', 'Logout failed');
                      }
                    } catch (error) {
                      Alert.alert('Error', 'Failed to log out. Please try again.');
                    }
                  }}
                >
                  <View style={[styles.iconContainer, { backgroundColor: '#fee' }]}>
                    <Feather name="log-out" size={20} color="#e74c3c" />
                  </View>
                  <Text style={styles.igTextLogout}>Log Out</Text>
                </TouchableOpacity>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={styles.cancelButton}
                  activeOpacity={0.7}
                  onPress={() => setMenuVisible(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFD500', // Figma Yellow Background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: '#000',
    fontSize: 14,
    marginLeft: 8,
    height: '100%',
    padding: 0,
  },
  searchBtn: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  searchBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  categoryPillsScrollView: {
    maxHeight: 44,
    marginVertical: 4,
  },
  categoryPills: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: '#0095f6', // Active Podium Blue
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#0095f6',
  },
  categoryChipInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    marginRight: 8,
  },
  categoryChipText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  categoryChipTextInactive: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
  },
  subTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  leftToggles: {
    flexDirection: 'row',
    gap: 16,
  },
  rightToggles: {
    flexDirection: 'row',
    gap: 12,
  },
  subTab: {
    paddingVertical: 4,
  },
  subTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  subTabText: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.4)',
    fontWeight: '600',
  },
  subTabTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loaderText: {
    marginTop: 10,
    fontSize: 14,
    color: '#333',
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 10,
  },
  podiumCol: {
    alignItems: 'center',
    marginHorizontal: 0,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    backgroundColor: '#fff',
  },
  videoThumbnailContainer: {
    width: 65,
    height: 65,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    backgroundColor: '#efefef',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  voteBadge: {
    backgroundColor: 'rgba(28, 28, 30, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  voteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  crownContainer: {
    position: 'absolute',
    top: -18,
    alignSelf: 'center',
    zIndex: 10,
  },
  crownEmoji: {
    fontSize: 22,
    lineHeight: 24,
  },
  pedestalTop3D: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 14,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.15)',
  },
  pedestal: {
    width: 86,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(255, 255, 255, 0.35)',
    borderRightWidth: 1.5,
    borderRightColor: 'rgba(0, 0, 0, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  pedestalNumber: {
    fontSize: 52,
    fontWeight: '900',
    color: '#ffffff',
    opacity: 0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  listContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  creatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  creatorInfo: {
    flex: 1,
  },
  creatorNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  creatorSubText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  funniestVideoContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  videoRow: {
    flexDirection: 'row',
  },
  nestedThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  listThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  funniestTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  rankPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  trendBadgeUp: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendBadgeDown: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  funniestLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0095f6',
  },
  videoTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    maxWidth: '90%',
  },
  trendIcon: {
    fontSize: 14,
  },
  videoCaption: {
    fontSize: 13,
    color: '#333',
    marginVertical: 2,
  },
  videoStats: {
    fontSize: 11,
    color: '#888',
  },
  videoRankText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    marginVertical: 2,
  },
  videoCreatorFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  footerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: '#eee',
  },
  footerCreatorInfo: {
    flex: 1,
  },
  footerCreatorName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  footerCreatorStats: {
    fontSize: 10,
    color: '#666',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  igSheet: {
    width: '100%',
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  igHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
  },
  menuItemsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  menuGroup: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  igItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  igText: {
    flex: 1,
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 'auto',
  },
  separator: {
    height: 0.5,
    backgroundColor: '#e5e7eb',
    marginLeft: 64,
  },
  igItemLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#e74c3c',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  igTextLogout: {
    flex: 1,
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cancelText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
});
