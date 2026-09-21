import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import COLORS from '@/src/theme/colors';
import StoryThumbnail from './StoryThumbnail';

export type Highlight = {
  id: string;
  title: string;
  coverImage: string;
  stories: Array<{ id: string; image: string; }>; // Minimal story type
};

interface HighlightCarouselProps {
  highlights: Highlight[];
  onPressHighlight?: (highlight: Highlight) => void;
  isOwnProfile?: boolean;
  onAddHighlight?: () => void;
}

const HighlightCarousel: React.FC<HighlightCarouselProps> = ({ highlights, onPressHighlight, isOwnProfile, onAddHighlight }) => {
  const renderAddButton = () => {
    if (!isOwnProfile || typeof onAddHighlight !== 'function') return null;
    return (
      <TouchableOpacity style={styles.highlightBubble} onPress={onAddHighlight}>
        <View style={styles.addButton}>
          <Ionicons name="add" size={24} color={COLORS.textSecondary} />
        </View>
        <Text style={styles.title} numberOfLines={1}>New</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={highlights}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => item.id || `highlight-${index}`}
        ListHeaderComponent={renderAddButton}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.highlightBubble} onPress={() => onPressHighlight?.(item)}>
            <StoryThumbnail uri={item.coverImage} style={styles.coverImage} resizeMode="cover" />
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingHorizontal: 12 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 0,
    backgroundColor: COLORS.background,
  },
  highlightBubble: {
    alignItems: 'center',
    marginRight: 12,
    width: 64,
  },
  coverImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 5,
    backgroundColor: COLORS.inputBg,
  },
  addButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginBottom: 5,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 11,
    color: COLORS.textPrimary,
    textAlign: 'center',
    maxWidth: 64,
    fontWeight: '400',
  },
});

export default HighlightCarousel;

