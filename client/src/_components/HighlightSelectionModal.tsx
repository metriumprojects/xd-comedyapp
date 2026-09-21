import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import COLORS from '@/src/theme/colors';
import StoryThumbnail from './StoryThumbnail';
import { useSwipeDownToDismiss } from '@/hooks/useSwipeDownToDismiss';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Highlight {
  id?: string;
  _id?: string;
  title: string;
  coverImage: string;
  stories?: string[];
  items?: any[];
}

interface HighlightSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  highlights: Highlight[];
  onSelectHighlight: (highlightId: string, isAlreadySaved: boolean) => void;
  onCreateNew: () => void;
  currentStoryId?: string;
  processingHighlightId?: string | null;
  loading?: boolean;
  useViewOverlay?: boolean;
}

export default function HighlightSelectionModal({
  visible,
  onClose,
  highlights,
  onSelectHighlight,
  onCreateNew,
  currentStoryId,
  processingHighlightId,
  loading = false,
  useViewOverlay = false,
}: HighlightSelectionModalProps) {
  const insets = useSafeAreaInsets();
  const hasHighlights = highlights && highlights.length > 0;
  const resolveHighlightId = (h: any) => String(h?.id || h?._id || '');

  const { headerPanHandlers, sheetPanHandlers, animatedStyle, dismiss } = useSwipeDownToDismiss({
    onDismiss: onClose,
    visible,
    initialSlideIn: true,
  });

  const isStoryInHighlight = (item: any, storyId?: string) => {
    if (!storyId || !item) return false;
    const sid = String(storyId).trim();
    if (Array.isArray(item.stories) && item.stories.some((s: any) => String(s) === sid)) {
      return true;
    }
    if (Array.isArray(item.items)) {
      return item.items.some((it: any) => {
        const itId = typeof it === 'string' ? it : (it?.storyId || it?.id || it?._id);
        return String(itId) === sid;
      });
    }
    return false;
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.iconCircle}>
        <Ionicons name="chevron-down" size={32} color={COLORS.textPrimary} />
      </View>
      <Text style={styles.emptyTitle}>Organize and save your stories</Text>
      <Text style={styles.emptySubtitle}>
        Save stories just for you or to share it with others
      </Text>
      
      <TouchableOpacity style={styles.createButton} onPress={onCreateNew}>
        <Text style={styles.createButtonText}>Create your first highlight</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHighlightItem = ({ item }: { item: Highlight }) => {
    const hid = resolveHighlightId(item);
    const isSaved = isStoryInHighlight(item, currentStoryId);
    const isProcessing = processingHighlightId === hid;

    return (
      <TouchableOpacity 
        style={styles.highlightItem} 
        disabled={!!processingHighlightId}
        onPress={() => {
          if (hid && !processingHighlightId) {
            onSelectHighlight(hid, isSaved);
          }
        }}
      >
        <StoryThumbnail uri={item.coverImage} style={styles.highlightCover} resizeMode="cover" />
        <Text style={styles.highlightTitle} numberOfLines={1}>{item.title}</Text>
        {isProcessing ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={styles.addIcon} />
        ) : isSaved ? (
          <Ionicons name="checkmark-circle" size={26} color={COLORS.primary} style={styles.addIcon} />
        ) : (
          <Ionicons name="add-circle-outline" size={26} color={COLORS.textMuted} style={styles.addIcon} />
        )}
      </TouchableOpacity>
    );
  };

  const innerContent = (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={() => dismiss()} />
      
      <Animated.View {...sheetPanHandlers} style={[styles.sheet, animatedStyle, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View {...headerPanHandlers} style={{ width: '100%', paddingTop: 4 }}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add to a highlight</Text>
            {hasHighlights && (
              <TouchableOpacity onPress={onCreateNew} disabled={!!processingHighlightId}>
                <Text style={[styles.newBtnText, !!processingHighlightId && { opacity: 0.5 }]}>New highlight</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 40 }} />
        ) : hasHighlights ? (
          <FlatList
            data={highlights}
            keyExtractor={(item) => resolveHighlightId(item) || `hl_${Math.random().toString(36).slice(2)}`}
            renderItem={renderHighlightItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          renderEmptyState()
        )}
      </Animated.View>
    </View>
  );

  if (useViewOverlay) {
    if (!visible) return null;
    return (
      <View style={[StyleSheet.absoluteFillObject, { zIndex: 120 }]}>
        {innerContent}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={() => dismiss()}>
      {innerContent}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: 300,
    maxHeight: SCREEN_HEIGHT * 0.7,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  newBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.info,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  highlightCover: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.inputBg,
  },
  highlightTitle: {
    flex: 1,
    marginLeft: 15,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  addIcon: {
    marginLeft: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 30,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: COLORS.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  createButtonText: {
    color: COLORS.textLight,
    fontSize: 15,
    fontWeight: '600',
  },
});
