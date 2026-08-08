import { hapticLight, hapticMedium } from '@/lib/haptics';
import React, { useState } from 'react';
import { Text, TouchableOpacity, Alert } from 'react-native';
import { useAppDialog } from '@/src/_components/AppDialogProvider';
import { COLORS } from '@/src/theme/colors';

interface AcceptDeclineButtonsProps {
  item: any;
  onActionTaken?: (id: string) => void;
}

const AcceptDeclineButtons: React.FC<AcceptDeclineButtonsProps> = ({ item, onActionTaken }) => {
  const [actionTaken, setActionTaken] = useState(false);
  const { showSuccess } = useAppDialog();

  return (
    <>
      <TouchableOpacity
        style={{
          backgroundColor: COLORS.primary,
          paddingVertical: 6,
          paddingHorizontal: 18,
          borderRadius: 8,
          marginRight: 8,
          opacity: actionTaken ? 0.5 : 1,
        }}
        disabled={actionTaken}
        onPress={async () => {
          hapticMedium();
          setActionTaken(true);
          try {
            // Backend API call to accept follow request
            const response = await fetch(`/api/users/followRequests/${item.senderId}/accept`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) throw new Error('Failed to accept request');
            showSuccess('Follow request accepted');
            if (onActionTaken) onActionTaken(item.id);
          } catch (err) {
            console.error('Error accepting request:', err);
            Alert.alert('Error', 'Failed to accept request');
          }
        }}
      >
        <Text style={{ color: COLORS.textLight, fontWeight: 'bold' }}>Accept</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          backgroundColor: COLORS.danger,
          paddingVertical: 6,
          paddingHorizontal: 18,
          borderRadius: 8,
          opacity: actionTaken ? 0.5 : 1,
        }}
        disabled={actionTaken}
        onPress={async () => {
          hapticLight();
          setActionTaken(true);
          try {
            // Backend API call to reject follow request
            const response = await fetch(`/api/users/followRequests/${item.senderId}/reject`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) throw new Error('Failed to reject request');
            showSuccess('Follow request rejected');
            if (onActionTaken) onActionTaken(item.id);
          } catch (err) {
            console.error('Error rejecting request:', err);
            Alert.alert('Error', 'Failed to reject request');
          }
        }}
      >
        <Text style={{ color: COLORS.textLight, fontWeight: 'bold' }}>Decline</Text>
      </TouchableOpacity>
    </>
  );
};

export default AcceptDeclineButtons;
