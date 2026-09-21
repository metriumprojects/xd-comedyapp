import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, Animated, ScrollView } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '@/src/theme/colors';

type DMInputProps = {
  input: string;
  setInput: (text: string) => void;
  onSend: () => void;
  onMediaPress: () => void;
  onCameraPress: () => void;
  onMicPressIn: () => void;
  onMicPressOut: () => void;
  recording: boolean;
  recordingDuration: number;
  micPulseAnim: Animated.Value;
  replyingTo: any;
  onCancelReply: () => void;
  editingMessage?: any;
  onCancelEdit?: () => void;
  sending: boolean;
};

const DMInput: React.FC<DMInputProps> = ({
  input,
  setInput,
  onSend,
  onMediaPress,
  onCameraPress,
  onMicPressIn,
  onMicPressOut,
  recording,
  recordingDuration,
  micPulseAnim,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  sending,
}) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <ScrollView 
      keyboardShouldPersistTaps="handled" 
      scrollEnabled={false} 
      style={{ backgroundColor: COLORS.background || '#fff', flexGrow: 0 }}
      contentContainerStyle={styles.container}
    >
      {editingMessage && (
        <View style={styles.editBar}>
          <View style={styles.editIconWrap}>
            <Ionicons name="pencil" size={15} color={COLORS.primary || '#FF6B00'} />
          </View>
          <View style={styles.replyContent}>
            <Text style={styles.editLabel}>Editing message</Text>
            <Text style={styles.replyText} numberOfLines={1}>{editingMessage.text || ''}</Text>
          </View>
          <TouchableOpacity onPress={onCancelEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.replyCloseBtn} accessibilityRole="button" accessibilityLabel="Cancel edit">
            <Ionicons name="close" size={18} color="#737373" />
          </TouchableOpacity>
        </View>
      )}

      {!editingMessage && replyingTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyIconWrap}>
            <Ionicons name="arrow-undo" size={15} color="#737373" />
          </View>
          <View style={styles.replyContent}>
            <Text style={styles.replyLabel} numberOfLines={1}>
              Replying to <Text style={styles.replyUsername}>{replyingTo.username || (replyingTo.senderId === 'self' ? 'yourself' : 'them')}</Text>
            </Text>
            <Text style={styles.replyText} numberOfLines={1}>{replyingTo.text}</Text>
          </View>
          <TouchableOpacity onPress={onCancelReply} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.replyCloseBtn} accessibilityRole="button" accessibilityLabel="Cancel reply">
            <Ionicons name="close" size={18} color="#737373" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        {!input.trim() && !recording && !editingMessage && (
          <TouchableOpacity style={styles.iconBtn} onPress={onCameraPress} accessibilityRole="button" accessibilityLabel="Open camera">
            <LinearGradient
              colors={['#FF6B00', '#FF8D00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cameraCircle}
            >
              <Feather name="camera" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={[styles.inputContainer, editingMessage && styles.inputContainerEditing]}>
          {recording ? (
            <View style={styles.recordingRow}>
              <Animated.View style={[styles.recordingDot, { opacity: micPulseAnim }]} />
              <Text style={styles.recordingText}>{formatDuration(recordingDuration)}</Text>
              <Text style={styles.recordingHint}>Recording...</Text>
            </View>
          ) : (
            <TextInput
              style={styles.textInput}
              placeholder={editingMessage ? 'Edit message...' : 'Message...'}
              placeholderTextColor="#8e8e8e"
              value={input}
              onChangeText={setInput}
              multiline
              autoFocus={!!editingMessage}
              accessibilityLabel={editingMessage ? 'Edit message' : 'Message'}
            />
          )}

          {!input.trim() && !recording && !editingMessage && (
            <View style={styles.rightIcons}>
              <TouchableOpacity style={styles.innerIcon} onPress={onMicPressIn} accessibilityRole="button" accessibilityLabel="Record voice message">
                <Feather name="mic" size={20} color={COLORS.textPrimary || '#1f2937'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.innerIcon} onPress={onMediaPress} accessibilityRole="button" accessibilityLabel="Attach photo or video">
                <Feather name="image" size={20} color={COLORS.textPrimary || '#1f2937'} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {(input.trim() || recording) && (
          <TouchableOpacity 
            style={styles.sendBtn} 
            onPress={recording ? onMicPressOut : onSend}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Send voice message' : (editingMessage ? 'Save edit' : 'Send message')}
            accessibilityState={{ disabled: sending, busy: sending }}
          >
            <LinearGradient
              colors={['#FF6B00', '#FF8D00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendCircle}
            >
              {sending ? (
                <Feather name="loader" size={18} color="#fff" />
              ) : editingMessage ? (
                <Ionicons name="checkmark" size={22} color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" style={styles.sendIcon} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderTopColor: '#efefef',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6f6f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: '#e8e8e8',
  },
  editBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: '#FFD4B2',
  },
  editIconWrap: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary || '#FF6B00',
  },
  replyIconWrap: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  replyLabel: {
    fontSize: 12,
    color: '#737373',
  },
  replyUsername: {
    fontWeight: '700',
    color: '#262626',
  },
  replyText: {
    fontSize: 13,
    color: '#555',
    marginTop: 1,
  },
  replyCloseBtn: {
    padding: 4,
    marginLeft: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    marginRight: 10,
  },
  cameraCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 24,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  inputContainerEditing: {
    borderWidth: 1,
    borderColor: COLORS.primary || '#FF6B00',
    backgroundColor: '#FFF9F5',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 10,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  innerIcon: {
    marginLeft: 14,
  },
  sendBtn: {
    marginLeft: 10,
  },
  sendCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    marginLeft: 2,
  },
  recordingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginRight: 10,
  },
  recordingHint: {
    fontSize: 14,
    color: '#8e8e8e',
  },
});

export default React.memo(DMInput);
