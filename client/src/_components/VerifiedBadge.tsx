import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import COLORS from '@/src/theme/colors';

interface VerifiedBadgeProps {
  size?: number;
  color?: string;
}

// Shield with checkmark - using Ionicons shield-checkmark
export default function VerifiedBadge({ size = 16, color = COLORS.textPrimary }: VerifiedBadgeProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Ionicons name="shield-checkmark" size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
