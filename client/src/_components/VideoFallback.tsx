// Fallback component for video rendering issues
import React from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import COLORS from '@/src/theme/colors';

type VideoFallbackProps = {
  connectionStatus: string;
  initializeViewer: () => void;
  reconnectAttemptsRef?: React.MutableRefObject<any>;
};

export default function VideoFallback({ connectionStatus, initializeViewer, reconnectAttemptsRef }: VideoFallbackProps) {
  const [showError, setShowError] = React.useState(false);

  React.useEffect(() => {
    // Show error if video not rendered after 8 seconds
    const timeout = setTimeout(() => setShowError(true), 8000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.black }}>
      <ActivityIndicator size="large" color={COLORS.textLight} style={{ marginBottom: 10 }} />
      <Text style={{ color: COLORS.textLight, fontSize: 16 }}>
        {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Connecting to live stream...'}
      </Text>
      <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 5 }}>
        {connectionStatus === 'reconnecting' ? 'Attempting reconnect...' : 'Please wait'}
      </Text>
      {showError && (
        <View style={{ marginTop: 20, padding: 16, backgroundColor: COLORS.danger, borderRadius: 8 }}>
          <Text style={{ color: COLORS.textLight, fontWeight: 'bold', textAlign: 'center' }}>
            Video not rendering. This is usually a device or system issue. Try:
            {'\n'}- Restarting the app
            {'\n'}- Switching WiFi/data
            {'\n'}- Testing on another device
            {'\n'}- Updating the app/OS
            {'\n'}- If problem persists, update Agora SDK or check device compatibility.
          </Text>
        </View>
      )}
      {connectionStatus === 'disconnected' && (
        <TouchableOpacity 
          style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.danger, borderRadius: 8 }}
          onPress={() => {
            if (typeof reconnectAttemptsRef !== 'undefined' && reconnectAttemptsRef.current) reconnectAttemptsRef.current = 0;
            initializeViewer();
          }}
        >
          <Text style={{ color: COLORS.textLight, fontWeight: 'bold' }}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
