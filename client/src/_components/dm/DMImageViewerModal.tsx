import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
  StatusBar,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type DMImageViewerModalProps = {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
};

const DMImageViewerModal: React.FC<DMImageViewerModalProps> = ({
  visible,
  imageUrl,
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(1);
      translateY.setValue(0);
      setScale(1);
    }
  }, [visible, scaleAnim, translateY]);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      const nextScale = scale > 1 ? 1 : 2.5;
      setScale(nextScale);
      Animated.spring(scaleAnim, {
        toValue: nextScale,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => {
          // Only allow drag dismiss when zoomed out (scale === 1)
          return scale <= 1 && Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx);
        },
        onPanResponderMove: (_, g) => {
          if (scale <= 1 && g.dy > 0) {
            translateY.setValue(g.dy);
          }
        },
        onPanResponderRelease: (_, g) => {
          if (scale <= 1 && (g.dy > 120 || g.vy > 0.6)) {
            Animated.timing(translateY, {
              toValue: SCREEN_HEIGHT,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              translateY.setValue(0);
              onClose();
            });
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              bounciness: 6,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [scale, onClose, translateY]
  );

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, 250],
    outputRange: [1, 0.2],
    extrapolate: 'clamp',
  });

  if (!visible || !imageUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Animated Dark Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />

      <View style={styles.container}>
        {/* Top Control Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close image"
          >
            <Ionicons name="close" size={28} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Gesture Area */}
        <Animated.View
          style={[
            styles.imageContainer,
            {
              transform: [
                { translateY },
                { scale: scaleAnim },
              ],
            },
          ]}
          {...panResponder.panHandlers}
          onTouchEnd={handleDoubleTap}
        >
          <ExpoImage
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="high"
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 20,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.85,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default React.memo(DMImageViewerModal);
