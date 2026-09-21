/** System / platform alerts — no human sender prefix. */
export function isSystemNotification(item: any): boolean {
  const type = String(item?.type || '').toLowerCase();
  const msg = typeof item?.message === 'string' ? item.message.trim().toLowerCase() : '';
  return (
    type === 'system' ||
    type === 'announcement' ||
    type === 'welcome' ||
    type === 'verification' ||
    type === 'admin' ||
    msg.startsWith('welcome to comedy') ||
    msg.startsWith('welcome to ') ||
    msg.startsWith("your account has been")
  );
}

export function getNotificationActionText(item: any): string {
  const type = String(item?.type || '').toLowerCase().trim().replace(/_/g, '-');
  const rawMsg = typeof item?.message === 'string' ? item.message.trim() : '';
  const lowerMsg = rawMsg.toLowerCase();

  // System notifications
  if (isSystemNotification(item)) {
    return rawMsg || 'new update';
  }

  const hasConversation = Boolean(
    item?.conversationId ||
    item?.conversation_id ||
    item?.groupId ||
    item?.chatId ||
    item?.data?.conversationId ||
    item?.data?.conversation_id ||
    item?.data?.groupId ||
    item?.data?.chatId
  );

  const hasStory = Boolean(
    item?.storyId ||
    item?.story_id ||
    item?.story?._id ||
    item?.story?.id ||
    item?.data?.storyId ||
    item?.data?.story_id ||
    item?.data?.story?._id ||
    item?.data?.story?.id ||
    item?.targetId ||
    item?.entityId
  );

  // Comedy-specific reactions & features
  if (type === 'laugh' || type === 'reaction-laugh' || type === 'post-laugh' || lowerMsg.includes('laughed at')) {
    return 'laughed at your post 😂';
  }
  if (type === 'tomato' || type === 'reaction-tomato' || type === 'post-tomato' || lowerMsg.includes('tomato')) {
    return 'threw a tomato at your post 🍅';
  }
  if (type === 'podium' || type === 'podium-vote' || lowerMsg.includes('podium')) {
    return 'voted for you on the Podium 🏆';
  }
  if (type === 'subscription' || type === 'tier' || type === 'tier-sub' || lowerMsg.includes('subscribed to')) {
    return 'subscribed to your VIP tier ⭐';
  }
  if (type === 'tip' || type === 'points' || type === 'coin' || lowerMsg.includes('sent you a tip')) {
    return 'sent you a tip 💰';
  }

  // DMs & Chat
  if (type === 'message' || type === 'dm' || type === 'chat' || type === 'new-message' || type === 'chat-message') {
    return 'sent you a message';
  }

  // Posts: Likes & Shares
  if (type === 'like' || type === 'post-like' || type === 'postlike') return 'liked your post';
  if (type === 'post-share' || type === 'postshare' || type === 'share') return 'shared your post';

  // Story: Likes & Shares
  if (type === 'story-like' || type === 'storylike' || lowerMsg.includes('liked your story')) {
    return 'liked your story';
  }
  if (type === 'story-share' || type === 'storyshare' || lowerMsg.includes('shared your story to their story')) {
    return 'shared your story to their story';
  }
  if (type === 'post-story-share' || type === 'poststoryshare' || lowerMsg.includes('shared your post to their story')) {
    return 'shared your post to their story';
  }

  // Comments & Replies
  if (type === 'comment' || type === 'post-comment' || type === 'postcomment') return 'commented on your post';
  if (type === 'comment-reply' || type === 'commentreply' || type === 'reply-comment') return 'replied to your comment';
  if (type === 'comment-like' || type === 'commentlike' || type === 'replylike') return 'liked your comment';

  // Stories
  if (type === 'story' || type === 'new-story' || type === 'newstory' || lowerMsg.includes('posted a new story') || lowerMsg.includes('shared a new story')) {
    return 'shared a new story';
  }
  if (type === 'story-mention' || type === 'storymention' || lowerMsg.includes('mentioned you in a story')) {
    return 'mentioned you in a story';
  }

  // Story Comment vs DM Story Reply
  if (
    type === 'story-comment' ||
    type === 'storycomment' ||
    lowerMsg.includes('commented on your story') ||
    lowerMsg.includes('commented:') ||
    (hasStory && !hasConversation && (type.includes('comment') || type.includes('reply') || lowerMsg.includes('replied')))
  ) {
    return 'commented on your story';
  }

  if (type === 'story-reply' || type === 'storyreply' || (hasConversation && lowerMsg.includes('replied'))) {
    return 'replied to your story';
  }

  // Follows
  if (type === 'follow' || type === 'new-follower' || type === 'new-follower') return 'started following you';
  if (type === 'follow-request') return 'sent you a follow request';
  if (type === 'follow-approved') return 'approved your follow request';

  // Mentions / Tags / Live
  if (type === 'mention' || type === 'post-mention') return 'mentioned you in a post';
  if (type === 'tag' || type === 'post-tag') return 'tagged you in a post';
  if (type === 'live' || type === 'livestream') return 'started a live stream';

  if (rawMsg) {
    if (lowerMsg.includes('commented:')) return 'commented on your story';
    if (lowerMsg.includes('replied:')) {
      return hasConversation ? 'replied to your story' : 'commented on your story';
    }
    return rawMsg;
  }

  return 'sent you a notification';
}

export function getNotificationDisplayText(item: any): string {
  const msg = typeof item?.message === 'string' ? item.message.trim() : '';
  const lowerMsg = msg.toLowerCase();

  if (isSystemNotification(item)) {
    return msg || 'New notification';
  }

  const senderNameRaw =
    item?.senderName ||
    item?.sender?.displayName ||
    item?.sender?.name ||
    item?.userName ||
    item?.user?.displayName ||
    item?.user?.name;
  const senderName = typeof senderNameRaw === 'string' && senderNameRaw.trim() ? senderNameRaw.trim() : 'Someone';

  const actionText = getNotificationActionText(item);
  if (actionText !== 'sent you a notification') {
    if (
      actionText.toLowerCase().startsWith('welcome') ||
      actionText === msg
    ) {
      return actionText;
    }
    return `${senderName} ${actionText}`;
  }

  if (msg) {
    if (msg.toLowerCase().startsWith(senderName.toLowerCase()) || msg.toLowerCase().startsWith('someone')) {
      return msg;
    }
  }

  return `${senderName} ${actionText}`;
}
