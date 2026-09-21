import { getCdnUrl } from '@/lib/api';

/**
 * Helpers for resolving post media URLs across API response shapes.
 */

export function getPostPrimaryImageUrl(post: any): string {
  if (!post) return '';

  const isVideoUrlStr = (u: string) => typeof u === 'string' && (/\.(mp4|mov|webm|m4v|mkv|avi)(\?|$)/i.test(u) || /\/video\/upload\//i.test(u));
  const resolveImage = (u: string, poster?: string): string => {
    if (poster && typeof poster === 'string' && poster.trim()) return getCdnUrl(poster.trim());
    if (!u || typeof u !== 'string') return '';
    if (isVideoUrlStr(u)) {
      try {
        const { getVideoThumbnailUrl } = require('@/lib/imageHelpers');
        return getCdnUrl(getVideoThumbnailUrl(u, poster));
      } catch {
        return getCdnUrl(u);
      }
    }
    return getCdnUrl(u);
  };

  if (Array.isArray(post.media) && post.media.length > 0) {
    const first = post.media[0];
    if (typeof first === 'string') return resolveImage(first);
    const poster = first?.thumbnailUrl || first?.thumbnail || first?.poster || first?.thumb || '';
    const url = first?.url || first?.uri || first?.imageUrl || '';
    return resolveImage(url || poster, poster);
  }

  if (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0) {
    const first = String(post.mediaUrls[0] || '');
    const poster = String(post.thumbnailUrl || post.thumbnail || '');
    return resolveImage(first, poster);
  }

  if (Array.isArray(post.images) && post.images.length > 0) {
    const img = post.images[0];
    const first = typeof img === 'string' ? img : (img?.url || img?.uri || '');
    return resolveImage(first);
  }

  const primary = String(post.imageUrl || post.mediaUrl || post.image || post.thumbnailUrl || post.thumbnail || '');
  const poster = String(post.thumbnailUrl || post.thumbnail || '');
  return resolveImage(primary, poster);
}

export function getPostMediaUrls(post: any): string[] {
  if (!post) return [];

  let rawUrls: string[] = [];

  if (Array.isArray(post.media) && post.media.length > 0) {
    rawUrls = post.media
      .map((m: any) => (typeof m === 'string' ? m : (m?.url || m?.uri || m?.imageUrl || '')))
      .filter(Boolean);
  } else if (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0) {
    rawUrls = post.mediaUrls.map(String).filter(Boolean);
  } else if (Array.isArray(post.images) && post.images.length > 0) {
    rawUrls = post.images
      .map((img: any) => (typeof img === 'string' ? img : (img?.url || img?.uri || '')))
      .filter(Boolean);
  } else {
    const primary = getPostPrimaryImageUrl(post);
    rawUrls = primary ? [primary] : [];
  }

  return rawUrls.map(u => getCdnUrl(u)).filter(Boolean);
}

export function parseSharePostData(raw?: string | null): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch {
      return null;
    }
  }
}

export function serializeSharePostData(post: any): string {
  return JSON.stringify(post);
}

export function isPostVideo(post: any): boolean {
  if (!post) return false;
  if (post.mediaType === 'video' || !!post.videoUrl || !!post.video) return true;
  const isVidUrl = (u?: any) => typeof u === 'string' && (/\.(mp4|mov|webm|m4v|mkv)(\?|$)/i.test(u) || u.includes('video/upload') || u.includes('/video/'));
  if (isVidUrl(post.imageUrl) || isVidUrl(post.mediaUrl)) return true;
  const media = Array.isArray(post.media) ? post.media : [];
  if (media.some((m: any) => m?.type === 'video' || isVidUrl(m?.url) || isVidUrl(m?.uri) || (typeof m === 'string' && isVidUrl(m)))) return true;
  if (Array.isArray(post.mediaUrls) && post.mediaUrls.some((u: any) => isVidUrl(String(u)))) return true;
  if (Array.isArray(post.images) && post.images.some((img: any) => isVidUrl(typeof img === 'string' ? img : (img?.url || img?.uri)))) return true;
  return false;
}

export function getPostVideoUrls(post: any): string[] {
  if (!post) return [];
  const urls: string[] = [];
  const isVidUrl = (u?: any) => typeof u === 'string' && (/\.(mp4|mov|webm|m4v|mkv)(\?|$)/i.test(u) || u.includes('video/upload') || u.includes('/video/'));

  if (Array.isArray(post.mediaUrls)) {
    for (const u of post.mediaUrls) {
      if (isVidUrl(u) || post.mediaType === 'video') urls.push(String(u));
    }
  }
  if (post.imageUrl && (isVidUrl(post.imageUrl) || post.mediaType === 'video')) {
    urls.push(post.imageUrl);
  }
  if (post.mediaUrl && (isVidUrl(post.mediaUrl) || post.mediaType === 'video')) {
    urls.push(post.mediaUrl);
  }
  if (post.feedUrl) urls.push(post.feedUrl);
  else if (post.videoUrl) urls.push(post.videoUrl);
  if (post.video) urls.push(typeof post.video === 'string' ? post.video : (post.video?.url || ''));

  if (Array.isArray(post.media)) {
    for (const m of post.media) {
      if (typeof m === 'string') {
        if (isVidUrl(m)) urls.push(m);
        continue;
      }
      const playback = m?.feedUrl || m?.url || m?.uri;
      if (playback && (m?.type === 'video' || isVidUrl(playback))) urls.push(playback);
    }
  }

  return [...new Set(urls.filter(Boolean).map(u => getCdnUrl(u)))];
}

export function buildSharedPostMetadata(post: any, sharePostId: string): Record<string, unknown> {
  const imageUrl = getPostPrimaryImageUrl(post);
  const mediaUrls = getPostMediaUrls(post);
  const authorId =
    post?.userId?._id ||
    post?.userId?.id ||
    post?.userId ||
    post?.authorId ||
    '';

  const firstMedia = Array.isArray(post?.media) ? post.media[0] : null;
  const firstMediaUrl = typeof firstMedia === 'string' ? firstMedia : (firstMedia?.url || firstMedia?.uri || '');
  const isVideoUrlPattern = (u?: string | null) => typeof u === 'string' && (/\.(mp4|mov|webm|m4v|mkv)(\?|$)/i.test(u) || u.includes('video/upload') || u.includes('/video/'));

  const isVideoPost =
    isPostVideo(post) ||
    firstMedia?.type === 'video' ||
    post?.mediaType === 'video' ||
    !!post?.videoUrl ||
    !!post?.video ||
    isVideoUrlPattern(firstMediaUrl) ||
    isVideoUrlPattern(imageUrl) ||
    (Array.isArray(post?.mediaUrls) && post.mediaUrls.some((u: any) => isVideoUrlPattern(String(u))));

  const videoUrl =
    (firstMedia?.type === 'video' ? (firstMedia?.url || firstMedia?.uri) : null) ||
    (isVideoUrlPattern(firstMediaUrl) ? firstMediaUrl : null) ||
    post?.videoUrl ||
    post?.video ||
    (Array.isArray(post?.mediaUrls) && post.mediaUrls.find((u: any) => isVideoUrlPattern(String(u)))) ||
    (isVideoUrlPattern(imageUrl) ? imageUrl : undefined);

  const thumbnailUrl =
    firstMedia?.thumbnailUrl ||
    firstMedia?.thumbnail ||
    post?.thumbnailUrl ||
    post?.thumbnail ||
    '';

  return {
    postId: sharePostId,
    userId: authorId,
    authorId,
    userName: post?.userName || post?.user?.displayName || post?.user?.name || 'User',
    userAvatar:
      post?.userAvatar ||
      post?.user?.profilePicture ||
      post?.user?.avatar ||
      post?.user?.photoURL ||
      '',
    caption: post?.caption || post?.text || '',
    imageUrl: getCdnUrl(isVideoPost ? (thumbnailUrl || imageUrl) : imageUrl),
    thumbnailUrl: getCdnUrl(thumbnailUrl),
    videoUrl: isVideoPost && videoUrl ? getCdnUrl(videoUrl) : undefined,
    isVideo: isVideoPost,
    mediaType: isVideoPost ? 'video' : 'image',
    mediaUrls: mediaUrls.map(u => getCdnUrl(u)),
    aspectRatio: post?.media?.[0]?.aspectRatio || post?.aspectRatio || 1,
  };
}

export function buildSharedStoryMetadata(story: any, shareStoryId: string): Record<string, unknown> {
  const isVideoUrlPattern = (u?: any) =>
    typeof u === 'string' &&
    (/\.(mp4|mov|webm|m4v|mkv)(\?|$)/i.test(u) || u.includes('video/upload') || u.includes('/video/'));

  let nestedPostMeta = story?.postMetadata;
  if (typeof nestedPostMeta === 'string') {
    try {
      nestedPostMeta = JSON.parse(nestedPostMeta);
    } catch {
      nestedPostMeta = undefined;
    }
  }

  const origMeta = nestedPostMeta?.originalPostMetadata || nestedPostMeta;

  const resolvedVideoUrl =
    (isVideoUrlPattern(origMeta?.videoUrl) ? origMeta.videoUrl : null) ||
    (isVideoUrlPattern(origMeta?.video) ? origMeta.video : null) ||
    (Array.isArray(origMeta?.mediaUrls) ? origMeta.mediaUrls.find((u: any) => isVideoUrlPattern(String(u))) : null) ||
    (isVideoUrlPattern(nestedPostMeta?.videoUrl) ? nestedPostMeta.videoUrl : null) ||
    (isVideoUrlPattern(nestedPostMeta?.video) ? nestedPostMeta.video : null) ||
    (isVideoUrlPattern(nestedPostMeta?.mediaUrl) ? nestedPostMeta.mediaUrl : null) ||
    (isVideoUrlPattern(nestedPostMeta?.media?.[0]?.url) ? nestedPostMeta.media[0].url : null) ||
    (Array.isArray(nestedPostMeta?.mediaUrls) ? nestedPostMeta.mediaUrls.find((u: any) => isVideoUrlPattern(String(u))) : null) ||
    (isVideoUrlPattern(story?.videoUrl) && !story?.videoUrl.includes('stories/') ? story.videoUrl : null) ||
    (isVideoUrlPattern(story?.video) && !story?.video.includes('stories/') ? story.video : null) ||
    (isVideoUrlPattern(story?.videoUrl) ? story.videoUrl : null) ||
    (isVideoUrlPattern(story?.video) ? story.video : null) ||
    origMeta?.videoUrl ||
    nestedPostMeta?.videoUrl ||
    story?.videoUrl ||
    story?.video ||
    '';

  const resolvedThumbnailUrl =
    story?.thumbnailUrl ||
    story?.thumbnail ||
    nestedPostMeta?.thumbnailUrl ||
    nestedPostMeta?.thumbnail ||
    origMeta?.thumbnailUrl ||
    origMeta?.thumbnail ||
    nestedPostMeta?.media?.[0]?.thumbnailUrl ||
    '';

  const rawImageUrl =
    story?.imageUrl ||
    story?.image ||
    nestedPostMeta?.imageUrl ||
    nestedPostMeta?.image ||
    origMeta?.imageUrl ||
    getPostPrimaryImageUrl(nestedPostMeta) ||
    getPostPrimaryImageUrl(story) ||
    '';

  const resolvedImageUrl = isVideoUrlPattern(rawImageUrl)
    ? (resolvedThumbnailUrl || '')
    : (rawImageUrl || resolvedThumbnailUrl || '');

  const isVideo = !!(
    story?.mediaType === 'video' ||
    nestedPostMeta?.mediaType === 'video' ||
    nestedPostMeta?.isVideo ||
    origMeta?.isVideo ||
    origMeta?.mediaType === 'video' ||
    (resolvedVideoUrl && resolvedVideoUrl !== 'placeholder')
  );

  const authorId = String(
    story?.userId?._id ||
    story?.userId?.id ||
    story?.userId ||
    story?.authorId ||
    nestedPostMeta?.authorId ||
    nestedPostMeta?.userId ||
    story?.uid ||
    ''
  ).trim();

  const nestedPostId =
    nestedPostMeta?.postId ||
    (nestedPostMeta?.isStoryReshare ? null : nestedPostMeta?._id) ||
    (nestedPostMeta?.isStoryReshare ? null : nestedPostMeta?.id) ||
    origMeta?.postId ||
    origMeta?._id ||
    origMeta?.id ||
    null;

  return {
    shareStoryId,
    storyId: shareStoryId,
    userId: authorId,
    authorId,
    userName: nestedPostMeta?.userName || story?.userName || 'User',
    userAvatar: nestedPostMeta?.userAvatar || story?.userAvatar || '',
    caption: nestedPostMeta?.caption || story?.caption || '',
    imageUrl: getCdnUrl(resolvedImageUrl),
    thumbnailUrl: getCdnUrl(resolvedThumbnailUrl || resolvedImageUrl),
    mediaUrls: resolvedImageUrl ? [getCdnUrl(resolvedImageUrl)] : [],
    videoUrl: isVideo ? getCdnUrl(resolvedVideoUrl) : '',
    mediaType: isVideo ? 'video' : 'image',
    isVideo,
    isStoryReshare: true,
    aspectRatio: nestedPostMeta?.aspectRatio || origMeta?.aspectRatio || 1,
    ...(nestedPostId ? { postId: String(nestedPostId) } : {}),
    ...(nestedPostMeta && nestedPostId ? { originalPostMetadata: nestedPostMeta } : {}),
  };
}

/** Resolve a real post id from story/post-share metadata (never a story id). */
export function resolveSharedPostId(metaOrStory: any): string | null {
  if (!metaOrStory) return null;
  let meta = metaOrStory?.postMetadata ?? metaOrStory;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = metaOrStory;
    }
  }

  const isStoryReshare = !!(
    meta?.isStoryReshare ||
    metaOrStory?.isStoryReshare ||
    meta?.shareStoryId ||
    metaOrStory?.shareStoryId
  );

  const candidates = [
    meta?.postId,
    meta?.originalPostMetadata?.postId,
    meta?.postMetadata?.postId,
    metaOrStory?.sharePostId,
    metaOrStory?.sharedPostId,
    metaOrStory?.postId,
    metaOrStory?.post?._id,
    metaOrStory?.post?.id,
  ];

  if (!isStoryReshare) {
    candidates.push(meta?._id, meta?.id);
  }

  for (const c of candidates) {
    const id = String(c || '').trim();
    if (!id) continue;
    if (id.startsWith('share_story_')) continue;
    if (meta?.storyId && id === String(meta.storyId)) continue;
    if (meta?.shareStoryId && id === String(meta.shareStoryId)) continue;
    return id;
  }
  return null;
}
