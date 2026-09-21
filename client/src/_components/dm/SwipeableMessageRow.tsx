import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import COLORS from '@/src/theme/colors';

interface SwipeableMessageRowProps {
  children: React.ReactNode;
  onSwipeReply?: () => void;
  onDoubleTap?: () => void;
  isSelf?: boolean;
  enabled?: boolean;
}

const SWIPE_THRESHOLD = 45;
const MAX_SWIPE = 70;
const DOUBLE_TAP_DELAY = 280;

export const SwipeableMessageRow: React.FC<SwipeableMessageRowProps> = ({
  children,
  onSwipeReply,
  onDoubleTap,
  isSelf = false,
  enabled = true,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const hasTriggeredHapticRef = useRef(false);
  const lastTapRef = useRef<number>(0);
  const [showHeart, setShowHeart] = useState(false);

  // Heart pop animation values
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const heartTranslateY = useRef(new Animated.Value(0)).current;

  const triggerHeartAnimation = useCallback(() => {
    setShowHeart(true);
    heartScale.setValue(0);
    heartOpacity.setValue(1);
    heartTranslateY.setValue(0);

    Animated.parallel([
      Animated.spring(heartScale, {
        toValue: 1.25,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(heartTranslateY, {
        toValue: -28,
        duration: 750,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(heartOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setShowHeart(false);
    });
  }, [heartScale, heartOpacity, heartTranslateY]);

  const onDoubleTapRef = useRef(onDoubleTap);
  useEffect(() => {
    onDoubleTapRef.current = onDoubleTap;
  }, [onDoubleTap]);

  const isSwipingRef = useRef(false);

  const handleTap = useCallback(() => {
    if (isSwipingRef.current) return;
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected!
      lastTapRef.current = 0;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      triggerHeartAnimation();
      onDoubleTapRef.current?.();
    } else {
      lastTapRef.current = now;
    }
  }, [triggerHeartAnimation]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Only capture when dragging horizontally to the right
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!enabled || !onSwipeReply) return false;
        return (
          gestureState.dx > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2
        );
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (!enabled || !onSwipeReply) return false;
        return (
          gestureState.dx > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2
        );
      },
      onPanResponderGrant: () => {
        isSwipingRef.current = true;
        hasTriggeredHapticRef.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          // Logarithmic spring-like resistance
          const drag = Math.min(MAX_SWIPE, gestureState.dx * 0.75);
          translateX.setValue(drag);

          if (drag >= SWIPE_THRESHOLD && !hasTriggeredHapticRef.current) {
            hasTriggeredHapticRef.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          } else if (drag < SWIPE_THRESHOLD && hasTriggeredHapticRef.current) {
            hasTriggeredHapticRef.current = false;
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const passed =
          gestureState.dx >= SWIPE_THRESHOLD || hasTriggeredHapticRef.current;
        hasTriggeredHapticRef.current = false;
        setTimeout(() => { isSwipingRef.current = false; }, 150);

        Animated.spring(translateX, {
          toValue: 0,
          friction: 7,
          tension: 50,
          useNativeDriver: true,
        }).start();

        if (passed && onSwipeReply) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onSwipeReply();
        }
      },
      onPanResponderTerminate: () => {
        hasTriggeredHapticRef.current = false;
        setTimeout(() => { isSwipingRef.current = false; }, 150);
        Animated.spring(translateX, {
          toValue: 0,
          friction: 7,
          tension: 50,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Interpolations for left reply icon badge
  const iconScale = translateX.interpolate({
    inputRange: [0, 20, SWIPE_THRESHOLD, MAX_SWIPE],
    outputRange: [0, 0.4, 1.1, 1],
    extrapolate: 'clamp',
  });

  const iconOpacity = translateX.interpolate({
    inputRange: [0, 15, SWIPE_THRESHOLD],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const iconRotate = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: ['-45deg', '0deg'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.outerContainer} {...panResponder.panHandlers}>
      {/* Curved Reply Icon Badge revealed on swipe */}
      {onSwipeReply && (
        <Animated.View
          style={[
            styles.replyIconContainer,
            {
              opacity: iconOpacity,
              transform: [
                { scale: iconScale },
                { rotate: iconRotate },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.replyIconCircle}>
            <Ionicons
              name="arrow-undo"
              size={17}
              color={COLORS.primary || '#FF6B00'}
            />
          </View>
        </Animated.View>
      )}

      {/* Main Swipeable Message Content */}
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            transform: [{ translateX }],
          },
        ]}
        onTouchEnd={handleTap}
      >
        {children}

        {/* Floating Pop Heart on Double Tap */}
        {showHeart && (
          <Animated.View
            style={[
              styles.floatingHeartContainer,
              isSelf ? styles.heartSelfPos : styles.heartPeerPos,
              {
                opacity: heartOpacity,
                transform: [
                  { scale: heartScale },
                  { translateY: heartTranslateY },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Ionicons name="heart" size={48} color="#FF3B30" style={styles.heartShadow} />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  replyIconContainer: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  contentWrapper: {
    width: '100%',
    position: 'relative',
  },
  floatingHeartContainer: {
    position: 'absolute',
    top: '30%',
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartSelfPos: {
    right: '25%',
  },
  heartPeerPos: {
    left: '25%',
  },
  heartShadow: {
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default React.memo(SwipeableMessageRow);
