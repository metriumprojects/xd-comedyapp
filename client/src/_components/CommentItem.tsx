import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import CommentAvatar from "./CommentAvatar";
import { Comment } from "./CommentSection";

interface CommentItemProps {
  comment: Comment;
  isReply?: boolean;
  parentId?: string;
  currentUser: any;
  currentUserId: string;
  onReply: (id: string, userName: string) => void;
  onLike: (id: string, isReply: boolean, parentId?: string) => void;
  onLongPress: (comment: Comment, isReply: boolean, parentId?: string) => void;
}

const getCommentTime = (timestamp: any) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  if (diff < 2419200) return `${Math.floor(diff / 604800)}w`;
  if (diff < 31536000) return `${Math.floor(diff / 2419200)}mo`;
  return `${Math.floor(diff / 31536000)}y`;
};

const CommentItemComponent: React.FC<CommentItemProps> = ({
  comment,
  isReply = false,
  parentId,
  currentUser,
  currentUserId,
  onReply,
  onLike,
  onLongPress,
}) => {
  const [repliesExpanded, setRepliesExpanded] = useState(false);

  const isOwner = useMemo(() => {
    const uid = currentUser?.uid || currentUser?._id || currentUser?.id;
    return uid && String(uid) === String(comment.userId);
  }, [currentUser, comment.userId]);

  const timeText = useMemo(() => getCommentTime(comment.createdAt), [comment.createdAt]);
  const isLiked = comment.likes?.includes(currentUserId);
  const likeCount = comment.likesCount || comment.likes?.length || 0;
  const replyCount = comment.replies?.length || 0;

  return (
    <View>
      {/* Comment row */}
      <View style={[styles.commentRow, isReply && styles.replyRow]}>
        <CommentAvatar
          userId={comment.userId}
          userAvatar={comment.userAvatar}
          size={isReply ? 24 : 32}
        />
        <View style={styles.commentBody}>
          <TouchableOpacity
            activeOpacity={0.7}
            onLongPress={() => {
              if (isOwner) onLongPress(comment, isReply, parentId);
            }}
          >
            <Text style={styles.commentTextLine}>
              <Text style={styles.userName}>{comment.userName}</Text>
              {'  '}
              <Text style={styles.commentText}>{comment.text}</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{timeText}</Text>
            {likeCount > 0 && (
              <Text style={styles.metaTextBold}>
                {likeCount} {likeCount === 1 ? 'like' : 'likes'}
              </Text>
            )}
            <TouchableOpacity
              onPress={() => onReply(parentId || comment.id, comment.userName)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.metaTextBold}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => onLike(comment.id, isReply, parentId)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={12}
            color={isLiked ? '#FF3B30' : '#8e8e8e'}
          />
        </TouchableOpacity>
      </View>

      {/* Replies section — only rendered for top-level comments */}
      {!isReply && replyCount > 0 && (
        <View style={styles.repliesContainer}>
          {/* ── View / Hide replies toggle ── */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setRepliesExpanded(prev => !prev)}
            activeOpacity={0.6}
          >
            <View style={styles.toggleDash} />
            <Text style={styles.toggleLabel}>
              {repliesExpanded
                ? 'Hide replies'
                : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
            </Text>
          </TouchableOpacity>

          {/* Expanded reply list */}
          {repliesExpanded &&
            comment.replies!.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                isReply
                parentId={comment.id}
                currentUser={currentUser}
                currentUserId={currentUserId}
                onReply={onReply}
                onLike={onLike}
                onLongPress={onLongPress}
              />
            ))}
        </View>
      )}
    </View>
  );
};

/* ──────────── Instagram-style stylesheet ──────────── */
const AVATAR_SIZE = 32;          // top-level avatar
const AVATAR_GAP = 10;           // gap between avatar & text
const LEFT_PAD = 16;             // screen-edge padding
// replies indent = avatar center of parent (LEFT_PAD + AVATAR_SIZE/2 + small offset)
const REPLY_INDENT = LEFT_PAD + AVATAR_SIZE + AVATAR_GAP; // 60

const styles = StyleSheet.create({
  /* ── Row layout ── */
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: LEFT_PAD,
    paddingRight: 16,
    paddingVertical: 10,
  },
  replyRow: {
    paddingLeft: 0,       // handled by repliesContainer
    paddingVertical: 6,
  },

  /* ── Text body ── */
  commentBody: {
    flex: 1,
    marginLeft: AVATAR_GAP,
  },
  commentTextLine: {
    fontSize: 13,
    color: '#262626',
    lineHeight: 18,
  },
  userName: {
    fontWeight: '600',
    fontSize: 13,
    color: '#262626',
  },
  commentText: {
    fontWeight: '400',
    fontSize: 13,
    color: '#262626',
  },

  /* ── Meta row (time · likes · reply) ── */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 14,
  },
  metaText: {
    fontSize: 12,
    color: '#8e8e8e',
  },
  metaTextBold: {
    fontSize: 12,
    color: '#8e8e8e',
    fontWeight: '600',
  },

  /* ── Heart button ── */
  heartBtn: {
    paddingTop: 6,
    paddingLeft: 10,
    alignItems: 'center',
  },

  /* ── Replies container ── */
  repliesContainer: {
    marginLeft: REPLY_INDENT,
  },

  /* ── Toggle row ── */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 16,
  },
  toggleDash: {
    width: 24,
    height: 0.5,
    backgroundColor: '#8e8e8e',
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 12,
    color: '#8e8e8e',
    fontWeight: '600',
  },
});

export const CommentItem = React.memo(CommentItemComponent);
