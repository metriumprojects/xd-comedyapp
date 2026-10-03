import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useUploadQueue } from '@/lib/useUploadQueue';
import COLORS from '@/src/theme/colors';
import { Feather, Ionicons } from '@expo/vector-icons';

export default function UploadProgressBanner() {
  const { tasks, removeTask, retryTask } = useUploadQueue();

  if (tasks.length === 0) return null;

  // Active task priority: currently uploading -> first pending -> latest error/success
  const activeTask =
    tasks.find((t) => t.status === 'uploading') ||
    tasks.find((t) => t.status === 'pending') ||
    tasks[0];

  if (!activeTask) return null;

  const isSuccess = activeTask.status === 'success';
  const isError = activeTask.status === 'error';
  const isUploading = activeTask.status === 'uploading' || activeTask.status === 'pending';
  const extraCount = tasks.length - 1;

  const getTitle = () => {
    if (isSuccess) return `${activeTask.type === 'story' ? 'Story' : 'Post'} uploaded!`;
    if (isError) return `Upload failed`;
    if (activeTask.mediaCount && activeTask.mediaCount > 1) {
      return `Uploading ${activeTask.mediaCount} photos...`;
    }
    return `Uploading ${activeTask.type}...`;
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.bannerPill}>
        {/* Left Status Icon */}
        <View style={styles.iconContainer}>
          {isUploading && <ActivityIndicator size="small" color={COLORS.primary} />}
          {isSuccess && <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />}
          {isError && <Ionicons name="alert-circle" size={18} color={COLORS.danger} />}
        </View>

        {/* Content & Progress */}
        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>
              {getTitle()}
            </Text>
            {extraCount > 0 && isUploading && (
              <View style={styles.queueBadge}>
                <Text style={styles.queueBadgeText}>+{extraCount}</Text>
              </View>
            )}
            {isUploading && (
              <Text style={styles.percentageText}>{Math.round(activeTask.progress)}%</Text>
            )}
          </View>
          {isUploading && (
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.max(3, Math.min(100, activeTask.progress))}%` },
                ]}
              />
            </View>
          )}
          {isError && (
            <Text style={styles.errorText} numberOfLines={1}>
              {activeTask.error || 'Tap retry or cancel'}
            </Text>
          )}
        </View>

        {/* Right Actions */}
        <View style={styles.actionContainer}>
          {isError && (
            <TouchableOpacity
              onPress={() => retryTask(activeTask.id)}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="refresh" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          {(isError || isSuccess) && (
            <TouchableOpacity
              onPress={() => removeTask(activeTask.id)}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={16} color="rgba(255, 255, 255, 0.7)" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  bannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 28, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  iconContainer: {
    marginRight: 8,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  queueBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 6,
  },
  queueBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  percentageText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 'auto',
    paddingLeft: 6,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginTop: 3,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  errorText: {
    fontSize: 11,
    color: COLORS.danger,
    marginTop: 2,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  actionBtn: {
    padding: 2,
  },
});
