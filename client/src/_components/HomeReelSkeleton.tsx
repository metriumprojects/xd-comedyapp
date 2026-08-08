import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import COLORS from '@/src/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ShimmerBlockProps {
  width: number | string;
  height: number | string;
  borderRadius?: number;
  style?: object;
}

function ShimmerBlock({ width, height, borderRadius = 4, style }: ShimmerBlockProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.5],
  });

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

interface HomeReelSkeletonProps {
  height?: number;
}

export function HomeReelSkeleton({ height }: HomeReelSkeletonProps) {
  const insets = useSafeAreaInsets();
  const containerHeight = height ?? Dimensions.get('window').height;

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      <ShimmerBlock width="100%" height="100%" borderRadius={0} />

      <View style={[styles.rightCol, { top: insets.top + 140 }]}>
        <ShimmerBlock width={48} height={48} borderRadius={24} />
        <ShimmerBlock width={32} height={32} borderRadius={16} style={styles.actionGap} />
        <ShimmerBlock width={32} height={32} borderRadius={16} style={styles.actionGap} />
        <ShimmerBlock width={32} height={32} borderRadius={16} style={styles.actionGap} />
        <ShimmerBlock width={32} height={32} borderRadius={16} style={styles.actionGap} />
      </View>

      <View style={[styles.bottomCol, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <ShimmerBlock width={120} height={14} borderRadius={7} style={{ marginBottom: 10 }} />
        <ShimmerBlock width={SCREEN_WIDTH * 0.65} height={12} borderRadius={6} style={{ marginBottom: 6 }} />
        <ShimmerBlock width={SCREEN_WIDTH * 0.45} height={12} borderRadius={6} style={{ marginBottom: 16 }} />
        <ShimmerBlock width="100%" height={36} borderRadius={18} />
      </View>
    </View>
  );
}

/** Lightweight pulse overlay while a reel video buffers */
export function ReelBufferSkeleton() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.35],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.bufferOverlay, { opacity }]} pointerEvents="none" />
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    backgroundColor: COLORS.black,
    overflow: 'hidden',
  },
  block: {
    backgroundColor: COLORS.card,
  },
  rightCol: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    zIndex: 2,
  },
  actionGap: {
    marginTop: 16,
  },
  bottomCol: {
    position: 'absolute',
    left: 0,
    right: 72,
    bottom: 0,
    paddingHorizontal: 14,
    zIndex: 2,
  },
  bufferOverlay: {
    backgroundColor: COLORS.card,
    zIndex: 10,
  },
});

export default HomeReelSkeleton;
