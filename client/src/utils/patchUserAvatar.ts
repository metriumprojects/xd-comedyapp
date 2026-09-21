import { isMissingOrDefaultAvatar, resolveAvatarUrl } from '@/lib/utils/avatar';

function normId(value: any): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    return String(value._id || value.id || value.uid || value.firebaseUid || '').trim();
  }
  return String(value).trim();
}

function normName(value: any): string {
  return String(value || '').trim().toLowerCase();
}

/** True if this id/object refers to the updated user. */
export function matchesUpdatedUser(candidate: any, uid: string, username?: string): boolean {
  const target = String(uid || '').trim();
  const uname = normName(username);
  if (!target && !uname) return false;

  const ids = [
    normId(candidate),
    normId(candidate?.userId),
    normId(candidate?.user),
    normId(candidate?.author),
    normId(candidate?.authorId),
    normId(candidate?.ownerId),
    normId(candidate?.senderId),
    normId(candidate?.sender),
    normId(candidate?.fromUserId),
    normId(candidate?.fromUser),
    normId(candidate?.otherUserId),
    normId(candidate?.otherUser),
    normId(candidate?.firebaseUid),
    normId(candidate?.uid),
  ].filter(Boolean);

  if (target && ids.some((id) => id === target || id.toLowerCase() === target.toLowerCase())) {
    return true;
  }

  if (uname) {
    const names = [
      normName(candidate?.username),
      normName(candidate?.userName),
      normName(candidate?.user?.username),
      normName(candidate?.sender?.username),
      normName(candidate?.otherUser?.username),
    ].filter(Boolean);
    if (names.includes(uname)) return true;
  }

  return false;
}

function withAvatar(obj: any, avatar: string, displayName?: string): any {
  if (!obj || typeof obj !== 'object') return obj;
  const next: any = {
    ...obj,
    avatar,
    photoURL: avatar,
    profilePicture: avatar,
  };
  if (displayName) {
    next.displayName = displayName;
    if (next.name) next.name = displayName;
  }
  return next;
}

/**
 * Patch denormalized avatar fields on a post/comment/notification/message-like object.
 * Returns same reference if nothing matched (cheap React equality).
 */
export function patchEntityAvatar(
  entity: any,
  uid: string,
  avatarRaw: string,
  displayName?: string,
  username?: string
): any {
  if (!entity || typeof entity !== 'object') return entity;
  if (!uid || isMissingOrDefaultAvatar(avatarRaw)) return entity;

  const avatar = resolveAvatarUrl(avatarRaw);
  if (isMissingOrDefaultAvatar(avatar)) return entity;

  const matches =
    matchesUpdatedUser(entity, uid, username) ||
    matchesUpdatedUser(entity.userId, uid, username) ||
    matchesUpdatedUser(entity.user, uid, username) ||
    matchesUpdatedUser(entity.author, uid, username) ||
    matchesUpdatedUser(
      { senderId: entity.senderId, sender: entity.sender, fromUserId: entity.fromUserId },
      uid,
      username
    ) ||
    matchesUpdatedUser(
      { otherUserId: entity.otherUserId, otherUser: entity.otherUser },
      uid,
      username
    );

  if (!matches) return entity;

  const next: any = { ...entity };
  next.userAvatar = avatar;
  next.avatar = avatar;
  next.photoURL = avatar;
  next.senderAvatar = avatar;
  next.authorAvatar = avatar;
  next.otherUserAvatar = avatar;
  next.peerAvatar = avatar;
  if (displayName) {
    next.userName = displayName;
    next.senderName = displayName;
    if (entity.displayName != null) next.displayName = displayName;
  }

  if (next.user && typeof next.user === 'object') {
    next.user = withAvatar(next.user, avatar, displayName);
  }
  if (next.userId && typeof next.userId === 'object') {
    next.userId = withAvatar(next.userId, avatar, displayName);
  }
  if (next.author && typeof next.author === 'object') {
    next.author = withAvatar(next.author, avatar, displayName);
  }
  if (next.sender && typeof next.sender === 'object') {
    next.sender = withAvatar(next.sender, avatar, displayName);
  }
  if (next.fromUser && typeof next.fromUser === 'object') {
    next.fromUser = withAvatar(next.fromUser, avatar, displayName);
  }
  if (next.otherUser && typeof next.otherUser === 'object') {
    next.otherUser = withAvatar(next.otherUser, avatar, displayName);
  }
  if (next.otherUserProfile && typeof next.otherUserProfile === 'object') {
    next.otherUserProfile = withAvatar(next.otherUserProfile, avatar, displayName);
  }
  if (next.profile && typeof next.profile === 'object') {
    next.profile = withAvatar(next.profile, avatar, displayName);
  }

  return next;
}

/** Map a list; returns same array ref if no item changed. */
export function patchListAvatars(
  list: any[] | null | undefined,
  uid: string,
  avatar: string,
  displayName?: string,
  username?: string
): any[] {
  if (!Array.isArray(list) || list.length === 0) return (list as any[]) || [];
  let changed = false;
  const next = list.map((item) => {
    const patched = patchEntityAvatar(item, uid, avatar, displayName, username);
    if (patched !== item) changed = true;
    return patched;
  });
  return changed ? next : list;
}

export function readProfileUpdatePayload(data: any): {
  uid: string;
  avatar: string;
  displayName?: string;
  username?: string;
} | null {
  const uid = String(data?.uid || data?.userId || data?.id || '').trim();
  const avatar = String(data?.avatar || data?.photoURL || data?.profilePicture || '').trim();
  if (!uid || isMissingOrDefaultAvatar(avatar)) return null;
  return {
    uid,
    avatar,
    displayName: data?.displayName || data?.name || undefined,
    username: data?.username || data?.userName || undefined,
  };
}
