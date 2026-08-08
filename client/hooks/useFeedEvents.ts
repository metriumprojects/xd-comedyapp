import { useEffect } from 'react';
import AsyncStorage from '@/lib/storage';
import { feedEventEmitter } from '../lib/feedEventEmitter';

export function useFeedEvents(
  setPosts: React.Dispatch<React.SetStateAction<any[]>>,
  setAllLoadedPosts: React.Dispatch<React.SetStateAction<any[]>>,
  isOnline: boolean,
  loadInitialFeed: (pageNum?: number, options?: any) => Promise<any>
) {
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
            const homeKeys = allKeys.filter(k => k.includes('home_feed_v1'));
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
          
          if (isOnline) {
             loadInitialFeed(0, { silent: true, _t: Date.now(), bypassDedupe: true }).catch(() => {});
          }
        })();
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
              return false; // Remove it so we can either put it back in place or at top
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
          }
          return prev;
        };

        setPosts(prev => updateInPlaceOrMoveToTop(prev));
        setAllLoadedPosts(prev => updateInPlaceOrMoveToTop(prev));

        // Only reload feed from server if it was an actual content edit, to avoid feed jumping on simple likes/ratings
        if (isContentEdit && isOnline) {
          loadInitialFeed(0, { silent: true, _t: Date.now(), bypassDedupe: true }).catch(() => {});
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
        
        // Refresh feed to get new content without the blocked user
        if (isOnline) {
          loadInitialFeed(0, { silent: true, _t: Date.now() }).catch(() => {});
        }
      }
      if (event.type === 'USER_SUBSCRIBED' && event.userId) {
        // Refresh feed to unlock posts from the subscribed user
        if (isOnline) {
          loadInitialFeed(0, { silent: true, _t: Date.now() }).catch(() => {});
        }
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
          const creatorIds = [
            p?.userId?._id,
            p?.userId?.id,
            p?.userId?.firebaseUid,
            p?.userId?.uid,
            p?.userId,
            p?.user?._id,
            p?.user?.id,
            p?.user?.firebaseUid,
            p?.user?.uid,
            p?.creatorId,
            p?.creator?._id,
            p?.creator?.id
          ].filter(Boolean).map(id => String(id).toLowerCase());

          const matches = creatorIds.some(cid => allTargetIds.includes(cid));
          if (matches) {
            return { ...p, isFollowing };
          }
          return p;
        };

        setPosts(prev => (Array.isArray(prev) ? prev.map(updateFollow) : prev));
        setAllLoadedPosts(prev => (Array.isArray(prev) ? prev.map(updateFollow) : prev));
      }
    });
    return unsub;
  }, [isOnline, loadInitialFeed, setPosts, setAllLoadedPosts]);

  useEffect(() => {
    // @ts-ignore
    const sub = feedEventEmitter.addListener('feedUpdated', () => {
      if (!isOnline) return;
      loadInitialFeed(0, { silent: true, _t: Date.now() }).catch(() => {});
    });
    return () => sub.remove();
  }, [isOnline, loadInitialFeed]);
}
