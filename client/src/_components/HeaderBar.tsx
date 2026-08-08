import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import COLORS from '@/src/theme/colors';

const HeaderBar = ({ title }: { title: string }) => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    paddingTop: 32,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
});

export default HeaderBar;
