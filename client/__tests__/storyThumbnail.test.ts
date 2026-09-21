import { describe, expect, it } from '@jest/globals';
import {
  isVideo,
  isStoryVideo,
  extractStoryVideoUrl,
  resolveStoryThumbnailUrlSync,
  videoThumbnailCache,
} from '../src/_components/StoryThumbnail';

describe('Story Thumbnail Resolution', () => {
  describe('isVideo', () => {
    it('identifies mp4, mov, and video upload paths as video', () => {
      expect(isVideo('https://cdn.example.com/story.mp4')).toBe(true);
      expect(isVideo('https://cdn.example.com/story.mov?token=123')).toBe(true);
      expect(isVideo('https://res.cloudinary.com/demo/video/upload/sample.mp4')).toBe(true);
      expect(isVideo('https://cdn.example.com/photo.jpg')).toBe(false);
      expect(isVideo('https://cdn.example.com/photo.png')).toBe(false);
      expect(isVideo('')).toBe(false);
      expect(isVideo(null as any)).toBe(false);
    });
  });

  describe('isStoryVideo', () => {
    it('detects video stories correctly across all field conventions', () => {
      expect(isStoryVideo({ mediaType: 'video', videoUrl: 'https://cdn.example.com/vid.mp4' })).toBe(true);
      expect(isStoryVideo({ video: 'https://cdn.example.com/vid.mp4' })).toBe(true);
      expect(isStoryVideo({ postMetadata: { videoUrl: 'https://cdn.example.com/vid.mp4' } })).toBe(true);
      expect(isStoryVideo({ mediaUrl: 'https://cdn.example.com/vid.mp4' })).toBe(true);
      expect(isStoryVideo({ imageUrl: 'https://cdn.example.com/photo.jpg' })).toBe(false);
      expect(isStoryVideo({ image: 'https://cdn.example.com/photo.jpg' })).toBe(false);
    });
  });

  describe('extractStoryVideoUrl', () => {
    it('extracts and normalizes video URL from various story properties', () => {
      expect(extractStoryVideoUrl({ videoUrl: 'https://cdn.example.com/v.mp4' })).toBe('https://cdn.example.com/v.mp4');
      expect(extractStoryVideoUrl({ video: 'https://cdn.example.com/v.mp4' })).toBe('https://cdn.example.com/v.mp4');
      expect(extractStoryVideoUrl({ postMetadata: { videoUrl: 'https://cdn.example.com/v.mp4' } })).toBe('https://cdn.example.com/v.mp4');
      expect(extractStoryVideoUrl(undefined, 'https://cdn.example.com/v.mp4')).toBe('https://cdn.example.com/v.mp4');
    });
  });

  describe('resolveStoryThumbnailUrlSync', () => {
    it('returns direct image thumbnails for photo stories', () => {
      const photoStory = {
        id: 'story1',
        imageUrl: 'https://cdn.example.com/picture.jpg',
      };
      expect(resolveStoryThumbnailUrlSync(photoStory)).toBe('https://cdn.example.com/picture.jpg');
    });

    it('returns MongoDB image field for photo stories', () => {
      const mongoStory = {
        _id: 'story2',
        image: 'https://cdn.example.com/mongo_pic.jpg',
      };
      expect(resolveStoryThumbnailUrlSync(mongoStory)).toBe('https://cdn.example.com/mongo_pic.jpg');
    });

    it('returns explicit thumbnailUrl for video stories if provided', () => {
      const videoStoryWithThumb = {
        id: 'story3',
        mediaType: 'video',
        videoUrl: 'https://cdn.example.com/video.mp4',
        thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
      };
      expect(resolveStoryThumbnailUrlSync(videoStoryWithThumb)).toBe('https://cdn.example.com/thumb.jpg');
    });

    it('NEVER returns raw mp4 URL as an image thumbnail when no poster is available', () => {
      const rawVideoStory = {
        id: 'story4',
        mediaType: 'video',
        videoUrl: 'https://cdn.example.com/raw_video.mp4',
      };
      // Should return empty string synchronously instead of raw mp4
      expect(resolveStoryThumbnailUrlSync(rawVideoStory)).toBe('');
    });

    it('returns cached thumbnail immediately if present in videoThumbnailCache', () => {
      const videoUrl = 'https://cdn.example.com/cached_video.mp4';
      const cachedLocalUri = 'file:///data/user/0/cache/thumb_123.jpg';
      videoThumbnailCache.set(videoUrl, cachedLocalUri);

      const story = {
        id: 'story5',
        mediaType: 'video',
        videoUrl,
      };
      expect(resolveStoryThumbnailUrlSync(story)).toBe(cachedLocalUri);
      expect(resolveStoryThumbnailUrlSync(undefined, videoUrl)).toBe(cachedLocalUri);
    });

    it('transforms Cloudinary video URLs to jpg automatically', () => {
      const cloudinaryStory = {
        id: 'story6',
        mediaType: 'video',
        videoUrl: 'https://res.cloudinary.com/demo/video/upload/sample.mp4',
      };
      const resolved = resolveStoryThumbnailUrlSync(cloudinaryStory);
      expect(resolved).toContain('.jpg');
      expect(resolved).not.toContain('.mp4');
    });
  });
});
