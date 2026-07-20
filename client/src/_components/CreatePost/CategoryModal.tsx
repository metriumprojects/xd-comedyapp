import React from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, TextInput, Image, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { hapticLight } from '@/lib/haptics';
import { getCategoryImageSource } from '@/lib/categoryImages';
import { getModalHeight } from '@/utils/responsive';

interface CategoryModalProps {
  visible: boolean;
  onClose: () => void;
  categories: { name: string; image: string }[];
  selectedCategories: { name: string; image: string }[];
  setSelectedCategories: (categories: { name: string; image: string }[]) => void;
  categorySearch: string;
  onSearchChange: (text: string) => void;
  panHandlers: any;
  iosSheetKeyboardOffset: number;
}

const CategoryModal: React.FC<CategoryModalProps> = ({
  visible,
  onClose,
  categories,
  selectedCategories,
  setSelectedCategories,
  categorySearch,
  onSearchChange,
  panHandlers,
  iosSheetKeyboardOffset,
}) => {
  const renderCategoryItem = ({ item }: { item: { name: string; image: string } }) => {
    const isSelected = selectedCategories.some(c => c.name.toLowerCase() === item.name.toLowerCase());
    return (
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
          paddingHorizontal: 14,
          backgroundColor: isSelected ? '#FFF8F0' : '#FAFAFA',
          borderRadius: 12,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: isSelected ? '#FFE0B2' : '#F0F0F0'
        }}
        onPress={() => {
          hapticLight();
          if (isSelected) {
            setSelectedCategories(selectedCategories.filter(c => c.name.toLowerCase() !== item.name.toLowerCase()));
          } else {
            setSelectedCategories([...selectedCategories, item]);
          }
        }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 15, fontWeight: isSelected ? '600' : '400', color: isSelected ? '#FF8D00' : '#111', flex: 1 }}>
          {item.name}
        </Text>
        <Ionicons 
          name={isSelected ? "checkbox" : "square-outline"} 
          size={22} 
          color={isSelected ? "#FF8D00" : "#B0B0B0"} 
        />
      </TouchableOpacity>
    );
  };

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
            backgroundColor: '#fff',
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
                <View style={{ width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center' }} />
              </View>
              <Text style={{ fontWeight: '500', fontSize: 16, marginBottom: 8, color: '#000', textAlign: 'center' }}>Add a category</Text>
              <Text style={{ color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                This will help people find your post in the home feed.
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' }}>
                <Feather name="search" size={18} color="#000" style={{ marginRight: 10 }} />
                <TextInput
                  style={{ flex: 1, fontSize: 15, color: '#000' }}
                  placeholder="Search"
                  placeholderTextColor="#666"
                  value={categorySearch}
                  onChangeText={onSearchChange}
                />
              </View>
            </View>

            <View style={{ flex: 1, paddingHorizontal: 20 }}>
              <FlatList
                data={categories.filter(c => c.name.toLowerCase() !== 'podium' && c.name.toLowerCase().includes(categorySearch.toLowerCase()))}
                keyExtractor={item => item.name}
                renderItem={renderCategoryItem}
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#888' }}>No categories found</Text>
                  </View>
                }
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 }}>
                <TouchableOpacity onPress={onClose}>
                  <Text style={{ color: '#111', fontWeight: '700', fontSize: 15 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onClose}
                  style={{ backgroundColor: '#FF8D00', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default React.memo(CategoryModal);
