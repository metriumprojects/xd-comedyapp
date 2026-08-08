import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import COLORS from '@/src/theme/colors';

export function CenteredLoader({
  color = COLORS.primary,
  size = 'large',
}: {
  color?: string;
  size?: 'small' | 'large';
}) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

