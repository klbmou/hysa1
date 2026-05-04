import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Repeat,
  Bookmark,
  User,
  Verified,
  Send,
  Share2,
  Play,
} from 'lucide-react-native';
import { postAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import MediaViewer from '../components/MediaViewer';
import * as haptics from '../utils/haptics';
import { sharePost } from '../utils/share';
import theme from '../theme';

const CommentItem = ({ comment, depth = 0, onReply, replyingTo, setReplyingTo }) => {
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const replies = comment.replies || [];
  const isReplying = replyingTo && replyingTo.id === comment.id;
  const hasReplies = replies.length > 0;
  const isRoot = depth === 0;

  const handleStartReply = () => {
    haptics.light();
    setReplyingTo({ id: comment.id, author: comment.author });
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setReplySubmitting(true);
    try {
      await onReply(comment.id, replyText.trim());
      setReplyText('');
      setReplyingTo(null);
      if (hasReplies) setShowReplies(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to add reply.');
    } finally {
      setReplySubmitting(false);
    }
  };

  const avatarSize = isRoot ? 32 : Math.max(20, 28 - depth * 3);
  const avatarRadius = avatarSize / 2;

  return (
    <View style={styles.commentWrapper}>
      {isRoot && <View style={styles.commentItemRoot}>
        <View style={[styles.commentAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarRadius }]}>
          {comment.authorAvatar ? (
            <Image source={{ uri: comment.authorAvatar }} style={{ width: avatarSize, height: avatarSize, borderRadius: avatarRadius }} />
          ) : (
            <View style={[styles.commentAvatarPlaceholder, { width: avatarSize, height: avatarSize, borderRadius: avatarRadius }]}>
              <User size={avatarSize * 0.5} color={theme.colors.textMuted} />
            </View>
          )}
        </View>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <View style={styles.nameRow}>
              <Text style={styles.commentAuthor}>{comment.author || comment.authorKey || 'User'}</Text>
              {comment.authorVerified && <Verified size={12} color={theme.colors.verified} fill={theme.colors.verified} />}
              {comment.authorRole === 'owner' && (
                <Text style={styles.ownerBadge}>OP</Text>
              )}
            </View>
            <Text style={styles.commentTime}>{formatDate(comment.createdAt)}</Text>
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
          <View style={styles.commentActions}>
            <Text style={styles.likeCountText}>{comment.likeCount || 0}</Text>
            <TouchableOpacity style={styles.commentActionBtn} onPress={handleStartReply} activeOpacity={0.6}>
              <Text style={styles.replyBtnText}>Reply</Text>
            </TouchableOpacity>
          </View>

          {hasReplies && (
            <TouchableOpacity
              style={styles.viewRepliesBtn}
              onPress={() => { setShowReplies(!showReplies); haptics.light(); }}
              activeOpacity={0.6}
            >
              <Text style={styles.viewRepliesText}>
                {showReplies ? 'Hide' : `View`} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </Text>
            </TouchableOpacity>
          )}

          {showReplies && replies.map((reply) => (
            <View key={reply.id || reply.text} style={styles.replyContainer}>
              <View style={styles.replyAvatarWrap}>
                {reply.authorAvatar ? (
                  <Image source={{ uri: reply.authorAvatar }} style={styles.replyAvatar} />
                ) : (
                  <View style={styles.replyAvatarPlaceholder}>
                    <User size={10} color={theme.colors.textMuted} />
                  </View>
                )}
              </View>
              <View style={styles.replyContent}>
                <View style={styles.replyHeader}>
                  <Text style={styles.replyAuthor}>{reply.author || 'User'}</Text>
                  <Text style={styles.replyTime}>{formatDate(reply.createdAt)}</Text>
                </View>
                <Text style={styles.replyText}>{reply.text}</Text>
                <View style={styles.replyActions}>
                  <Text style={styles.replyLikeText}>{reply.likeCount || 0}</Text>
                  <TouchableOpacity onPress={() => setReplyingTo({ id: comment.id, author: reply.author })} activeOpacity={0.6}>
                    <Text style={styles.replyReplyBtn}>Reply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {isReplying && (
            <View style={styles.replyInputRow}>
              <TextInput
                style={styles.replyInput}
                placeholder={`Reply to @${comment.author}...`}
                placeholderTextColor={theme.colors.textMuted}
                value={replyText}
                onChangeText={setReplyText}
                multiline
                autoFocus
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.replySendBtn, (!replyText.trim() || replySubmitting) && styles.replySendBtnDisabled]}
                onPress={handleReply}
                disabled={!replyText.trim() || replySubmitting}
                activeOpacity={0.7}
              >
                {replySubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Send size={14} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelReplyBtn} onPress={() => setReplyingTo(null)} activeOpacity={0.7}>
                <Text style={styles.cancelReplyText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>}
    </View>
  );
};

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PostDetail = ({ navigation, route }) => {
  const { user: currentUser } = useAuth();
  const postId = route.params?.postId;
  const passedPost = route.params?.post;
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState(passedPost || null);
  const [loading, setLoading] = useState(!passedPost);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewerMedia, setViewerMedia] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  useEffect(() => {
    if (!postId && !passedPost) {
      setError('No post selected.');
      setLoading(false);
      return;
    }

    if (passedPost) {
      setPost(passedPost);
      fetchComments(passedPost.id || postId);
      return;
    }

    fetchPost();
  }, [postId]);

  const fetchPost = async () => {
    try {
      const response = await postAPI.getPost(postId);
      if (response.data.ok && response.data.post) {
        setPost(response.data.post);
        fetchComments(postId);
      } else {
        setError('Post not found.');
      }
    } catch (err) {
      console.error('PostDetail fetch error:', err);
      setError('Failed to load post.');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (targetId) => {
    try {
      const response = await postAPI.getComments(targetId);
      if (response.data.ok) {
        setComments(response.data.comments || []);
        setCommentCount(response.data.commentCount || 0);
      }
    } catch (err) {
      console.error('Comments fetch error:', err);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !postId) return;
    setSubmitting(true);
    try {
      const response = await postAPI.addComment(postId, commentText.trim());
      if (response.data.ok) {
        setCommentText('');
        fetchComments(postId);
      }
    } catch (err) {
      console.error('Add comment error:', err);
      Alert.alert('Error', 'Failed to add comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = useCallback(async (parentId, text) => {
    if (!postId) return;
    try {
      const response = await postAPI.addReply(postId, parentId, text);
      if (response.data.ok) {
        fetchComments(postId);
      }
    } catch (err) {
      console.error('Reply error:', err);
      throw err;
    }
  }, [postId]);

  const renderMedia = () => {
    if (!post?.media || post.media.length === 0) return null;
    return post.media.map((media, index) => {
      const displayUrl = media.fullUrl || media.url;
      const thumbUrl = media.thumbnailUrl || displayUrl;
      if (!displayUrl) return null;
      return (
        <TouchableOpacity
          key={index}
          style={styles.mediaContainer}
          onPress={() => { setViewerMedia(media); haptics.light(); }}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: media.kind === 'video' ? thumbUrl : displayUrl }}
            style={styles.media}
            resizeMode="cover"
          />
          {media.kind === 'video' && (
            <View style={styles.mediaPlayOverlay}>
              <Play size={32} color="#fff" fill="#fff" />
            </View>
          )}
        </TouchableOpacity>
      );
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error || 'Post not found.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.authorSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => {
              if (post.authorKey) {
                const myKey = currentUser && (currentUser.key || currentUser.userKey || '');
                if (myKey && String(post.authorKey) === String(myKey)) {
                  navigation.navigate('Profile');
                } else {
                  navigation.navigate('UserProfile', { userKey: post.authorKey });
                }
              }
            }}
          >
            {post.authorAvatar ? (
              <Image source={{ uri: post.authorAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={24} color={theme.colors.textMuted} />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.authorInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.authorName}>{post.author || post.authorKey || 'Unknown'}</Text>
              {post.verified && <Verified size={16} color={theme.colors.verified} fill={theme.colors.verified} />}
            </View>
            <Text style={styles.authorKey}>@{post.authorKey || ''}</Text>
            <Text style={styles.timestamp}>{formatDate(post.createdAt)}</Text>
          </View>
        </View>

        {post.text ? <Text style={styles.postText}>{post.text}</Text> : null}

        {renderMedia()}

        {post.quotedPost && (
          <View style={styles.quotedPost}>
            <Text style={styles.quotedAuthor}>{post.quotedPost.author}</Text>
            <Text style={styles.quotedText} numberOfLines={2}>
              {post.quotedPost.text}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.action}>
            <Heart size={20} color={theme.colors.textSecondary} />
            <Text style={styles.actionText}>{post.likeCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
          >
            <MessageCircle size={20} color={theme.colors.textSecondary} />
            <Text style={styles.actionText}>{post.commentCount || commentCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action}>
            <Repeat size={20} color={theme.colors.textSecondary} />
            <Text style={styles.actionText}>{post.repostCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.action, { marginLeft: 'auto' }]}>
            <Bookmark size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => { haptics.light(); sharePost({ postId: post.id, username: post.authorKey || post.author, text: post.text }); }}>
            <Share2 size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            Comments ({commentCount})
          </Text>
          {comments.length === 0 ? (
            <Text style={styles.noComments}>No comments yet.</Text>
          ) : (
            comments.map((comment) => (
              <CommentItem
                key={comment.id || comment.text}
                comment={comment}
                onReply={handleReply}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
              />
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.commentInputRow}>
        {replyingTo && (
          <View style={styles.replyingIndicator}>
            <Text style={styles.replyingText}>Replying to @{replyingTo.author}</Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)} activeOpacity={0.7}>
              <Text style={styles.replyingCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        <TextInput
          style={styles.commentInput}
          placeholder={replyingTo ? `Reply to @${replyingTo.author}...` : 'Write a comment...'}
          placeholderTextColor={theme.colors.textMuted}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!commentText.trim() || submitting) && styles.sendButtonDisabled]}
          onPress={handleAddComment}
          disabled={!commentText.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Send size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      <MediaViewer
        visible={!!viewerMedia}
        media={viewerMedia}
        onClose={() => setViewerMedia(null)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bgGlass,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  authorSection: {
    flexDirection: 'row',
    padding: 16,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  authorKey: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  postText: {
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  mediaContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  media: {
    width: '100%',
    height: 250,
    borderRadius: theme.radius.md,
  },
  mediaPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  quotedPost: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: theme.colors.bgInput,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  quotedAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  quotedText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  commentsSection: {
    padding: 16,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  noComments: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 32,
  },
  commentWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  commentItemRoot: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  commentContent: {
    flex: 1,
    paddingRight: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginRight: 6,
  },
  ownerBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  commentTime: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginLeft: 'auto',
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    marginRight: 2,
  },
  likeCountText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginRight: 14,
  },
  commentActionText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  replyBtnText: {
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  viewRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  viewRepliesText: {
    fontSize: 13,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingLeft: 8,
  },
  replyAvatarWrap: {
    marginRight: 8,
    flexShrink: 0,
    marginTop: 1,
  },
  replyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  replyAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyContent: {
    flex: 1,
    minWidth: 0,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  replyAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginRight: 6,
  },
  replyTime: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginLeft: 6,
  },
  replyText: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  replyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  replyLikeText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginRight: 12,
  },
  replyReplyBtn: {
    fontSize: 11,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 4,
  },
  replyInput: {
    flex: 1,
    backgroundColor: theme.colors.bgInput,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: theme.colors.textPrimary,
    maxHeight: 80,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  replySendBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  replySendBtnDisabled: {
    opacity: 0.4,
  },
  cancelReplyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 4,
    flexShrink: 0,
  },
  cancelReplyText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  commentInputRow: {
    flexDirection: 'column',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.bgSecondary,
  },
  replyingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderRadius: theme.radius.sm,
  },
  replyingText: {
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  replyingCancel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  commentInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgInput,
    borderRadius: theme.radius.full,
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.textPrimary,
    maxHeight: 100,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.radius.sm,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PostDetail;
