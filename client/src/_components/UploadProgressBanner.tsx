import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useUploadQueue } from '@/lib/useUploadQueue';
import COLORS from '@/src/theme/colors';
import { Feather, Ionicons } from '@expo/vector-icons';

export default function UploadProgressBanner() {
  const { tasks, removeTask, retryTask } = useUploadQueue();

  if (tasks.length === 0) return null;

  return (
    <View style={styles.container}>
      {tasks.map((task) => {
        const isSuccess = task.status === 'success';
        const isError = task.status === 'error';
        const isUploading = task.status === 'uploading' || task.status === 'pending';

        return (
          <View key={task.id} style={styles.bannerRow}>
            {/* Left Icon */}
            <View style={styles.iconContainer}>
              {isUploading && <ActivityIndicator size="small" color={COLORS.primary} />}
              {isSuccess && <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />}
              {isError && <Ionicons name="alert-circle" size={24} color={COLORS.danger} />}
            </View>

            {/* Middle Text */}
            <View style={styles.textContainer}>
              <Text style={styles.title}>
                {isUploading && `Uploading ${task.type}...`}
                {isSuccess && `${task.type} uploaded successfully!`}
                {isError && `Failed to upload ${task.type}`}
              </Text>
              {isUploading && (
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${task.progress}%` }]} />
                </View>
              )}
              {isError && <Text style={styles.errorText} numberOfLines={1}>{task.error}</Text>}
            </View>

            {/* Right Action */}
            <View style={styles.actionContainer}>
              {isError && (
                <TouchableOpacity onPress={() => retryTask(task.id)} style={styles.actionBtn}>
                  <Ionicons name="refresh" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              )}
              {(isError || isSuccess) && (
                <TouchableOpacity onPress={() => removeTask(task.id)} style={styles.actionBtn}>
                  <Feather name="x" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 8,
  },
  iconContainer: {
    marginRight: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 2,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    padding: 4,
  }
});
