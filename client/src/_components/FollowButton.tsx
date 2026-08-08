import * as Haptics from 'expo-haptics';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import COLORS from '@/src/theme/colors';

interface FollowButtonProps {
  status: 'none' | 'pending' | 'approved';
  loading: boolean;
  onPress: () => void;
}

const FollowButton: React.FC<FollowButtonProps> = ({ status, loading, onPress }) => {
  let label = 'Follow';
  if (status === 'pending') label = 'Requested';
  if (status === 'approved') label = 'Following';

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      disabled={loading}
    >
      {loading ? <ActivityIndicator color={COLORS.textLight} /> : <Text style={styles.text}>{label}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    marginVertical: 8,
  },
  text: {
    color: COLORS.textLight,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default FollowButton;
