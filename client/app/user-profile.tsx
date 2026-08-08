import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@/lib/storage';
import Profile from './(tabs)/profile';
import COLORS from '@/src/theme/colors';

// Wrapper route so viewing another user's profile doesn't activate the bottom Profile tab.
// Also add safe-area and vertical spacing so content is not flush to edges.
export default function UserProfileWrapper() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserFirebaseUid, setCurrentUserFirebaseUid] = useState<string | null>(null);
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);

  // Get current user ID and aliases
  useEffect(() => {
    const getUserId = async () => {
      try {
        const [storedUserId, storedFirebaseUid, storedUid] = await Promise.all([
          AsyncStorage.getItem('userId'),
          AsyncStorage.getItem('firebaseUid'),
          AsyncStorage.getItem('uid'),
        ]);
        setCurrentUserId(storedUserId);
        setCurrentUserFirebaseUid(storedFirebaseUid);
        setCurrentUserUid(storedUid);
      } catch (error) {
        console.error('Failed to get user IDs:', error);
      }
    };
    getUserId();
  }, []);

  const userId = typeof params.id === 'string' ? params.id : (typeof params.uid === 'string' ? params.uid : undefined);

  // If viewing own profile, redirect to main profile tab
  useEffect(() => {
    if (userId) {
      const isSelf = 
        (currentUserId && String(userId) === String(currentUserId)) ||
        (currentUserFirebaseUid && String(userId) === String(currentUserFirebaseUid)) ||
        (currentUserUid && String(userId) === String(currentUserUid));
      
      if (isSelf) {
        router.replace('/(tabs)/profile');
      }
    }
  }, [currentUserId, currentUserFirebaseUid, currentUserUid, userId, router]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
      <View style={{ flex: 1 }}>
        <Profile userIdProp={userId} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
});
