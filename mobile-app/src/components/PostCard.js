import React, { useState, memo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Share,
  Clipboard,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import {
  Heart,
  MessageCircle,
  Repeat,
  Bookmark,
  MoreHorizontal,
  User,
  Verified,
  Share2,
  Copy,
  Flag,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import * as haptics from '../utils/haptics';
import theme from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MEDIA_MAX_WIDTH = SCREEN_WIDTH - 24;

const PostCard = memo(({
  post,
  onLike,
  onBookmark,
  onComment,
  onRepost,
  onViewProfile,
  onRepostSuccess,
}) => {
  const { user: currentUser } = useAuth();
  const [liked, setLiked] = useState(post.likedByMe || false);
  const [bookmarked, setBookmarked] = useState(post.bookmarkedByMe || false);
  const [reposted, setReposted] = useState(post.repostedByMe || false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [repostCount, setRepostCount] = useState(post.repostCount || 0);
  const [actionLoading, setActionLoading] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  const isOwner = currentUser && (post.authorKey === currentUser.key || post.authorId === currentUser.id);

  const setLoading = (key, value) => {
    setActionLoading((prev) => ({ ...prev, [key]: value }));
  };

  const handleLike = async () => {
    if (actionLoading.like) return;
    setLoading('like', true);
    haptics.light();
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    try {
      if (onLike) await onLike(post.id);
    } catch (err) {
      setLiked(!liked);
      setLikeCount(liked ? likeCount + 1 : likeCount - 1);
    } finally {
      setLoading('like', false);
    }
  };

  const handleBookmark = async () => {
    if (actionLoading.bookmark) return;
    setLoading('bookmark', true);
    haptics.light();
    setBookmarked(!bookmarked);
    try {
      if (onBookmark) await onBookmark(post.id);
    } catch (err) {
      setBookmarked(!bookmarked);
    } finally {
      setLoading('bookmark', false);
    }
  };

  const handleRepost = async () => {
    if (actionLoading.repost || !onRepost) return;
    setLoading('repost', true);
    haptics.medium();
    setReposted(!reposted);
    setRepostCount(reposted ? repostCount - 1 : repostCount + 1);
    try {
      await onRepost(post.id);
      if (onRepostSuccess) onRepostSuccess(post.id);
    } catch (err) {
      setReposted(!reposted);
      setRepostCount(reposted ? repostCount + 1 : repostCount - 1);
    } finally {
      setLoading('repost', false);
    }
  };

  const handleShare = async () => {
    setMenuOpen(false);
    haptics.light();
    try {
      await Share.share({
        message: post.text
          ? `${post.author}: ${post.text}`
          : `Post by @${post.authorKey || post.author}`,
        title: 'Share Post',
      });
    } catch (err) {
      if (err.message !== 'User did not share') {
        console.error('Share error:', err);
      }
    }
  };

  const handleCopyText = async () => {
    setMenuOpen(false);
    haptics.light();
    try {
      if (Clipboard.setString) {
        Clipboard.setString(post.text || '');
      } else {
        await Clipboard.setStringAsync(post.text || '');
      }
      setActionFeedback({ icon: 'Copy', text: 'Copied to clipboard' });
      setTimeout(() => setActionFeedback(null), 1500);
    } catch (err) {
      console.error('Copy error:', err);
    }
  };

  const handleReport = () => {
    setMenuOpen(false);
    setActionFeedback({ icon: 'Flag', text: 'Report feature coming soon' });
    setTimeout(() => setActionFeedback(null), 2000);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    setActionFeedback({ icon: 'Delete', text: 'Delete feature coming soon' });
    setTimeout(() => setActionFeedback(null), 2000);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const renderMedia = () => {
    if (!post.media || post.media.length === 0) return null;

    const mediaItems = post.media.slice(0, 4);

    if (mediaItems.length === 1) {
      const media = mediaItems[0];
      if (media.kind === 'video' && media.url) {
        return (
          <View style={styles.mediaContainer}>
            <Video
              source={{ uri: media.url }}
              style={styles.fullMedia}
              useNativeControls
              resizeMode={ResizeMode.COVER}
              isLooping
            />
          </View>
        );
      } else if (media.url) {
        return (
          <View style={styles.mediaContainer}>
            <Image
              source={{ uri: media.url }}
              style={styles.fullMedia}
              resizeMode="cover"
            />
          </View>
        );
      }
    }

    return (
      <View style={styles.mediaGrid}>
        {mediaItems.map((media, index) => {
          if (media.kind === 'video' && media.url) {
            return (
              <View key={index} style={[styles.gridItem, mediaItems.length === 1 && styles.gridItemFull]}>
                <Video
                  source={{ uri: media.url }}
                  style={styles.gridVideo}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                />
              </View>
            );
          } else if (media.url) {
            return (
              <View key={index} style={[styles.gridItem, mediaItems.length === 1 && styles.gridItemFull]}>
                <Image
                  source={{ uri: media.url }}
                  style={styles.gridImage}
                  resizeMode="cover"
                />
              </View>
            );
          }
          return null;
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => onViewProfile && onViewProfile(post.authorKey)}
        >
          {post.authorAvatar ? (
            <Image source={{ uri: post.authorAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={20} color={theme.colors.textMuted} />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.authorRow}>
            <Text style={styles.authorName}>{post.author}</Text>
            {post.verified && <Verified size={14} color={theme.colors.verified} fill={theme.colors.verified} />}
          </View>
          <Text style={styles.timestamp}>{formatDate(post.createdAt)}</Text>
        </View>
        <TouchableOpacity style={styles.moreButton} onPress={() => setMenuOpen(true)}>
          <MoreHorizontal size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {post.text ? (
        <Text style={styles.content}>{post.text}</Text>
      ) : null}

      {renderMedia()}

      {post.quotedPost && (
        <TouchableOpacity style={styles.quotedPost}>
          <View style={styles.quotedHeader}>
            <Text style={styles.quotedAuthor}>{post.quotedPost.author}</Text>
            {post.quotedPost.verified && <Verified size={12} color={theme.colors.verified} fill={theme.colors.verified} />}
          </View>
          <Text style={styles.quotedText} numberOfLines={2}>
            {post.quotedPost.text}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike} disabled={actionLoading.like}>
          <Heart
            size={20}
            color={liked ? theme.colors.like : theme.colors.textSecondary}
            fill={liked ? theme.colors.like : 'transparent'}
          />
          <Text style={[styles.actionText, liked && styles.actionTextActive]}>
            {likeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onComment && onComment(post.id)}>
          <MessageCircle size={20} color={theme.colors.textSecondary} />
          <Text style={styles.actionText}>{post.commentCount || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleRepost}
          disabled={actionLoading.repost}
        >
          <Repeat
            size={20}
            color={reposted ? theme.colors.success : theme.colors.textSecondary}
            fill={reposted ? theme.colors.success : 'transparent'}
          />
          <Text style={[styles.actionText, reposted && styles.actionTextRepost]}>
            {repostCount}
          </Text>
        </TouchableOpacity>

        <View style={styles.actionsRight}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleBookmark}
            disabled={actionLoading.bookmark}
          >
            <Bookmark
              size={20}
              color={bookmarked ? theme.colors.bookmark : theme.colors.textSecondary}
              fill={bookmarked ? theme.colors.bookmark : 'transparent'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        >
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Share2 size={18} color={theme.colors.textPrimary} />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleCopyText}>
              <Copy size={18} color={theme.colors.textPrimary} />
              <Text style={styles.menuItemText}>Copy text</Text>
            </TouchableOpacity>
            {!isOwner && (
              <TouchableOpacity style={styles.menuItem} onPress={handleReport}>
                <Flag size={18} color={theme.colors.danger} />
                <Text style={[styles.menuItemText, { color: theme.colors.danger }]}>Report</Text>
              </TouchableOpacity>
            )}
            {isOwner && (
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <Trash2 size={18} color={theme.colors.danger} />
                <Text style={[styles.menuItemText, { color: theme.colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuClose} onPress={() => setMenuOpen(false)}>
              <Text style={styles.menuCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {actionFeedback && (
        <View style={styles.feedbackToast}>
          <Text style={styles.feedbackText}>{actionFeedback.text}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  avatarContainer: {
    marginRight: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  timestamp: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  moreButton: {
    padding: 8,
    marginLeft: 4,
  },
  content: {
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  mediaContainer: {
    width: MEDIA_MAX_WIDTH,
    maxHeight: 300,
    marginBottom: 12,
    marginLeft: 12,
    overflow: 'hidden',
  },
  fullMedia: {
    width: MEDIA_MAX_WIDTH,
    height: 250,
    borderRadius: theme.radius.sm,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  gridItem: {
    width: '48%',
    aspectRatio: 1,
    margin: '1%',
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
  },
  gridItemFull: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridVideo: {
    width: '100%',
    height: '100%',
  },
  quotedPost: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12,
    backgroundColor: theme.colors.bgInput,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  quotedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  quotedAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  quotedText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    paddingVertical: 8,
  },
  actionsRight: {
    marginLeft: 'auto',
  },
  actionText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  actionTextActive: {
    color: theme.colors.like,
  },
  actionTextRepost: {
    color: theme.colors.success,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  menuCard: {
    backgroundColor: theme.colors.bgCard,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    width: '100%',
    maxWidth: 400,
    paddingBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  menuClose: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  menuCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  feedbackToast: {
    position: 'absolute',
    bottom: 16,
    left: 24,
    right: 24,
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    zIndex: 100,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
});

PostCard.displayName = 'PostCard';

export default PostCard;
