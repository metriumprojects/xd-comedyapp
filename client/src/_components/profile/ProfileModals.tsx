import React, { useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Image,
  Share,
  Platform,
  Animated,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { hapticLight } from '@/lib/haptics';
import COLORS from '@/src/theme/colors';
import { useSwipeDownToDismiss } from '@/hooks/useSwipeDownToDismiss';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CollectionsModalProps {
  visible: boolean;
  onClose: () => void;
  sections: any[];
  selectedSection: string | null;
  onSelectSection: (sectionName: string | null) => void;
}

export const CollectionsModal: React.FC<CollectionsModalProps> = ({
  visible,
  onClose,
  sections,
  selectedSection,
  onSelectSection,
}) => {
  const {
    headerPanHandlers,
    sheetPanHandlers,
    animatedStyle,
    dismiss,
  } = useSwipeDownToDismiss({
    onDismiss: () => {
      hapticLight();
      onClose();
    },
    visible,
    initialSlideIn: true,
    initialOffset: 450,
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={() => {
        hapticLight();
        dismiss();
      }}
    >
      <View style={styles.menuOverlay}>
        <TouchableOpacity
          style={{ flex: 1, width: '100%' }}
          activeOpacity={1}
          onPress={() => {
            hapticLight();
            dismiss();
          }}
        />
        <Animated.View 
          {...sheetPanHandlers}
          style={[styles.menuSheet, animatedStyle]}
        >
          <View style={styles.menuSheetContent}>
            <View {...headerPanHandlers} style={[styles.handleContainer, { paddingVertical: 12, width: '100%' }]}>
              <View style={styles.menuHandle} />
            </View>
            
            <View style={{ paddingHorizontal: 20, paddingBottom: 15 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 }}>Collections</Text>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>View specific sets of photos and videos</Text>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              <TouchableOpacity
                style={styles.collectionSheetRow}
                onPress={() => {
                  hapticLight();
                  onSelectSection(null);
                  onClose();
                }}
              >
                <View style={styles.collectionSheetThumbPlaceholder}>
                  <Ionicons name="grid" size={20} color={COLORS.textSecondary} />
                </View>
                <Text style={[
                  styles.collectionSheetText,
                  !selectedSection && styles.collectionSheetTextActive
                ]}>All Posts</Text>
              </TouchableOpacity>

              {sections.map((section) => (
                <TouchableOpacity
                  key={section.id || section.name}
                  style={styles.collectionSheetRow}
                  onPress={() => {
                    hapticLight();
                    onSelectSection(section.name);
                    onClose();
                  }}
                >
                  {section.coverImage ? (
                    <Image source={{ uri: section.coverImage }} style={styles.collectionSheetThumb} />
                  ) : (
                    <View style={styles.collectionSheetThumbPlaceholder}>
                      <Ionicons name="folder-outline" size={20} color={COLORS.textSecondary} />
                    </View>
                  )}
                  <Text style={[
                    styles.collectionSheetText,
                    selectedSection === section.name && styles.collectionSheetTextActive
                  ]}>{section.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

interface UserMenuModalProps {
  visible: boolean;
  onClose: () => void;
  isOwnProfile: boolean;
  onBlock: () => void;
  onReport: () => void;
  onShare: () => void;
  isSubscribed?: boolean;
  onManageSubscription?: () => void;
}

export const UserMenuModal: React.FC<UserMenuModalProps> = ({
  visible,
  onClose,
  isOwnProfile,
  onBlock,
  onReport,
  onShare,
  isSubscribed,
  onManageSubscription,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const {
    headerPanHandlers,
    sheetPanHandlers,
    translateY: dragTranslateY,
    dismiss,
  } = useSwipeDownToDismiss({
    onDismiss: handleClose,
    visible,
  });

  const combinedTranslateY = Animated.add(slideAnim, dragTranslateY);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(300);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.menuOverlayWrapper, { opacity: fadeAnim }]}>
      <TouchableOpacity 
        style={styles.menuOverlay} 
        activeOpacity={1} 
        onPress={handleClose}
      >
        <Animated.View 
          {...sheetPanHandlers}
          style={[styles.menuSheet, { transform: [{ translateY: combinedTranslateY }] }]}
        >
          <View style={styles.menuSheetContent}>
            <View {...headerPanHandlers} style={[styles.handleContainer, { paddingVertical: 12, width: '100%' }]}>
              <View style={styles.menuHandle} />
            </View>

            {!isOwnProfile && (
              <>
                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => {
                    onClose();
                    onReport();
                  }}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: COLORS.primaryLight }]}>
                    <Feather name="flag" size={18} color={COLORS.danger} />
                  </View>
                  <Text style={[styles.menuItemText, { color: COLORS.danger }]}>Report User</Text>
                </TouchableOpacity>

                <View style={styles.menuSeparator} />

                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => {
                    onClose();
                    onBlock();
                  }}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: COLORS.inputBg }]}>
                    <Feather name="slash" size={18} color={COLORS.textPrimary} />
                  </View>
                  <Text style={styles.menuItemText}>Block User</Text>
                </TouchableOpacity>

                <View style={styles.menuSeparator} />

                {isSubscribed && onManageSubscription && (
                  <>
                    <TouchableOpacity 
                      style={styles.menuItem} 
                      onPress={() => {
                        onClose();
                        onManageSubscription();
                      }}
                    >
                      <View style={[styles.menuIconContainer, { backgroundColor: '#FFFBEA' }]}>
                        <Feather name="star" size={18} color="#FFB800" />
                      </View>
                      <Text style={styles.menuItemText}>Manage Subscription</Text>
                    </TouchableOpacity>

                    <View style={styles.menuSeparator} />
                  </>
                )}
              </>
            )}

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                onClose();
                onShare();
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: COLORS.primaryLight }]}>
                <Feather name="share-2" size={18} color={COLORS.info} />
              </View>
              <Text style={styles.menuItemText}>Share Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuCancelBtn} 
              onPress={handleClose}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  menuOverlayWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  menuSheetContent: {
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
  },
  menuHandle: {
    width: 38,
    height: 4.5,
    backgroundColor: '#DADCE0',
    borderRadius: 2.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuItemText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  menuSeparator: {
    height: 1,
    backgroundColor: COLORS.inputBg,
    marginHorizontal: 20,
  },
  menuCancelBtn: {
    marginTop: 10,
    marginBottom: 4,
    marginHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    alignItems: 'center',
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  collectionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.inputBg,
  },
  collectionSheetThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: COLORS.border,
  },
  collectionSheetThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionSheetText: {
    fontSize: 17,
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  collectionSheetTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
