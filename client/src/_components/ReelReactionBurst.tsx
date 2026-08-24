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
  swayWidth: number;   // Horizontal drift & sway
  riseHeight: number;  // Vertical distance to float up
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
  chargeProgress?: number; // 0 to 1
  isHolding?: boolean;
  holdingType?: ReactionType | null;
  isMegaExploded?: boolean;
}

/**
 * Individual Floating Emoji Particle with organic drift towards center & buoyant rise
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
      // Pop scale in and gently settle
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
      // Opacity: Fade in quickly, then fade out
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

  // If Firework: Full screen radial explosive trajectory across entire viewport
  if (item.isFirework) {
    const angle = item.angle || 0;
    const speed = item.speed || 180;
    const targetX = Math.cos(angle) * speed;
    const targetY = Math.sin(angle) * speed + 80; // gravity curve

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

  // Floating Fountain Stream: drifts towards screen center as it rises
  const transY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -item.riseHeight],
  });

  // Drifts inwards towards left/center with sine wave sway
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
  const flashAnim = useRef(new Animated.Value(0)).current;
  const megaTextScale = useRef(new Animated.Value(0)).current;
  const megaTextOpacity = useRef(new Animated.Value(0)).current;

  // Combo badge animation
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

  // Mega Explosion screen flash & banner trigger
  useEffect(() => {
    if (isMegaExploded) {
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.sequence([
        Animated.parallel([
          Animated.spring(megaTextScale, {
            toValue: 1.25,
            friction: 4,
            useNativeDriver: true,
          }),
          Animated.timing(megaTextOpacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(600),
        Animated.parallel([
          Animated.timing(megaTextScale, {
            toValue: 1.6,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(megaTextOpacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [isMegaExploded, flashAnim, megaTextScale, megaTextOpacity]);

  const isLaugh = holdingType === 'laugh';
  const percentage = Math.min(100, Math.round(chargeProgress * 100));

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

      {/* Central Mega Banner on Blast */}
      <View style={styles.centerContainer}>
        <Animated.View
          style={[
            styles.megaCelebrationBadge,
            {
              backgroundColor: isLaugh ? 'rgba(245, 158, 11, 0.95)' : 'rgba(220, 38, 38, 0.95)',
              opacity: megaTextOpacity,
              transform: [{ scale: megaTextScale }],
            },
          ]}
        >
          <ExpoImage
            source={isLaugh ? require('@/assets/images/Laugh.png') : require('@/assets/images/Tomato.png')}
            style={styles.megaBadgeIcon}
            contentFit="contain"
          />
          <Text style={styles.megaCelebrationText}>
            {isLaugh ? 'MEGA LAUGH! 😂🔥' : 'TOMATO STORM! 🍅💥'}
          </Text>
        </Animated.View>
      </View>

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
  megaCelebrationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  megaBadgeIcon: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  megaCelebrationText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
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
