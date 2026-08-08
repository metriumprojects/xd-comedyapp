import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toggleUserPrivacy } from '../lib/firebaseHelpers';
import { useUser } from '@/src/_components/UserContext';
import AsyncStorage from '@/lib/storage';
import COLORS from '@/src/theme/colors';


export default function PrivacyScreen() {
  const authUser = useUser();
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');
  
  useEffect(() => {
    async function fetchPrivacy() {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) {
          console.log('[Privacy] No userId found');
          setDebugInfo('No user ID found');
          setLoading(false);
          return;
        }
        
        setLoading(true);
        console.log('[Privacy] Fetching profile for userId:', userId);
        // For now, assume public by default since getUserProfile is not available
        const privacyValue = false; // Default to public
        console.log('[Privacy] Set default isPrivate:', privacyValue);
        setIsPrivate(privacyValue);
        setDebugInfo(`Default: isPrivate=${privacyValue}`);
      } catch (error) {
        console.error('[Privacy] Error:', error);
        setDebugInfo('Error loading privacy data');
      }
      setLoading(false);
    }
    fetchPrivacy();
  }, []);

  const handleToggle = async (value: boolean) => {
    console.log('[Privacy] Toggle requested:', value);
    setIsPrivate(value);
    if (!authUser?.uid) {
      console.error('[Privacy] No authUser.uid');
      return;
    }
    
    const res = await toggleUserPrivacy(authUser.uid, value);
    console.log('[Privacy] Response:', res);
    
    if (!res.success) {
      console.error('[Privacy] Toggle failed:', res.error);
      Alert.alert('Error', res.error || 'Could not update privacy setting.');
      setIsPrivate(!value);
    } else {
      console.log('[Privacy] ✅ Toggle successful');
    }
  };

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator style={{ marginTop: 32 }} size="large" color={COLORS.primary} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Privacy Settings</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Private Account</Text>
          <Switch value={isPrivate} onValueChange={handleToggle} thumbColor={COLORS.primary} />
        </View>
        <Text style={styles.info}>
          {isPrivate
            ? 'Your account is private. Only approved followers can see your posts and send you messages.'
            : 'Your account is public. Anyone can see your posts and send you messages.'}
        </Text>
      </View>
      {debugInfo && (
        <View style={styles.debugCard}>
          <Text style={styles.debugText}>{debugInfo}</Text>
          <Text style={styles.debugText}>UID: {authUser?.uid?.substring(0, 10)}...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  header: { fontWeight: '700', fontSize: 24, color: COLORS.primary, marginBottom: 24, textAlign: 'center' },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, shadowColor: COLORS.black, shadowOpacity: 0.08, shadowRadius: 8, elevation: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, justifyContent: 'space-between' },
  label: { fontSize: 17, color: COLORS.textPrimary, fontWeight: '600' },
  info: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8, textAlign: 'center' },
  debugCard: { backgroundColor: COLORS.inputBg, borderRadius: 8, padding: 12, marginTop: 16, borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  debugText: { fontSize: 11, color: COLORS.textSecondary, marginVertical: 2, fontFamily: 'monospace' },
});