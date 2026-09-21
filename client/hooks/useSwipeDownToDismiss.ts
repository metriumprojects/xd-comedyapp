import { useRef, useEffect, useCallback } from 'react';
import { Animated, PanResponder, Dimensions, Easing } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface UseSwipeDownToDismissOptions {
  onDismiss: () => void;
  threshold?: number;
  velocityThreshold?: number;
  visible?: boolean;
  initialSlideIn?: boolean;
  initialOffset?: number;
}

/**
 * Hook to provide fluid, Google Material / iOS-like drag-down-to-dismiss gesture physics for bottom sheets.
 * - Real-time finger tracking on downward drag with instant touch capture on drag header.
 * - Dismisses with silky 60fps velocity-matched glide to off-screen without any sudden jerk or snap.
 * - Elastic spring physics if released before threshold.
 * - Optional slide-up entry and smooth programmatic dismissal without dark cover glitching.
 */
export function useSwipeDownToDismiss({
  onDismiss,
  threshold = 60,
  velocityThreshold = 0.3,
  visible = true,
  initialSlideIn = false,
  initialOffset = SCREEN_HEIGHT,
}: UseSwipeDownToDismissOptions) {
  const translateY = useRef(new Animated.Value(initialSlideIn ? SCREEN_HEIGHT : 0)).current;
  const isDismissing = useRef(false);

  // Smooth entrance when visible becomes true
  useEffect(() => {
    if (visible) {
      isDismissing.current = false;
      if (initialSlideIn) {
        translateY.setValue(SCREEN_HEIGHT);
        Animated.spring(translateY, {
          toValue: 0,
          damping: 26,
          stiffness: 280,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      } else {
        translateY.setValue(0);
      }
    } else {
      isDismissing.current = false;
      translateY.setValue(SCREEN_HEIGHT);
    }
  }, [visible, initialSlideIn, translateY]);

  // Programmatic dismiss with smooth slide-down exit (no snap back)
  const dismiss = useCallback((callback?: () => void) => {
    if (isDismissing.current) return;
    isDismissing.current = true;

    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      // Do NOT reset translateY to 0 here! It stays safely off-screen.
      onDismiss();
      callback?.();
    });
  }, [onDismiss, translateY]);

  // Header PanResponder: Instant touch grab on top drag handle / header area
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
        } else {
          // Subtle rubber-band resistance when pulling upward
          translateY.setValue(g.dy * 0.15);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > threshold || g.vy > velocityThreshold) {
          if (isDismissing.current) return;
          isDismissing.current = true;
          const remaining = Math.max(0, SCREEN_HEIGHT - g.dy);
          const speed = Math.max(1.8, Math.abs(g.vy) * 2.2);
          const duration = Math.min(220, Math.max(140, Math.round(remaining / speed)));

          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            onDismiss();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 24,
            stiffness: 300,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 300,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Sheet PanResponder: Captures downward drag gestures over the body while allowing child buttons to be pressed
  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
      onMoveShouldSetPanResponderCapture: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
        } else {
          translateY.setValue(g.dy * 0.15);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > threshold || g.vy > velocityThreshold) {
          if (isDismissing.current) return;
          isDismissing.current = true;
          const remaining = Math.max(0, SCREEN_HEIGHT - g.dy);
          const speed = Math.max(1.8, Math.abs(g.vy) * 2.2);
          const duration = Math.min(220, Math.max(140, Math.round(remaining / speed)));

          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            onDismiss();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 24,
            stiffness: 300,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 300,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return {
    translateY,
    panHandlers: headerPanResponder.panHandlers,
    headerPanHandlers: headerPanResponder.panHandlers,
    sheetPanHandlers: sheetPanResponder.panHandlers,
    animatedStyle: {
      transform: [{ translateY }],
    },
    dismiss,
    reset: () => translateY.setValue(0),
  };
}

export default useSwipeDownToDismiss;
