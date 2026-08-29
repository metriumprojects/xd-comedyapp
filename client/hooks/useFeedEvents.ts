import { useEffect, useRef } from 'react';
import AsyncStorage from '@/lib/storage';
import { feedEventEmitter } from '../lib/feedEventEmitter';
import { useReelsStore } from '@/store/useReelsStore';

export function useFeedEvents(
  setPosts: React.Dispatch<React.SetStateAction<any[]>>,
  setAllLoadedPosts: React.Dispatch<React.SetStateAction<any[]>>,
  isOnline: boolean,
  loadInitialFeed: (pageNum?: number, options?: any) => Promise<any>,
  flatListRef?: React.RefObject<any>
) {
  const refreshTimerRef = useRef<any>(null);

  const debouncedRefresh = (delay = 300) => {
    if (!isOnline) return;
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      loadInitialFeed(0, { silent: true, _t: Date.now(), bypassDedupe: true }).catch(() => {});
    }, delay);
  };

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsub = feedEventEmitter.onFeedUpdate((event) => {
      if (event.type === 'POST_DELETED' && event.postId) {
        const targetId = String(event.postId).split('-loop')[0];
        
        const filterFn = (prev: any[]) => (Array.isArray(prev) ? prev.filter(p => {
          const pid = String(p?.id || p?._id || '').split('-loop')[0];
          return pid !== targetId;
        }) : []);

        setPosts(prev => filterFn(prev));
        setAllLoadedPosts(prev => filterFn(prev));
        
        // Aggressively clear ALL home feed caches
        (async () => {
          try {
            const allKeys = await AsyncStorage.getAllKeys();
            const homeKeys = allKeys.filter(k => k.includes('home_feed_'));
            for (const fullKey of homeKeys) {
              try {
                const cached = await AsyncStorage.getItem(fullKey);
                if (cached) {
                  let entry = JSON.parse(cached);
                  if (entry && Array.isArray(entry.data)) {
                    const updatedData = entry.data.filter((p: any) => {
                      const pid = String(p?.id || p?._id || '').split('-loop')[0];
                      return pid !== targetId;
                    });
                    if (updatedData.length !== entry.data.length) {
                      entry.data = updatedData;
                      await AsyncStorage.setItem(fullKey, JSON.stringify(entry));
                    }
                  }
                }
              } catch (e) {
                await AsyncStorage.removeItem(fullKey);
              }
            }
          } catch (e) {}
          
          debouncedRefresh(200);
        })();
      }

      if (event.type === 'POST_CREATED') {
        try {
          useReelsStore.getState().setActiveIndex(0);
          if (flatListRef?.current?.scrollToOffset) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: false });
          }
        } catch {}
        debouncedRefresh(200);
      }

      if (event.type === 'POST_UPDATED' && event.postId) {
        const patch = event.data && typeof event.data === 'object' ? event.data : {};
        const targetId = String(event.postId);
        const isContentEdit = patch.isContentEdit === true;

        const updateInPlaceOrMoveToTop = (prev: any[]) => {
          if (!Array.isArray(prev)) return prev;
          let targetPost: any = null;
          const remaining = prev.filter(p => {
            const ids = [String(p?.id || ''), String(p?._id || ''), String((p as any)?.postId || '')].filter(Boolean);
            if (ids.includes(targetId)) {
              targetPost = { ...p, ...patch };
              if (isContentEdit) {
                targetPost.updatedAt = new Date().toISOString();
              }
              return false; // Remove it so we can put it at top or back in place
            }
            return true;
          });

          if (targetPost) {
            if (isContentEdit) {
              // Move to top for content edits
              return [targetPost, ...remaining];
            } else {
              // Update in place for likes/ratings/saves
              return prev.map(p => {
                const ids = [String(p?.id || ''), String(p?._id || ''), String((p as any)?.postId || '')].filter(Boolean);
                if (ids.includes(targetId)) {
                  return targetPost;
                }
                return p;
              });
            }
          } else if (isContentEdit && patch && (patch.caption || patch.content || patch.mediaUrls || patch.imageUrl)) {
            // Post wasn't in loaded slice yet, prepend it
            return [{ _id: targetId, id: targetId, ...patch }, ...prev];
          }
          return prev;
        };

        setPosts(prev => updateInPlaceOrMoveToTop(prev));
        setAllLoadedPosts(prev => updateInPlaceOrMoveToTop(prev));

        if (isContentEdit) {
          try {
            useReelsStore.getState().setActiveIndex(0);
            if (flatListRef?.current?.scrollToOffset) {
              flatListRef.current.scrollToOffset({ offset: 0, animated: false });
            }
          } catch {}
          debouncedRefresh(200);
        }
      }

      if (event.type === 'USER_BLOCKED' && event.userId) {
        const blockedUserId = String(event.userId);
        
        const filterFn = (prev: any[]) => (Array.isArray(prev) ? prev.filter(p => {
          const authorId = p?.userId && typeof p.userId === 'object' 
            ? String(p.userId._id || p.userId.id || '') 
            : String(p?.userId || '');
          return authorId !== blockedUserId;
        }) : []);

        setPosts(prev => filterFn(prev));
        setAllLoadedPosts(prev => filterFn(prev));
        
        debouncedRefresh(200);
      }

      if (event.type === 'USER_SUBSCRIBED' && event.userId) {
        debouncedRefresh(200);
      }

      if (event.type === 'USER_FOLLOW_CHANGED' && event.userId) {
        const targetUserId = String(event.userId).toLowerCase();
        const extraTargetIds = Array.isArray(event.data?.targetUserIds)
          ? event.data.targetUserIds.map((id: any) => String(id).toLowerCase())
          : [];
        const allTargetIds = [targetUserId, ...extraTargetIds];
        const isFollowing = !!event.data?.isFollowing;

        const updateFollow = (p: any) => {
          if (!p) return p;
          const authorId = String(
            (p?.userId && typeof p.userId === 'object' ? (p.userId?._id || p.userId?.id || p.userId?.uid) : p?.userId) ||
            p?.authorId ||
            ''
          ).toLowerCase();

          if (allTargetIds.includes(authorId)) {
            const currentProfile = p.profile && typeof p.profile === 'object' ? p.profile : {};
            return {
              ...p,
              isFollowing,
              profile: {
                ...currentProfile,
                isFollowing,
              },
            };
          }
          return p;
        };

        setPosts((prev) => (Array.isArray(prev) ? prev.map(updateFollow) : prev));
        setAllLoadedPosts((prev) => (Array.isArray(prev) ? prev.map(updateFollow) : prev));
      }
    });

    const subSimple = (feedEventEmitter as any).addListener('feedUpdated', () => {
      debouncedRefresh(150);
    });

    return () => {
      unsub();
      try { subSimple?.remove?.(); } catch {}
    };
  }, [setPosts, setAllLoadedPosts, isOnline, loadInitialFeed, flatListRef]);
}
