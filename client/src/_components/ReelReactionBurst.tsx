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
  swayWidth: number;
  riseHeight: number;
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
  chargeProgress?: number;
  isHolding?: boolean;
  holdingType?: ReactionType | null;
  isMegaExploded?: boolean;
}

/**
 * Individual Floating Emoji Particle
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
  const scale = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: item.duration,
        easing: item.isFirework ? Easing.out(Easing.cubic) : Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(scale, {
          toValue: item.scale,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: item.scale * (item.isFirework ? 0.7 : 0.85),
          duration: item.duration * 0.6,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: item.isFirework ? 100 : 180,
          useNativeDriver: true,
        }),
        Animated.delay(item.duration * 0.45),
        Animated.timing(opacity, {
          toValue: 0,
          duration: item.duration * 0.55,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete(item.id);
    });
  }, [item, progress, opacity, scale, onComplete]);

  // Firework: radial burst
  if (item.isFirework) {
    const angle = item.angle || 0;
    const speed = item.speed || 180;
    const targetX = Math.cos(angle) * speed;
    const targetY = Math.sin(angle) * speed + 80;

    const transX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, targetX],
    });
    const transY = progress.interpolate({
      inputRange: [0, 0.35, 1],
      outputRange: [0, targetY * 0.35, targetY],
    });

    const rotateStr = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [`${item.rotation}deg`, `${item.rotation + 180}deg`],
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
              { rotate: rotateStr },
            ],
          },
        ]}
      >
        <ExpoImage source={imgSource} style={{ width: size, height: size }} contentFit="contain" />
      </Animated.View>
    );
  }

  // Standard: floating fountain drift inwards
  const transY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -item.riseHeight],
  });
  const transX = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [
      0,
      -item.swayWidth * 0.5,
      -item.swayWidth * 1.2,
      -item.swayWidth * 0.8,
      -item.swayWidth * 1.5,
    ],
  });
  const rotateStr = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      `${item.rotation - 10}deg`,
      `${item.rotation + 18}deg`,
      `${item.rotation - 12}deg`,
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

/**
 * Splatter droplet that flies outward from the centre splat point
 */
const SplatDroplet: React.FC<{
  angle: number;
  distance: number;
  color: string;
  delay: number;
  size: number;
}> = React.memo(({ angle, distance, color, delay, size }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [anim, opacity, delay]);

  const targetX = Math.cos(angle) * distance;
  const targetY = Math.sin(angle) * distance + distance * 0.4; // gravity curve

  const transX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetX],
  });
  const transY = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, targetY * 0.2, targetY],
  });
  const dropScale = anim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.3, 1.2, 0.6],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateX: transX }, { translateY: transY }, { scale: dropScale }],
      }}
    />
  );
});

export const ReelReactionBurst: React.FC<ReelReactionBurstProps> = ({
  particles,
  onParticleComplete,
  comboCount = 0,
  chargeProgress = 0,
  isHolding = false,
  holdingType = null,
  isMegaExploded = false,
}) => {
  const comboScale = useRef(new Animated.Value(0)).current;
  const comboOpacity = useRef(new Animated.Value(0)).current;

  // Giant central emoji: grows then pops & splatters
  const megaEmojiScale = useRef(new Animated.Value(0)).current;
  const megaEmojiOpacity = useRef(new Animated.Value(0)).current;
  const splatOpacity = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  const isLaugh = holdingType === 'laugh';
  const percentage = Math.min(100, Math.round(chargeProgress * 100));

  // Generate splatter droplets data
  const splatDroplets = useRef(
    Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      angle: (i / 28) * 2 * Math.PI + (Math.random() - 0.5) * 0.5,
      distance: 80 + Math.random() * 160,
      delay: Math.random() * 80,
      size: 8 + Math.random() * 16,
    }))
  ).current;

  // Combo badge
  useEffect(() => {
    if (isHolding && comboCount > 1) {
      Animated.parallel([
        Animated.spring(comboScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
        Animated.timing(comboOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(comboScale, { toValue: 0.7, duration: 200, useNativeDriver: true }),
        Animated.timing(comboOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [isHolding, comboCount, comboScale, comboOpacity]);

  // Mega Explosion: Giant emoji grows → pops → splatters as colored paint
  useEffect(() => {
    if (isMegaExploded) {
      // Reset
      megaEmojiScale.setValue(0);
      megaEmojiOpacity.setValue(0);
      splatOpacity.setValue(0);

      // 1. Screen flash
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();

      // 2. Giant emoji grows to massive size then pops
      Animated.sequence([
        // Grow in
        Animated.parallel([
          Animated.spring(megaEmojiScale, {
            toValue: 2.8,
            friction: 4,
            tension: 30,
            useNativeDriver: true,
          }),
          Animated.timing(megaEmojiOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        // Hold briefly at peak
        Animated.delay(250),
        // Pop out: scale up more + fade out quickly
        Animated.parallel([
          Animated.timing(megaEmojiScale, {
            toValue: 4.5,
            duration: 250,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(megaEmojiOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // 3. Paint splatter appears when emoji pops (slight delay)
      Animated.sequence([
        Animated.delay(350),
        Animated.timing(splatOpacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.delay(500),
        Animated.timing(splatOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isMegaExploded, megaEmojiScale, megaEmojiOpacity, splatOpacity, flashAnim]);

  const splatColor = isLaugh ? 'rgba(255, 200, 0, 0.8)' : 'rgba(220, 38, 38, 0.75)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Full Screen Flash Glow on Blast */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isLaugh ? 'rgba(255, 215, 0, 0.25)' : 'rgba(239, 68, 68, 0.25)',
            opacity: flashAnim,
          },
        ]}
      />

      {/* Giant Central Emoji that Grows and Pops */}
      <View style={styles.centerContainer}>
        <Animated.View
          style={{
            opacity: megaEmojiOpacity,
            transform: [{ scale: megaEmojiScale }],
          }}
        >
          <ExpoImage
            source={isLaugh ? require('@/assets/images/Laugh.png') : require('@/assets/images/Tomato.png')}
            style={{ width: 80, height: 80 }}
            contentFit="contain"
          />
        </Animated.View>
      </View>

      {/* Paint Splatter Droplets flying outward from center */}
      <Animated.View style={[styles.centerContainer, { opacity: splatOpacity }]}>
        {splatDroplets.map((d) => (
          <SplatDroplet
            key={d.id}
            angle={d.angle}
            distance={d.distance}
            color={splatColor}
            delay={d.delay}
            size={d.size}
          />
        ))}
      </Animated.View>

      {/* Floating Combo & Charge Meter Badge during Press & Hold */}
      {isHolding && comboCount > 1 && !isMegaExploded && (
        <Animated.View
          style={[
            styles.comboBadge,
            {
              backgroundColor: isLaugh
                ? 'rgba(245, 158, 11, 0.95)'
                : 'rgba(239, 68, 68, 0.95)',
              opacity: comboOpacity,
              transform: [{ scale: comboScale }],
            },
          ]}
        >
          <Text style={styles.comboText}>
            {isLaugh ? '😂 +' : '🍅 +'}{comboCount}
          </Text>
          <View style={styles.chargeProgressBarTrack}>
            <View
              style={[
                styles.chargeProgressBarFill,
                { width: `${percentage}%` },
              ]}
            />
          </View>
        </Animated.View>
      )}

      {/* Render all stream & firework particles */}
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
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  comboBadge: {
    position: 'absolute',
    right: 20,
    bottom: 230,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    zIndex: 10000,
  },
  comboText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  chargeProgressBarTrack: {
    width: 60,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  chargeProgressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
});
