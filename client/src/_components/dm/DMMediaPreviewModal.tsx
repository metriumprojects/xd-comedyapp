import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import COLORS from '@/src/theme/colors';
import { DEFAULT_AVATAR_URL } from '@/lib/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DMMediaPreviewModalProps {
  visible: boolean;
  media: { uri: string; type: 'image' | 'video' } | null;
  recipientName?: string;
  recipientAvatar?: string | null;
  onClose: () => void;
  onSend: (caption: string) => void;
}

const VideoPreviewStage: React.FC<{
  videoUri: string;
  isMuted: boolean;
  onToggleMute: () => void;
}> = ({ videoUri, isMuted, onToggleMute }) => {
  const [isPlaying, setIsPlaying] = useState(true);

  const player = useVideoPlayer(videoUri || '', (p) => {
    p.loop = true;
    p.muted = isMuted;
    if (videoUri) p.play();
  });

  useEffect(() => {
    if (player) {
      player.muted = isMuted;
    }
  }, [player, isMuted]);

  useEffect(() => {
    if (!player) return;
    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, isPlaying]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  return (
    <Pressable style={styles.videoStagePressable} onPress={handleTogglePlay}>
      <VideoView
        player={player}
        style={styles.fullMedia}
        contentFit="contain"
        nativeControls={false}
      />
      {!isPlaying && (
        <View style={styles.centerPlayOverlay}>
          <View style={styles.playIconCircle}>
            <Ionicons name="play" size={36} color="#FFFFFF" style={{ marginLeft: 3 }} />
          </View>
        </View>
      )}
    </Pressable>
  );
};

export const DMMediaPreviewModal: React.FC<DMMediaPreviewModalProps> = ({
  visible,
  media,
  recipientName = 'Chat',
  recipientAvatar,
  onClose,
  onSend,
}) => {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setCaption('');
      setIsMuted(false);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
  }, [onClose]);

  const handleSend = useCallback(() => {
    if (!media) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const finalCaption = caption.trim();
    onSend(finalCaption);
  }, [media, caption, onSend]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  if (!visible || !media) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0B0E" />

        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Recipient Pill */}
          <View style={styles.recipientPill}>
            <ExpoImage
              source={{ uri: recipientAvatar || DEFAULT_AVATAR_URL }}
              style={styles.recipientAvatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <Text style={styles.recipientNameText} numberOfLines={1}>
              {recipientName}
            </Text>
          </View>

          {/* Video Mute Toggle or Placeholder */}
          {media.type === 'video' ? (
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={handleToggleMute}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons
                name={isMuted ? 'volume-mute' : 'volume-high'}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerIconButtonPlaceholder} />
          )}
        </View>

        {/* Media Center Stage */}
        <View style={styles.mediaStage}>
          {media.type === 'image' ? (
            <ExpoImage
              source={{ uri: media.uri }}
              style={styles.fullMedia}
              contentFit="contain"
              cachePolicy="memory-disk"
              priority="high"
            />
          ) : (
            <VideoPreviewStage
              videoUri={media.uri}
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
            />
          )}
        </View>

        {/* Bottom Caption & Send Bar */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.bottomBarWrapper}>
            <View style={styles.captionInputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.captionInput}
                placeholder="Add a caption..."
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={500}
                returnKeyType="default"
              />

              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSend}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={COLORS.primaryGradient || ['#FF6B00', '#FFA000']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendButtonGradient}
                >
                  <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default React.memo(DMMediaPreviewModal);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0E',
    justifyContent: 'space-between',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  recipientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: SCREEN_WIDTH * 0.55,
  },
  recipientAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  recipientNameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  mediaStage: {
    flex: 1,
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  fullMedia: {
    width: '100%',
    height: '100%',
  },
  videoStagePressable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  bottomBarWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(11, 11, 14, 0.95)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  captionInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 4,
    minHeight: 48,
  },
  captionInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    maxHeight: 90,
    paddingVertical: 6,
  },
  sendButton: {
    marginLeft: 8,
    borderRadius: 18,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
