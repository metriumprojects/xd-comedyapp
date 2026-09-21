import React, { useCallback } from 'react';
import { AppState, Image, StyleSheet, Text, TouchableOpacity, View, Animated, Easing, Modal, ActivityIndicator, PanResponder } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Audio } from 'expo-av';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DEFAULT_AVATAR_URL } from '@/lib/api';
import { apiService } from '@/src/_services/apiService';
import { normalizeMediaUrl, isVideoUrl } from '@/lib/utils/media';
import { getVideoThumbnailUrl } from '@/lib/imageHelpers';
import { resolveLocalFirst, pinMedia } from '../media/mediaMirror';
import { useAudioSpeed } from '../media/audioSpeedStore';
import COLORS from '@/src/theme/colors';

/**
 * Generates natural, speech-like waveform heights seeded deterministically
 * by the message ID or audio URL.
 */
function generateWaveformBars(seed: string, count: number = 32): number[] {
  let hash = 0;
  const str = seed || 'default_voice_sample';
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    const pseudo = Math.abs(Math.sin(hash * 0.002 + i * 0.78 + (i % 4) * 1.3));
    const envelope = Math.sin((i / Math.max(1, count - 1)) * Math.PI);
    const minH = 5;
    const maxH = 22;
    const h = Math.round(minH + (maxH - minH) * (pseudo * 0.72 + envelope * 0.28));
    bars.push(Math.max(4, Math.min(maxH, h)));
  }
  return bars;
}

type Props = {
  text?: string;
  imageUrl?: string | null;
  mediaType?: 'text' | 'image' | 'video' | 'audio' | 'post' | string;
  mediaUrl?: string | null;
  audioUrl?: string | null;
  audioDuration?: number;
  createdAt: any;
  editedAt?: any;
  isSelf: boolean;
  formatTime: (ts: any) => string;
  replyTo?: { 
    id: string; 
    text: string; 
    senderId: string; 
    mediaUrl?: string | null; 
    imageUrl?: string | null; 
    mediaType?: string | null; 
  } | null;
  username?: string;
  currentUserId?: string;
  compact?: boolean;
  showTail?: boolean;
  sent?: boolean;
  delivered?: boolean;
  read?: boolean;
  sharedPost?: any;
  sharedStory?: any;
  onPressStory?: (story: any) => void;
  onPressPost?: (post: any) => void;
  onPressShare?: () => void;
  onPressImage?: (url: string) => void;
  onLongPress?: () => void;
  activeSoundId?: string | null;
  onPlayStart?: (id: string) => void;
  id: string;
  avatarUrl?: string | null;
  onReaction?: (emoji: string) => void;
  reactions?: { [emoji: string]: string[] };
  failed?: boolean;
  thumbnailUrl?: string | null;
  onPressReactionsBadge?: (messageId: string, reactions: any) => void;
  onRetry?: (messageId: string) => void;
  isSearchMatch?: boolean;
  isCurrentSearchMatch?: boolean;
};

function MessageBubbleInner({
  text,
  imageUrl,
  mediaType,
  mediaUrl,
  audioUrl,
  audioDuration,
  createdAt,
  editedAt,
  isSelf,
  formatTime,
  replyTo,
  username,
  currentUserId,
  compact,
  showTail,
  sent,
  delivered,
  read,
  sharedPost,
  sharedStory,
  onPressPost,
  onPressShare,
  onPressStory,
  onPressImage,
  onLongPress,
  activeSoundId,
  onPlayStart,
  id,
  avatarUrl,
  onReaction,
  reactions,
  failed,
  thumbnailUrl,
  onPressReactionsBadge,
  onRetry,
  isSearchMatch,
  isCurrentSearchMatch,
}: Props) {
  const [playing, setPlaying] = React.useState(false);
  const [playVideoModalVisible, setPlayVideoModalVisible] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [playbackPosition, setPlaybackPosition] = React.useState(0);
  const [playbackDuration, setPlaybackDuration] = React.useState(0);
  const [resolvedStory, setResolvedStory] = React.useState<any>(sharedStory || null);
  const [storyExpired, setStoryExpired] = React.useState(false);
  const [storyLoading, setStoryLoading] = React.useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
  }, []);
  const displayText = typeof text === 'string'
    ? text.trim().replace(/(^|\s)#([\p{L}\p{N}_]+)/gu, '$1$2')
    : text;
  const inferMediaType = React.useCallback((explicitType: any, mUrl: any, aUrl: any, imgUrl: any, aDuration: any, msgText: any) => {
    const explicit = typeof explicitType === 'string' ? explicitType.trim().toLowerCase() : '';
    if (explicit && explicit !== 'text') return explicit;
    const trimmedText = typeof msgText === 'string' ? msgText.trim() : msgText;
    if (explicit === 'text' && (aUrl || (aDuration && !trimmedText))) return 'audio';
    if (aUrl) return 'audio';
    if (aDuration && !trimmedText) return 'audio';

    const candidate = String(mUrl || imgUrl || '').toLowerCase();
    if (!candidate) return 'text';
    if (candidate.startsWith('data:audio') || /(\.m4a|\.aac|\.mp3|\.wav|\.ogg)(\?|$)/i.test(candidate)) return 'audio';
    if (candidate.startsWith('data:video') || /(\.mp4|\.mov|\.webm)(\?|$)/i.test(candidate)) return 'video';
    if (candidate.startsWith('data:image') || /(\.jpe?g|\.png|\.gif|\.webp)(\?|$)/i.test(candidate)) return 'image';
    return imgUrl ? 'image' : 'text';
  }, []);

  const resolvedMediaUrl = mediaUrl || imageUrl || null;
  const resolvedMediaType = inferMediaType(mediaType, resolvedMediaUrl, audioUrl, imageUrl, audioDuration, text);

  const [videoPlayUrl, setVideoPlayUrl] = React.useState(resolvedMediaUrl);
  const [imagePlayUrl, setImagePlayUrl] = React.useState(resolvedMediaUrl);

  React.useEffect(() => {
    if (resolvedMediaType === 'video' && resolvedMediaUrl) {
      let active = true;
      try {
        resolveLocalFirst(resolvedMediaUrl).then((resolved: string) => {
          if (active) setVideoPlayUrl(resolved);
        }).catch(() => {});
        pinMedia(resolvedMediaUrl).catch(() => {});
      } catch {
        setVideoPlayUrl(resolvedMediaUrl);
      }
      return () => { active = false; };
    } else {
      setVideoPlayUrl(resolvedMediaUrl);
    }
  }, [resolvedMediaUrl, resolvedMediaType]);

  React.useEffect(() => {
    if (resolvedMediaType === 'image' && resolvedMediaUrl) {
      let active = true;
      try {
        resolveLocalFirst(resolvedMediaUrl).then((resolved: string) => {
          if (active) setImagePlayUrl(resolved);
        }).catch(() => {});
        pinMedia(resolvedMediaUrl).catch(() => {});
      } catch {
        setImagePlayUrl(resolvedMediaUrl);
      }
      return () => { active = false; };
    } else {
      setImagePlayUrl(resolvedMediaUrl);
    }
  }, [resolvedMediaUrl, resolvedMediaType]);

  // DEBUG LOG
  if (sharedPost || sharedStory) {
    console.log(`[MessageBubble] Rendering shared content: id=${id}, type=${resolvedMediaType}, hasPost=${!!sharedPost}, hasStory=${!!sharedStory}`);
  }

  const playbackUrl = audioUrl || (resolvedMediaType === 'audio' ? resolvedMediaUrl : null);
  const isLegacyStoryText = typeof displayText === 'string' && /shared a story:/i.test(displayText);
  const isStoryMetaText = typeof displayText === 'string' && /\b(sent|shared)\b.*\bstory\b/i.test(displayText);
  const initialSharedStoryId = sharedStory?.storyId || sharedStory?.id || sharedStory?._id || '';
  const sharedPostMediaUrls = React.useMemo(() => {
    if (!sharedPost) return [] as string[];

    const candidates = [
      ...(Array.isArray(sharedPost?.mediaUrls) ? sharedPost.mediaUrls : []),
      ...(Array.isArray(sharedPost?.imageUrls) ? sharedPost.imageUrls : []),
      ...(Array.isArray(sharedPost?.images) ? sharedPost.images : []),
      ...(Array.isArray(sharedPost?.media) ? sharedPost.media : []),
      ...(sharedPost?.imageUrl ? [sharedPost.imageUrl] : []),
      ...(sharedPost?.image ? [sharedPost.image] : []),
    ];

    const urls = candidates
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return item.url || item.uri || item.imageUrl || item.mediaUrl || '';
        }
        return '';
      })
      .filter((url: string) => typeof url === 'string' && !!url.trim());

    return Array.from(new Set(urls));
  }, [sharedPost]);
  const sharedPostMediaCount = React.useMemo(() => {
    if (Number(sharedPost?.mediaCount) > 0) return Number(sharedPost.mediaCount);
    return sharedPostMediaUrls.length;
  }, [sharedPost, sharedPostMediaUrls]);
  const sharedPostPreviewUrl = sharedPostMediaUrls[0] || sharedPost?.imageUrl || sharedPost?.image || null;
  const [sharedPostThumb, setSharedPostThumb] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    const rawUrl = sharedPostMediaUrls[0] || sharedPost?.imageUrl || sharedPost?.image || null;
    if (!rawUrl) {
      setSharedPostThumb(null);
      return;
    }
    const normalized = normalizeMediaUrl(rawUrl);
    const isVideo = sharedPost?.mediaType === 'video' || isVideoUrl(normalized);
    
    if (isVideo) {
      const cloudThumb = getVideoThumbnailUrl(normalized);
      if (cloudThumb !== normalized && cloudThumb.endsWith('.jpg')) {
        setSharedPostThumb(cloudThumb);
      } else {
        // Fallback to local expo-video-thumbnails generation
        (async () => {
          try {
            const { getThumbnailAsync } = await import('expo-video-thumbnails');
            const { uri } = await getThumbnailAsync(normalized, { time: 1000 });
            if (isMounted) {
              setSharedPostThumb(uri);
            }
          } catch (e) {
            console.warn('[MessageBubble] Failed to generate video thumbnail:', e);
            setSharedPostThumb(normalized); // fallback to original
          }
        })();
      }
    } else {
      setSharedPostThumb(normalized);
    }
    
    return () => {
      isMounted = false;
    };
  }, [sharedPost, sharedPostMediaUrls]);

  const legacyStoryId = typeof text === 'string'
    ? (text.match(/story[:;]\/\/([A-Za-z0-9_-]+)/i)?.[1] || text.match(/Shared a story:\s*([A-Za-z0-9_-]+)/i)?.[1] || '')
    : '';
  const storyId = resolvedStory?.storyId || resolvedStory?.id || initialSharedStoryId || legacyStoryId || '';

  React.useEffect(() => {
    setResolvedStory(sharedStory || null);
    setStoryExpired(false);
  }, [sharedStory]);

  const [localVideoThumb, setLocalVideoThumb] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    if (resolvedMediaType === 'video' && resolvedMediaUrl) {
      const isVideo = isVideoUrl(resolvedMediaUrl);
      const isCloudinary = resolvedMediaUrl.includes('res.cloudinary.com');
      
      if (!isCloudinary && isVideo) {
        // Fallback to local expo-video-thumbnails generation
        (async () => {
          try {
            const { getThumbnailAsync } = await import('expo-video-thumbnails');
            const { uri } = await getThumbnailAsync(resolvedMediaUrl, { time: 1000 });
            if (isMounted) {
              setLocalVideoThumb(uri);
            }
          } catch (e) {
            console.warn('[MessageBubble] Failed to generate local video thumbnail:', e);
          }
        })();
      }
    }
    return () => {
      isMounted = false;
    };
  }, [resolvedMediaType, resolvedMediaUrl]);

  React.useEffect(() => {
    let cancelled = false;

    // Always try to fetch full story data when we have a storyId
    const needsLookup = resolvedMediaType === 'story' && storyId && !storyExpired;
    if (!needsLookup) return () => { cancelled = true; };

    // Skip if we already have full story data with a media URL
    const hasFullData = resolvedStory?.mediaUrl || resolvedStory?.imageUrl || resolvedStory?.image || resolvedStory?.videoUrl || resolvedStory?.video;
    if (hasFullData) return () => { cancelled = true; };

    setStoryLoading(true);
    (async () => {
      try {
        const res = await apiService.get(`/stories/${storyId}`);
        if (cancelled) return;

        if (res?.expired) {
          // Story has expired or been deleted
          setStoryExpired(true);
          // Keep partial data for the expired card (userName, userAvatar)
          if (res?.data) setResolvedStory(res.data);
        } else if (res?.success && res?.data) {
          setResolvedStory(res.data);
          setStoryExpired(false);
        } else if (!res?.success) {
          setStoryExpired(true);
        }
      } catch {
        if (!cancelled) {
          setStoryExpired(true);
        }
      } finally {
        if (!cancelled) setStoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedMediaType, storyId, storyExpired]);

  const formatDuration = (seconds?: number) => {
    if (!seconds || Number.isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const [sound, setSound] = React.useState<Audio.Sound | null>(null);
  const [audioUnavailable, setAudioUnavailable] = React.useState(false);
  const appStateRef = React.useRef(AppState.currentState);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  const isLikelyLocalFileUri = React.useCallback((uri: string) => {
    return uri.startsWith('file://')
      || uri.startsWith('/var/')
      || uri.startsWith('/private/')
      || uri.startsWith('/data/')
      || uri.startsWith('/storage/');
  }, []);

  const normalizeLocalUri = React.useCallback((uri: string) => {
    if (uri.startsWith('file://')) return uri;
    if (uri.startsWith('/')) return `file://${uri}`;
    return uri;
  }, []);

  const resolvePlayableAudioUri = React.useCallback(async (uri: string) => {
    const trimmed = uri.trim();
    if (!trimmed) return null;
    
    // If it's a network URL, just return it
    if (trimmed.startsWith('http')) return trimmed;
    
    if (!isLikelyLocalFileUri(trimmed)) return trimmed;

    const localUri = normalizeLocalUri(trimmed);
    try {
      const info = await FileSystem.getInfoAsync(localUri);
      return info.exists ? localUri : null;
    } catch {
      return null;
    }
  }, [isLikelyLocalFileUri, normalizeLocalUri]);
  
  React.useEffect(() => {
    if (activeSoundId && activeSoundId !== id && sound && playing) {
      sound.pauseAsync().then(() => setPlaying(false)).catch(() => {});
    }
  }, [activeSoundId, id, sound, playing]);

  React.useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  React.useEffect(() => {
    setAudioUnavailable(false);
  }, [playbackUrl]);

  const { speed, speedLabel, cycleSpeed } = useAudioSpeed();

  const waveformBars = React.useMemo(() => {
    const seed = id || resolvedMediaUrl || audioUrl || 'audio_voice_bubble';
    return generateWaveformBars(seed, 32);
  }, [id, resolvedMediaUrl, audioUrl]);

  const audioTotalDuration = React.useMemo(() => {
    if (typeof audioDuration === 'number' && audioDuration > 0) return audioDuration;
    if (typeof playbackDuration === 'number' && playbackDuration > 0) return playbackDuration;
    return 0;
  }, [audioDuration, playbackDuration]);

  // Keep playback rate in sync with active speed
  React.useEffect(() => {
    if (sound) {
      sound.setRateAsync(speed, true, Audio.PitchCorrectionQuality?.High).catch(() => {});
    }
  }, [sound, speed]);

  const handleCycleSpeed = async (e?: any) => {
    e?.stopPropagation?.();
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const nextSpeed = cycleSpeed();
    if (sound) {
      try {
        await sound.setRateAsync(nextSpeed, true, Audio.PitchCorrectionQuality?.High);
      } catch (err) {
        console.warn('Failed to set playback rate:', err);
      }
    }
  };

  // Pre-load and Pre-fetch audio/images
  React.useEffect(() => {
    if (resolvedMediaType === 'audio' && playbackUrl) {
      (async () => {
        try {
          const playableUri = await resolvePlayableAudioUri(playbackUrl);
          if (!playableUri) return;

          const fileName = playableUri.split('/').pop();
          const localCacheUri = `${FileSystem.cacheDirectory}${fileName}`;
          
          // Pre-fetch: Download if not in cache
          if (playableUri.startsWith('http')) {
            const fileInfo = await FileSystem.getInfoAsync(localCacheUri);
            if (!fileInfo.exists) {
              await FileSystem.downloadAsync(playableUri, localCacheUri).catch(() => {});
            }
          }
          
          // Pre-load sound object if not already loaded
          if (!sound) {
            const finalUri = playableUri.startsWith('http') ? localCacheUri : playableUri;
            const { sound: newSound } = await Audio.Sound.createAsync(
              { uri: finalUri },
              { shouldPlay: false, isLooping: false, rate: speed, shouldCorrectPitch: true },
              (status: any) => {
                if (status.isLoaded) {
                  setPlaybackPosition(status.positionMillis / 1000);
                  if (typeof status.durationMillis === 'number' && status.durationMillis > 0) {
                    setPlaybackDuration(status.durationMillis / 1000);
                  }
                  if (status.didJustFinish) {
                    setPlaying(false);
                    newSound.stopAsync().catch(() => {});
                    newSound.setPositionAsync(0).catch(() => {});
                    setPlaybackPosition(0);
                  }
                }
              }
            );
            setSound(newSound);
            setIsLoaded(true);
          }
        } catch (e) {
          console.log('Background pre-fetch error:', e);
        }
      })();
    }
  }, [resolvedMediaType, playbackUrl]);

  // Handle Playback mode switching
  const setupAudioMode = React.useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });
    } catch (e) {}
  }, []);

  // Debounce play button to prevent rapid tapping from creating multiple sounds
  const isPlayingActionRef = React.useRef(false);

  const handlePlayAudio = React.useCallback(async (initialPositionSeconds?: number) => {
    if (!playbackUrl) return;
    if (appStateRef.current !== 'active') return;
    if (isPlayingActionRef.current) return;
    isPlayingActionRef.current = true;
    
    try {
      await setupAudioMode();

      if (sound) {
        if (typeof initialPositionSeconds === 'number') {
          await sound.setPositionAsync(Math.floor(initialPositionSeconds * 1000));
          setPlaybackPosition(initialPositionSeconds);
          if (!playing) {
            onPlayStart?.(id);
            await sound.setRateAsync(speed, true, Audio.PitchCorrectionQuality?.High);
            await sound.playAsync();
            setPlaying(true);
          }
        } else if (playing) {
          await sound.pauseAsync();
          setPlaying(false);
        } else {
          try {
            onPlayStart?.(id);
            await sound.setRateAsync(speed, true, Audio.PitchCorrectionQuality?.High);
            await sound.playAsync();
            setPlaying(true);
          } catch (internalErr: any) {
            const internalMsg = String(internalErr || '');
            if (internalMsg.includes('AudioFocusNotAcquiredException') || internalMsg.includes('audio focus')) {
              setTimeout(async () => {
                try {
                  if (appStateRef.current !== 'active') return;
                  await setupAudioMode();
                  await sound.setRateAsync(speed, true, Audio.PitchCorrectionQuality?.High);
                  await sound.playAsync();
                  setPlaying(true);
                } catch {}
              }, 500);
            } else {
              console.error('Playback error:', internalErr);
              setSound(null);
            }
          }
        }
        isPlayingActionRef.current = false;
        return;
      }
      
      // Fallback if not pre-loaded or corrupted
      const playableUri = await resolvePlayableAudioUri(playbackUrl);
      if (!playableUri) {
        setAudioUnavailable(true);
        isPlayingActionRef.current = false;
        return;
      }

      onPlayStart?.(id);
      const initialMs = typeof initialPositionSeconds === 'number' ? Math.floor(initialPositionSeconds * 1000) : 0;
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: playableUri },
        { 
          shouldPlay: true, 
          isLooping: false, 
          positionMillis: initialMs,
          rate: speed, 
          shouldCorrectPitch: true 
        },
        (status: any) => {
          if (status.isLoaded) {
            setPlaybackPosition(status.positionMillis / 1000);
            if (typeof status.durationMillis === 'number' && status.durationMillis > 0) {
              setPlaybackDuration(status.durationMillis / 1000);
            }
            if (status.didJustFinish) {
              setPlaying(false);
              newSound.stopAsync().catch(() => {});
              newSound.setPositionAsync(0).catch(() => {});
              setPlaybackPosition(0);
            }
          }
        }
      );
      setSound(newSound);
      setIsLoaded(true);
      setPlaying(true);
      setAudioUnavailable(false);
    } catch (e: any) {
      console.error('Audio playback exception:', e);
      setAudioUnavailable(true);
    } finally {
      setTimeout(() => { isPlayingActionRef.current = false; }, 300);
    }
  }, [playbackUrl, sound, playing, onPlayStart, id, speed, resolvePlayableAudioUri, setupAudioMode]);

  const waveformWidthRef = React.useRef(160);
  const seekToRatioRef = React.useRef<(ratio: number) => void>(() => {});

  const handleWaveformLayout = React.useCallback((e: any) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      waveformWidthRef.current = w;
    }
  }, []);

  const seekToRatio = React.useCallback(async (ratio: number) => {
    const effectiveDuration = audioDuration || playbackDuration || 0;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const targetSeconds = clampedRatio * (effectiveDuration > 0 ? effectiveDuration : 1);
    setPlaybackPosition(targetSeconds);

    if (sound) {
      try {
        await sound.setPositionAsync(Math.floor(targetSeconds * 1000));
        if (!playing) {
          onPlayStart?.(id);
          await setupAudioMode();
          await sound.setRateAsync(speed, true, Audio.PitchCorrectionQuality?.High);
          await sound.playAsync();
          setPlaying(true);
        }
      } catch (err) {
        console.warn('Failed to seek sound position:', err);
      }
    } else if (playbackUrl) {
      handlePlayAudio(targetSeconds);
    }
  }, [audioDuration, playbackDuration, sound, playing, onPlayStart, id, speed, playbackUrl, handlePlayAudio, setupAudioMode]);

  seekToRatioRef.current = seekToRatio;

  const waveformPanResponder = React.useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 3,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        if (waveformWidthRef.current > 0) {
          const ratio = Math.max(0, Math.min(1, x / waveformWidthRef.current));
          seekToRatioRef.current(ratio);
        }
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        if (waveformWidthRef.current > 0) {
          const ratio = Math.max(0, Math.min(1, x / waveformWidthRef.current));
          seekToRatioRef.current(ratio);
        }
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminationRequest: () => false,
    });
  }, []);

  const validReactionEntries = React.useMemo(() => {
    if (!reactions) return [];
    if (reactions instanceof Map) {
      const entries: [string, string[]][] = [];
      reactions.forEach((users: any, emoji: any) => {
        if (Array.isArray(users) && users.length > 0) {
          entries.push([String(emoji), users.map(String)]);
        }
      });
      return entries;
    }
    if (typeof reactions === 'object') {
      return Object.entries(reactions)
        .filter(([, users]) => Array.isArray(users) && (users as any[]).length > 0)
        .map(([emoji, users]) => [emoji, (users as any[]).map(String)] as [string, string[]]);
    }
    return [];
  }, [reactions]);

  const handlePress = () => {
    // Double tap is handled exclusively by SwipeableMessageRow to avoid duplicate toggle races
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        isSelf ? styles.containerSelf : styles.containerOther,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
      ]}
    >
      {!isSelf && (
        <ExpoImage
          source={{ uri: avatarUrl || DEFAULT_AVATAR_URL }}
          style={styles.avatar}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
        />
      )}
      
      <View style={[styles.bubbleWrapper, isSelf ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
        <View style={{ flexDirection: isSelf ? 'row-reverse' : 'row', alignItems: 'center', overflow: 'visible' }}>
          <TouchableOpacity 
            activeOpacity={1}
            onPress={handlePress}
            onLongPress={onLongPress}
            delayLongPress={200}
            style={[
              styles.msgBubble,
              isSelf ? styles.msgBubbleRight : styles.msgBubbleLeft,
              compact && styles.msgBubbleCompact,
              isSearchMatch && styles.msgBubbleSearchMatch,
              isCurrentSearchMatch && styles.msgBubbleCurrentSearchMatch,
              (resolvedMediaType === 'post' || resolvedMediaType === 'story') && {
                paddingHorizontal: 0,
                paddingVertical: 0,
                overflow: 'hidden',
                backgroundColor: 'transparent',
              }
            ]}
          >
            {isSelf && (resolvedMediaType !== 'post' && resolvedMediaType !== 'story') && (
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            
            {replyTo && (
              <View style={[
                styles.replyQuote, 
                isSelf ? styles.replyQuoteSelf : styles.replyQuoteOther,
                compact && { marginTop: 4, marginHorizontal: 4 }
              ]}>
                <View style={[styles.replyQuoteBar, isSelf ? { backgroundColor: 'rgba(255,255,255,0.7)' } : { backgroundColor: COLORS.primary }]} />
                <View style={{ flexShrink: 1, minWidth: 100 }}>
                  <Text style={[styles.replyQuoteUser, isSelf ? { color: '#fff' } : { color: COLORS.primary }]} numberOfLines={1}>
                    {replyTo.senderId === currentUserId ? 'You' : (username || 'Them')}
                  </Text>
                  <Text style={[styles.replyQuoteText, isSelf ? { color: 'rgba(255,255,255,0.8)' } : { color: COLORS.textSecondary }]} numberOfLines={2}>
                    {replyTo.text || (replyTo.mediaUrl ? 'Attachment' : 'Message')}
                  </Text>
                </View>
              </View>
            )}

             {resolvedMediaType === 'image' && resolvedMediaUrl && (
              <TouchableOpacity onPress={() => onPressImage?.(imagePlayUrl || resolvedMediaUrl)}>
                <ExpoImage source={{ uri: imagePlayUrl || resolvedMediaUrl }} style={styles.msgImage} contentFit="cover" cachePolicy="memory-disk" transition={150} />
              </TouchableOpacity>
            )}
            
            {resolvedMediaType === 'video' && resolvedMediaUrl && (
              <TouchableOpacity onPress={() => setPlayVideoModalVisible(true)} style={styles.videoStub}>
                {(() => {
                  const poster = (thumbnailUrl && !isVideoUrl(thumbnailUrl))
                    ? thumbnailUrl
                    : (getVideoThumbnailUrl(resolvedMediaUrl) !== resolvedMediaUrl ? getVideoThumbnailUrl(resolvedMediaUrl) : localVideoThumb);
                  if (poster) {
                    return (
                      <ExpoImage
                        source={{ uri: poster }}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={150}
                      />
                    );
                  }
                  return (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="videocam-outline" size={32} color="rgba(255,255,255,0.45)" style={{ marginBottom: 12 }} />
                    </View>
                  );
                })()}
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
                <Ionicons name="play" color="white" size={40} style={styles.centerPlay} />
                <View style={styles.bottomPlayCircle}>
                  <Ionicons name="play" color="white" size={14} />
                </View>
              </TouchableOpacity>
            )}
  
            {resolvedMediaType === 'audio' && (audioUrl || resolvedMediaUrl || audioDuration) && (
              <View
                style={[styles.premiumAudioContainer, audioUnavailable && styles.audioUnavailableContainer]}
              >
                <TouchableOpacity
                  style={[styles.audioPlayCircle, isSelf && styles.audioPlayCircleSelf]}
                  onPress={() => handlePlayAudio()}
                  disabled={!playbackUrl}
                  activeOpacity={!playbackUrl ? 1 : 0.75}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={playing ? "Pause voice message" : "Play voice message"}
                >
                  <Ionicons
                    name={audioUnavailable ? 'alert-circle' : (playbackUrl ? (playing ? 'pause' : 'play') : 'mic')}
                    size={18}
                    color={isSelf ? COLORS.textLight : COLORS.textPrimary}
                  />
                </TouchableOpacity>

                <View style={styles.audioBody}>
                  {/* Interactive Seekable Waveform Area */}
                  <View
                    style={styles.waveformTouchArea}
                    {...waveformPanResponder.panHandlers}
                    onLayout={handleWaveformLayout}
                  >
                    <View style={styles.waveformContainer}>
                      {waveformBars.map((height, i) => {
                        const totalTime = audioTotalDuration;
                        const progress = totalTime > 0 ? playbackPosition / totalTime : 0;
                        const filledCount = Math.floor(progress * waveformBars.length);
                        const hasStarted = playing || playbackPosition > 0;
                        const isFilled = hasStarted && i <= filledCount;
                        const isCurrent = hasStarted && i === filledCount;

                        return (
                          <View
                            key={i}
                            style={[
                              styles.waveBar,
                              { height },
                              isCurrent && styles.waveBarCurrent,
                              {
                                backgroundColor: isSelf
                                  ? (isFilled ? COLORS.white : 'rgba(255,255,255,0.40)')
                                  : (isFilled ? '#111111' : 'rgba(0,0,0,0.16)')
                              }
                            ]}
                          />
                        );
                      })}
                    </View>
                  </View>

                  {/* Meta Row: Duration + 1x/1.5x/2x Speed Chip */}
                  <View style={styles.audioMetaRow}>
                    <Text style={[styles.audioTimeText, isSelf && { color: 'rgba(255,255,255,0.85)' }]}>
                      {audioUnavailable ? 'Unavailable' : (
                        (playing || playbackPosition > 0)
                          ? `${formatDuration(playbackPosition)} / ${formatDuration(audioTotalDuration)}`
                          : (audioTotalDuration > 0 ? formatDuration(audioTotalDuration) : (!playbackUrl ? 'Voice message' : '0:00'))
                      )}
                    </Text>

                    <TouchableOpacity
                      style={[styles.speedPill, isSelf ? styles.speedPillSelf : styles.speedPillOther]}
                      onPress={handleCycleSpeed}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Playback speed ${speedLabel}, tap to change`}
                    >
                      <Text style={[styles.speedText, isSelf ? styles.speedTextSelf : styles.speedTextOther]}>
                        {speedLabel}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
  
            {resolvedMediaType === 'post' && sharedPost && (
              <TouchableOpacity 
                activeOpacity={0.9} 
                onPress={() => onPressPost?.(sharedPost)}
                style={styles.premiumPostContainer}
              >
                <View style={styles.sharedPostAuthor}>
                  <ExpoImage 
                    source={{ uri: sharedPost.userThumbnailUrl || sharedPost.userAvatar || DEFAULT_AVATAR_URL }} 
                    style={styles.sharedPostAvatar}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                  <Text style={styles.sharedPostAuthorName} numberOfLines={1}>{sharedPost.userName || sharedPost.username || 'User'}</Text>
                </View>
                {sharedPostThumb ? (
                  <View style={styles.sharedPostImageWrap}>
                    <ExpoImage source={{ uri: sharedPostThumb }} style={styles.sharedPostImage} contentFit="cover" cachePolicy="memory-disk" transition={150} />
                    {sharedPostMediaCount > 1 && (
                      <View style={styles.multiMediaBadge}>
                        <Ionicons name="copy-outline" size={12} color={COLORS.textLight} />
                        <Text style={styles.multiMediaBadgeText}>{sharedPostMediaCount}</Text>
                      </View>
                    )}
                  </View>
                ) : null}
                <View style={styles.sharedPostCaptionBar}>
                  <Text style={styles.sharedPostCaption} numberOfLines={2}>
                    <Text style={styles.sharedPostCaptionUser}>{sharedPost.userName || sharedPost.username || 'user'}</Text>
                    <Text> </Text>
                    <Text>{sharedPost.caption || sharedPost.text || '...'}</Text>
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* ===== STORY CARD - Instagram Style ===== */}
            {resolvedMediaType === 'story' && !storyExpired && resolvedStory && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onPressStory?.(resolvedStory)}
                style={styles.storyCard}
              >
                {/* Story thumbnail */}
                <ExpoImage
                  source={{ uri: resolvedStory.mediaUrl || resolvedStory.imageUrl || resolvedStory.videoUrl || resolvedStory.image || resolvedStory.video || DEFAULT_AVATAR_URL }}
                  style={styles.storyCardImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={150}
                />
                {/* Gradient overlay top */}
                <View style={styles.storyCardGradientTop} />
                {/* Gradient overlay bottom */}
                <View style={styles.storyCardGradientBottom} />
                {/* Header with avatar + name */}
                <View style={styles.storyCardHeader}>
                  <View style={styles.storyAvatarRing}>
                      <ExpoImage
                        source={{ uri: resolvedStory.userAvatar || DEFAULT_AVATAR_URL }}
                        style={styles.storyCardAvatar}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                  </View>
                  <Text style={styles.storyCardUsername} numberOfLines={1}>
                    {resolvedStory.userName || 'Story'}
                  </Text>
                </View>
                {/* Video indicator */}
                {(resolvedStory.mediaType === 'video' || resolvedStory.videoUrl || resolvedStory.video) && (
                  <View style={styles.storyVideoIcon}>
                    <Ionicons name="play" size={14} color={COLORS.textLight} />
                  </View>
                )}
                {/* Footer label */}
                <View style={styles.storyCardFooter}>
                  <View style={styles.storyBadge}>
                    <Feather name="aperture" size={12} color={COLORS.textLight} />
                    <Text style={styles.storyBadgeText}>Story</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* Story loading */}
            {resolvedMediaType === 'story' && storyLoading && !resolvedStory && !storyExpired && (
              <View style={[styles.storyCard, styles.storyCardUnavailable]}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="loader" size={24} color={COLORS.textMuted} />
                  <Text style={styles.storyUnavailableText}>Loading story...</Text>
                </View>
              </View>
            )}

            {/* Story expired / unavailable */}
            {resolvedMediaType === 'story' && (storyExpired || (!resolvedStory && !storyLoading && (legacyStoryId || storyId))) && (
              <View style={[styles.storyCard, styles.storyCardUnavailable]}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
                  <View style={styles.storyUnavailableIcon}>
                    <Feather name="camera-off" size={28} color={COLORS.textMuted} />
                  </View>
                  <Text style={styles.storyUnavailableTitle}>Story unavailable</Text>
                  <Text style={styles.storyUnavailableText}>This story is no longer available</Text>
                </View>
              </View>
            )}

            {!!displayText && !(resolvedMediaType === 'story' && (isLegacyStoryText || isStoryMetaText)) && (
              <View style={(resolvedMediaType === 'image' || resolvedMediaType === 'video') ? styles.mediaCaptionWrapper : undefined}>
                <Text style={[styles.msgText, isSelf && styles.msgTextSelf]}>
                  {displayText}
                </Text>
                {editedAt && (
                  <Text style={[styles.editedText, isSelf ? styles.editedTextSelf : styles.editedTextOther]}>
                    Edited
                  </Text>
                )}
              </View>
            )}
  
            {/* Removed internal timestamp for cleaner Instagram style */}
            <View style={styles.msgFooter}>
              {isSelf && (
                <View style={styles.statusIcons}>
                  {failed ? (
                    <TouchableOpacity
                      style={styles.retryBtn}
                      onPress={() => onRetry?.(id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Failed to send. Tap to retry"
                    >
                      <Ionicons name="alert-circle" size={15} color="#EF4444" />
                      <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                  ) : read ? (
                    <Ionicons name="checkmark-done" size={14} color={COLORS.textLight} />
                  ) : delivered ? (
                    <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.6)" />
                  ) : sent ? (
                    <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.6)" />
                  ) : (
                    <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.7)" />
                  )}
                </View>
              )}
            </View>

          </TouchableOpacity>

          {/* Reactions Display - outside bubble to avoid overflow clipping */}
          {validReactionEntries.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onPressReactionsBadge?.(id, reactions)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.reactionsBadge, isSelf ? { right: 8, left: undefined } : { left: 8, right: undefined }]}
            >
              {validReactionEntries.map(([emoji, users]) => (
                <View key={emoji} style={styles.reactionPill}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  {users.length > 1 && (
                    <Text style={styles.reactionCountText}>{users.length}</Text>
                  )}
                </View>
              ))}
            </TouchableOpacity>
          )}
          
          {/* Share icon next to bubble (only for media/story/post) */}
          {(resolvedMediaType === 'video' || resolvedMediaType === 'image' || resolvedMediaType === 'post' || resolvedMediaType === 'story') && (
            <TouchableOpacity style={styles.bubbleShareBtnCircle} onPress={onPressShare}>
              <Ionicons name="paper-plane-outline" size={18} color="#262626" />
            </TouchableOpacity>
          )}
        </View>

        {resolvedMediaType === 'video' && resolvedMediaUrl && (
          <ChatVideoPlayerModal
            visible={playVideoModalVisible}
            videoUri={videoPlayUrl || resolvedMediaUrl}
            onClose={() => setPlayVideoModalVisible(false)}
          />
        )}
      </View>
    </Animated.View>
  );
}

const ChatVideoPlayerModal: React.FC<{
  visible: boolean;
  videoUri: string;
  onClose: () => void;
}> = ({ visible, videoUri, onClose }) => {
  const player = useVideoPlayer(videoUri || '', (p) => {
    p.loop = false;
    if (visible && videoUri) p.play();
  });

  React.useEffect(() => {
    if (!player) return;
    if (visible && videoUri) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, visible, videoUri]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: COLORS.black || '#000', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity 
          style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }}
          onPress={onClose}
        >
          <Ionicons name="close" size={30} color={COLORS.textLight || '#fff'} />
        </TouchableOpacity>
        
        <VideoView
          player={player}
          style={{ width: '100%', height: '85%' }}
          contentFit="contain"
          nativeControls={true}
        />
      </View>
    </Modal>
  );
};

const areReactionsEqual = (r1: any, r2: any) => {
  if (r1 === r2) return true;
  if (!r1 && !r2) return true;
  if (!r1 || !r2) return false;
  try {
    return JSON.stringify(r1) === JSON.stringify(r2);
  } catch {
    return false;
  }
};

// Wrap with React.memo to prevent unnecessary re-renders when parent state changes
const MessageBubble = React.memo(MessageBubbleInner, (prev, next) => {
  // Only re-render when these props actually change
  return (
    prev.id === next.id &&
    prev.text === next.text &&
    prev.sent === next.sent &&
    prev.delivered === next.delivered &&
    prev.read === next.read &&
    prev.activeSoundId === next.activeSoundId &&
    prev.isSelf === next.isSelf &&
    prev.mediaUrl === next.mediaUrl &&
    prev.audioUrl === next.audioUrl &&
    areReactionsEqual(prev.reactions, next.reactions) &&
    prev.thumbnailUrl === next.thumbnailUrl &&
    prev.editedAt === next.editedAt &&
    prev.failed === next.failed &&
    prev.isSearchMatch === next.isSearchMatch &&
    prev.isCurrentSearchMatch === next.isCurrentSearchMatch
  );
});

export default MessageBubble;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 2,
    marginBottom: 18,
    paddingHorizontal: 8,
    alignItems: 'flex-end',
  },
  containerSelf: {
    justifyContent: 'flex-end',
  },
  containerOther: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: '#efefef',
  },
  bubbleWrapper: {
    maxWidth: '85%',
    overflow: 'visible',
  },
  msgBubble: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 40,
  },
  msgBubbleLeft: {
    backgroundColor: COLORS.inputBg,
    borderBottomLeftRadius: 4,
  },
  msgBubbleRight: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
    overflow: 'hidden',
  },
  msgBubbleCompact: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  msgText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  msgTextSelf: {
    fontSize: 15,
    color: COLORS.textLight,
    lineHeight: 20,
  },
  editedText: {
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic',
  },
  editedTextSelf: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  editedTextOther: {
    color: COLORS.textMuted,
  },
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    paddingBottom: 2,
  },
  msgTime: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  msgTimeSelf: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  statusIcons: {
    marginLeft: 4,
  },
  statusSent: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  statusDelivered: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  statusRead: { fontSize: 10, color: COLORS.textLight, fontWeight: '800' },
  statusPending: { fontSize: 8 },
  replyBox: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 10,
    padding: 6,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  replyBoxSelf: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  replyBoxOther: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  replyName: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  replyText: { fontSize: 12, color: COLORS.textSecondary },
  mediaCaptionWrapper: {
    marginTop: 6,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  msgImage: {
    width: 240,
    height: 240,
    borderRadius: 16,
    marginBottom: 4,
  },
  videoStub: {
    width: 240,
    height: 320,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  centerPlay: {
    opacity: 0.9,
  },
  bottomPlayCircle: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.textLight,
  },
  premiumAudioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 240,
  },
  audioUnavailableContainer: {
    opacity: 0.7,
  },
  audioPlayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    marginRight: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  audioPlayCircleSelf: {
    backgroundColor: 'rgba(255,255,255,0.24)',
    elevation: 0,
    shadowOpacity: 0,
  },
  audioBody: {
    flex: 1,
    justifyContent: 'center',
  },
  waveformTouchArea: {
    height: 32,
    justifyContent: 'center',
    paddingVertical: 2,
    overflow: 'hidden',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 26,
    gap: 2.2,
  },
  waveBar: {
    width: 2.5,
    borderRadius: 1.5,
  },
  waveBarCurrent: {
    borderRadius: 2,
    transform: [{ scaleY: 1.12 }],
  },
  audioMetaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  audioTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8e8e8e',
    letterSpacing: 0.2,
  },
  speedPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
  },
  speedPillSelf: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  speedPillOther: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderColor: 'rgba(0,0,0,0.12)',
  },
  speedText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  speedTextSelf: {
    color: COLORS.white,
  },
  speedTextOther: {
    color: '#262626',
  },
  premiumPostContainer: {
    backgroundColor: COLORS.background,
    width: 260,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sharedPostAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  sharedPostAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
  sharedPostImageWrap: {
    position: 'relative',
  },
  sharedPostAuthorName: { fontSize: 14, fontWeight: '700', color: '#262626' },
  sharedPostImage: { width: '100%', height: 300, resizeMode: 'cover' },
  multiMediaBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  multiMediaBadgeText: {
    marginLeft: 4,
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '700',
  },
  // ===== INSTAGRAM-STYLE STORY CARD =====
  storyCard: {
    width: 200,
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.black,
  },
  storyCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  storyCardGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'transparent',
    // Simulate gradient with overlapping layers
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  storyCardGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  storyCardHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  storyAvatarRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#E1306C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  replyQuote: {
    flexDirection: 'row',
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 4,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  replyQuoteSelf: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  replyQuoteOther: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  replyQuoteBar: {
    width: 3,
    borderRadius: 2,
    marginRight: 8,
  },
  replyQuoteUser: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  replyQuoteText: {
    fontSize: 13,
  },
  storyCardAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  storyCardUsername: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textLight,
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  storyVideoIcon: {
    position: 'absolute',
    top: 50,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyCardFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  storyBadgeText: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '600',
  },
  storyCardUnavailable: {
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  storyUnavailableIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  storyUnavailableTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  storyUnavailableText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  sharedPostCaptionBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sharedPostCaption: {
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 18,
  },
  sharedPostCaptionUser: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  bubbleShareBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  reactionsBadge: {
    position: 'absolute',
    bottom: -14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background || '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: COLORS.border || '#E5E7EB',
    elevation: 3,
    shadowColor: COLORS.black || '#000000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.12,
    shadowRadius: 2.5,
    zIndex: 10,
    gap: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 13,
  },
  reactionCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary || '#6B7280',
    marginLeft: 2,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  retryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  msgBubbleSearchMatch: {
    borderColor: 'rgba(255, 107, 0, 0.45)',
    borderWidth: 1.5,
  },
  msgBubbleCurrentSearchMatch: {
    borderColor: '#FF6B00',
    borderWidth: 2,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
});
