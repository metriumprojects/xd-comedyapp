import React, { useState, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  PanResponder,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserAvatar from '../UserAvatar';
import { useUserProfile, getCachedUserProfile } from '../../../hooks/useUserProfile';
import COLORS from '@/src/theme/colors';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type ReactionEntry = {
  emoji: string;
  userId: string;
};

type DMReactionsModalProps = {
  visible: boolean;
  reactions?: { [emoji: string]: string[] } | Map<string, string[]> | any;
  currentUserId?: string | null;
  myIds?: string[];
  onClose: () => void;
  onRemoveReaction?: (emoji: string) => void;
  onUserPress?: (userId: string) => void;
};

const ReactionUserRow: React.FC<{
  userId: string;
  emoji: string;
  isMe: boolean;
  onRemove?: () => void;
  onPressUser?: () => void;
}> = ({ userId, emoji, isMe, onRemove, onPressUser }) => {
  const { profile } = useUserProfile(userId);
  const cached = getCachedUserProfile(userId);

  const displayName = profile?.displayName || profile?.name || profile?.username ||
    cached?.displayName || cached?.name || cached?.username || (isMe ? 'You' : 'User');
  const avatarUrl = profile?.avatar || profile?.photoURL || cached?.avatar || cached?.photoURL || '';

  return (
    <TouchableOpacity
      style={styles.userRow}
      activeOpacity={0.7}
      onPress={isMe ? onRemove : onPressUser}
    >
      <View style={styles.userLeft}>
        <UserAvatar
          uri={avatarUrl}
          name={displayName}
          size={42}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {displayName} {isMe ? '(You)' : ''}
          </Text>
          {isMe && (
            <Text style={styles.removeHint}>Tap to remove reaction</Text>
          )}
        </View>
      </View>

      <View style={styles.userRight}>
        <Text style={styles.rowEmoji}>{emoji}</Text>
        {isMe && (
          <TouchableOpacity
            style={styles.removeIconBtn}
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const DMReactionsModal: React.FC<DMReactionsModalProps> = ({
  visible,
  reactions,
  currentUserId,
  myIds = [],
  onClose,
  onRemoveReaction,
  onUserPress,
}) => {
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) {
            translateY.setValue(g.dy);
          }
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 80 || g.vy > 0.5) {
            Animated.timing(translateY, {
              toValue: SCREEN_HEIGHT,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              translateY.setValue(0);
              onClose();
            });
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [onClose, translateY]
  );

  // Normalize reactions map
  const parsedEntries = useMemo(() => {
    if (!reactions) return [];
    const entries: ReactionEntry[] = [];
    if (reactions instanceof Map) {
      reactions.forEach((users: any, emoji: any) => {
        if (Array.isArray(users)) {
          users.forEach((uid: any) => {
            if (uid) entries.push({ emoji: String(emoji), userId: String(uid) });
          });
        }
      });
    } else if (typeof reactions === 'object') {
      Object.entries(reactions).forEach(([emoji, users]) => {
        if (Array.isArray(users)) {
          users.forEach((uid: any) => {
            if (uid) entries.push({ emoji: String(emoji), userId: String(uid) });
          });
        }
      });
    }
    return entries;
  }, [reactions]);

  const emojiCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    parsedEntries.forEach((e) => {
      counts[e.emoji] = (counts[e.emoji] || 0) + 1;
    });
    return counts;
  }, [parsedEntries]);

  const uniqueEmojis = useMemo(() => Object.keys(emojiCounts), [emojiCounts]);

  const displayedEntries = useMemo(() => {
    if (selectedTab === 'all') return parsedEntries;
    return parsedEntries.filter((e) => e.emoji === selectedTab);
  }, [parsedEntries, selectedTab]);

  const checkIsMe = (uid: string) => {
    if (!uid) return false;
    const str = String(uid);
    if (currentUserId && String(currentUserId) === str) return true;
    return myIds.includes(str);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <Animated.View
          style={[styles.sheetContainer, { transform: [{ translateY }] }]}
        >
          {/* Header Drag Handle */}
          <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
            <View style={styles.dragPill} />
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.titleText}>Reactions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Emoji Category Tabs */}
          <View style={styles.tabsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsScrollContent}
            >
              <TouchableOpacity
                style={[styles.tabPill, selectedTab === 'all' && styles.tabPillActive]}
                onPress={() => setSelectedTab('all')}
              >
                <Text style={[styles.tabText, selectedTab === 'all' && styles.tabTextActive]}>
                  All {parsedEntries.length}
                </Text>
              </TouchableOpacity>

              {uniqueEmojis.map((emoji) => {
                const count = emojiCounts[emoji];
                const isActive = selectedTab === emoji;
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.tabPill, isActive && styles.tabPillActive]}
                    onPress={() => setSelectedTab(emoji)}
                  >
                    <Text style={styles.tabEmoji}>{emoji}</Text>
                    <Text style={[styles.tabCount, isActive && styles.tabTextActive]}>
                      {count}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Participants List */}
          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {displayedEntries.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No reactions yet</Text>
              </View>
            ) : (
              displayedEntries.map((item, idx) => {
                const isMe = checkIsMe(item.userId);
                return (
                  <ReactionUserRow
                    key={`${item.userId}_${item.emoji}_${idx}`}
                    userId={item.userId}
                    emoji={item.emoji}
                    isMe={isMe}
                    onRemove={() => {
                      onRemoveReaction?.(item.emoji);
                    }}
                    onPressUser={() => {
                      onClose();
                      onUserPress?.(item.userId);
                    }}
                  />
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.65,
    minHeight: 280,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  dragHandleArea: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragPill: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 4,
  },
  tabsWrapper: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  tabPillActive: {
    backgroundColor: '#FFF4EB',
    borderColor: '#FFD4B2',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: COLORS.primary || '#FF6B00',
    fontWeight: '700',
  },
  tabEmoji: {
    fontSize: 14,
  },
  tabCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f8fafc',
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  removeHint: {
    fontSize: 11,
    color: COLORS.primary || '#FF6B00',
    marginTop: 2,
    fontWeight: '500',
  },
  userRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowEmoji: {
    fontSize: 18,
  },
  removeIconBtn: {
    padding: 2,
  },
  emptyState: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
});

export default React.memo(DMReactionsModal);
