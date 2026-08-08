import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import COLORS from '@/src/theme/colors';

interface ConversationActionModalProps {
  actionsVisible: boolean;
  closeActions: () => void;
  actionTitle: string;
  setActionsVisible: (visible: boolean) => void;
  confirmDeleteVisible: boolean;
  setConfirmDeleteVisible: (visible: boolean) => void;
  handleDelete: () => void;
}

export const ConversationActionModal: React.FC<ConversationActionModalProps> = ({
  actionsVisible,
  closeActions,
  actionTitle,
  setActionsVisible,
  confirmDeleteVisible,
  setConfirmDeleteVisible,
  handleDelete,
}) => {
  return (
    <>
      <Modal visible={actionsVisible} transparent animationType="fade" onRequestClose={closeActions}>
        <Pressable style={styles.actionSheetBackdrop} onPress={closeActions}>
          <Pressable style={styles.actionSheetContainer} onPress={() => {}}>
            <Text style={styles.actionSheetTitle} numberOfLines={1}>
              {actionTitle || 'Conversation'}
            </Text>

            <TouchableOpacity
              style={[styles.actionSheetButton, styles.actionSheetDeleteButton]}
              activeOpacity={0.8}
              onPress={() => {
                setActionsVisible(false);
                setConfirmDeleteVisible(true);
              }}
            >
              <Feather name="trash-2" size={18} color={COLORS.danger} />
              <Text style={[styles.actionSheetButtonText, styles.actionSheetDeleteText]}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionSheetButton, styles.actionSheetCancelButton]}
              activeOpacity={0.8}
              onPress={closeActions}
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={confirmDeleteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDeleteVisible(false)}
      >
        <Pressable style={styles.actionSheetBackdrop} onPress={() => setConfirmDeleteVisible(false)}>
          <Pressable style={styles.confirmContainer} onPress={() => {}}>
            <Text style={styles.confirmTitle}>Delete conversation?</Text>
            <Text style={styles.confirmSubtitle}>This will remove the conversation from your inbox.</Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmCancelBtn]}
                onPress={() => setConfirmDeleteVisible(false)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, styles.confirmDeleteBtn]} onPress={handleDelete}>
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: COLORS.background,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  actionSheetTitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 10,
  },
  actionSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionSheetButtonText: {
    marginLeft: 10,
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  actionSheetDeleteButton: {
    marginTop: 2,
  },
  actionSheetDeleteText: {
    color: COLORS.danger,
  },
  actionSheetCancelButton: {
    marginTop: 10,
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  actionSheetCancelText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  confirmContainer: {
    marginHorizontal: 22,
    marginBottom: 24,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 16,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  confirmSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 14,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginLeft: 10,
  },
  confirmCancelBtn: {
    backgroundColor: COLORS.surface,
  },
  confirmCancelText: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  confirmDeleteBtn: {
    backgroundColor: COLORS.danger,
  },
  confirmDeleteText: {
    fontWeight: '800',
    color: COLORS.textLight,
  },
});
