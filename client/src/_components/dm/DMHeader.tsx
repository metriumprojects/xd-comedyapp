import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import UserAvatar from '../UserAvatar';
import VerifiedBadge from '../VerifiedBadge';
import COLORS from '@/src/theme/colors';

type DMHeaderProps = {
  displayName: string;
  avatarUri: string;
  isGroup: boolean;
  statusText?: string;
  onBack: () => void;
  onInfo: () => void;
  onTitlePress?: () => void;
  onCall?: () => void;
  onVideoCall?: () => void;
  verified?: boolean;
};

const DMHeader: React.FC<DMHeaderProps> = ({
  displayName,
  avatarUri,
  isGroup,
  statusText,
  onBack,
  onInfo,
  onTitlePress,
  onCall,
  onVideoCall,
  verified,
}) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="chevron-left" size={28} color={COLORS.textPrimary || '#1f2937'} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.headerTitle} onPress={onTitlePress || onInfo} activeOpacity={0.7}>
        <UserAvatar
          uri={avatarUri}
          name={displayName}
          size={36}
          showInitials={!isGroup}
          style={styles.headerAvatar}
        />
        <View style={styles.headerNameContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.headerName} numberOfLines={1}>
              {displayName}
            </Text>
            {!!verified && <VerifiedBadge size={14} />}
          </View>
          {statusText ? (
            <Text style={styles.headerStatus}>{statusText}</Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="info" size={22} color={COLORS.textPrimary || '#1f2937'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: COLORS.background || '#ffffff',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border || '#ebebeb',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#efefef',
  },
  headerNameContainer: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary || '#1f2937',
  },
  headerStatus: {
    fontSize: 11,
    color: COLORS.primary || '#FF6B00',
    marginTop: 1,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: 10,
  },
});

export default DMHeader;
