import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    SectionList,
    StyleSheet,
    Dimensions,
    Platform,
    Animated,
    PanResponder,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@/lib/storage';
import { useNotifications } from '../../hooks/useNotifications';
import { getNotificationActionText, getNotificationDisplayText, isSystemNotification } from '@/src/utils/notificationText';
import { resolveAvatarUrl, isMissingOrDefaultAvatar } from '@/lib/utils/avatar';
import { cacheUserProfile } from '@/hooks/useUserProfile';
import { showStoryUnavailableAlert } from '@/src/utils/storyAlerts';
import UserAvatar from './UserAvatar';
import { resolveNotificationSender, warmNotificationAvatars } from '@/src/utils/notificationAvatar';
import { useReelsStore } from '@/store/useReelsStore';
import { getActiveStories } from '@/lib/firebaseHelpers/core';
import COLORS from '@/src/theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface NotificationsModalProps {
    visible: boolean;
    onClose: () => void;
}

function formatInstagramTime(dateInput: any): string {
    if (!dateInput) return 'now';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'now';
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d`;
    const diffWeeks = Math.floor(diffDays / 7);
    return `${diffWeeks}w`;
}

/** Group notifications into Instagram-style chronological sections */
export function groupNotificationsByDate(items: any[]): { title: string; data: any[] }[] {
    if (!Array.isArray(items) || items.length === 0) return [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - (24 * 60 * 60 * 1000);
    const startOfWeek = startOfToday - (6 * 24 * 60 * 60 * 1000); // 7-day window

    const groups: { [key: string]: any[] } = {
        'Today': [],
        'Yesterday': [],
        'This week': [],
        'Earlier': [],
    };

    for (const item of items) {
        const itemDate = item?.createdAt ? new Date(item.createdAt).getTime() : 0;
        if (itemDate >= startOfToday) {
            groups['Today'].push(item);
        } else if (itemDate >= startOfYesterday) {
            groups['Yesterday'].push(item);
        } else if (itemDate >= startOfWeek) {
            groups['This week'].push(item);
        } else {
            groups['Earlier'].push(item);
        }
    }

    const order = ['Today', 'Yesterday', 'This week', 'Earlier'];
    const result: { title: string; data: any[] }[] = [];

    for (const key of order) {
        if (groups[key].length > 0) {
            result.push({ title: key, data: groups[key] });
        }
    }

    return result;
}

export default function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
    const router = useRouter();
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [activeStoryMap, setActiveStoryMap] = useState<Map<string, string>>(new Map());

    const { notifications, fetchNotifications, markAsRead } = useNotifications(currentUserId || '');

    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const uid = await AsyncStorage.getItem('userId');
                if (isMounted && uid) setCurrentUserId(String(uid));
            } catch { }
        })();
        return () => { isMounted = false; };
    }, []);

    const handleDismiss = useCallback(() => {
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: SCREEN_HEIGHT,
                duration: 220,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose();
        });
    }, [onClose, backdropOpacity, translateY]);

    // Animate open and pause background video reels
    useEffect(() => {
        if (visible) {
            translateY.setValue(SCREEN_HEIGHT);
            backdropOpacity.setValue(0);
            Animated.parallel([
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.spring(translateY, {
                    toValue: 0,
                    damping: 26,
                    stiffness: 240,
                    useNativeDriver: true,
                }),
            ]).start();

            useReelsStore.getState().setModalOpen(true);
            if (currentUserId) {
                fetchNotifications();
            }

            // Fetch live stories to ensure story rings ONLY appear if a user actually has an active story
            (async () => {
                try {
                    const res = await getActiveStories();
                    const stories = Array.isArray(res?.stories) ? res.stories : [];
                    const map = new Map<string, string>();
                    for (const s of stories) {
                        const uid = String(s?.userId || s?.authorId || s?.uid || '').trim();
                        const sid = String(s?._id || s?.id || s?.storyId || '').trim();
                        const uname = String(s?.userName || s?.username || '').trim().toLowerCase();
                        if (uid && sid && !map.has(uid)) {
                            map.set(uid, sid);
                        }
                        if (uname && sid && !map.has(`name:${uname}`)) {
                            map.set(`name:${uname}`, sid);
                        }
                    }
                    setActiveStoryMap(map);
                } catch { }
            })();
        } else {
            useReelsStore.getState().setModalOpen(false);
        }
        return () => {
            useReelsStore.getState().setModalOpen(false);
        };
    }, [visible, currentUserId]);

    // Pre-warm avatar cache on notifications arrival
    useEffect(() => {
        if (Array.isArray(notifications) && notifications.length > 0) {
            warmNotificationAvatars(notifications);
        }
    }, [notifications]);

    // PanResponder for smooth swipe-down-to-dismiss gesture from the top drag area
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 5;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    translateY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100 || gestureState.vy > 0.5) {
                    handleDismiss();
                } else {
                    Animated.spring(translateY, {
                        toValue: 0,
                        damping: 22,
                        stiffness: 260,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    const sections = useMemo(() => groupNotificationsByDate(notifications), [notifications]);

    const handleNotificationClick = (item: any) => {
        const type = String(item?.type || '').toLowerCase().trim().replace(/_/g, '-');
        const message = String(item?.message || '').toLowerCase();

        const isValidId = (s: any): boolean => {
            if (s == null) return false;
            const str = String(s).trim();
            return str !== '' && str !== 'undefined' && str !== 'null' && str !== '[object Object]' && str !== '0' && str !== 'false';
        };

        const rawStoryId = (
            item?.storyId ||
            item?.story?._id ||
            item?.story?.id ||
            item?.data?.storyId ||
            item?.data?.story?._id ||
            item?.data?.story?.id ||
            item?.metadata?.storyId ||
            item?.payload?.storyId ||
            ''
        );
        const resolvedStoryId = isValidId(rawStoryId) ? String(rawStoryId).trim() : '';

        const rawPostId = (
            item?.postId ||
            item?.post?._id ||
            item?.post?.id ||
            item?.data?.postId ||
            item?.data?.post_id ||
            item?.data?.sharePostId ||
            item?.sharePostId ||
            item?.targetId ||
            item?.entityId ||
            ''
        );
        const resolvedPostId = isValidId(rawPostId) ? String(rawPostId).trim() : '';

        const rawConversationId = (
            item?.conversationId ||
            item?.conversation_id ||
            item?.groupId ||
            item?.chatId ||
            item?.data?.conversationId ||
            item?.data?.conversation_id ||
            ''
        );
        const resolvedConversationId = isValidId(rawConversationId) ? String(rawConversationId).trim() : '';

        const resolved = resolveNotificationSender(item);
        const resolvedSenderId = isValidId(resolved.senderId) ? resolved.senderId : '';
        const resolvedSenderName = resolved.senderName;
        const resolvedSenderAvatar = isMissingOrDefaultAvatar(resolved.senderAvatar) ? '' : resolved.senderAvatar;

        if (resolvedSenderId && (resolvedSenderName || resolvedSenderAvatar)) {
            try {
                cacheUserProfile({
                    uid: resolvedSenderId,
                    displayName: resolvedSenderName,
                    avatar: resolvedSenderAvatar || undefined,
                });
            } catch { }
        }

        // 1. Direct Message / Chat notifications
        if (
            type === 'dm' ||
            type === 'message' ||
            type === 'chat' ||
            type === 'new-message' ||
            type === 'chat-message' ||
            type === 'group-message' ||
            type === 'conversation' ||
            message.includes('sent you a message')
        ) {
            handleDismiss();
            if (resolvedConversationId || resolvedSenderId) {
                const qs = `conversationId=${encodeURIComponent(resolvedConversationId)}&otherUserId=${encodeURIComponent(resolvedSenderId)}&user=${encodeURIComponent(resolvedSenderName)}&avatar=${encodeURIComponent(resolvedSenderAvatar)}`;
                router.push(`/dm?${qs}` as any);
            } else {
                router.push('/inbox' as any);
            }
            return;
        }

        // 2. Post Shared to Story
        const isPostStoryShare = (
            type === 'post-story-share' ||
            type === 'poststoryshare' ||
            type === 'post-share-story' ||
            message.includes('shared your post to their story')
        );

        if (isPostStoryShare) {
            handleDismiss();
            if (resolvedStoryId) {
                router.push(`/(tabs)/home?storyId=${encodeURIComponent(resolvedStoryId)}&authorId=${encodeURIComponent(resolvedSenderId)}&t=${Date.now()}` as any);
            } else if (resolvedPostId) {
                router.push(`/post-detail?id=${encodeURIComponent(resolvedPostId)}` as any);
            } else if (resolvedSenderId) {
                router.push(`/user-profile?id=${encodeURIComponent(resolvedSenderId)}` as any);
            } else {
                router.push('/(tabs)/home' as any);
            }
            return;
        }

        const hasConversation = Boolean(resolvedConversationId);

        // 3. Story Comment
        const isStoryCommentInteraction = (
            type === 'story-comment' ||
            type === 'storycomment' ||
            message.includes('commented on your story')
        );

        if (isStoryCommentInteraction) {
            handleDismiss();
            if (resolvedStoryId) {
                router.push(`/(tabs)/home?storyId=${encodeURIComponent(resolvedStoryId)}&isOwnStory=true&openComments=true&t=${Date.now()}` as any);
            } else if (resolvedConversationId || resolvedSenderId) {
                const qs = `conversationId=${encodeURIComponent(resolvedConversationId)}&otherUserId=${encodeURIComponent(resolvedSenderId)}&user=${encodeURIComponent(resolvedSenderName)}&avatar=${encodeURIComponent(resolvedSenderAvatar)}`;
                router.push(`/dm?${qs}` as any);
            } else {
                showStoryUnavailableAlert();
            }
            return;
        }

        // 4. Story Reply
        const isStoryReplyInteraction = (
            type === 'story-reply' ||
            type === 'storyreply' ||
            (hasConversation && message.includes('replied'))
        );

        if (isStoryReplyInteraction) {
            handleDismiss();
            if (resolvedStoryId) {
                router.push(`/(tabs)/home?storyId=${encodeURIComponent(resolvedStoryId)}&isOwnStory=true&openComments=true&t=${Date.now()}` as any);
            } else if (resolvedConversationId) {
                const qs = `conversationId=${encodeURIComponent(resolvedConversationId)}&otherUserId=${encodeURIComponent(resolvedSenderId)}&user=${encodeURIComponent(resolvedSenderName)}&avatar=${encodeURIComponent(resolvedSenderAvatar)}`;
                router.push(`/dm?${qs}` as any);
            } else {
                showStoryUnavailableAlert();
            }
            return;
        }

        // 5. Story Likes
        const isStoryLikeInteraction = (
            type === 'story-like' ||
            type === 'storylike' ||
            message.includes('liked your story')
        );

        if (isStoryLikeInteraction) {
            handleDismiss();
            if (resolvedStoryId) {
                router.push(`/(tabs)/home?storyId=${encodeURIComponent(resolvedStoryId)}&isOwnStory=true&openComments=true&t=${Date.now()}` as any);
            } else {
                showStoryUnavailableAlert();
            }
            return;
        }

        // 6. Other User's Story (New story posted, story mention, story share)
        const isOtherStoryInteraction = (
            type === 'story' ||
            type === 'new-story' ||
            type === 'newstory' ||
            type === 'story-share' ||
            type === 'storyshare' ||
            type === 'story-mention' ||
            type === 'storymention' ||
            message.includes('posted a new story') ||
            message.includes('shared a new story') ||
            message.includes('mentioned you in a story') ||
            message.includes('shared your story') ||
            ((type.includes('story') || message.includes('story')) && !isStoryCommentInteraction && !isStoryReplyInteraction && !isStoryLikeInteraction && !isPostStoryShare)
        );

        if (isOtherStoryInteraction) {
            handleDismiss();
            if (resolvedStoryId) {
                router.push(`/(tabs)/home?storyId=${encodeURIComponent(resolvedStoryId)}&authorId=${encodeURIComponent(resolvedSenderId)}&t=${Date.now()}` as any);
            } else if (resolvedSenderId) {
                router.push(`/(tabs)/home?authorId=${encodeURIComponent(resolvedSenderId)}&isAuthorLookup=true&t=${Date.now()}` as any);
            } else {
                showStoryUnavailableAlert();
            }
            return;
        }

        // 7. Post Comments & Replies
        if (
            type === 'comment' ||
            type === 'post-comment' ||
            type === 'postcomment' ||
            type === 'comment-like' ||
            type === 'commentlike' ||
            type === 'comment-reply' ||
            type === 'commentreply' ||
            type === 'replylike' ||
            type === 'reply-comment'
        ) {
            handleDismiss();
            if (resolvedPostId) {
                const commentId = String(item?.commentId || item?.data?.commentId || '').trim();
                router.push(`/post-detail?id=${encodeURIComponent(resolvedPostId)}&openComments=true&commentId=${encodeURIComponent(commentId)}` as any);
            } else if (resolvedSenderId) {
                router.push(`/user-profile?id=${encodeURIComponent(resolvedSenderId)}` as any);
            } else {
                router.push('/(tabs)/home' as any);
            }
            return;
        }

        // 8. Post Likes, Laugh, Tomato, Shares, Mentions, Tags
        if (
            type === 'like' ||
            type === 'post-like' ||
            type === 'postlike' ||
            type === 'laugh' ||
            type === 'reaction-laugh' ||
            type === 'post-laugh' ||
            type === 'tomato' ||
            type === 'reaction-tomato' ||
            type === 'post-tomato' ||
            type === 'tag' ||
            type === 'post-tag' ||
            type === 'mention' ||
            type === 'post-mention' ||
            type === 'post-share' ||
            type === 'share'
        ) {
            handleDismiss();
            if (resolvedPostId) {
                router.push(`/post-detail?id=${encodeURIComponent(resolvedPostId)}` as any);
            } else if (resolvedSenderId) {
                router.push(`/user-profile?id=${encodeURIComponent(resolvedSenderId)}` as any);
            } else {
                router.push('/(tabs)/home' as any);
            }
            return;
        }

        // 9. Podium
        if (type === 'podium' || type === 'podium-vote') {
            handleDismiss();
            router.push('/podium' as any);
            return;
        }

        // 10. Follows
        if (type === 'follow' || type === 'follow-request' || type === 'follow-approved' || type === 'new-follower') {
            handleDismiss();
            if (resolvedSenderId) router.push(`/user-profile?id=${encodeURIComponent(resolvedSenderId)}` as any);
            else router.push('/(tabs)/home' as any);
            return;
        }

        // Fallback
        handleDismiss();
        if (type.includes('story') || message.includes('story')) {
            if (resolvedStoryId) {
                router.push(`/(tabs)/home?storyId=${encodeURIComponent(resolvedStoryId)}&isOwnStory=true&openComments=true&t=${Date.now()}` as any);
            } else {
                showStoryUnavailableAlert();
            }
            return;
        }

        if (resolvedConversationId || (type === 'dm' || type === 'message')) {
            const qs = `conversationId=${encodeURIComponent(resolvedConversationId)}&otherUserId=${encodeURIComponent(resolvedSenderId)}&user=${encodeURIComponent(resolvedSenderName)}&avatar=${encodeURIComponent(resolvedSenderAvatar)}`;
            router.push(`/dm?${qs}` as any);
        } else if (resolvedPostId) {
            router.push(`/post-detail?id=${encodeURIComponent(resolvedPostId)}` as any);
        } else if (resolvedSenderId) {
            router.push(`/user-profile?id=${encodeURIComponent(resolvedSenderId)}` as any);
        } else {
            router.push('/(tabs)/home' as any);
        }
    };

    const renderNotificationItem = (item: any) => {
        const resolved = resolveNotificationSender(item);
        const resolvedSenderName = resolved.senderName;
        const resolvedSenderId = String(resolved.senderId || '').trim();

        const rawThumbnail = String(
            item?.postThumbnail ||
            item?.post?.imageUrl ||
            item?.post?.mediaUrl ||
            item?.post?.media?.[0] ||
            item?.data?.postThumbnail ||
            item?.data?.imageUrl ||
            item?.data?.mediaUrl ||
            item?.thumbnailUrl ||
            ''
        ).trim();

        const thumbnailUri = rawThumbnail ? resolveAvatarUrl(rawThumbnail) : null;
        const actionText = getNotificationActionText(item);
        const relativeTime = formatInstagramTime(item.createdAt);

        // Determine if user has an active story right now
        let activeStoryId: string | null = null;
        if (resolvedSenderId && activeStoryMap.has(resolvedSenderId)) {
            activeStoryId = activeStoryMap.get(resolvedSenderId)!;
        } else if (resolvedSenderName && activeStoryMap.has(`name:${resolvedSenderName.toLowerCase()}`)) {
            activeStoryId = activeStoryMap.get(`name:${resolvedSenderName.toLowerCase()}`)!;
        }
        const hasActiveStory = Boolean(activeStoryId);

        const handleAvatarPress = () => {
            markAsRead(item._id).catch(() => {});
            handleDismiss();
            if (hasActiveStory && activeStoryId) {
                router.push(`/(tabs)/home?storyId=${encodeURIComponent(activeStoryId)}&authorId=${encodeURIComponent(resolvedSenderId)}&t=${Date.now()}` as any);
            } else if (resolvedSenderId) {
                router.push(`/user-profile?id=${encodeURIComponent(resolvedSenderId)}` as any);
            }
        };

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                style={[
                    styles.notificationItem,
                    !item.read && styles.unreadNotificationItem
                ]}
                onPress={() => {
                    markAsRead(item._id).catch(() => {});
                    handleDismiss();
                    handleNotificationClick(item);
                }}
            >
                {/* Left: Fixed Avatar Slot (48x48) ensures pixel-perfect vertical alignment with or without ring */}
                <View style={styles.avatarSlot}>
                    <TouchableOpacity activeOpacity={0.8} onPress={handleAvatarPress}>
                        {hasActiveStory ? (
                            <LinearGradient
                                colors={['#FF5E3A', '#FF2A68', '#FF8928']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.avatarGradientRing}
                            >
                                <View style={styles.avatarInnerContainer}>
                                    <UserAvatar
                                        user={item}
                                        name={resolvedSenderName}
                                        size={38}
                                        showInitials
                                    />
                                </View>
                            </LinearGradient>
                        ) : (
                            <View style={styles.avatarPlainContainer}>
                                <UserAvatar
                                    user={item}
                                    name={resolvedSenderName}
                                    size={44}
                                    showInitials
                                />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Middle: Rich Text */}
                <View style={styles.notificationContent}>
                    <Text style={styles.notificationText}>
                        {isSystemNotification(item) ? (
                            <>
                                <Text style={styles.systemText}>{getNotificationDisplayText(item)}</Text>
                                {' '}
                                <Text style={styles.notificationTimeText}>{relativeTime}</Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.senderNameText}>{resolvedSenderName}</Text>
                                {' '}
                                <Text style={styles.actionText}>{actionText}</Text>
                                {' '}
                                <Text style={styles.notificationTimeText}>{relativeTime}</Text>
                            </>
                        )}
                    </Text>
                </View>

                {/* Right: Media Thumbnail or Unread Dot */}
                {thumbnailUri ? (
                    <ExpoImage
                        source={{ uri: thumbnailUri }}
                        style={styles.thumbnailImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                    />
                ) : !item.read ? (
                    <View style={styles.unreadDot} />
                ) : null}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="none"
            onRequestClose={handleDismiss}
        >
            <View style={styles.modalRoot}>
                {/* Backdrop: tap anywhere outside the sheet to dismiss */}
                <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={handleDismiss}
                    />
                </Animated.View>

                {/* Swipeable Instagram-style Bottom Sheet */}
                <Animated.View
                    style={[
                        styles.sheetContainer,
                        { transform: [{ translateY }] },
                    ]}
                >
                    {/* Top Drag Handle & Header Area */}
                    <View {...panResponder.panHandlers} style={styles.dragArea}>
                        <View style={styles.dragHandleBar} />
                        <View style={styles.notificationsHeader}>
                            <Text style={styles.notificationsTitle}>Notifications</Text>
                            <TouchableOpacity
                                onPress={handleDismiss}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                style={styles.closeBtn}
                            >
                                <Feather name="x" size={24} color={COLORS.textPrimary || '#1f2937'} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Grouped SectionList (Today, Yesterday, This week, Earlier) */}
                    {sections.length > 0 ? (
                        <SectionList
                            sections={sections}
                            keyExtractor={(item: any, idx: number) => String(item._id || item.id || `notif_${idx}`)}
                            renderItem={({ item }) => renderNotificationItem(item)}
                            renderSectionHeader={({ section: { title } }) => (
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionHeaderText}>{title}</Text>
                                </View>
                            )}
                            contentContainerStyle={styles.notificationsList}
                            stickySectionHeadersEnabled={false}
                            removeClippedSubviews={Platform.OS === 'android'}
                            windowSize={7}
                            maxToRenderPerBatch={12}
                            initialNumToRender={12}
                        />
                    ) : (
                        <View style={styles.emptyNotifications}>
                            <Feather name="bell-off" size={48} color={COLORS.textMuted || '#9ca3af'} />
                            <Text style={styles.emptyNotificationsText}>No notifications yet</Text>
                        </View>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    sheetContainer: {
        height: '88%',
        backgroundColor: COLORS.background || '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 16,
    },
    dragArea: {
        backgroundColor: COLORS.background || '#ffffff',
        borderBottomWidth: 0.5,
        borderBottomColor: COLORS.border || '#ebebeb',
        paddingTop: 8,
    },
    dragHandleBar: {
        width: 38,
        height: 4.5,
        borderRadius: 3,
        backgroundColor: '#d1d5db',
        alignSelf: 'center',
        marginBottom: 6,
    },
    notificationsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    notificationsTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary || '#1f2937',
    },
    closeBtn: {
        padding: 2,
    },
    sectionHeader: {
        backgroundColor: COLORS.background || '#ffffff',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 6,
    },
    sectionHeaderText: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary || '#111827',
        letterSpacing: -0.2,
    },
    notificationsList: {
        paddingBottom: 28,
    },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.card || '#ffffff',
        borderBottomWidth: 0.5,
        borderBottomColor: COLORS.border || '#f0f0f0',
    },
    unreadNotificationItem: {
        backgroundColor: COLORS.primaryLight || '#FFF9F2',
    },
    avatarSlot: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarPlainContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
    },
    avatarGradientRing: {
        width: 48,
        height: 48,
        borderRadius: 24,
        padding: 2.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInnerContainer: {
        width: 43,
        height: 43,
        borderRadius: 21.5,
        borderWidth: 2,
        borderColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
    },
    notificationContent: {
        flex: 1,
        marginRight: 8,
    },
    notificationText: {
        fontSize: 14,
        lineHeight: 18,
        color: COLORS.textPrimary || '#1f2937',
    },
    senderNameText: {
        fontWeight: '700',
        color: COLORS.textPrimary || '#000000',
    },
    actionText: {
        color: COLORS.textSecondary || '#4b5563',
    },
    systemText: {
        color: COLORS.textPrimary || '#1f2937',
        fontWeight: '500',
    },
    notificationTimeText: {
        fontSize: 13,
        color: COLORS.textMuted || '#8e8e8e',
        fontWeight: '400',
    },
    thumbnailImage: {
        width: 44,
        height: 44,
        borderRadius: 6,
        backgroundColor: '#eee',
        marginLeft: 8,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primary || '#FF6B00',
        marginLeft: 8,
    },
    emptyNotifications: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyNotificationsText: {
        marginTop: 16,
        fontSize: 16,
        color: COLORS.textMuted || '#999999',
        fontWeight: '500',
    },
});
