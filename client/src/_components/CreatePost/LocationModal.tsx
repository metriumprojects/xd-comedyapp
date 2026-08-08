import React from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '@/lib/haptics';
import { getModalHeight } from '@/utils/responsive';
import COLORS from '@/src/theme/colors';

interface LocationType {
  name: string;
  address: string;
  placeId?: string;
  lat: number;
  lon: number;
  verified?: boolean;
}

interface LocationModalProps {
  visible: boolean;
  onClose: () => void;
  locationSearch: string;
  onSearchChange: (text: string) => void;
  loadingLocationResults: boolean;
  locationResults: LocationType[];
  location: LocationType | null;
  setLocation: (location: LocationType | null) => void;
  getLocationKey: (loc: any) => string;
  panHandlers: any;
  iosSheetKeyboardOffset: number;
}

const LocationModal: React.FC<LocationModalProps> = ({
  visible,
  onClose,
  locationSearch,
  onSearchChange,
  loadingLocationResults,
  locationResults,
  location,
  setLocation,
  getLocationKey,
  panHandlers,
  iosSheetKeyboardOffset,
}) => {
  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      transparent 
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        enabled={Platform.OS === 'ios'}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={iosSheetKeyboardOffset}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
          <View style={{
            backgroundColor: COLORS.background,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            maxHeight: getModalHeight(0.85),
            minHeight: 450,
            overflow: 'hidden'
          }}>
            <View 
              {...panHandlers}
              style={{ paddingHorizontal: 20, paddingTop: 16 }}
            >
              <View style={{ width: '100%', height: 32, justifyContent: 'center' }}>
                <View style={{ width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center' }} />
              </View>
              <Text style={{ fontWeight: '500', fontSize: 16, marginBottom: 20, color: COLORS.black, textAlign: 'center' }}>Choose a location to tag</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.inputBg }}>
                <Feather name="search" size={18} color={COLORS.black} style={{ marginRight: 10 }} />
                <TextInput
                  style={{ flex: 1, fontSize: 15, color: COLORS.black }}
                  placeholder="Search"
                  placeholderTextColor={COLORS.textSecondary}
                  value={locationSearch}
                  onChangeText={onSearchChange}
                />
              </View>
            </View>

            <View style={{ flex: 1, paddingHorizontal: 20 }}>
              {loadingLocationResults ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 20 }} />
              ) : (
                <FlatList
                  data={locationResults}
                  keyExtractor={(item, idx) => getLocationKey(item) || String(idx)}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1 }}
                  renderItem={({ item }) => {
                    const isSelected = !!location && getLocationKey(location) === getLocationKey(item);
                    return (
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, backgroundColor: isSelected ? '#f2f2f2' : 'transparent', borderRadius: 12, marginBottom: 4 }}
                        onPress={() => {
                          hapticLight();
                          if (isSelected) setLocation(null);
                          else setLocation(item);
                        }}
                      >
                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.inputBg, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                          <Feather name="map-pin" size={18} color={COLORS.black} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textPrimary }}>{item.name}</Text>
                          <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 2 }}>{item.address}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={<Text style={{ color: COLORS.textMuted, marginTop: 12, textAlign: 'center' }}>No results</Text>}
                  contentContainerStyle={{ paddingBottom: 20 }}
                />
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 }}>
                <TouchableOpacity onPress={onClose}>
                  <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onClose}
                  style={{ backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 }}
                >
                  <Text style={{ color: COLORS.textLight, fontWeight: '600', fontSize: 15 }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default React.memo(LocationModal);
