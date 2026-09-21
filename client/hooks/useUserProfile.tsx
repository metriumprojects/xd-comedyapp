import { DEFAULT_AVATAR_URL } from '@/lib/api';
import { useEffect, useState } from 'react';
import { apiService } from '@/src/_services/apiService';
import { Image as ExpoImage } from 'expo-image';
import { resolveAvatarUrl, isMissingOrDefaultAvatar } from '@/lib/utils/avatar';
import { feedEventEmitter } from '@/lib/feedEventEmitter';

function isRecord(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object';
}

export interface UserProfile {
  id: string;
  uid: string;
  name: string;
  displayName?: string;
  username?: string;
  avatar: string;
  photoURL?: string;
  bio?: string;
  email?: string;
  website?: string;
  verified?: boolean;
  isVerified?: boolean;
}

const checkMissingAvatar = (url?: string | null) => {
  if (typeof isMissingOrDefaultAvatar === 'function') {
    return isMissingOrDefaultAvatar(url);
  }
  if (!url) return true;
  const s = String(url).trim().toLowerCase();
  return !s || s === 'null' || s === 'undefined' || s.includes('avatardefault') || s.includes('default-pic');
};

const globalProfileCache = new Map<string, UserProfile>();

export function cacheUserProfile(userObj: any) {
  if (!userObj) return;
  const uid = String(userObj.uid || userObj._id || userObj.id || userObj.userId || '').trim();
  const username = String(userObj.username || userObj.userName || '').trim().toLowerCase();
  
  const avatar =
    userObj.avatar ||
    userObj.photoURL ||
    userObj.profilePicture ||
    userObj.senderAvatar ||
    userObj.userAvatar ||
    userObj.authorAvatar ||
    userObj.avatarUrl ||
    userObj.photoUrl;
  const displayName = userObj.displayName || userObj.name || userObj.userName || userObj.username;
  
  if (!uid && !username) return;

  const existing = (uid ? globalProfileCache.get(uid) : null) || (username ? globalProfileCache.get(username) : null);
  const validAvatar = (avatar && !checkMissingAvatar(avatar) ? avatar : null) || existing?.avatar || DEFAULT_AVATAR_URL;
  const resolvedName = displayName || existing?.displayName || existing?.name || 'User';

  const profile: UserProfile = {
    id: uid || username,
    uid: uid || username,
    name: resolvedName,
    displayName: displayName || existing?.displayName,
    username: userObj.username || userObj.userName || existing?.username,
    avatar: validAvatar,
    photoURL: validAvatar,
    bio: userObj.bio || existing?.bio,
    email: userObj.email || existing?.email,
    website: userObj.website || existing?.website,
    verified: userObj.verified ?? userObj.isVerified ?? existing?.verified ?? existing?.isVerified,
    isVerified: userObj.isVerified ?? userObj.verified ?? existing?.isVerified ?? existing?.verified,
  };

  const isChanged = !existing || existing.avatar !== validAvatar || existing.name !== resolvedName;

  if (uid) globalProfileCache.set(uid, profile);
  if (username) globalProfileCache.set(username, profile);

  if (validAvatar && validAvatar !== DEFAULT_AVATAR_URL) {
    try {
      const resolved = resolveAvatarUrl(validAvatar);
      if (resolved && resolved !== DEFAULT_AVATAR_URL) {
        ExpoImage.prefetch(resolved).catch(() => {});
      }
    } catch {}
  }

  if (isChanged && (uid || username)) {
    feedEventEmitter.emit('USER_PROFILE_UPDATED', {
      uid: profile.uid,
      username: profile.username,
      avatar: profile.avatar,
      displayName: profile.name,
    });
  }
}

export function getCachedUserProfile(key?: string | null): UserProfile | null {
  if (!key) return null;
  const s = String(key).trim();
  if (!s || s === 'undefined' || s === 'null' || s === '[object Object]') return null;
  return globalProfileCache.get(s) || globalProfileCache.get(s.toLowerCase()) || null;
}

export function useUserProfile(userId: string | null | undefined) {
  const cached = getCachedUserProfile(userId);
  const [profile, setProfile] = useState<UserProfile | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const currentCached = getCachedUserProfile(userId);
    if (currentCached) {
      setProfile(currentCached);
      setLoading(false);
    }
  }, [userId]);

  const isPlaceholderName = (value: any) => {
    const s = typeof value === 'string' ? value.trim() : '';
    if (!s) return true;
    return s.toLowerCase() === 'user' || s.toLowerCase() === 'unknown';
  };

  useEffect(() => {
    const sub = feedEventEmitter.addListener('USER_PROFILE_UPDATED', (data: any) => {
      if (!userId) return;
      const targetId = String(data?.uid || data?.userId || data?.id || '').trim();
      const targetUser = String(data?.username || '').trim().toLowerCase();
      const currentKey = String(userId).trim().toLowerCase();

      if ((targetId && currentKey === targetId.toLowerCase()) || (targetUser && currentKey === targetUser)) {
        const updated = getCachedUserProfile(userId);
        if (updated) {
          setProfile({ ...updated });
        }
      }
    });
    return () => sub.remove();
  }, [userId]);

  useEffect(() => {
    const isClean = typeof userId === 'string' && userId.trim() !== '' && userId !== 'undefined' && userId !== 'null' && userId !== '[object Object]' && userId !== '0';
    if (!userId || !isClean) {
      setLoading(false);
      setProfile(null);
      return;
    }

    const existing = getCachedUserProfile(userId);
    if (existing) {
      setProfile(existing);
      setLoading(false);
      if (existing.avatar && !checkMissingAvatar(existing.avatar) && !isPlaceholderName(existing.name)) {
        return;
      }
    }

    let mounted = true;

    async function fetchProfile() {
      try {
        if (!existing) setLoading(true);
        setError(null);
        const result = await apiService.get(`/users/${userId}`);
        if (!mounted) return;
        const payload: any = (() => {
          if (!isRecord(result)) return null;
          const root = result;
          const d = (root as any).data;
          if (isRecord(d) && isRecord((d as any).data)) return (d as any).data;
          if (isRecord(d) && isRecord((d as any).user)) return (d as any).user;
          if (isRecord(d)) return d;
          if (isRecord((root as any).user)) return (root as any).user;
          return null;
        })();

        if (isRecord(result) && result.success && isRecord(payload)) {
          const avatarUrl = payload.avatar || payload.photoURL || payload.profilePicture || DEFAULT_AVATAR_URL;
          const email = (typeof payload.email === 'string' ? payload.email.trim() : '') as string;
          const emailFallback = email && email.includes('@') ? email.split('@')[0] : email;
          const displayName = (typeof payload.displayName === 'string' ? payload.displayName.trim() : '') as string;
          const resolvedName =
            (!isPlaceholderName(displayName) ? displayName : '') ||
            (typeof payload.name === 'string' ? payload.name.trim() : '') ||
            (typeof payload.username === 'string' ? payload.username.trim() : '') ||
            (emailFallback ? emailFallback : '') ||
            (email ? email : '') ||
            'Unknown';
          const fetchedProfile: UserProfile = {
            id: String(payload.id || payload._id || userId),
            uid: String(payload.uid || payload.firebaseUid || payload.id || payload._id || userId),
            avatar: avatarUrl,
            name: resolvedName,
            displayName: payload.displayName,
            username: payload.username,
            photoURL: payload.photoURL,
            bio: payload.bio,
            email: payload.email,
            website: payload.website,
            verified: payload.verified ?? payload.isVerified,
            isVerified: payload.isVerified ?? payload.verified,
          };
          cacheUserProfile(fetchedProfile);
          setProfile(fetchedProfile);
        } else {
          setError('Failed to load profile');
          if (!existing) setProfile(null);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('useUserProfile error:', err);
        setError('An error occurred');
        if (!existing) setProfile(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [userId]);

  return { profile: cached || profile, loading: cached ? false : loading, error };
}
