import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '@/hooks/useOffline';
import { feedEventEmitter } from '@/lib/feedEventEmitter';
import * as Haptics from 'expo-haptics';

export default function InstagramOfflineToast() {
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetworkStatus();
  const [visible, setVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('No Internet Connection');
  const [toastType, setToastType] = useState<'offline' | 'online'>('offline');

  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevOnlineRef = useRef<boolean | null>(isOnline);

  const showToast = (message = 'No Internet Connection', type: 'offline' | 'online' = 'offline', duration = 3200) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setToastMessage(message);
    setToastType(type);
    setVisible(true);

    if (type === 'offline') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 14,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    hideTimerRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  };

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 60,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  };

  // Listen to network status changes
  useEffect(() => {
    if (prevOnlineRef.current === true && isOnline === false) {
      showToast('No Internet Connection', 'offline', 3200);
    } else if (prevOnlineRef.current === false && isOnline === true) {
      showToast('Back Online', 'online', 2000);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  // Listen to manual triggers (e.g. pull to refresh while offline)
  useEffect(() => {
    const unsub = feedEventEmitter.onFeedUpdate((event: any) => {
      if (event?.type === 'OFFLINE_REFRESH_ATTEMPT' || event?.type === 'SHOW_OFFLINE_TOAST') {
        showToast(event.message || 'No Internet Connection', 'offline', 3000);
      }
    });
    return () => unsub();
  }, []);

  if (!visible) return null;

  const isBackOnline = toastType === 'online';

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toastContainer,
        {
          bottom: Math.max(insets.bottom, 12) + 60, // Positioned right above the bottom tab bar
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={[styles.toastPill, isBackOnline && styles.toastPillOnline]}>
        <Ionicons
          name={isBackOnline ? "checkmark-circle" : "alert-circle-outline"}
          size={20}
          color={isBackOnline ? "#4ADE80" : "#FFFFFF"}
        />
        <Text style={styles.toastText}>{toastMessage}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(38, 38, 38, 0.95)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  toastPillOnline: {
    backgroundColor: 'rgba(22, 101, 52, 0.95)',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
    letterSpacing: -0.1,
  },
});
