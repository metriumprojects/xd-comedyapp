import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@/lib/storage';
import { useNotifications } from '../../hooks/useNotifications';
import { notificationService } from '../../lib/notificationService';
import { getNotificationDisplayText } from '../../lib/notificationText';
import COLORS from '@/src/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 375;
const isLargeDevice = SCREEN_WIDTH >= 414;

interface NotificationsModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
    const router = useRouter();
    const [currentUserId, setCurrentUserId] = useState<string>('');

    const { notifications, fetchNotifications, markAsRead } = useNotifications(currentUserId || '');

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

    useEffect(() => {
        if (visible && currentUserId) {
            fetchNotifications();
        }
    }, [visible, currentUserId]);

    const getNotificationNavRoute = (item: any) => {
        const type = String(item?.type || '').toLowerCase().replace(/_/g, '-');
        const senderId = String(item?.senderId || item?.fromUserId || item?.data?.senderId || '').trim();
        const postId = String(item?.postId || item?.data?.postId || '').trim();
        const commentId = String(item?.commentId || item?.data?.commentId || '').trim();

        if (type === 'follow' || type === 'follow-request' || type === 'follow-approved' || type === 'new-follower') {
            return senderId ? `/user-profile?id=${encodeURIComponent(senderId)}` : '/(tabs)/profile';
        } else if (type === 'like' || type === 'post-like' || type === 'tag' || type === 'post-tag' || type === 'mention' || type === 'post-mention') {
            if (postId) return `/post-detail?id=${encodeURIComponent(postId)}`;
            if (senderId) return `/user-profile?id=${encodeURIComponent(senderId)}`;
            return '/(tabs)/home';
        } else if (type === 'comment' || type === 'post-comment' || type === 'comment-reply' || type === 'comment-like') {
            if (postId) return `/post-detail?id=${encodeURIComponent(postId)}&openComments=true&commentId=${encodeURIComponent(commentId)}`;
            if (senderId) return `/user-profile?id=${encodeURIComponent(senderId)}`;
            return '/(tabs)/home';
        } else if (type === 'dm' || type === 'message') {
            if (senderId) return `/dm?otherUserId=${encodeURIComponent(senderId)}`;
            return '/inbox';
        } else if (type === 'live' || type === 'livestream') {
            return '/(tabs)/home';
        } else if (type === 'story' || type === 'story-like' || type === 'story-mention' || type === 'story-reply' || type === 'story-comment' || type === 'new-story') {
            if (senderId) return `/user-profile?id=${encodeURIComponent(senderId)}`;
            return '/(tabs)/home';
        } else {
            if (senderId) return `/user-profile?id=${encodeURIComponent(senderId)}`;
            return '/(tabs)/home';
        }
    };

    const renderNotificationItem = (item: any) => (
        <TouchableOpacity
            style={styles.notificationItem}
            onPress={async () => {
                try { await markAsRead(item._id); } catch { }
                try { onClose(); } catch { }
                try { router.push(getNotificationNavRoute(item) as any); } catch { }
            }}
        >
            <View style={styles.notificationContent}>
                <Text style={styles.notificationMessage}>{getNotificationDisplayText(item)}</Text>
                <Text style={styles.notificationTime}>
                    {new Date(item.createdAt).toLocaleDateString()}
                </Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={async () => {
                onClose();
                try { await fetchNotifications(); } catch { }
            }}
        >
            <View style={styles.notificationsModal}>
                <View style={styles.notificationsHeader}>
                    <Text style={styles.notificationsTitle}>Notifications</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Feather name="x" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                </View>

                {notifications.length > 0 ? (
                    <FlatList
                        data={notifications}
                        keyExtractor={(item) => item._id}
                        renderItem={({ item }) => renderNotificationItem(item)}
                        contentContainerStyle={styles.notificationsList}
                    />
                ) : (
                    <View style={styles.emptyNotifications}>
                        <Feather name="bell-off" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyNotificationsText}>No notifications yet</Text>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    notificationsModal: {
        flex: 1,
        backgroundColor: COLORS.background,
        marginTop: isSmallDevice ? 50 : 60,
    },
    notificationsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    notificationsTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    notificationsList: {
        paddingVertical: 8,
    },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: COLORS.border,
    },
    notificationContent: {
        flex: 1,
    },
    notificationMessage: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    notificationTime: {
        fontSize: 12,
        color: COLORS.textMuted,
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
        color: COLORS.textMuted,
        fontWeight: '500',
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.primary,
        marginLeft: 8,
    },
});
