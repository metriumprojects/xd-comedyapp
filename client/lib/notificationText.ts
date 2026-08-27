export function getNotificationActionText(item: any): string {
  const rawType = String(item?.type || '').toLowerCase().trim().replace(/_/g, '-');
  
  if (rawType === 'message' || rawType === 'dm') return 'sent you a message';
  if (rawType === 'like' || rawType === 'post-like') return 'liked your post';
  if (rawType === 'comment' || rawType === 'post-comment') return 'commented on your post';
  if (rawType === 'comment-reply') return 'replied to your comment';
  if (rawType === 'comment-like') return 'liked your comment';
  if (rawType === 'follow' || rawType === 'new-follower') return 'started following you';
  if (rawType === 'follow-request') return 'sent you a follow request';
  if (rawType === 'follow-approved') return 'approved your follow request';
  if (rawType === 'mention' || rawType === 'post-mention') return 'mentioned you in a post';
  if (rawType === 'tag' || rawType === 'post-tag') return 'tagged you in a post';
  if (rawType === 'live' || rawType === 'livestream') return 'started a live stream';
  
  // Story-specific notifications
  if (rawType === 'story-like' || (rawType === 'story' && item?.data?.action === 'like')) return 'liked your story';
  if (rawType === 'story-reply' || rawType === 'story-comment' || (rawType === 'story' && item?.data?.action === 'comment')) return 'replied to your story';
  if (rawType === 'story-mention') return 'mentioned you in a story';
  if (rawType === 'story' || rawType === 'new-story') return 'shared a new story';

  const msg = typeof item?.message === 'string' ? item.message.trim() : '';
  if (msg) return msg;

  return 'sent you a notification';
}

export function getNotificationDisplayText(item: any): string {
  const senderNameRaw = item?.senderName || item?.userName || item?.user?.displayName || item?.user?.name;
  const senderName = typeof senderNameRaw === 'string' && senderNameRaw.trim() ? senderNameRaw.trim() : 'Someone';
  return `${senderName} ${getNotificationActionText(item)}`;
}
