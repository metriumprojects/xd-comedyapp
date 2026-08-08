import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import COLORS from '@/src/theme/colors';

const ErrorMessage = ({ message }: { message: string }) => (
  <View style={styles.container}>
    <Text style={styles.text}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 8,
    margin: 8,
  },
  text: {
    color: COLORS.danger,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ErrorMessage;
