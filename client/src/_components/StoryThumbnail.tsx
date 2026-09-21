import React, { useState, useEffect, memo } from 'react';
import {
  View,
  Image,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ImageStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '@/src/theme/colors';
import { getVideoThumbnailUrl } from '../../lib/imageHelpers';
import { normalizeMediaUrl, isVideoUrl as checkIsVideoUrl } from '../../lib/utils/media';

// Shared in-memory cache of videoUrl -> local thumbnail file URI
export const videoThumbnailCache = new Map<string, string>();

/**
 * Checks if a URL or path represents a video file
 */
export function isVideo(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (
    cleanUrl.endsWith('.jpg') ||
    cleanUrl.endsWith('.jpeg') ||
    cleanUrl.endsWith('.png') ||
    cleanUrl.endsWith('.webp') ||
    cleanUrl.endsWith('.avif')
  ) {
    return false;
  }
  return checkIsVideoUrl(url) || /\.(mp4|mov|mkv|m4v|webm|avi)(\?|$)/i.test(url) || url.includes('/video/');
}

/**
 * Check if a story object represents a video
 */
export function isStoryVideo(story: any): boolean {
  if (!story || typeof story !== 'object') return false;
  if (story.mediaType === 'video' || story.type === 'video') return true;
  if (story.video || story.videoUrl) return true;
  if (story.postMetadata?.videoUrl || story.postMetadata?.mediaType === 'video') return true;
  if (isVideo(story.mediaUrl) || isVideo(story.image) || isVideo(story.imageUrl)) return true;
  return false;
}

/**
 * Extract raw video URL from story if present
 */
export function extractStoryVideoUrl(story?: any, fallbackUri?: string): string {
  if (fallbackUri && isVideo(fallbackUri)) {
    return normalizeMediaUrl(fallbackUri);
  }
  if (!story || typeof story !== 'object') return '';
  const candidate =
    story.videoUrl ||
    story.video ||
    story.postMetadata?.videoUrl ||
    (isVideo(story.mediaUrl) ? story.mediaUrl : '') ||
    (isVideo(story.imageUrl) ? story.imageUrl : '') ||
    (isVideo(story.image) ? story.image : '');

  return candidate ? normalizeMediaUrl(String(candidate)) : '';
}

/**
 * Synchronously resolves a displayable image thumbnail URI from a story or URL.
 * NEVER returns a raw MP4 or video URL as an image source.
 */
export function resolveStoryThumbnailUrlSync(story?: any, fallbackUri?: string): string {
  // If fallbackUri is an image, prioritize it
  if (fallbackUri && typeof fallbackUri === 'string' && !isVideo(fallbackUri)) {
    const norm = normalizeMediaUrl(fallbackUri);
    if (norm && !isVideo(norm)) return norm;
  }

  if (story && typeof story === 'object') {
    // 1. Direct thumbnail fields
    const directThumb =
      story.thumbnailUrl ||
      story.thumbnail ||
      story.thumbUrl ||
      story.posterUrl ||
      story.coverImage ||
      story.postMetadata?.thumbnailUrl;

    if (directThumb && typeof directThumb === 'string' && !isVideo(directThumb)) {
      const norm = normalizeMediaUrl(directThumb);
      if (norm && !isVideo(norm)) return norm;
    }

    // 2. Direct image fields (only if not a video URL)
    const directImage =
      story.imageUrl ||
      story.image ||
      story.postMetadata?.imageUrl ||
      story.mediaUrl;

    if (directImage && typeof directImage === 'string' && !isVideo(directImage)) {
      const norm = normalizeMediaUrl(directImage);
      if (norm && !isVideo(norm)) return norm;
    }

    // 3. Cloudinary video thumbnail transformation
    const videoUrl = story.videoUrl || story.video || story.postMetadata?.videoUrl;
    if (videoUrl && typeof videoUrl === 'string') {
      if (videoUrl.includes('res.cloudinary.com') && videoUrl.includes('/video/upload/')) {
        const transformed = getVideoThumbnailUrl(videoUrl);
        if (transformed && !isVideo(transformed)) {
          return normalizeMediaUrl(transformed);
        }
      }

      // Check in-memory thumbnail cache
      const normalizedVid = normalizeMediaUrl(videoUrl);
      if (videoThumbnailCache.has(normalizedVid)) {
        return videoThumbnailCache.get(normalizedVid)!;
      }
      if (videoThumbnailCache.has(videoUrl)) {
        return videoThumbnailCache.get(videoUrl)!;
      }
    }
  }

  // Fallback check on fallbackUri if it has a cached thumbnail
  if (fallbackUri && typeof fallbackUri === 'string') {
    const normVid = normalizeMediaUrl(fallbackUri);
    if (videoThumbnailCache.has(normVid)) return videoThumbnailCache.get(normVid)!;
    if (videoThumbnailCache.has(fallbackUri)) return videoThumbnailCache.get(fallbackUri)!;

    // Cloudinary video thumbnail fallback
    if (fallbackUri.includes('res.cloudinary.com') && fallbackUri.includes('/video/upload/')) {
      const transformed = getVideoThumbnailUrl(fallbackUri);
      if (transformed && !isVideo(transformed)) return normalizeMediaUrl(transformed);
    }
  }

  return '';
}

/**
 * Asynchronously gets or generates a thumbnail for a story or video URL.
 * Uses in-memory cache and expo-video-thumbnails fallback.
 */
export async function getOrGenerateStoryThumbnail(storyOrUrl: any): Promise<string> {
  const syncThumb = resolveStoryThumbnailUrlSync(
    typeof storyOrUrl === 'object' ? storyOrUrl : undefined,
    typeof storyOrUrl === 'string' ? storyOrUrl : undefined
  );
  if (syncThumb) return syncThumb;

  const videoUrl =
    typeof storyOrUrl === 'string'
      ? (isVideo(storyOrUrl) ? normalizeMediaUrl(storyOrUrl) : '')
      : extractStoryVideoUrl(storyOrUrl);

  if (!videoUrl) return '';

  if (videoThumbnailCache.has(videoUrl)) {
    return videoThumbnailCache.get(videoUrl)!;
  }

  try {
    const { getThumbnailAsync } = await import('expo-video-thumbnails');
    const result = await getThumbnailAsync(videoUrl, { time: 500 });
    if (result?.uri) {
      videoThumbnailCache.set(videoUrl, result.uri);
      return result.uri;
    }
  } catch (err) {
    // Retry at 0ms timestamp
    try {
      const { getThumbnailAsync } = await import('expo-video-thumbnails');
      const result = await getThumbnailAsync(videoUrl, { time: 0 });
      if (result?.uri) {
        videoThumbnailCache.set(videoUrl, result.uri);
        return result.uri;
      }
    } catch {
      // Ignored
    }
  }

  return '';
}

export interface StoryThumbnailProps {
  story?: any;
  uri?: string;
  style?: StyleProp<ViewStyle | ImageStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain' | 'center';
  borderRadius?: number;
  showPlayBadge?: boolean;
  fallbackIconSize?: number;
  onPress?: () => void;
}

/**
 * Universal Story Thumbnail component.
 * Renders an image thumbnail instantly for photos or pre-generated thumbnails,
 * and seamlessly generates + caches video thumbnails for video stories with 0 blank frames.
 */
export const StoryThumbnail = memo(function StoryThumbnail({
  story,
  uri,
  style,
  imageStyle,
  containerStyle,
  resizeMode = 'cover',
  borderRadius = 0,
  showPlayBadge = false,
  fallbackIconSize = 28,
}: StoryThumbnailProps) {
  const initialThumb = resolveStoryThumbnailUrlSync(story, uri);
  const [thumbUrl, setThumbUrl] = useState<string>(initialThumb);
  const [isLoading, setIsLoading] = useState<boolean>(!initialThumb && (isStoryVideo(story) || isVideo(uri)));
  const [hasError, setHasError] = useState<boolean>(false);

  const videoUrl = extractStoryVideoUrl(story, uri);
  const isVideoStory = isStoryVideo(story) || isVideo(uri) || !!videoUrl;

  useEffect(() => {
    let isMounted = true;
    const resolvedSync = resolveStoryThumbnailUrlSync(story, uri);

    if (resolvedSync) {
      setThumbUrl(resolvedSync);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    if (isVideoStory && videoUrl) {
      setIsLoading(true);
      setHasError(false);

      getOrGenerateStoryThumbnail(story || videoUrl)
        .then((generatedUri) => {
          if (!isMounted) return;
          if (generatedUri) {
            setThumbUrl(generatedUri);
            setHasError(false);
          } else {
            setHasError(true);
          }
        })
        .catch(() => {
          if (isMounted) setHasError(true);
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [story, uri, videoUrl, isVideoStory]);

  const showVideoIcon = showPlayBadge || (isVideoStory && !!thumbUrl);

  return (
    <View
      style={[
        styles.container,
        { borderRadius, overflow: 'hidden' },
        containerStyle,
        style as StyleProp<ViewStyle>,
      ]}
    >
      {thumbUrl && !hasError ? (
        <Image
          source={{ uri: thumbUrl }}
          style={[StyleSheet.absoluteFillObject, imageStyle]}
          resizeMode={resizeMode}
          onError={() => {
            // If image fails, attempt video generation if videoUrl available
            if (videoUrl && !videoThumbnailCache.has(videoUrl)) {
              getOrGenerateStoryThumbnail(videoUrl).then((genUri) => {
                if (genUri) setThumbUrl(genUri);
                else setHasError(true);
              }).catch(() => setHasError(true));
            } else {
              setHasError(true);
            }
          }}
        />
      ) : isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : (
        <View style={styles.centerBox}>
          <Ionicons
            name={isVideoStory ? 'videocam-outline' : 'image-outline'}
            size={fallbackIconSize}
            color={COLORS.textMuted}
          />
        </View>
      )}

      {/* Optional video play badge */}
      {showVideoIcon && !isLoading && !hasError && (
        <View style={styles.playBadge}>
          <Ionicons name="play" size={12} color={COLORS.textLight} />
        </View>
      )}
    </View>
  );
});

export default StoryThumbnail;

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
