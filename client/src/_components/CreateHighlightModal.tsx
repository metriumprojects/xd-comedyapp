import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDialog } from '@/src/_components/AppDialogProvider';
import { createHighlight, uploadImage, getUserStories } from '../../lib/firebaseHelpers/index';
import { getKeyboardOffset } from '../../utils/responsive';
import { getVideoThumbnailUrl } from '../../lib/imageHelpers';
import COLORS from '@/src/theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CreateHighlightModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  onSuccess?: () => void;
  defaultCoverUri?: string;
  initialName?: string;
  storyToInclude?: string;
}

export default function CreateHighlightModal({
  visible,
  onClose,
  userId,
  onSuccess,
  defaultCoverUri,
  initialName = '',
  storyToInclude,
}: CreateHighlightModalProps) {
  const insets = useSafeAreaInsets();
  const { showSuccess } = useAppDialog();
  const [name, setName] = useState(initialName);
  const [coverImage, setCoverImage] = useState<string | null>(defaultCoverUri || null);
  const [visibility, setVisibility] = useState('Public');
  const [loading, setLoading] = useState(false);

  const [stories, setStories] = useState<any[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(new Set());

  const resolveStoryThumbnail = (story: any) => {
    if (!story) return '';
    const isVideo = story.mediaType === 'video' || !!story.video || !!story.videoUrl;
    if (isVideo) {
      const videoUrl = story.videoUrl || story.video || '';
      const posterUrl = story.thumbnail || story.thumbnailUrl || (story.imageUrl !== story.videoUrl ? story.imageUrl : '') || story.image || '';
      return getVideoThumbnailUrl(videoUrl, posterUrl);
    }
    return story.imageUrl || story.image || '';
  };

  useEffect(() => {
    if (visible && userId) {
      const fetchStories = async () => {
        setLoadingStories(true);
        try {
          const res = await getUserStories(userId);
          if (res.success && res.stories) {
            setStories(res.stories);
            // If storyToInclude is specified, select it automatically
            if (storyToInclude) {
              setSelectedStoryIds(new Set([storyToInclude]));
              const includedStory = res.stories.find((s: any) => String(s.id || s._id) === String(storyToInclude));
              if (includedStory) {
                const previewUrl = resolveStoryThumbnail(includedStory);
                if (previewUrl) {
                  setCoverImage(previewUrl);
                }
              }
            }
          }
        } catch (error) {
          console.error('[CreateHighlightModal] Error fetching user stories:', error);
        } finally {
          setLoadingStories(false);
        }
      };
      fetchStories();
    } else {
      setStories([]);
      setSelectedStoryIds(new Set());
      if (!defaultCoverUri) setCoverImage(null);
    }
  }, [visible, userId, storyToInclude, defaultCoverUri]);

  const toggleStory = (storyId: string, mediaUrl: string) => {
    const nextSelected = new Set(selectedStoryIds);
    if (nextSelected.has(storyId)) {
      nextSelected.delete(storyId);
      if (coverImage === mediaUrl) {
        if (nextSelected.size > 0) {
          const firstId = Array.from(nextSelected)[0];
          const firstStory = stories.find(s => String(s.id || s._id) === firstId);
          if (firstStory) {
            setCoverImage(resolveStoryThumbnail(firstStory));
          }
        } else {
          setCoverImage(null);
        }
      }
    } else {
      nextSelected.add(storyId);
      if (!coverImage || nextSelected.size === 1) {
        setCoverImage(mediaUrl);
      }
    }
    setSelectedStoryIds(nextSelected);
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setCoverImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleVisibilitySelect = () => {
    Alert.alert(
      'Highlight Visibility',
      'Choose who can see this highlight',
      [
        { text: 'Public', onPress: () => setVisibility('Public') },
        { text: 'Private', onPress: () => setVisibility('Private') },
        { text: 'Friends', onPress: () => setVisibility('Friends') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const isSubmittingRef = React.useRef(false);

  const handleCreate = async () => {
    if (loading || isSubmittingRef.current) return;

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a highlight name');
      return;
    }

    if (selectedStoryIds.size === 0) {
      Alert.alert('Error', 'Please select at least one story to include in the highlight');
      return;
    }

    if (!coverImage) {
      Alert.alert('Error', 'Please select a cover image or select stories to set a cover image');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      let finalCoverUrl = coverImage;
      
      // If coverImage is a local URI, upload it
      if (coverImage.startsWith('file://')) {
        const imagePath = `highlights/${userId}/${Date.now()}.jpg`;
        const uploadResult = await uploadImage(coverImage, imagePath);
        if (!uploadResult.success) throw new Error(uploadResult.error);
        finalCoverUrl = uploadResult.url || '';
      }

      // Create highlight with visibility
      const initialStoryIds = Array.from(selectedStoryIds);
      const result = await createHighlight(userId, name, finalCoverUrl, initialStoryIds, visibility);

      if (result.success) {
        showSuccess('Highlight created successfully!');
        setName('');
        setCoverImage(null);
        setVisibility('Public');
        onSuccess?.();
        onClose();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create highlight');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const renderStoriesGrid = () => {
    if (loadingStories) {
      return (
        <View style={{ marginVertical: 35, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={{ marginTop: 8, color: COLORS.textMuted, fontSize: 13 }}>Loading archive...</Text>
        </View>
      );
    }
    if (stories.length === 0) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 35, marginTop: 20 }}>
          <Ionicons name="images-outline" size={40} color={COLORS.border} />
          <Text style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 10, textAlign: 'center' }}>No stories available to add to highlights.</Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center', paddingHorizontal: 20 }}>Only uploaded stories can be saved to your highlights.</Text>
        </View>
      );
    }

    const itemWidth = (SCREEN_WIDTH - 40 - 16) / 3; // 40 horizontal padding, 16 gap
    return (
      <View style={{ marginTop: 24, paddingTop: 20 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 }}>Select Stories</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {stories.map((story) => {
            const storyId = String(story.id || story._id);
            const mediaUrl = resolveStoryThumbnail(story);
            const isSelected = selectedStoryIds.has(storyId);
            return (
              <TouchableOpacity
                key={storyId}
                activeOpacity={0.8}
                onPress={() => toggleStory(storyId, mediaUrl)}
                style={{
                  width: itemWidth,
                  height: itemWidth * 1.3,
                  borderRadius: 8,
                  overflow: 'hidden',
                  backgroundColor: COLORS.surface,
                  borderWidth: isSelected ? 3 : 0,
                  borderColor: COLORS.info,
                  position: 'relative',
                  marginBottom: 8,
                }}
              >
                <Image source={{ uri: mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                
                {/* Checkbox overlay */}
                <View style={{ 
                  position: 'absolute', 
                  top: 6, 
                  right: 6, 
                  backgroundColor: isSelected ? COLORS.info : 'rgba(0,0,0,0.3)', 
                  borderRadius: 10, 
                  width: 20, 
                  height: 20, 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  borderWidth: isSelected ? 0 : 1.5,
                  borderColor: COLORS.textLight
                }}>
                  {isSelected && <Ionicons name="checkmark" size={12} color={COLORS.textLight} />}
                </View>

                {story.mediaType === 'video' && (
                  <View style={{ position: 'absolute', bottom: 6, left: 6 }}>
                    <Ionicons name="play" size={14} color={COLORS.textLight} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        {/* Full-screen dark backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.keyboardAvoidingView}>
          <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />

          <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            {/* Solid white background extension below container */}
            <View style={styles.bottomSolidExtension} />
            <View style={styles.handle} />

            {/* Custom Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} disabled={loading}>
                <Text style={styles.headerActionText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>New highlight</Text>
              <TouchableOpacity onPress={handleCreate} disabled={loading || !name.trim() || selectedStoryIds.size === 0}>
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={[styles.headerActionText, styles.headerSaveText, (name.trim() && selectedStoryIds.size > 0) && { color: COLORS.info, fontWeight: '700' }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 30) }}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
              keyboardDismissMode="on-drag"
            >
              {/* Central Cover Preview */}
              <TouchableOpacity style={styles.coverContainer} onPress={handlePickImage}>
                {coverImage ? (
                  <Image source={{ uri: coverImage }} style={styles.coverImage} />
                ) : (
                  <View style={styles.placeholderCover}>
                    <Ionicons name="image-outline" size={48} color={COLORS.border} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Inputs & Settings */}
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Highlight name"
                  placeholderTextColor={COLORS.textMuted}
                  value={name}
                  onChangeText={setName}
                  maxLength={30}
                />
              </View>

              <TouchableOpacity style={styles.settingBtn} onPress={handleVisibilitySelect}>
                <View style={styles.settingLeft}>
                  <Ionicons name="eye-outline" size={22} color={COLORS.black} />
                  <Text style={styles.settingText}>Visibility</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: COLORS.info, fontSize: 15, marginRight: 8, fontWeight: '500' }}>{visibility}</Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </View>
              </TouchableOpacity>

              {/* Stories Picker Grid */}
              {renderStoriesGrid()}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  container: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: SCREEN_HEIGHT * 0.88,
    position: 'relative',
  },
  bottomSolidExtension: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    height: 600,
    backgroundColor: COLORS.background,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerActionText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  headerSaveText: {
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  coverContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 25,
    backgroundColor: COLORS.inputBg,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  input: {
    height: 50,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  settingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    marginLeft: 15,
    fontWeight: '500',
  },
});



