import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ReactionType = 'laugh' | 'tomato';

interface Particle {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  scale: number;
  rotation: string;
  duration: number;
  anim: Animated.Value;
  opacity: Animated.Value;
}

interface ReelReactionBurstProps {
  type: ReactionType;
  level: 'mini' | 'medium' | 'mega'; // 0.5s -> mini, 1.0s -> medium, 1.5s+ -> mega
  originY?: number; // Y position of the reaction button
  onComplete?: () => void;
}

export const ReelReactionBurst: React.FC<ReelReactionBurstProps> = ({
  type,
  level,
  originY = SCREEN_HEIGHT * 0.65,
  onComplete,
}) => {
  const isLaugh = type === 'laugh';
  const sourceImg = isLaugh
    ? require('@/assets/images/Laugh.png')
    : require('@/assets/images/Tomato.png');

  // Flash background overlay for mega burst
  const flashAnim = useRef(new Animated.Value(0)).current;
  const megaBadgeScale = useRef(new Animated.Value(0)).current;
  const megaBadgeOpacity = useRef(new Animated.Value(0)).current;

  // Generate particles based on level
  const particleCount = level === 'mega' ? 24 : level === 'medium' ? 10 : 5;

  const particles = useRef<Particle[]>(
    Array.from({ length: particleCount }).map((_, i) => {
      const isMega = level === 'mega';
      const startX = SCREEN_WIDTH - 50;
      const startY = originY;

      // Target positions
      let targetX = startX - 30 - Math.random() * 80;
      let targetY = startY - 80 - Math.random() * 120;

      if (isMega) {
        // Explode across the entire screen
        targetX = Math.random() * (SCREEN_WIDTH - 60) + 30;
        targetY = Math.random() * (SCREEN_HEIGHT * 0.7) + 50;
      }

      const randomRot = `${(Math.random() - 0.5) * 360}deg`;
      const randomScale = isMega ? 0.8 + Math.random() * 0.9 : 0.5 + Math.random() * 0.5;
      const duration = isMega ? 1200 + Math.random() * 400 : 700 + Math.random() * 300;

      return {
        id: i,
        startX,
        startY,
        targetX,
        targetY,
        scale: randomScale,
        rotation: randomRot,
        duration,
        anim: new Animated.Value(0),
        opacity: new Animated.Value(1),
      };
    })
  ).current;

  useEffect(() => {
    // 1. Animate particles
    const particleAnimations = particles.map((p) => {
      return Animated.parallel([
        Animated.timing(p.anim, {
          toValue: 1,
          duration: p.duration,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(p.duration * 0.5),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: p.duration * 0.5,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    const allAnims: Animated.CompositeAnimation[] = [Animated.stagger(30, particleAnimations)];

    // 2. If mega level, animate flash and center badge
    if (level === 'mega') {
      allAnims.push(
        Animated.sequence([
          Animated.timing(flashAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(flashAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );

      allAnims.push(
        Animated.sequence([
          Animated.parallel([
            Animated.spring(megaBadgeScale, {
              toValue: 1.2,
              friction: 4,
              useNativeDriver: true,
            }),
            Animated.timing(megaBadgeOpacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(500),
          Animated.parallel([
            Animated.timing(megaBadgeScale, {
              toValue: 1.6,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(megaBadgeOpacity, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
    }

    Animated.parallel(allAnims).start(() => {
      onComplete?.();
    });
  }, [level, onComplete, particles, flashAnim, megaBadgeScale, megaBadgeOpacity]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Mega Screen Glow Flash */}
      {level === 'mega' && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isLaugh ? 'rgba(255, 215, 0, 0.15)' : 'rgba(239, 68, 68, 0.18)',
              opacity: flashAnim,
            },
          ]}
        />
      )}

      {/* Mega Central Reaction Badge */}
      {level === 'mega' && (
        <View style={styles.centerContainer}>
          <Animated.View
            style={[
              styles.megaBadge,
              {
                backgroundColor: isLaugh ? 'rgba(245, 158, 11, 0.95)' : 'rgba(220, 38, 38, 0.95)',
                opacity: megaBadgeOpacity,
                transform: [{ scale: megaBadgeScale }],
              },
            ]}
          >
            <ExpoImage source={sourceImg} style={styles.megaBadgeIcon} contentFit="contain" />
            <Text style={styles.megaBadgeText}>
              {isLaugh ? 'MEGA LAUGH! 😂' : 'TOMATO STORM! 🍅'}
            </Text>
          </Animated.View>
        </View>
      )}

      {/* Floating Particles */}
      {particles.map((p) => {
        const transX = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [p.startX, p.targetX],
        });
        const transY = p.anim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [p.startY, p.targetY * 0.9, p.targetY],
        });

        const iconSize = 34 * p.scale;

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                opacity: p.opacity,
                transform: [
                  { translateX: transX },
                  { translateY: transY },
                  { scale: p.scale },
                  { rotate: p.rotation },
                ],
              },
            ]}
          >
            <ExpoImage
              source={sourceImg}
              style={{ width: iconSize, height: iconSize }}
              contentFit="contain"
            />
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 9999,
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  megaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  megaBadgeIcon: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  megaBadgeText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
