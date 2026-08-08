import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DEFAULT_AVATAR_URL } from '../../../lib/api';
import COLORS from '@/src/theme/colors';

interface PostDetailsFormProps {
  caption: string;
  setCaption: (text: string) => void;
  hashtags: string[];
  hashtagInput: string;
  onHashtagInputChange: (text: string) => void;
  onHashtagCommit: () => void;
  onRemoveTag: (tag: string) => void;
  selectedCategories: { name: string; image: string }[];
  onOpenCategories: () => void;
  onRemoveCategory: (name: string) => void;
  locationName?: string;
  onOpenLocation: () => void;
  taggedUsers: any[];
  onOpenTagPeople: () => void;
  onRemoveTaggedUser: (uid: string) => void;
  visibility: string;
  subscriptionTierId?: string | null;
  onOpenVisibility: () => void;
  hasVideo?: boolean;
  customThumbnailUri?: string | null;
  onSelectCustomThumbnail?: () => void;
  onRemoveCustomThumbnail?: () => void;
}

const PostDetailsForm: React.FC<PostDetailsFormProps> = ({
  caption, setCaption, hashtags, hashtagInput, onHashtagInputChange, onHashtagCommit, onRemoveTag,
  selectedCategories, onOpenCategories, onRemoveCategory, locationName, onOpenLocation,
  taggedUsers, onOpenTagPeople, onRemoveTaggedUser,
  visibility, subscriptionTierId, onOpenVisibility,
  hasVideo, customThumbnailUri, onSelectCustomThumbnail, onRemoveCustomThumbnail
}) => {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ paddingHorizontal: 15 }}>
        {/* Caption Input Row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 }}>
          <Feather name="align-left" size={18} color={COLORS.textPrimary} style={{ marginRight: 15, marginTop: 2 }} />
          <TextInput
            style={{
              flex: 1,
              fontSize: 14,
              color: COLORS.black,
              fontWeight: '500',
              minHeight: 24,
              maxHeight: 140,
              paddingTop: 0,
              paddingBottom: 0,
              textAlignVertical: 'top',
            }}
            placeholder="Write a caption..."
            placeholderTextColor={COLORS.textPrimary}
            value={caption}
            onChangeText={setCaption}
            multiline={true}
          />
        </View>

        {/* Video Cover / Thumbnail Row (TikTok Style) */}
        {hasVideo && (
          <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.surface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Feather name="image" size={18} color={COLORS.primary} style={{ marginRight: 15 }} />
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.black }}>Video Cover / Thumbnail</Text>
                  <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
                    {customThumbnailUri ? 'Custom cover selected' : 'Auto cover (from video frame)'}
                  </Text>
                </View>
              </View>

              {customThumbnailUri ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Image source={{ uri: customThumbnailUri }} style={{ width: 36, height: 36, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border }} />
                  <TouchableOpacity onPress={onSelectCustomThumbnail} style={{ backgroundColor: COLORS.inputBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textPrimary }}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onRemoveCustomThumbnail} style={{ backgroundColor: '#ffebee', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 16 }}>
                    <Feather name="trash-2" size={14} color="#d32f2f" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={onSelectCustomThumbnail} style={{ backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textLight }}>+ Select Cover</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Tags Row */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
            <Feather name="hash" size={18} color={COLORS.textPrimary} style={{ marginRight: 15 }} />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: COLORS.black, fontWeight: '500' }}
              placeholder="Add tags (press space or enter)"
              placeholderTextColor={COLORS.textMuted}
              value={hashtagInput}
              onChangeText={(text) => {
                onHashtagInputChange(text);
                if (text.endsWith(' ') || text.endsWith(',')) {
                  onHashtagCommit();
                }
              }}
              onSubmitEditing={onHashtagCommit}
              blurOnSubmit={false}
            />
          </View>
          {hashtags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 10, paddingLeft: 35 }}>
              {hashtags.map(tag => (
                <View key={tag} style={{ backgroundColor: COLORS.inputBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15, flexDirection: 'row', alignItems: 'center', marginRight: 8, marginBottom: 5 }}>
                  <Text style={{ color: COLORS.textPrimary, fontSize: 12 }}>#{tag}</Text>
                  <TouchableOpacity onPress={() => onRemoveTag(tag)} style={{ marginLeft: 5 }}>
                    <Feather name="x" size={12} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Category Row */}
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }} onPress={onOpenCategories}>
          <Feather name="bookmark" size={18} color={COLORS.textPrimary} style={{ marginRight: 15 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: selectedCategories.length > 0 ? COLORS.black : COLORS.textPrimary }}>
              {selectedCategories.length > 0 ? selectedCategories.map(c => c.name).join(', ') : 'Add a category for the home feed'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Location Row */}
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }} onPress={onOpenLocation}>
          <Feather name="map-pin" size={18} color={COLORS.textPrimary} style={{ marginRight: 15 }} />
          <View style={{ flex: 1 }}>
            {locationName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ 
                  backgroundColor: COLORS.surface, 
                  paddingHorizontal: 12, 
                  paddingVertical: 6, 
                  borderRadius: 20, 
                  flexDirection: 'row', 
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: COLORS.border
                }}>
                  <Feather name="map-pin" size={12} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: '500' }}>{locationName}</Text>
                </View>
              </View>
            ) : (
              <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.textPrimary }}>Add a location</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Visibility Row */}
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }} onPress={onOpenVisibility}>
          <Feather name="eye" size={18} color={COLORS.textPrimary} style={{ marginRight: 15 }} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ 
                backgroundColor: visibility === 'Everyone' ? COLORS.surface : '#E3F2FD', 
                paddingHorizontal: 12, 
                paddingVertical: 6, 
                borderRadius: 20, 
                flexDirection: 'row', 
                alignItems: 'center',
                borderWidth: 1,
                borderColor: visibility === 'Everyone' ? COLORS.border : '#90CAF9',
                maxWidth: '95%'
              }}>
                <Feather 
                  name={visibility === 'Everyone' ? 'globe' : 'lock'} 
                  size={12} 
                  color={visibility === 'Everyone' ? COLORS.textSecondary : '#1976D2'} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={{ 
                  color: visibility === 'Everyone' ? COLORS.textPrimary : '#1976D2', 
                  fontSize: 14, 
                  fontWeight: visibility === 'Everyone' ? '500' : '600' 
                }}>
                  Post visibility: {visibility === 'Subscribers' ? (subscriptionTierId ? 'Subscribers (Tier-Locked)' : 'Subscribers Only') : visibility}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Tag People Row */}
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }} onPress={onOpenTagPeople}>
          <Feather name="user-plus" size={18} color={COLORS.textPrimary} style={{ marginRight: 15 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: taggedUsers.length > 0 ? COLORS.black : COLORS.textPrimary }}>
              {taggedUsers.length > 0 ? `${taggedUsers.length} people tagged` : 'Tag people'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default PostDetailsForm;
