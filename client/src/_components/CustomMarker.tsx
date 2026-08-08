import React from 'react';
import { Image, View } from 'react-native';
import COLORS from '@/src/theme/colors';

interface CustomMarkerProps {
  imageUrl: string;
  size?: number;
}

export const CustomMarker: React.FC<CustomMarkerProps> = ({ imageUrl, size = 70 }) => {
  const innerSize = size - 6; // 3px padding on each side
  const pointerSize = 12;

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Main marker container with orange border */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 6,
          backgroundColor: COLORS.primary,
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        {/* White inner background */}
        <View
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 6,
            overflow: 'hidden',
            backgroundColor: COLORS.background,
          }}
        >
          {/* Image */}
          <Image
            source={{ uri: imageUrl }}
            style={{ width: innerSize, height: innerSize }}
            resizeMode="cover"
          />
        </View>
      </View>

      {/* Speech bubble pointer */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: pointerSize / 2,
          borderRightWidth: pointerSize / 2,
          borderTopWidth: pointerSize,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: COLORS.primary,
          marginTop: -2,
        }}
      />
    </View>
  );
};

export default CustomMarker;
