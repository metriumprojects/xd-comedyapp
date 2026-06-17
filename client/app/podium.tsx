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
  Platform
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
    return normalizeMediaUrl(thumbnailUrl);
  }
  if (mediaUrl && typeof mediaUrl === 'string' && mediaUrl.trim()) {
    return normalizeMediaUrl(getVideoThumbnailUrl(mediaUrl));
  }
  return '';
};

export default function PodiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('userId').then(uid => { if (uid) setCurrentUserId(uid); }).catch(() => {});
  }, []);

  // Navigate to a creator's profile
  const navigateToCreator = (creatorId: string) => {
    if (!creatorId || creatorId.startsWith('creator-')) return; // Skip mock data
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (currentUserId && creatorId === currentUserId) {
      router.push('/(tabs)/profile');
    } else {
      router.push({ pathname: '/user-profile', params: { uid: creatorId } });
    }
  };

  // Navigate to a video/post detail
  const navigateToPost = (postId: string) => {
    if (!postId || postId.startsWith('video-')) return; // Skip mock data
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setActiveType(type);
  };

  const handleTimeframePress = (tf: 'weekly' | 'monthly' | 'all') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setActiveTimeframe(tf);
  };

  const getRankIndicatorSymbol = (rank: number) => {
    if (rank === 1) return '📈';
    if (rank === 2) return '📈';
    if (rank === 3) return '↘';
    return '↘';
  };

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
          <TouchableOpacity style={styles.headerIcon} onPress={() => {}}>
            <Feather name="bell" size={22} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => {}}>
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
            placeholder="Search funny videos"
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={() => {}}>
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
                    <ExpoImage source={{ uri: normalizeMediaUrl(top2.creator.avatar) || DEFAULT_AVATAR_URL }} style={[styles.avatarImage, { borderColor: '#C0C0C0' }]} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  ) : (
                    <View style={styles.videoThumbnailContainer}>
                      <ExpoImage source={{ uri: resolveThumbnail(top2.thumbnailUrl, top2.mediaUrl) }} style={styles.videoThumbnail} contentFit="cover" transition={200} cachePolicy="memory-disk" />
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
                
                <LinearGradient colors={['#3DC3FF', '#0095f6']} style={[styles.pedestal, { height: 110 }]}>
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
                  {activeType === 'creators' ? (
                    <ExpoImage source={{ uri: normalizeMediaUrl(top1.creator.avatar) || DEFAULT_AVATAR_URL }} style={[styles.avatarImage, { borderColor: '#FFD700', width: 70, height: 70, borderRadius: 35 }]} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  ) : (
                    <View style={[styles.videoThumbnailContainer, { width: 75, height: 75 }]}>
                      <ExpoImage source={{ uri: resolveThumbnail(top1.thumbnailUrl, top1.mediaUrl) }} style={styles.videoThumbnail} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                      <View style={styles.playIconOverlay}>
                        <Ionicons name="play" size={16} color="#fff" />
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

                <LinearGradient colors={['#59E094', '#00A36C']} style={[styles.pedestal, { height: 160 }]}>
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
                    <ExpoImage source={{ uri: normalizeMediaUrl(top3.creator.avatar) || DEFAULT_AVATAR_URL }} style={[styles.avatarImage, { borderColor: '#CD7F32' }]} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  ) : (
                    <View style={styles.videoThumbnailContainer}>
                      <ExpoImage source={{ uri: resolveThumbnail(top3.thumbnailUrl, top3.mediaUrl) }} style={styles.videoThumbnail} contentFit="cover" transition={200} cachePolicy="memory-disk" />
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

                <LinearGradient colors={['#6CE5FF', '#00B4D8']} style={[styles.pedestal, { height: 85 }]}>
                  <Text style={styles.pedestalNumber}>3</Text>
                </LinearGradient>
              </View>
            )}
          </View>

          {/* 6. Rankings list below the podium */}
          <View style={styles.listContainer}>
            {rankings.map((item) => {
              if (activeType === 'creators') {
                return (
                  <TouchableOpacity key={item.creator.id} style={styles.card} activeOpacity={0.8} onPress={() => navigateToCreator(item.creator.id)}>
                    {/* Main Creator Header */}
                    <View style={styles.creatorHeader}>
                      <ExpoImage source={{ uri: normalizeMediaUrl(item.creator.avatar) || DEFAULT_AVATAR_URL }} style={styles.listAvatar} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                      <View style={styles.creatorInfo}>
                        <Text style={styles.creatorNameText}>{item.creator.name}</Text>
                        <Text style={styles.creatorSubText}>
                          N°{item.rank}  •  😂 Total {formatCount(item.totalLaughs)}  •  {item.totalVideos} videos
                        </Text>
                      </View>
                    </View>
                    
                    {/* Nested Funniest Video Box */}
                    {item.funniestVideo && (
                      <TouchableOpacity style={styles.funniestVideoContainer} activeOpacity={0.7} onPress={() => navigateToPost(String(item.funniestVideo.id))}>
                        <View style={styles.videoRow}>
                          <ExpoImage source={{ uri: resolveThumbnail(item.funniestVideo.thumbnailUrl, item.funniestVideo.mediaUrl) }} style={styles.nestedThumbnail} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                          <View style={styles.videoDetails}>
                            <View style={styles.funniestTitleRow}>
                              <Text style={styles.funniestLabel}>Funniest video</Text>
                              <Text style={styles.trendIcon}>{getRankIndicatorSymbol(item.rank)}</Text>
                            </View>
                            <Text style={styles.videoCaption} numberOfLines={1}>
                              {item.funniestVideo.caption}
                            </Text>
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
                return (
                  <View key={item.id} style={styles.card}>
                    {/* Main Video Row — tappable to open video */}
                    <TouchableOpacity style={styles.videoRow} activeOpacity={0.7} onPress={() => navigateToPost(String(item.id))}>
                      <View style={styles.thumbnailWrapper}>
                        <ExpoImage source={{ uri: resolveThumbnail(item.thumbnailUrl, item.mediaUrl) }} style={styles.listThumbnail} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                        <View style={styles.playIconOverlay}>
                          <Ionicons name="play" size={18} color="#fff" />
                        </View>
                      </View>
                      <View style={styles.videoDetails}>
                        <View style={styles.funniestTitleRow}>
                          <Text style={styles.videoTitleText} numberOfLines={1}>
                            {item.caption || 'Funny Video'}
                          </Text>
                          <Text style={styles.trendIcon}>{getRankIndicatorSymbol(item.rank)}</Text>
                        </View>
                        <Text style={styles.videoRankText}>N°{item.rank}</Text>
                        <Text style={styles.videoStats}>
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
            })}
          </View>
        </ScrollView>
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
    marginHorizontal: 8,
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
    backgroundColor: '#0095f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 8,
  },
  voteText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  pedestal: {
    width: 85,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedestalNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.4)',
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
});
