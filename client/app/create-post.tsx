import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, KeyboardAvoidingView, StyleSheet, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Hook & Components
import { useCreatePost, isVideoUri } from '../hooks/useCreatePost';
import MediaPicker from '@/src/_components/CreatePost/MediaPicker';
import MediaPreview from '@/src/_components/CreatePost/MediaPreview';
import PostDetailsForm from '@/src/_components/CreatePost/PostDetailsForm';

// Modals
import CategoryModal from '@/src/_components/CreatePost/CategoryModal';
import LocationModal from '@/src/_components/CreatePost/LocationModal';
import VerifiedLocationModal from '@/src/_components/CreatePost/VerifiedLocationModal';
import TagPeopleModal from '@/src/_components/CreatePost/TagPeopleModal';
import VisibilityModal from '@/src/_components/CreatePost/VisibilityModal';

import { DEFAULT_CATEGORIES } from '../lib/firebaseHelpers/index';
import { hapticLight } from '../lib/haptics';
import COLORS from '@/src/theme/colors';

export default function CreatePostScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const {
    step, setStep, loading, caption, setCaption, hashtags, setHashtags,
    hashtagInput, setHashtagInput, visibility, setVisibility,
    selectedGroupId, setSelectedGroupId, subscriptionTierId, setSubscriptionTierId, userGroups,
    selectedImages, setSelectedImages, location, setLocation,
    verifiedLocation, setVerifiedLocation, taggedUsers, setTaggedUsers,
    selectedCategories, setSelectedCategories, categories,
    galleryAssets, loadingGallery, handleShare, handleHashtagCommit,
    locationSearch, locationResults, loadingLocationResults, handleLocationSearch,
    verifiedSearch, setVerifiedSearch, verifiedResults, loadingVerifiedResults, verifiedOptions, verifiedCenter,
    userSearch, userResults, loadingUserResults, handleUserSearch,
    categorySearch, setCategorySearch, isEditMode,
    galleryEndCursor, handleCamera, handleLaunchImageLibrary, loadGalleryAssets, handleVerifiedSearch,
    fetchNearbyVerifiedLocations, customThumbnailUri, handleSelectCustomThumbnail, handleRemoveCustomThumbnail
  } = useCreatePost(params);

  // Modal visibility states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showVerifiedModal, setShowVerifiedModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);

  const getLocationKey = (loc: any) => {
    if (!loc) return '';
    if (loc.placeId || loc.place_id) return loc.placeId || loc.place_id;
    const lat = Number(loc.lat || loc.latitude || 0).toFixed(5);
    const lon = Number(loc.lon || loc.longitude || 0).toFixed(5);
    return `${loc.name}_${lat}_${lon}`;
  };
  const dummyPanHandlers = { onStartShouldSetResponder: () => true, onMoveShouldSetResponder: () => true };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top || (Platform.OS === 'ios' ? 47 : 0), paddingBottom: insets.bottom || (Platform.OS === 'ios' ? 34 : 0) }}>
      {step === 'picker' ? (
        <MediaPicker
          assets={galleryAssets || []}
          selectedImages={selectedImages || []}
          onSelect={(uri) => {
            hapticLight();
            if (selectedImages.includes(uri)) {
              setSelectedImages(selectedImages.filter(i => i !== uri));
            } else {
              const isTargetVideo = isVideoUri(uri, galleryAssets);
              const hasExistingVideo = selectedImages.some(i => isVideoUri(i, galleryAssets));

              if (isTargetVideo) {
                if (selectedImages.length > 0) {
                  Alert.alert('Single Video Limit', 'Only 1 video can be selected per post.');
                  return;
                }
              } else if (hasExistingVideo) {
                Alert.alert('Single Video Limit', 'Only 1 video can be selected per post.');
                return;
              }

              if ((selectedImages || []).length >= 25) {
                Alert.alert('Limit Reached', 'You can select up to 25 photos.');
                return;
              }
              const asset = (galleryAssets || []).find(a => a.uri === uri);
              if (asset && asset.mediaType === 'video' && asset.duration) {
                const durationInSeconds = asset.duration > 2520 ? (asset.duration / 1000) : asset.duration;
                if (durationInSeconds > 2520) {
                  Alert.alert('Video Too Long', 'Videos in posts must be 42 minutes or shorter.');
                  return;
                }
              }
              setSelectedImages([...(selectedImages || []), uri]);
            }
          }}
          onCamera={handleCamera} 
          onBrowseFolders={handleLaunchImageLibrary}
          onLoadMore={() => loadGalleryAssets(galleryEndCursor)}
          onNext={() => {
            hapticLight();
            setStep('details');
          }}
          onBack={() => router.back()}
          canNext={(selectedImages || []).length > 0}
          loading={loadingGallery}
        />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10 }}>
              <TouchableOpacity 
                onPress={() => isEditMode ? router.back() : setStep('picker')} 
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' }}
              >
                <Feather name="x" size={20} color={COLORS.black} />
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>{isEditMode ? 'Edit post' : 'New post'}</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView style={{ flex: 1 }}>
              <MediaPreview
                uris={selectedImages}
                thumbnails={{}}
                isVideo={(uri) => isVideoUri(uri, galleryAssets)}
                height={350}
                onRemove={(index) => {
                  const updated = [...selectedImages];
                  updated.splice(index, 1);
                  setSelectedImages(updated);
                }}
              />
              <PostDetailsForm
                caption={caption}
                setCaption={setCaption}
                hashtags={hashtags}
                hashtagInput={hashtagInput}
                onHashtagInputChange={setHashtagInput}
                onHashtagCommit={handleHashtagCommit}
                onRemoveTag={(tag) => setHashtags(hashtags.filter(t => t !== tag))}
                selectedCategories={selectedCategories}
                onOpenCategories={() => setShowCategoryModal(true)}
                onRemoveCategory={(name) => setSelectedCategories(selectedCategories.filter(c => c.name !== name))}
                locationName={location?.name}
                onOpenLocation={() => setShowLocationModal(true)}
                taggedUsers={taggedUsers}
                onOpenTagPeople={() => setShowTagModal(true)}
                onRemoveTaggedUser={(uid) => setTaggedUsers(taggedUsers.filter(u => u.uid !== uid))}
                visibility={visibility}
                subscriptionTierId={subscriptionTierId}
                onOpenVisibility={() => setShowVisibilityModal(true)}
                hasVideo={(selectedImages || []).some(uri => isVideoUri(uri, galleryAssets))}
                customThumbnailUri={customThumbnailUri}
                onSelectCustomThumbnail={handleSelectCustomThumbnail}
                onRemoveCustomThumbnail={handleRemoveCustomThumbnail}
              />
            </ScrollView>

            {/* Footer */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: (insets.bottom || 20) + 5 }}>
              <TouchableOpacity onPress={() => {
                setCaption('');
                setHashtags([]);
                setLocation(null);
                setVerifiedLocation(null);
                setTaggedUsers([]);
                setSelectedCategories([]);
              }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textPrimary }}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShare}
                disabled={loading}
                style={{
                  backgroundColor: COLORS.primary,
                  paddingHorizontal: 35,
                  paddingVertical: 12,
                  borderRadius: 8,
                  opacity: loading ? 0.6 : 1,
                  minWidth: 100,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.textLight} />
                ) : (
                  <Text style={{ color: COLORS.textLight, fontWeight: 'bold', fontSize: 15 }}>
                    {isEditMode ? 'Save' : 'Share'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      <CategoryModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        categories={categories.length > 0 ? categories : DEFAULT_CATEGORIES.map(c => typeof c === 'string' ? { name: c, image: '' } : c)}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        categorySearch={categorySearch}
        onSearchChange={setCategorySearch}
        panHandlers={dummyPanHandlers as any}
        iosSheetKeyboardOffset={0}
      />
      
      <LocationModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        locationSearch={locationSearch}
        onSearchChange={handleLocationSearch}
        loadingLocationResults={loadingLocationResults}
        locationResults={locationResults}
        location={location}
        setLocation={setLocation}
        getLocationKey={getLocationKey}
        panHandlers={dummyPanHandlers as any}
        iosSheetKeyboardOffset={0}
      />

      <VerifiedLocationModal
        visible={showVerifiedModal}
        onClose={() => setShowVerifiedModal(false)}
        verifiedSearch={verifiedSearch}
        onSearchChange={handleVerifiedSearch}
        loadingVerifiedResults={loadingVerifiedResults}
        verifiedResults={verifiedResults}
        verifiedOptions={verifiedOptions}
        verifiedLocation={verifiedLocation}
        setVerifiedLocation={setVerifiedLocation}
        getLocationKey={getLocationKey}
        verifiedCenter={verifiedCenter}
        panHandlers={dummyPanHandlers as any}
        iosSheetKeyboardOffset={0}
      />

      <TagPeopleModal
        visible={showTagModal}
        onClose={() => setShowTagModal(false)}
        userSearch={userSearch}
        onSearchChange={handleUserSearch}
        loadingUserResults={loadingUserResults}
        userResults={userResults}
        taggedUsers={taggedUsers}
        setTaggedUsers={setTaggedUsers}
        panHandlers={dummyPanHandlers as any}
        iosSheetKeyboardOffset={0}
      />

      <VisibilityModal
        visible={showVisibilityModal}
        onClose={() => setShowVisibilityModal(false)}
        visibility={visibility}
        setVisibility={setVisibility}
        selectedGroupId={selectedGroupId}
        setSelectedGroupId={setSelectedGroupId}
        subscriptionTierId={subscriptionTierId}
        setSubscriptionTierId={setSubscriptionTierId}
        userGroups={userGroups}
        panHandlers={dummyPanHandlers as any}
      />

      {loading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }]}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </View>
  );
}
