import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import AsyncStorage from '@/lib/storage';
import { resolveCanonicalUserId } from '../lib/currentUser';
import { HomeReelSkeleton } from '@/src/_components/HomeReelSkeleton';

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userId = await AsyncStorage.getItem('userId');

      if (token && userId) {
        const eulaAccepted = await AsyncStorage.getItem('eula_accepted_v2');
        if (eulaAccepted === 'true') {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/auth/eula-screen');
        }
        Promise.resolve()
          .then(() => resolveCanonicalUserId(userId))
          .catch(() => {});
      } else {
        router.replace('/auth/welcome');
      }
    } catch (error) {
      console.error('🔐 Auth check error:', error);
      router.replace('/auth/welcome');
    } finally {
      setChecking(false);
    }
  };

  if (!checking) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <HomeReelSkeleton />
    </View>
  );
}
