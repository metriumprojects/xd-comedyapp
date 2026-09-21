import { Image as ExpoImage } from 'expo-image';
import { getUserAvatarUrl, isMissingOrDefaultAvatar } from '@/lib/utils/avatar';
import { cacheUserProfile } from '@/hooks/useUserProfile';

/** Shared notification sender fields — list UI + tap navigation stay in sync. */
export function resolveNotificationSender(item: any): {
  senderId: string;
  senderName: string;
  senderAvatar: string;
} {
  const senderId = String(
    item?.senderId ||
      item?.fromUserId ||
      item?.sender?.uid ||
      item?.sender?.id ||
      item?.sender?._id ||
      item?.fromUser?.uid ||
      item?.fromUser?.id ||
      item?.data?.senderId ||
      ''
  ).trim();

  const senderName =
    String(
      item?.senderName ||
        item?.sender?.displayName ||
        item?.sender?.name ||
        item?.sender?.username ||
        item?.sender?.userName ||
        item?.fromUser?.displayName ||
        item?.fromUser?.name ||
        item?.data?.senderName ||
        item?.data?.user ||
        item?.data?.displayName ||
        item?.data?.name ||
        ''
    ).trim() || 'Someone';

  const senderAvatar = getUserAvatarUrl(item);

  return { senderId, senderName, senderAvatar };
}

/** Seed profile cache + disk image cache so faces feel instant on open/tap. */
export function warmNotificationAvatars(items: any[] | null | undefined) {
  if (!Array.isArray(items) || items.length === 0) return;

  const urls: string[] = [];
  for (const item of items) {
    const { senderId, senderName, senderAvatar } = resolveNotificationSender(item);
    if (senderId) {
      try {
        cacheUserProfile({
          uid: senderId,
          displayName: senderName,
          avatar: isMissingOrDefaultAvatar(senderAvatar) ? undefined : senderAvatar,
        });
      } catch {}
    }
    if (!isMissingOrDefaultAvatar(senderAvatar)) {
      urls.push(senderAvatar);
    }
  }

  if (urls.length) {
    try {
      ExpoImage.prefetch(urls);
    } catch {}
  }
}
