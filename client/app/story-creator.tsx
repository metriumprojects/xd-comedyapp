import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    LayoutAnimation,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    Alert,
} from 'react-native';
import { safeRouterBack } from '@/lib/safeRouterBack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { createStory } from '@/lib/firebaseHelpers/index';
import { getAuthenticatedUserId } from '@/lib/currentUser';
import { apiService } from '@/src/_services/apiService';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { feedEventEmitter } from '../lib/feedEventEmitter';
import { mapService } from '../services';
import { compressVideoSafe } from '../lib/mediaUtils';
import COLORS from '@/src/theme/colors';
let captureRef: ((ref: any, opts?: any) => Promise<string>) | null = null;
try {
    const viewShot = require('react-native-view-shot');
    captureRef = typeof viewShot.captureRef === 'function' ? viewShot.captureRef : null;
} catch (_) {
    // Module not available in Expo Go — text overlays won't be baked into the image.
    captureRef = null;
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface GalleryAsset {
    id: string;
    uri: string;
    mediaType: 'photo' | 'video';
    duration?: number;
}

interface TextOverlay {
    id: string;
    text: string;
    color: string;
    fontStyle: FontStyleKey;
    x: number; // 0-1 relative
    y: number; // 0-1 relative
}

type FontStyleKey = 'classic' | 'modern' | 'strong';

const FONT_STYLES: Record<FontStyleKey, { label: string; fontFamily?: string; italic?: boolean; letterSpacing?: number; textTransform?: 'uppercase' | 'none' }> = {
    classic: { label: 'Classic', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
    modern: { label: 'Modern', fontFamily: undefined, letterSpacing: 1 },
    strong: { label: 'Strong', fontFamily: undefined, letterSpacing: 2, textTransform: 'uppercase' },
};

const TEXT_COLORS = [
    '#ffffff', '#000000', '#FFD700', '#FF4444',
    '#44CFFF', '#44FF88', '#FF44CC', '#FF8800',
    '#8B44FF', '#FF6B6B', '#4ECDC4', '#96E6A1',
];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COLS = 3;
const TILE_SIZE = SCREEN_W / COLS;
const CANVAS_H = SCREEN_H;

// ─────────────────────────────────────────────
// DraggableText — defined at MODULE level so it
// is never recreated on parent re-renders.
// ─────────────────────────────────────────────
const DraggableText = ({
    overlay,
    isSelected,
    onSelect,
    onDelete,
    onEdit,
    onUpdatePosition,
    onDragStart,
    onDragEnd,
}: {
    overlay: TextOverlay;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit: (overlay: TextOverlay) => void;
    onUpdatePosition: (id: string, x: number, y: number) => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
}) => {
    const baseRef = useRef({ x: overlay.x * SCREEN_W, y: overlay.y * CANVAS_H });
    const pan = useRef(new Animated.ValueXY({ x: baseRef.current.x, y: baseRef.current.y })).current;

    useEffect(() => {
        const nx = overlay.x * SCREEN_W;
        const ny = overlay.y * CANVAS_H;
        if (Math.abs(baseRef.current.x - nx) > 1 || Math.abs(baseRef.current.y - ny) > 1) {
            baseRef.current = { x: nx, y: ny };
            pan.setValue({ x: nx, y: ny });
        }
    }, [overlay.x, overlay.y]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
            onPanResponderGrant: () => {
                onSelect(overlay.id);
                pan.stopAnimation();
                pan.setOffset({ x: baseRef.current.x, y: baseRef.current.y });
                pan.setValue({ x: 0, y: 0 });
                onDragStart?.();
            },
            onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
            onPanResponderRelease: () => {
                pan.flattenOffset();
                const cur: any = (pan as any).__getValue ? (pan as any).__getValue() : { x: baseRef.current.x, y: baseRef.current.y };
                const rawX = typeof cur?.x === 'number' ? cur.x : baseRef.current.x;
                const rawY = typeof cur?.y === 'number' ? cur.y : baseRef.current.y;

                const clampedX = Math.max(10, Math.min(SCREEN_W - 60, rawX));
                const clampedY = Math.max(60, Math.min(CANVAS_H - 140, rawY));

                baseRef.current = { x: clampedX, y: clampedY };
                pan.setValue({ x: clampedX, y: clampedY });
                onUpdatePosition(overlay.id, clampedX / SCREEN_W, clampedY / CANVAS_H);
                onDragEnd?.();
            },
            onPanResponderTerminate: () => {
                pan.flattenOffset();
                onDragEnd?.();
            },
        })
    ).current;

    const fs = FONT_STYLES[overlay.fontStyle];

    return (
        <Animated.View
            {...panResponder.panHandlers}
            style={[
                styles.textOverlay,
                {
                    transform: [
                        { translateX: pan.x },
                        { translateY: pan.y },
                    ],
                },
                isSelected && styles.textOverlaySelected,
            ]}
        >
            <TouchableOpacity
                activeOpacity={1}
                onPress={() => onEdit(overlay)}
            >
                <Text
                    style={[
                        styles.overlayText,
                        {
                            color: overlay.color,
                            fontFamily: fs.fontFamily,
                            letterSpacing: fs.letterSpacing,
                            textTransform: fs.textTransform as any,
                        },
                    ]}
                >
                    {overlay.text}
                </Text>
            </TouchableOpacity>

            {isSelected && (
                <TouchableOpacity
                    onPress={() => onDelete(overlay.id)}
                    style={styles.overlayDeleteBadge}
                    hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
                >
                    <Feather name="x" size={14} color="#fff" />
                </TouchableOpacity>
            )}
        </Animated.View>
    );
};

// ─────────────────────────────────────────────
// Helper: copy native video URI to cache for expo-av playback
async function copyStoryVideoToCache(nativeUri: string): Promise<string> {
  if (!nativeUri) return nativeUri;
  if (nativeUri.startsWith('file://') && !nativeUri.includes('%')) {
    try {
      const info = await FileSystem.getInfoAsync(nativeUri);
      if (info.exists) return nativeUri;
    } catch (_) {}
  }
  const hash = nativeUri.replace(/[^a-zA-Z0-9]/g, '_').slice(-60);
  const dest = `${FileSystem.cacheDirectory}storyvidcache_${hash}.mp4`;
  try {
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists) return dest;
  } catch (_) {}

  try {
    await FileSystem.copyAsync({ from: nativeUri, to: dest });
    const check = await FileSystem.getInfoAsync(dest);
    if (check.exists) return dest;
  } catch (_) {}

  // Fallback: MediaLibrary localUri
  try {
    const assetId = nativeUri.startsWith('ph://')
      ? nativeUri.replace('ph://', '').split('/')[0]
      : nativeUri;
    const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId, { copyToLocalContainer: true } as any);
    if (assetInfo?.localUri) {
      await FileSystem.copyAsync({ from: assetInfo.localUri, to: dest });
      const check2 = await FileSystem.getInfoAsync(dest);
      if (check2.exists) return dest;
      return assetInfo.localUri;
    }
  } catch (_) {}

  return nativeUri;
}

function isNativeVideoUri(u: string): boolean {
  return u.startsWith('ph://') || u.startsWith('assets-library://') || u.startsWith('content://');
}

const AutoplayVideoPreview: React.FC<{ uri: string; rawUri?: string; style: any }> = ({ uri, rawUri, style }) => {
  const videoRef = React.useRef<Video>(null);
  const [playableUri, setPlayableUri] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const sourceUri = rawUri || uri;

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isNativeVideoUri(sourceUri)) {
        if (active) setPlayableUri(sourceUri);
        return;
      }
      try {
        const cached = await copyStoryVideoToCache(sourceUri);
        if (active) setPlayableUri(cached);
      } catch {
        if (active) setPlayableUri(sourceUri);
      }
    })();
    return () => { active = false; };
  }, [sourceUri]);

  useEffect(() => {
    if (isLoaded && videoRef.current) {
      videoRef.current.playAsync().catch(() => {});
    }
  }, [isLoaded, playableUri]);

  return (
    <View style={style}>
      {!isLoaded && (
        <View style={StyleSheet.absoluteFillObject}>
          {(sourceUri.startsWith('ph://') || sourceUri.startsWith('assets-library://')) ? (
            <Image
              source={{ uri: sourceUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#FF8D00" />
            </View>
          )}
        </View>
      )}
      {playableUri && (
        <Video
          ref={videoRef}
          source={{ uri: playableUri }}
          style={{ width: '100%', height: '100%', opacity: isLoaded ? 1 : 0 }}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls={false}
          shouldPlay
          isMuted
          isLooping
          onLoad={() => setIsLoaded(true)}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded && status.positionMillis >= 2000) {
              videoRef.current?.setStatusAsync({ positionMillis: 0, shouldPlay: true }).catch(() => {});
            }
          }}
        />
      )}
    </View>
  );
};

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────
export default function StoryCreatorScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { sharePostId, sharePostData } = useLocalSearchParams<{ sharePostId?: string; sharePostData?: string }>();
    const [sharedPostMetadata, setSharedPostMetadata] = useState<any | null>(null);

    useEffect(() => {
        if (sharePostId && sharePostData) {
            try {
                let rawData = sharePostData;
                try {
                    rawData = decodeURIComponent(sharePostData);
                } catch {
                    // if already decoded or malformed, keep rawData
                }
                const parsedPost = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

                const isVideo = parsedPost.mediaType === 'video' ||
                    parsedPost.type === 'video' ||
                    !!parsedPost.videoUrl ||
                    (Array.isArray(parsedPost.media) && parsedPost.media[0]?.type === 'video') ||
                    /\.(mp4|mov|m4v|webm)(\?|$)/i.test(String(parsedPost.videoUrl || parsedPost.media?.[0]?.url || ''));

                const videoUrl = isVideo ? (parsedPost.videoUrl || parsedPost.media?.[0]?.url || '') : '';
                const imageUrl = parsedPost.thumbnailUrl ||
                    parsedPost.thumbnail ||
                    parsedPost.media?.[0]?.thumbnailUrl ||
                    parsedPost.media?.[0]?.url ||
                    parsedPost.imageUrl ||
                    '';

                const targetUri = videoUrl || imageUrl || 'placeholder';

                setSelectedUri(targetUri);
                setSelectedAsset({
                    id: 'share_post_' + sharePostId,
                    uri: targetUri,
                    mediaType: isVideo ? 'video' : 'photo',
                });

                setSharedPostMetadata({
                    postId: sharePostId,
                    userName: parsedPost.userName || parsedPost.user?.displayName || parsedPost.user?.name || 'User',
                    userAvatar: parsedPost.userAvatar || parsedPost.user?.profilePicture || parsedPost.user?.avatar || parsedPost.user?.photoURL || '',
                    caption: parsedPost.caption || parsedPost.text || '',
                    imageUrl: imageUrl,
                    videoUrl: videoUrl,
                    mediaType: isVideo ? 'video' : 'photo',
                });

                setStep('editor');
            } catch (err) {
                console.error('[StoryCreator] Failed to parse sharePostData:', err);
            }
        }
    }, [sharePostId, sharePostData]);

    // Navigation Step
    const [step, setStep] = useState<'picker' | 'editor'>('picker');

    // Gallery / Media Selection
    const [assets, setAssets] = useState<GalleryAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [selectedUri, setSelectedUri] = useState<string | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<GalleryAsset | null>(null);
    const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const previewRef = useRef<View>(null);

    // Visibility Selection
    const [userGroups, setUserGroups] = useState<any[]>([]);
    const [visibility, setVisibility] = useState('Everyone');
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [showVisibilityModal, setShowVisibilityModal] = useState(false);

    // Location Auto-complete
    const [locationQuery, setLocationQuery] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
    const [loadingLocations, setLoadingLocations] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<any>(null);
    const [showLocationModal, setShowLocationModal] = useState(false);

    // Text Overlays
    const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
    const [showTextEditor, setShowTextEditor] = useState(false);
    const [editingText, setEditingText] = useState('');
    const [editingColor, setEditingColor] = useState('#ffffff');
    const [editingFontStyle, setEditingFontStyle] = useState<FontStyleKey>('classic');
    const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
    const [scrollEnabled, setScrollEnabled] = useState(true);
    const [editorKeyboardHeight, setEditorKeyboardHeight] = useState(0);
    const textInputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (!showTextEditor) {
            setEditorKeyboardHeight(0);
            return;
        }
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (e: any) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setEditorKeyboardHeight(e.endCoordinates?.height || 0);
        };
        const onHide = () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setEditorKeyboardHeight(0);
        };

        const showSub = Keyboard.addListener(showEvent, onShow);
        const hideSub = Keyboard.addListener(hideEvent, onHide);

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [showTextEditor]);

    const handlePreviewPress = () => {
        if (editorKeyboardHeight > 0) {
            Keyboard.dismiss();
        } else {
            textInputRef.current?.focus();
        }
    };

    // Sharing State
    const isSharingRef = useRef(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Load user groups and gallery permissions
    useEffect(() => {
        (async () => {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            setHasPermission(status === 'granted');
            if (status === 'granted') {
                await loadAssets();
            } else {
                setLoading(false);
            }
        })();

        (async () => {
            try {
                const uid = await getAuthenticatedUserId();
                if (uid) {
                    const res = await apiService.get(`/groups?userId=${uid}&_t=${Date.now()}`, { bypassDedupe: true });
                    if (res?.success && Array.isArray(res.data)) {
                        setUserGroups(res.data);
                    } else if (Array.isArray(res)) {
                        setUserGroups(res);
                    }
                }
            } catch (err) {
                console.error('[StoryCreator] Failed to fetch groups:', err);
            }
        })();
    }, []);

    // Fetch Location Predictions
    useEffect(() => {
        if (locationQuery.length < 2) {
            setLocationSuggestions([]);
            return;
        }
        setLoadingLocations(true);
        const timer = setTimeout(async () => {
            try {
                const suggestions = await mapService.getAutocompleteSuggestions(locationQuery);
                const predictions = suggestions.map((s: any) => ({
                    placeId: s.placeId,
                    name: s.mainText || s.description || 'Location',
                    address: s.description || '',
                }));
                setLocationSuggestions(predictions);
            } catch (err) {
                setLocationSuggestions([]);
            } finally {
                setLoadingLocations(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [locationQuery]);

    const loadAssets = async (after?: string) => {
        try {
            const page = await MediaLibrary.getAssetsAsync({
                mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
                sortBy: [[MediaLibrary.SortBy.creationTime, false]],
                first: 30,
                after,
            });
            const mapped: GalleryAsset[] = page.assets.map((a) => ({
                id: a.id,
                uri: a.uri,
                mediaType: a.mediaType === MediaLibrary.MediaType.video ? 'video' : 'photo',
                duration: a.duration,
            }));
            setAssets((prev) => (after ? [...prev, ...mapped] : mapped));
            setEndCursor(page.endCursor);
            setHasNextPage(page.hasNextPage);
        } catch (e) {
            console.error('[StoryCreator] Error loading assets:', e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const loadMore = async () => {
        if (!hasNextPage || loadingMore) return;
        setLoadingMore(true);
        await loadAssets(endCursor);
    };

    const openCamera = async () => {
        try {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) return;
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsEditing: false,
                quality: 0.9,
                videoMaxDuration: 720,
            });
            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                setSelectedUri(asset.uri);
                setSelectedAsset({
                    id: 'camera',
                    uri: asset.uri,
                    mediaType: asset.type === 'video' ? 'video' : 'photo',
                });
                setStep('editor');
            }
        } catch (e) {
            console.error('[StoryCreator] Camera error:', e);
        }
    };

    // Upload and Share
    const handleShare = async () => {
        if (isSharingRef.current) return;
        if (!selectedUri) return;
        isSharingRef.current = true;
        setUploading(true);
        setUploadProgress(0);
        try {
            hapticMedium();
            const authUserId = await getAuthenticatedUserId();
            if (!authUserId) throw new Error('User not authenticated');

            let uploadUri = selectedUri;
            const mediaType = selectedAsset?.mediaType || 'photo';

            if (mediaType === 'video' && !uploadUri.startsWith('http://') && !uploadUri.startsWith('https://')) {
                try {
                    uploadUri = await copyStoryVideoToCache(uploadUri);
                    uploadUri = await compressVideoSafe(uploadUri);
                } catch (e) {
                    console.warn('[StoryCreator] Video cache preparation error:', e);
                }
            }

            let textBaked = false;
            if (!sharedPostMetadata && mediaType === 'photo') {
                if (textOverlays.length > 0 && captureRef !== null) {
                    try {
                        setSelectedOverlayId(null);
                        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                        const capturedUri = await captureRef(previewRef, {
                            format: 'jpg',
                            quality: 0.92,
                            result: 'tmpfile',
                        });
                        if (capturedUri) {
                            uploadUri = capturedUri;
                            textBaked = true;
                        }
                    } catch (e) {
                        console.warn('[StoryCreator] Failed to capture preview with text overlays:', e);
                    }
                }

                if (uploadUri && !uploadUri.startsWith('http://') && !uploadUri.startsWith('https://')) {
                    try {
                        const manipResult = await ImageManipulator.manipulateAsync(
                            uploadUri,
                            [{ resize: { width: 1080 } }],
                            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
                        );
                        uploadUri = manipResult.uri;
                    } catch (e) {
                        console.warn('Image manipulation failed, using raw URI:', e);
                    }
                }
            }

            const finalPostMetadata = (() => {
                const meta: Record<string, unknown> = {};
                if (sharedPostMetadata) Object.assign(meta, sharedPostMetadata);
                if (textOverlays.length > 0) {
                    meta.textOverlays = textOverlays;
                    if (textBaked) meta.textBaked = true;
                }
                return Object.keys(meta).length > 0 ? meta : undefined;
            })();

            const storyRes = await createStory(
                authUserId,
                uploadUri,
                mediaType === 'video' ? 'video' : 'image',
                undefined,
                selectedLocation || undefined,
                sharedPostMetadata?.imageUrl || undefined,
                visibility,
                selectedGroupId ? [selectedGroupId] : [],
                (p: number) => setUploadProgress(Math.round(p)),
                sharedPostMetadata ? true : undefined,
                finalPostMetadata
            );

            if (storyRes?.success) {
                hapticSuccess();
                setUploadProgress(100);
                setTimeout(() => {
                    setUploading(false);
                    isSharingRef.current = false;
                    feedEventEmitter.emit('feedUpdated');
                    const createdStoryId = storyRes?.storyId || storyRes?.story?._id || storyRes?.story?.id;
                    router.replace({
                        pathname: '/(tabs)/home',
                        params: { 
                            storyId: createdStoryId ? String(createdStoryId) : undefined,
                            viewStory: 'true',
                            _t: String(Date.now())
                        }
                    });
                }, 500);
            } else {
                throw new Error('Upload failed');
            }
        } catch (err: any) {
            isSharingRef.current = false;
            setUploading(false);
            Alert.alert('Upload Failed', err?.message || 'Something went wrong while sharing your story.');
        }
    };

    // Text Editor overlays logic
    const openTextEditor = () => {
        setSelectedOverlayId(null);
        setEditingText('');
        setEditingColor('#ffffff');
        setEditingFontStyle('classic');
        setShowTextEditor(true);
    };

    const handleCanvasPress = () => {
        if (selectedOverlayId) {
            setSelectedOverlayId(null);
        } else {
            openTextEditor();
        }
    };

    const openTextEditorForOverlay = (overlay: TextOverlay) => {
        setSelectedOverlayId(overlay.id);
        setEditingText(overlay.text);
        setEditingColor(overlay.color);
        setEditingFontStyle(overlay.fontStyle);
        setShowTextEditor(true);
    };

    const commitText = () => {
        const trimmed = editingText.trim();
        if (!trimmed) {
            setShowTextEditor(false);
            return;
        }

        if (selectedOverlayId) {
            setTextOverlays((prev) =>
                prev.map((o) =>
                    o.id === selectedOverlayId
                        ? { ...o, text: trimmed, color: editingColor, fontStyle: editingFontStyle }
                        : o
                )
            );
        } else {
            const overlay: TextOverlay = {
                id: Date.now().toString(),
                text: trimmed,
                color: editingColor,
                fontStyle: editingFontStyle,
                x: 0.35,
                y: 0.45,
            };
            setTextOverlays((prev) => [...prev, overlay]);
        }

        setShowTextEditor(false);
        setSelectedOverlayId(null);
    };

    const deleteOverlay = (id: string) => {
        setTextOverlays((prev) => prev.filter((o) => o.id !== id));
        setSelectedOverlayId((prev) => (prev === id ? null : prev));
    };

    const renderTile = useCallback(
        ({ item }: { item: GalleryAsset }) => {
            return (
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={async () => {
                        let targetUri = item.uri;
                        if (item.uri.startsWith('ph://') || item.uri.startsWith('assets-library://')) {
                            try {
                                const assetId = item.uri.startsWith('ph://')
                                    ? item.uri.replace('ph://', '').split('/')[0]
                                    : item.uri;
                                const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId, { copyToLocalContainer: true } as any);
                                if (assetInfo) {
                                    targetUri = assetInfo.localUri || assetInfo.uri || item.uri;
                                }
                            } catch (e) {
                                console.warn('[story-creator] Failed to resolve iOS local URI for preview:', e);
                            }
                        }
                        setSelectedUri(targetUri);
                        setSelectedAsset(item);
                        setStep('editor');
                    }}
                    style={[styles.tile, { width: TILE_SIZE, height: TILE_SIZE }]}
                >
                    <Image source={{ uri: item.uri }} style={styles.tileImg} />
                    {item.mediaType === 'video' && (
                        <View style={styles.videoBadge}>
                            <Feather name="video" size={10} color="#fff" />
                            {item.duration != null && (
                                <Text style={styles.videoDuration}>
                                    {Math.floor(item.duration / 60)}:
                                    {String(Math.floor(item.duration % 60)).padStart(2, '0')}
                                </Text>
                            )}
                        </View>
                    )}
                </TouchableOpacity>
            );
        },
        []
    );

    const CameraTile = () => (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={openCamera}
            style={[styles.tile, styles.cameraTile, { width: TILE_SIZE, height: TILE_SIZE }]}
        >
            <Feather name="camera" size={30} color="#333" />
            <Text style={styles.cameraLabel}>Camera</Text>
        </TouchableOpacity>
    );

    if (hasPermission === false) {
        return (
            <View style={[styles.screen, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => safeRouterBack()} style={styles.headerBtn}>
                        <Feather name="x" size={26} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Add to story</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.permissionBox}>
                    <Feather name="image" size={56} color="#555" />
                    <Text style={styles.permissionText}>Gallery access required</Text>
                    <Text style={styles.permissionSub}>Allow access in Settings → Permissions</Text>
                </View>
            </View>
        );
    }

    const editingFs = FONT_STYLES[editingFontStyle];

    return (
        <View
            style={[
                styles.screen,
                {
                    backgroundColor: step === 'picker' ? COLORS.background : '#000000',
                    paddingTop: step === 'picker' ? (insets.top || (Platform.OS === 'ios' ? 47 : 0)) : 0,
                },
            ]}
        >
            <StatusBar
                barStyle={step === 'picker' ? 'dark-content' : 'light-content'}
                backgroundColor={step === 'picker' ? COLORS.background : 'transparent'}
                translucent={step === 'editor'}
            />

            {step === 'picker' ? (
                <>
                    {/* Header for Picker */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => safeRouterBack()} style={styles.headerBtn}>
                            <Feather name="x" size={26} color="#000" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Add to story</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Recents Label */}
                    <View style={styles.recentsRow}>
                        <Text style={styles.recentsLabel}>Recents</Text>
                    </View>

                    {/* Grid */}
                    {loading ? (
                        <View style={styles.loader}>
                            <ActivityIndicator size="large" color="#FF8D00" />
                        </View>
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={assets}
                            keyExtractor={(item) => item.id}
                            numColumns={COLS}
                            renderItem={renderTile}
                            ListHeaderComponent={<CameraTile />}
                            ListHeaderComponentStyle={{ width: TILE_SIZE }}
                            onEndReached={loadMore}
                            onEndReachedThreshold={0.5}
                            showsVerticalScrollIndicator={false}
                            ListFooterComponent={
                                loadingMore ? (
                                    <ActivityIndicator size="small" color="#FF8D00" style={{ marginVertical: 12 }} />
                                ) : null
                            }
                            columnWrapperStyle={styles.row}
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
                        />
                    )}
                </>
            ) : (
                <>

                    {/* Full Screen Story Canvas (captured by captureRef) */}
                    <TouchableWithoutFeedback onPress={handleCanvasPress}>
                        <View ref={previewRef} collapsable={false} style={styles.fullScreenCanvas}>
                            {sharedPostMetadata ? null : selectedUri ? (
                                selectedAsset?.mediaType === 'video' ? (
                                    <AutoplayVideoPreview uri={selectedUri} rawUri={selectedAsset?.uri} style={StyleSheet.absoluteFill} />
                                ) : (
                                    <Image source={{ uri: selectedUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                                )
                            ) : null}

                            {sharedPostMetadata && (
                                <View style={styles.sharedPostCard}>
                                    <View style={styles.sharedPostCardHeader}>
                                        <Image 
                                            source={{ uri: sharedPostMetadata.userAvatar || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y' }} 
                                            style={styles.sharedPostCardAvatar} 
                                            resizeMode="cover"
                                        />
                                        <Text style={styles.sharedPostCardUsername}>
                                            {sharedPostMetadata.userName}
                                        </Text>
                                    </View>
                                    {sharedPostMetadata.mediaType === 'video' ? (
                                        <View style={{ position: 'relative', width: '100%', aspectRatio: 1, marginBottom: 8, overflow: 'hidden', borderRadius: 8, backgroundColor: '#000' }}>
                                            {sharedPostMetadata.videoUrl ? (
                                                <AutoplayVideoPreview uri={sharedPostMetadata.videoUrl} style={StyleSheet.absoluteFill} />
                                            ) : (
                                                <Image
                                                    source={{ uri: sharedPostMetadata.imageUrl }}
                                                    style={StyleSheet.absoluteFill}
                                                    resizeMode="cover"
                                                />
                                            )}
                                            <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                                                <Feather name="video" size={13} color="#fff" />
                                            </View>
                                        </View>
                                    ) : (
                                        <Image 
                                            source={{ uri: sharedPostMetadata.imageUrl }} 
                                            style={styles.sharedPostCardImage} 
                                            resizeMode="cover"
                                        />
                                    )}
                                    {sharedPostMetadata.caption ? (
                                        <Text style={styles.sharedPostCardCaption} numberOfLines={2}>
                                            <Text style={{ fontWeight: '700' }}>{sharedPostMetadata.userName} </Text>
                                            {sharedPostMetadata.caption}
                                        </Text>
                                    ) : null}
                                </View>
                            )}

                            {/* Text overlays preview */}
                            {textOverlays.map((o) => (
                                <DraggableText
                                    key={o.id}
                                    overlay={o}
                                    isSelected={selectedOverlayId === o.id}
                                    onSelect={setSelectedOverlayId}
                                    onDelete={deleteOverlay}
                                    onEdit={openTextEditorForOverlay}
                                    onUpdatePosition={(id, x, y) => {
                                        setTextOverlays(prev => prev.map(item => item.id === id ? { ...item, x, y } : item));
                                    }}
                                    onDragStart={() => setScrollEnabled(false)}
                                    onDragEnd={() => setScrollEnabled(true)}
                                />
                            ))}
                        </View>
                    </TouchableWithoutFeedback>

                    {/* Floating Header Overlay (Back & Aa) */}
                    <View style={[styles.floatingHeader, { top: insets.top + 8 }]} pointerEvents="box-none">
                        <TouchableOpacity 
                            onPress={() => {
                                if (sharedPostMetadata || sharePostId) {
                                    safeRouterBack();
                                } else {
                                    setStep('picker');
                                    setTextOverlays([]);
                                    setLocationQuery('');
                                    setSelectedLocation(null);
                                    setShowLocationModal(false);
                                }
                            }} 
                            style={styles.floatingRoundBtn}
                            activeOpacity={0.7}
                        >
                            <Feather name="arrow-left" size={24} color="#fff" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={openTextEditor}
                            style={styles.floatingRoundBtn}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.aaFloatingBtnText}>Aa</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Floating Bottom Bar (Pills & Share Button) */}
                    <View style={[styles.floatingBottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]} pointerEvents="box-none">
                        {/* Options Row (Visibility & Location Pills) */}
                        <View style={styles.floatingOptionsRow} pointerEvents="box-none">
                            <TouchableOpacity
                                style={styles.floatingOptionPill}
                                activeOpacity={0.7}
                                onPress={() => {
                                    hapticLight();
                                    setShowVisibilityModal(true);
                                }}
                            >
                                <Feather name="users" size={15} color="#fff" style={{ marginRight: 6 }} />
                                <Text style={styles.floatingPillText}>{visibility}</Text>
                                <Feather name="chevron-down" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.floatingOptionPill, selectedLocation && { backgroundColor: 'rgba(255,141,0,0.35)', borderColor: '#FF8D00' }]}
                                activeOpacity={0.7}
                                onPress={() => {
                                    hapticLight();
                                    setShowLocationModal(true);
                                }}
                            >
                                <Feather name="map-pin" size={15} color={selectedLocation ? '#FF8D00' : '#fff'} style={{ marginRight: 6 }} />
                                <Text style={styles.floatingPillText} numberOfLines={1}>
                                    {selectedLocation?.name || 'Location'}
                                </Text>
                                {selectedLocation ? (
                                    <TouchableOpacity
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            setSelectedLocation(null);
                                            setLocationQuery('');
                                            setLocationSuggestions([]);
                                        }}
                                        style={{ marginLeft: 4 }}
                                    >
                                        <Feather name="x" size={14} color="#fff" />
                                    </TouchableOpacity>
                                ) : (
                                    <Feather name="chevron-down" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Share to Story Button with integrated loading state */}
                        <TouchableOpacity
                            style={[styles.floatingShareBtn, uploading && styles.floatingShareBtnUploading]}
                            onPress={handleShare}
                            disabled={uploading}
                            activeOpacity={0.85}
                        >
                            {uploading && uploadProgress > 0 && (
                                <View
                                    style={[
                                        styles.floatingShareBtnProgressFill,
                                        { width: `${Math.min(uploadProgress, 100)}%` },
                                    ]}
                                />
                            )}

                            {uploading ? (
                                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 10 }} />
                            ) : (
                                <Feather name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
                            )}
                            <Text style={styles.floatingShareBtnText}>
                                {uploading
                                    ? uploadProgress > 0
                                        ? `Sharing story... ${uploadProgress}%`
                                        : 'Sharing story...'
                                    : 'Share to Story'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {/* Visibility Modal */}
            <Modal
                visible={showVisibilityModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowVisibilityModal(false)}
            >
                <TouchableWithoutFeedback onPress={() => setShowVisibilityModal(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.visibilitySheet}>
                                <View style={styles.sheetHandle} />
                                <Text style={styles.sheetTitle}>Select Visibility</Text>
                                <Text style={styles.sheetSubtitle}>Choose who can view this story</Text>

                                <TouchableOpacity 
                                    style={styles.sheetOptionRow}
                                    onPress={() => {
                                        setVisibility('Everyone');
                                        setSelectedGroupId(null);
                                        setShowVisibilityModal(false);
                                    }}
                                >
                                    <View style={[styles.sheetOptionCircle, visibility === 'Everyone' && styles.sheetOptionCircleActive]}>
                                        {visibility === 'Everyone' && <View style={styles.sheetOptionDot} />}
                                    </View>
                                    <Text style={styles.sheetOptionLabel}>Everyone</Text>
                                </TouchableOpacity>

                                {userGroups.map((group) => {
                                    const isSelected = selectedGroupId === group._id;
                                    return (
                                        <TouchableOpacity 
                                            key={group._id}
                                            style={styles.sheetOptionRow}
                                            onPress={() => {
                                                setVisibility(group.name);
                                                setSelectedGroupId(group._id);
                                                setShowVisibilityModal(false);
                                            }}
                                        >
                                            <View style={[styles.sheetOptionCircle, isSelected && styles.sheetOptionCircleActive]}>
                                                {isSelected && <View style={styles.sheetOptionDot} />}
                                            </View>
                                            <Text style={styles.sheetOptionLabel}>{group.name}</Text>
                                        </TouchableOpacity>
                                    );
                                })}

                                <TouchableOpacity 
                                    style={styles.sheetCloseBtn}
                                    onPress={() => setShowVisibilityModal(false)}
                                >
                                    <Text style={styles.sheetCloseBtnText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Location Picker Bottom Sheet Modal */}
            <Modal
                visible={showLocationModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowLocationModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <TouchableWithoutFeedback onPress={() => setShowLocationModal(false)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={[styles.visibilitySheet, { backgroundColor: COLORS.background, maxHeight: '82%', minHeight: 380 }]}>
                                    <View style={styles.sheetHandle} />
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                        <Text style={[styles.sheetTitle, { color: COLORS.textPrimary, marginBottom: 0 }]}>Select Location</Text>
                                        <TouchableOpacity
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            onPress={() => setShowLocationModal(false)}
                                        >
                                            <Feather name="x" size={22} color={COLORS.textMuted} />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Search Input Bar */}
                                    <View style={[styles.locationInputContainer, { backgroundColor: COLORS.surface, borderColor: COLORS.border, marginBottom: 10 }]}>
                                        <Feather name="search" size={18} color="#FF8D00" style={{ marginRight: 10 }} />
                                        <TextInput
                                            style={[styles.locationInput, { color: COLORS.textPrimary }]}
                                            placeholder="Search city, venue or address..."
                                            placeholderTextColor={COLORS.textMuted}
                                            value={locationQuery}
                                            onChangeText={setLocationQuery}
                                            autoFocus={true}
                                        />
                                        {loadingLocations ? (
                                            <ActivityIndicator size="small" color="#FF8D00" />
                                        ) : locationQuery.length > 0 ? (
                                            <TouchableOpacity onPress={() => { setLocationQuery(''); setLocationSuggestions([]); }}>
                                                <Feather name="x-circle" size={16} color={COLORS.textMuted} />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>

                                    {/* Suggestions List */}
                                    <FlatList
                                        data={locationSuggestions}
                                        keyExtractor={(item) => item.placeId || item.name}
                                        keyboardShouldPersistTaps="handled"
                                        style={{ flex: 1 }}
                                        ListEmptyComponent={() => (
                                            locationQuery.length >= 2 && !loadingLocations ? (
                                                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                                                    <Feather name="map-pin" size={28} color={COLORS.textMuted} style={{ marginBottom: 8, opacity: 0.5 }} />
                                                    <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>No locations found for "{locationQuery}"</Text>
                                                </View>
                                            ) : (
                                                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                                                    <Feather name="map" size={28} color={COLORS.textMuted} style={{ marginBottom: 8, opacity: 0.5 }} />
                                                    <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>Type at least 2 characters to search</Text>
                                                </View>
                                            )
                                        )}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                style={[styles.locationItem, { borderBottomColor: COLORS.border }]}
                                                onPress={() => {
                                                    Keyboard.dismiss();
                                                    setSelectedLocation({
                                                        name: item.name,
                                                        address: item.address,
                                                        placeId: item.placeId
                                                    });
                                                    setLocationQuery(item.name);
                                                    setLocationSuggestions([]);
                                                    setShowLocationModal(false);
                                                }}
                                            >
                                                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,141,0,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                                    <Feather name="map-pin" size={16} color="#FF8D00" />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.locationName, { color: COLORS.textPrimary }]}>{item.name}</Text>
                                                    <Text style={[styles.locationAddress, { color: COLORS.textSecondary }]} numberOfLines={1}>{item.address}</Text>
                                                </View>
                                                <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
                                            </TouchableOpacity>
                                        )}
                                    />
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>

            {/* Draggable Text Overlay Editor Modal */}
            <Modal
                visible={showTextEditor}
                animationType="fade"
                transparent
                statusBarTranslucent
                onRequestClose={() => {
                    Keyboard.dismiss();
                    setShowTextEditor(false);
                }}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: '#000',
                        paddingBottom: Platform.OS === 'ios'
                            ? (editorKeyboardHeight > 0 ? editorKeyboardHeight : insets.bottom + 8)
                            : 8,
                    }}
                >
                    {/* Render selected media as background inside the modal */}
                    {selectedUri && (
                        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                            {selectedAsset?.mediaType === 'video' ? (
                                <AutoplayVideoPreview uri={selectedUri} rawUri={selectedAsset?.uri} style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <Image source={{ uri: selectedUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            )}
                        </View>
                    )}
                    {/* Dark overlay on top of the media */}
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]} pointerEvents="none" />

                    {/* Header */}
                    <View style={[styles.textEditorHeader, { paddingTop: insets.top + 8 }]}>
                        <TouchableOpacity
                            onPress={() => {
                                Keyboard.dismiss();
                                setShowTextEditor(false);
                            }}
                            style={styles.editorHeaderSideBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Feather name="x" size={24} color="#fff" />
                        </TouchableOpacity>

                        <Text style={styles.editorHeaderTitle}>Edit text</Text>

                        <View style={styles.editorHeaderRight}>
                            {selectedOverlayId != null && (
                                <TouchableOpacity
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        deleteOverlay(selectedOverlayId);
                                        setShowTextEditor(false);
                                    }}
                                    style={styles.editorDeleteBtn}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Feather name="trash-2" size={20} color="#ff5555" />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                onPress={() => {
                                    Keyboard.dismiss();
                                    commitText();
                                }}
                                style={styles.doneBtn}
                            >
                                <Text style={styles.doneBtnText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Text Input area (tap background to dismiss or focus) */}
                    <TouchableWithoutFeedback onPress={handlePreviewPress}>
                        <View style={styles.textEditorPreview}>
                            <TextInput
                                ref={textInputRef}
                                style={[
                                    styles.textInput,
                                    {
                                        color: editingColor,
                                        fontFamily: editingFs.fontFamily,
                                        letterSpacing: editingFs.letterSpacing,
                                        textTransform: editingFs.textTransform as any,
                                    },
                                ]}
                                value={editingText}
                                onChangeText={setEditingText}
                                placeholder="Type something..."
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                multiline
                                autoFocus
                                selectionColor="#FF8D00"
                                returnKeyType="done"
                                blurOnSubmit={false}
                            />
                        </View>
                    </TouchableWithoutFeedback>

                    {/* Bottom Controls Bar (Font style pills + Color picker dots) */}
                    <View style={styles.editorControlsBar}>
                        {/* Font style row */}
                        <View style={styles.fontStyleRow}>
                            {(Object.keys(FONT_STYLES) as FontStyleKey[]).map((key) => {
                                const active = editingFontStyle === key;
                                const fs = FONT_STYLES[key];
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        onPress={() => setEditingFontStyle(key)}
                                        style={[styles.fontStyleBtn, active && styles.fontStyleBtnActive]}
                                    >
                                        <Text
                                            style={[
                                                styles.fontStyleLabel,
                                                active && styles.fontStyleLabelActive,
                                                {
                                                    fontFamily: fs.fontFamily,
                                                    letterSpacing: fs.letterSpacing,
                                                    textTransform: fs.textTransform as any,
                                                },
                                            ]}
                                        >
                                            {fs.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Color Picker */}
                        <View style={styles.colorRowContainer}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.colorRow}
                                keyboardShouldPersistTaps="always"
                            >
                                {TEXT_COLORS.map((c) => {
                                    const active = editingColor === c;
                                    return (
                                        <TouchableOpacity
                                            key={c}
                                            onPress={() => setEditingColor(c)}
                                            style={[
                                                styles.colorDot,
                                                { backgroundColor: c },
                                                active && styles.colorDotSelected,
                                            ]}
                                        />
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#fff' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
    },
    headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: '#000', fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
    aaHeaderBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: '#f5f5f5',
    },
    aaHeaderBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },

    // Details Container
    detailsContainer: {
        paddingHorizontal: 20,
        marginTop: 15,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#888',
        marginTop: 18,
        marginBottom: 8,
        letterSpacing: 0.8,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fafafa',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    visibilityIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FF8D00',
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    optionSubtitle: {
        fontSize: 13,
        color: '#777',
        marginTop: 2,
    },
    locationInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fafafa',
        borderRadius: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#f0f0f0',
        height: 50,
    },
    locationInput: {
        flex: 1,
        fontSize: 15,
        color: '#333',
        height: '100%',
    },
    locationDropdown: {
        position: 'absolute',
        top: 54,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#eee',
        zIndex: 999,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
    },
    locationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    locationName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    locationAddress: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    locationLoader: {
        position: 'absolute',
        right: 16,
        top: 15,
    },

    // Bottom Bar
    bottomBar: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: 0,
        backgroundColor: '#fff',
    },
    shareSubmitBtn: {
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FF8D00',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FF8D00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
    },
    shareSubmitBtnDisabled: {
        opacity: 0.6,
        backgroundColor: '#ccc',
        shadowColor: 'transparent',
    },
    shareSubmitBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },

    // Preview Canvas & Floating Controls
    fullScreenCanvas: {
        width: SCREEN_W,
        height: CANVAS_H,
        backgroundColor: '#000000',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    preview: {
        width: SCREEN_W,
        height: CANVAS_H,
        backgroundColor: '#000000',
        overflow: 'hidden',
        alignSelf: 'center',
    },
    previewImg: { width: '100%', height: '100%' },
    floatingHeader: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 50,
    },
    floatingRoundBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    aaFloatingBtnText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    floatingBottomBar: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 0,
        zIndex: 50,
    },
    floatingOptionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    floatingOptionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 20,
        maxWidth: (SCREEN_W - 42) / 2,
    },
    floatingPillText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    floatingShareBtn: {
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FF8D00',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FF8D00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
        overflow: 'hidden',
    },
    floatingShareBtnUploading: {
        backgroundColor: '#E67E00',
        shadowOpacity: 0.2,
    },
    floatingShareBtnProgressFill: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: 3,
        backgroundColor: '#ffffff',
        borderBottomLeftRadius: 25,
    },
    floatingShareBtnText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 16,
    },

    // Text overlay on preview
    textOverlay: {
        position: 'absolute',
        left: 0,
        top: 0,
        maxWidth: SCREEN_W - 60,
        padding: 6,
        zIndex: 100,
        elevation: 20,
    },
    textOverlaySelected: {
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.7)',
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    overlayText: {
        fontSize: 26,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 4,
        textAlign: 'center',
    },
    overlayDeleteBadge: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#fff',
        zIndex: 99,
    },

    // Gallery List
    recentsRow: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
    recentsLabel: { color: '#000', fontSize: 17, fontWeight: '700' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    row: { gap: 1.5, marginBottom: 1.5 },
    tile: { position: 'relative', overflow: 'hidden', backgroundColor: '#f0f0f0' },
    tileImg: { width: '100%', height: '100%' },
    cameraTile: { backgroundColor: '#f9f9f9', alignItems: 'center', justifyContent: 'center', gap: 6 },
    cameraLabel: { color: '#333', fontSize: 13, fontWeight: '600' },
    videoBadge: {
        position: 'absolute', bottom: 6, right: 6,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4,
        paddingHorizontal: 4, paddingVertical: 2, gap: 3,
    },
    videoDuration: { color: '#fff', fontSize: 10, fontWeight: '600' },

    // Permission denied
    permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
    permissionText: { color: '#000', fontSize: 17, fontWeight: '700', textAlign: 'center' },
    permissionSub: { color: '#666', fontSize: 14, textAlign: 'center' },

    // Visibility sheet layout
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    visibilitySheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 14,
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#e0e0e0',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
    },
    sheetSubtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 20,
    },
    sheetOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    sheetOptionCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#ccc',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    sheetOptionCircleActive: {
        borderColor: '#FF8D00',
    },
    sheetOptionDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FF8D00',
    },
    sheetOptionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    sheetCloseBtn: {
        marginTop: 20,
        backgroundColor: '#f5f5f5',
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetCloseBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },

    // ── Text Editor Modal ──
    textEditorBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
    textEditorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    editorHeaderSideBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editorHeaderTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        flex: 1,
        textAlign: 'center',
    },
    editorHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    editorDeleteBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneBtn: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        backgroundColor: '#FF8D00',
        borderRadius: 20,
    },
    doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    textEditorPreview: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    textEditorOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    textInput: {
        fontSize: 28,
        fontWeight: '700',
        width: SCREEN_W - 40,
        textAlign: 'center',
        color: '#fff',
        zIndex: 10,
    },

    editorControlsBar: {
        width: '100%',
        paddingTop: 8,
    },
    // Font style selector
    fontStyleRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 12,
    },
    fontStyleBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    fontStyleBtnActive: {
        backgroundColor: '#fff',
        borderColor: '#fff',
    },
    fontStyleLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        fontWeight: '600',
    },
    fontStyleLabelActive: {
        color: '#000',
    },
    colorRowContainer: {
        height: 52,
        justifyContent: 'center',
    },
    // Color picker
    colorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 12,
    },
    colorDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorDotSelected: {
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 4,
        elevation: 4,
    },
    uploadingArea: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    uploadingText: {
        marginBottom: 8,
        color: '#666',
        fontWeight: '600',
        fontSize: 14,
    },
    uploadingBarBg: {
        width: '100%',
        height: 6,
        backgroundColor: '#e0e0e0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    uploadingBar: {
        height: 6,
        backgroundColor: '#FF8D00',
        borderRadius: 3,
    },
    sharedPostCard: {
        width: SCREEN_W * 0.85,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        zIndex: 10,
    },
    sharedPostCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    sharedPostCardAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#eeeeee',
        marginRight: 8,
    },
    sharedPostCardUsername: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111111',
    },
    sharedPostCardImage: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#f9f9f9',
    },
    sharedPostCardCaption: {
        fontSize: 12,
        color: '#333333',
        lineHeight: 15,
    },
});
