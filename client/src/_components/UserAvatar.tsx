import React, { useEffect, useMemo, useState } from 'react';
import { StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Image as ExpoImage, ImageStyle } from 'expo-image';
import {
  DEFAULT_AVATAR_URL,
  isMissingOrDefaultAvatar,
  pickAvatarUrl,
} from '@/lib/utils/avatar';

type Props = {
  user?: any;
  uri?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle | ViewStyle>;
  name?: string;
  showInitials?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * Instant chrome: letter/default shows immediately; real photo snaps on (no fade lag).
 */
export default function UserAvatar({
  user,
  uri,
  size = 40,
  style,
  name,
  showInitials = false,
  onPress,
  disabled,
  testID,
}: Props) {
  const resolved = useMemo(() => pickAvatarUrl(uri, user), [uri, user]);
  const hasPhoto = !isMissingOrDefaultAvatar(resolved);

  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [resolved]);

  useEffect(() => {
    if (!hasPhoto || failed) return;
    try {
      ExpoImage.prefetch(resolved);
    } catch {}
  }, [resolved, hasPhoto, failed]);

  const initial = String(name || user?.displayName || user?.name || user?.username || 'U')
    .trim()
    .charAt(0)
    .toUpperCase() || 'U';

  const frameStyle = [
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: '#eee',
      overflow: 'hidden' as const,
    },
    style as any,
  ];

  const showImage = hasPhoto && !failed;
  const waitingForPhoto = showImage && !loaded;

  const content = (
    <View style={frameStyle} testID={testID}>
      {/* Instant placeholder — never blank while network image loads */}
      {(showInitials && (!showImage || waitingForPhoto || failed)) || (!showImage && showInitials) ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#FF6B00',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: Math.max(12, size * 0.4), fontWeight: '700' }}>
            {initial}
          </Text>
        </View>
      ) : null}

      {!showInitials && (!showImage || waitingForPhoto) ? (
        <ExpoImage
          source={{ uri: DEFAULT_AVATAR_URL }}
          style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
        />
      ) : null}

      {showImage ? (
        <ExpoImage
          source={{ uri: resolved }}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity: loaded ? 1 : 0,
          }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
          recyclingKey={resolved}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(false);
          }}
        />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        disabled={disabled}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
