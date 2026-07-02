import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, ScrollView } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POST_SIZE = (SCREEN_WIDTH - 48) / 2;

export const ProfileSkeleton: React.FC = () => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 0.8,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 0.3,
        duration: 800,
        useNativeDriver: true,
      }),
    ]);

    Animated.loop(pulse).start();
  }, [pulseAnim]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header Block */}
      <View style={styles.headerBlock}>
        {/* Left Column: Avatar */}
        <Animated.View style={[styles.avatar, { opacity: pulseAnim }]} />

        {/* Right Column: Name & Stats Grid */}
        <View style={styles.infoWrapper}>
          <Animated.View style={[styles.titleLine, { opacity: pulseAnim }]} />
          <Animated.View style={[styles.usernameLine, { opacity: pulseAnim }]} />

          {/* Stats Boxes */}
          <View style={styles.statsRow}>
            {[1, 2, 3, 4].map((i) => (
              <Animated.View key={i} style={[styles.statBox, { opacity: pulseAnim }]} />
            ))}
          </View>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionsRow}>
        <Animated.View style={[styles.actionBtn, { opacity: pulseAnim }]} />
        <Animated.View style={[styles.actionBtnShort, { opacity: pulseAnim }]} />
        
        {/* Chips carousel placeholder */}
        <View style={styles.chipsScroll}>
          {[1, 2, 3].map((i) => (
            <Animated.View key={i} style={[styles.chipPlaceholder, { opacity: pulseAnim }]} />
          ))}
        </View>
      </View>

      {/* Bio Section */}
      <View style={styles.bioContainer}>
        <Animated.View style={[styles.bioLine, { opacity: pulseAnim }]} />
        <Animated.View style={[styles.bioLineShort, { opacity: pulseAnim }]} />
        <Animated.View style={[styles.bioLineTiny, { opacity: pulseAnim }]} />
      </View>

      {/* Highlights Circles placeholder */}
      <View style={styles.highlightsContainer}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.highlightWrapper}>
            <Animated.View style={[styles.highlightCircle, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.highlightText, { opacity: pulseAnim }]} />
          </View>
        ))}
      </View>

      {/* Tabs Placeholder */}
      <View style={styles.tabsRow}>
        {[1, 2, 3].map((i) => (
          <Animated.View key={i} style={[styles.tabItem, { opacity: pulseAnim }]} />
        ))}
      </View>

      {/* Post Grid Placeholder */}
      <View style={styles.gridContainer}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Animated.View key={i} style={[styles.gridItem, { opacity: pulseAnim }]} />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e1e9ee',
  },
  infoWrapper: {
    flex: 1,
    marginLeft: 16,
    gap: 8,
  },
  titleLine: {
    width: '60%',
    height: 20,
    borderRadius: 4,
    backgroundColor: '#e1e9ee',
  },
  usernameLine: {
    width: '40%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#e1e9ee',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 4,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#e1e9ee',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  actionBtn: {
    width: 90,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e1e9ee',
  },
  actionBtnShort: {
    width: 95,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e1e9ee',
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    marginLeft: 4,
  },
  chipPlaceholder: {
    width: 60,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e1e9ee',
  },
  bioContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 6,
  },
  bioLine: {
    width: '90%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#e1e9ee',
  },
  bioLineShort: {
    width: '75%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#e1e9ee',
  },
  bioLineTiny: {
    width: '50%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#e1e9ee',
  },
  highlightsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 20,
    gap: 16,
  },
  highlightWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  highlightCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e1e9ee',
  },
  highlightText: {
    width: 40,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#e1e9ee',
  },
  tabsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    marginTop: 24,
    paddingVertical: 12,
  },
  tabItem: {
    flex: 1,
    height: 20,
    marginHorizontal: 32,
    borderRadius: 4,
    backgroundColor: '#e1e9ee',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    justifyContent: 'space-between',
    gap: 16,
  },
  gridItem: {
    width: POST_SIZE,
    height: POST_SIZE,
    borderRadius: 12,
    backgroundColor: '#e1e9ee',
  },
});
export default ProfileSkeleton;
