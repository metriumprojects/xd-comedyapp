import React, { useEffect, useRef, useState } from 'react';
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
  explodedType?: ReactionType | null; // Locked type at the moment of explosion
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
 * A single paint splatter droplet that animates outward on mount
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
    // Reset on mount
    anim.setValue(0);
    opacity.setValue(1);

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(350),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [anim, opacity, delay]);

  const targetX = Math.cos(angle) * distance;
  const targetY = Math.sin(angle) * distance + distance * 0.35;

  const transX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetX],
  });
  const transY = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, targetY * 0.2, targetY],
  });
  const dropScale = anim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.3, 1.4, 0.5],
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

/**
 * Full splatter burst that mounts fresh each time, with unique key so React re-creates it
 */
const SplatBurst: React.FC<{
  splatType: ReactionType;
}> = React.memo(({ splatType }) => {
  const isLaugh = splatType === 'laugh';
  const splatColor = isLaugh ? 'rgba(255, 200, 0, 0.85)' : 'rgba(220, 38, 38, 0.8)';

  // Generate fresh droplet data on each mount
  const droplets = useRef(
    Array.from({ length: 32 }).map((_, i) => ({
      id: i,
      angle: (i / 32) * 2 * Math.PI + (Math.random() - 0.5) * 0.5,
      distance: 60 + Math.random() * 180,
      delay: Math.random() * 60,
      size: 6 + Math.random() * 18,
    }))
  ).current;

  return (
    <View style={styles.centerContainer}>
      {droplets.map((d) => (
        <SplatDroplet
          key={d.id}
          angle={d.angle}
          distance={d.distance}
          color={splatColor}
          delay={d.delay}
          size={d.size}
        />
      ))}
    </View>
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
  explodedType = null,
}) => {
  const comboScale = useRef(new Animated.Value(0)).current;
  const comboOpacity = useRef(new Animated.Value(0)).current;
  const megaEmojiScale = useRef(new Animated.Value(0)).current;
  const megaEmojiOpacity = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Track active splat with unique key for re-mount
  const [activeSplat, setActiveSplat] = useState<{ key: number; type: ReactionType } | null>(null);

  // Use explodedType (locked at detonation) for the blast visuals, fallback to holdingType
  const blastType = explodedType || holdingType || 'laugh';
  const isLaugh = holdingType === 'laugh';
  const isBlastLaugh = blastType === 'laugh';
  const percentage = Math.min(100, Math.round(chargeProgress * 100));

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

  // Mega Explosion: Giant emoji grows → pops → paint splatters
  useEffect(() => {
    if (isMegaExploded && explodedType) {
      // Reset anims
      megaEmojiScale.setValue(0);
      megaEmojiOpacity.setValue(0);

      // 1. Screen flash
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();

      // 2. Giant emoji grows → holds → pops
      Animated.sequence([
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
        Animated.delay(280),
        Animated.parallel([
          Animated.timing(megaEmojiScale, {
            toValue: 5,
            duration: 220,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(megaEmojiOpacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // 3. Mount fresh SplatBurst at the moment the emoji pops (280ms + small buffer)
      setTimeout(() => {
        setActiveSplat({ key: Date.now(), type: explodedType });
      }, 350);

      // 4. Auto-clear splat after animation completes
      setTimeout(() => {
        setActiveSplat(null);
      }, 1600);
    }
  }, [isMegaExploded, explodedType, megaEmojiScale, megaEmojiOpacity, flashAnim]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Full Screen Flash Glow on Blast */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isBlastLaugh ? 'rgba(255, 215, 0, 0.25)' : 'rgba(239, 68, 68, 0.25)',
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
            source={isBlastLaugh ? require('@/assets/images/Laugh.png') : require('@/assets/images/Tomato.png')}
            style={{ width: 80, height: 80 }}
            contentFit="contain"
          />
        </Animated.View>
      </View>

      {/* Paint Splatter Droplets — mounted fresh each blast via unique key */}
      {activeSplat && (
        <SplatBurst key={activeSplat.key} splatType={activeSplat.type} />
      )}

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
