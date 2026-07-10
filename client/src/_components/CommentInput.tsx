import React, { useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

interface CommentInputProps {
  newComment: string;
  setNewComment: (val: string | ((prev: string) => string)) => void;
  replyTo: { id: string; userName: string } | null;
  resolvedCurrentAvatar: string;
  isSubmitting: boolean;
  onAddComment: () => void;
  quickEmojis: string[];
}

export const CommentInput: React.FC<CommentInputProps> = ({
  newComment,
  setNewComment,
  replyTo,
  resolvedCurrentAvatar,
  isSubmitting,
  onAddComment,
  quickEmojis,
}) => {
  const inputRef = useRef<TextInput>(null);

  const handlePost = () => {
    if (!newComment.trim() || isSubmitting) return;
    onAddComment();
    // Keep keyboard open after posting
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <View>
      <View style={styles.quickEmojiBar}>
        {quickEmojis.map(emoji => (
          <TouchableOpacity key={emoji} onPress={() => setNewComment(prev => prev + emoji)}>
            <Text style={{ fontSize: 24 }}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.inputArea}>
        <ExpoImage source={{ uri: resolvedCurrentAvatar }} style={styles.inputAvatar} />
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={replyTo ? `Reply to ${replyTo.userName}...` : "Add a comment..."}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            blurOnSubmit={false}
          />
          <TouchableOpacity onPress={handlePost} disabled={isSubmitting || !newComment.trim()}>
            <Text style={[styles.postBtn, (!newComment.trim() || isSubmitting) && { opacity: 0.4 }]}>Post</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  quickEmojiBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  inputArea: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 8, alignItems: 'center' },
  inputAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  inputWrapper: { flex: 1, flexDirection: 'row', backgroundColor: '#f0f2f5', borderRadius: 25, paddingHorizontal: 15, alignItems: 'center', minHeight: 45 },
  input: { flex: 1, fontSize: 14, color: '#333', paddingVertical: 8 },
  postBtn: { color: '#0095f6', fontWeight: '700', marginLeft: 10, fontSize: 14 },
});
