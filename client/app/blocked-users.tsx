import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@/lib/storage';
import { userService } from '../lib/userService';
import { DEFAULT_AVATAR_URL } from '@/lib/api';
import { useAppDialog } from '@/src/_components/AppDialogProvider';
import { safeRouterBack } from '@/lib/safeRouterBack';
import COLORS from '@/src/theme/colors';


interface BlockedUser {
    id: string;
    userId: string;
    blockedAt: number;
    name?: string;
    avatar?: string;
    username?: string;
}

export default function BlockedUsersScreen() {
    const router = useRouter();
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [unblocking, setUnblocking] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const { showSuccess } = useAppDialog();

    useEffect(() => {
        const init = async () => {
            try {
                const uid = await AsyncStorage.getItem('userId');
                setUserId(uid);
            } catch (e) {
                console.error('Error getting userId:', e);
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (userId) {
            loadBlockedUsers();
        } else {
            setLoading(false);
        }
    }, [userId]);

    const loadBlockedUsers = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const data = await userService.getBlockedUsers(userId);
            setBlockedUsers(data.map((u: any) => ({
                id: u._id || u.uid,
                userId: u.uid || u.firebaseUid,
                name: u.name || u.displayName || 'User',
                avatar: u.avatar || u.photoURL || u.profilePicture,
                username: u.username || u.displayName?.toLowerCase().replace(/\s+/g, ''),
                blockedAt: Date.now()
            })));
        } catch (e) {
            console.warn('Failed to fetch blocked users:', e);
            setBlockedUsers([]);
        }

        setLoading(false);
    };

    const handleUnblock = async (targetUserId: string) => {
        if (!userId) return;

        Alert.alert(
            'Unblock User',
            'You will start seeing content from this user again.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unblock',
                    onPress: async () => {
                        setUnblocking(targetUserId);
                        try {
                            const success = await userService.unblockUser(userId, targetUserId);
                            if (success) {
                                setBlockedUsers(prev => prev.filter(u => u.userId !== targetUserId));
                                showSuccess('User unblocked');
                            } else {
                                throw new Error('Unblock failed');
                            }
                        } catch (e) {
                            Alert.alert('Error', 'Failed to unblock user');
                        }
                        setUnblocking(null);
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => safeRouterBack()} style={styles.backBtn}>
                    <Feather name="arrow-left" size={24} color={COLORS.black} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Blocked Users</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={blockedUsers}
                    keyExtractor={(item) => item.userId}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Feather name="slash" size={64} color={COLORS.border} />
                            <Text style={styles.emptyTitle}>No Blocked Users</Text>
                            <Text style={styles.emptySubtitle}>
                                When you block someone, they&apos;ll appear here
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={styles.userItem}>
                            <ExpoImage
                                source={{ uri: item.avatar || DEFAULT_AVATAR_URL }}
                                style={styles.avatar}
                                contentFit="cover"
                                transition={200}
                            />
                            <View style={styles.userInfo}>
                                <Text style={styles.userName}>{item.name || 'User'}</Text>
                                {item.username && (
                                    <Text style={styles.userHandle}>@{item.username}</Text>
                                )}
                            </View>
                            <TouchableOpacity
                                style={styles.unblockBtn}
                                onPress={() => handleUnblock(item.userId)}
                                disabled={unblocking === item.userId}
                            >
                                {unblocking === item.userId ? (
                                    <ActivityIndicator size="small" color={COLORS.info} />
                                ) : (
                                    <Text style={styles.unblockText}>Unblock</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingVertical: 8,
        flexGrow: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 80,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: COLORS.textMuted,
        marginTop: 8,
        textAlign: 'center',
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.inputBg,
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    userHandle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    unblockBtn: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: COLORS.inputBg,
        borderWidth: 1,
        borderColor: COLORS.border,
        minWidth: 90,
        alignItems: 'center',
    },
    unblockText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.info,
    },
});
