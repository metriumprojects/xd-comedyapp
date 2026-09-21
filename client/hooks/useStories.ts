import { useState, useEffect, useRef, useCallback } from 'react';
import { useSharedValue } from 'react-native-reanimated';

interface Story {
  id: string;
  mediaType?: 'image' | 'video';
  videoUrl?: string;
  imageUrl?: string;
  postMetadata?: {
    mediaType?: string;
    videoUrl?: string;
  };
}

export function useStories(
  stories: Story[],
  initialIndex: number,
  onClose: () => void,
  extraPauseCondition: boolean = false,
  isCurrentVideoExplicit?: boolean
) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [videoDuration, setVideoDuration] = useState(5000);
  const progressSv = useSharedValue(0);
  
  const currentIndexRef = useRef(initialIndex);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const storiesRef = useRef(stories);
  useEffect(() => { storiesRef.current = stories; }, [stories]);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const elapsedRef = useRef(0);

  const goToNext = useCallback(() => {
    const currIndex = currentIndexRef.current;
    const currentStories = storiesRef.current || [];
    if (currIndex < currentStories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setImageLoading(true);
      setVideoDuration(5000);
      elapsedRef.current = 0;
      progressSv.value = 0;
    } else {
      onCloseRef.current();
    }
  }, [progressSv]);

  const goToPrevious = useCallback(() => {
    const currIndex = currentIndexRef.current;
    if (currIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setImageLoading(true);
      setVideoDuration(5000);
      elapsedRef.current = 0;
      progressSv.value = 0;
    }
  }, [progressSv]);

  // Reset elapsed timer and progress on index change
  useEffect(() => {
    elapsedRef.current = 0;
    progressSv.value = 0;
  }, [currentIndex, progressSv]);

  const currentStory = stories[currentIndex] as any;
  const isVideo = isCurrentVideoExplicit !== undefined
    ? isCurrentVideoExplicit
    : (
        currentStory?.mediaType === 'video' ||
        !!currentStory?.videoUrl ||
        !!currentStory?.video ||
        currentStory?.postMetadata?.mediaType === 'video' ||
        !!currentStory?.postMetadata?.videoUrl
      );

  // Stable JS-based timer for photo stories ONLY.
  // Video stories are driven synchronously by expo-av onPlaybackStatusUpdate.
  useEffect(() => {
    if (isVideo) {
      return;
    }

    const isActuallyPaused = isPaused || imageLoading || extraPauseCondition;
    if (isActuallyPaused) {
      return;
    }

    const duration = 5000;
    const intervalTime = 30; // 30ms for 60fps-like progress animation

    const timer = setInterval(() => {
      elapsedRef.current += intervalTime;
      const progressPercent = Math.min(100, (elapsedRef.current / duration) * 100);
      progressSv.value = progressPercent;

      if (elapsedRef.current >= duration) {
        clearInterval(timer);
        goToNext();
      }
    }, intervalTime);

    return () => {
      clearInterval(timer);
    };
  }, [currentIndex, isPaused, imageLoading, isVideo, stories, goToNext, progressSv, extraPauseCondition]);

  return {
    currentIndex,
    setCurrentIndex,
    isPaused,
    setIsPaused,
    imageLoading,
    setImageLoading,
    videoDuration,
    setVideoDuration,
    progressSv,
    goToNext,
    goToPrevious
  };
}
