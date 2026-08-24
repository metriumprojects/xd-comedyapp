import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ReactionType = 'laugh' | 'tomato';

export interface FloatingParticleItem {
  id: string;
  type: ReactionType;
  startX: number;
  startY: number;
  swayWidth: number; // Amplitude of horizontal swaying
  swayFreq: number;  // Frequency of sway
  riseHeight: number; // Vertical distance to float up
  scale: number;
  rotation: number;
  duration: number;
  isFirework?: boolean;
  angle?: number;
  speed?: number;
}

interface ReelReactionBurstProps {
  particles: FloatingParticleItem[];
  onParticleComplete: (id: string) => void;
  comboCount?: number;
  isHolding?: boolean;
  holdingType?: ReactionType | null;
}

/**
 * Individual Floating Emoji Particle with organic sway & buoyant rise (TikTok / IG Live style)
 */
const SingleFloatingEmoji: React.FC<{
  item: FloatingParticleItem;
  onComplete: (id: string) => void;
}> = React.memo(({ item, onComplete }) => {
  const isLaugh = item.type === 'laugh';
  const imgSource = isLaugh
    ? require('@/assets/images/Laugh.png')
    : require('@/assets/images/Tomato.png');

  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // 1. Vertical Rise & Horizontal Sway Progress
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: item.duration,
        easing: item.isFirework ? Easing.out(Easing.cubic) : Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Scale pop and settle
      Animated.sequence([
        Animated.spring(scale, {
          toValue: item.scale,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: item.scale * 0.85,
          duration: item.duration * 0.6,
          useNativeDriver: true,
        }),
      ]),
      // Opacity: Fade in quickly, then fade out near peak
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.delay(item.duration * 0.5),
        Animated.timing(opacity, {
          toValue: 0,
          duration: item.duration * 0.4,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete(item.id);
    });
  }, [item, progress, opacity, scale, onComplete]);

  // If Firework: radial arc burst outwards
  if (item.isFirework) {
    const angle = item.angle || 0;
    const speed = item.speed || 150;
    const targetX = Math.cos(angle) * speed;
    const targetY = Math.sin(angle) * speed + 50; // gravity pull

    const transX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, targetX],
    });
    const transY = progress.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0, targetY * 0.4, targetY],
    });

    const size = 38 * item.scale;

    return (
      <Animated.View
        style={[
          styles.particleAbsolute,
          {
            left: item.startX,
            top: item.startY,
            opacity,
            transform: [
              { translateX: transX },
              { translateY: transY },
              { scale },
              { rotate: `${item.rotation}deg` },
            ],
          },
        ]}
      >
        <ExpoImage source={imgSource} style={{ width: size, height: size }} contentFit="contain" />
      </Animated.View>
    );
  }

  // Standard Floating Fountain (Instagram Live smooth vertical rising + sway)
  const transY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -item.riseHeight],
  });

  // Natural sinusoidal horizontal wobble
  const transX = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [
      0,
      -item.swayWidth * 0.8,
      item.swayWidth * 0.5,
      -item.swayWidth * 0.9,
      item.swayWidth * 0.3,
    ],
  });

  const rotateStr = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      `${item.rotation - 10}deg`,
      `${item.rotation + 15}deg`,
      `${item.rotation - 8}deg`,
    ],
  });

  const size = 36 * item.scale;

  return (
    <Animated.View
      style={[
        styles.particleAbsolute,
        {
          left: item.startX,
          top: item.startY,
          opacity,
          transform: [
            { translateX: transX },
            { translateY: transY },
            { scale },
            { rotate: rotateStr },
          ],
        },
      ]}
    >
      <ExpoImage source={imgSource} style={{ width: size, height: size }} contentFit="contain" />
    </Animated.View>
  );
});

export const ReelReactionBurst: React.FC<ReelReactionBurstProps> = ({
  particles,
  onParticleComplete,
  comboCount = 0,
  isHolding = false,
  holdingType = null,
}) => {
  const comboScale = useRef(new Animated.Value(0)).current;
  const comboOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isHolding && comboCount > 1) {
      Animated.parallel([
        Animated.spring(comboScale, {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(comboOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(comboScale, {
          toValue: 0.7,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(comboOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isHolding, comboCount, comboScale, comboOpacity]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Floating Combo Multiplier Counter during press & hold */}
      {isHolding && comboCount > 1 && (
        <Animated.View
          style={[
            styles.comboBadge,
            {
              backgroundColor: holdingType === 'laugh'
                ? 'rgba(245, 158, 11, 0.95)'
                : 'rgba(239, 68, 68, 0.95)',
              opacity: comboOpacity,
              transform: [{ scale: comboScale }],
            },
          ]}
        >
          <Text style={styles.comboText}>
            {holdingType === 'laugh' ? '😂 +' : '🍅 +'}{comboCount}
          </Text>
        </Animated.View>
      )}

      {/* Render all active stream and firework particles */}
      {particles.map((p) => (
        <SingleFloatingEmoji key={p.id} item={p} onComplete={onParticleComplete} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  particleAbsolute: {
    position: 'absolute',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comboBadge: {
    position: 'absolute',
    right: 20,
    bottom: 230,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    zIndex: 10000,
  },
  comboText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
