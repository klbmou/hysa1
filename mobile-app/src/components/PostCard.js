import React, { useState, memo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Clipboard as RNClipboard,
} from 'react-native';
import {
  Heart,
  MessageCircle,
  Repeat,
  Bookmark,
  MoreHorizontal,
  Verified,
  Share2,
  Copy,
  Flag,
  Trash2,
  X,
  Play,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import MediaViewer from './MediaViewer';
import * as haptics from '../utils/haptics';
import { sharePost, copyLink } from '../utils/share';
import theme from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getCount = (...values) => {
  for (const value of values) {
    if (typeof value === 'number') return value;
    if (Array.isArray(value)) return value.length;
  }
  return 0;
};
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
  const likeCount = getCount(post.likeCount, post.likesCount, post.likes, post.reactions?.likes, post.stats?.likes);
  const commentCount = getCount(post.commentCount, post.commentsCount, post.comments, post.stats?.comments);
  const repostCount = getCount(post.repostCount, post.repostsCount, post.reposts, post.stats?.reposts);
  const [actionLoading, setActionLoading] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [viewerMedia, setViewerMedia] = useState(null);

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
    await sharePost({
      postId: post.id,
      username: post.authorKey || post.author,
      text: post.text,
    });
  };

  const handleCopyText = async () => {
    setMenuOpen(false);
    haptics.light();
    try {
      if (RNClipboard.setString) {
        RNClipboard.setString(post.text || '');
      } else {
        await RNClipboard.setStringAsync(post.text || '');
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
      const displayUrl = media.fullUrl || media.url;
      const thumbUrl = media.thumbnailUrl || displayUrl;
      if (!displayUrl) return null;
      return (
        <View style={styles.mediaWrap}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => { setViewerMedia(media); haptics.light(); }}
            activeOpacity={0.8}
          >
            <Image source={{ uri: media.kind === 'video' ? thumbUrl : displayUrl }} style={styles.media} resizeMode="cover" />
          </TouchableOpacity>
          {media.kind === 'video' && (
            <View style={styles.playOverlay}>
              <Play size={32} color="#fff" fill="#fff" />
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.mediaGrid}>
        {mediaItems.map((media, index) => {
          const displayUrl = media.fullUrl || media.url;
          const thumbUrl = media.thumbnailUrl || displayUrl;
          if (!displayUrl) return null;
          return (
            <View key={index} style={[styles.gridItem, mediaItems.length === 1 && styles.gridItemFull]}>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => { setViewerMedia(media); haptics.light(); }}
                activeOpacity={0.8}
              >
                <Image source={{ uri: media.kind === 'video' ? thumbUrl : displayUrl }} style={styles.gridImage} resizeMode="cover" />
              </TouchableOpacity>
              {media.kind === 'video' && (
                <View style={styles.gridPlayOverlay}>
                  <Play size={20} color="#fff" fill="#fff" />
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const repostUser =
    post.repostedBy?.username ||
    post.repostUser?.username ||
    post.repostAuthor?.username ||
    post.repostedByName ||
    post.repostedBy ||
    null;

  return (
    <View style={styles.card}>
      {repostUser ? (
        <View style={styles.repostRow}>
          <Repeat size={13} color="#A855F7" />
          <Text style={styles.repostText}>@{repostUser} reposted</Text>
        </View>
      ) : null}

      <View style={styles.authorRow}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => onViewProfile && onViewProfile(post.authorKey)}
        >
          {post.authorAvatar ? (
            <Image source={{ uri: post.authorAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <View style={styles.avatarDot} />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.authorNameRow}>
            <Text style={styles.authorName}>{post.author}</Text>
            {post.verified && <Verified size={14} color="#7C3AED" fill="#7C3AED" />}
          </View>
          <Text style={styles.timestamp}>{formatDate(post.createdAt)}</Text>
        </View>
        <TouchableOpacity style={styles.moreButton} onPress={() => setMenuOpen(true)}>
          <MoreHorizontal size={20} color="#B7B7C8" />
        </TouchableOpacity>
      </View>

      {post.text ? (
        <Text style={styles.postText}>{post.text}</Text>
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
              color={liked ? '#FF3B8A' : '#B7B7C8'}
              fill={liked ? '#FF3B8A' : 'transparent'}
            />
            <Text style={[styles.actionText, liked && styles.actionTextActive]}>
              {likeCount}
            </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onComment && onComment(post.id)}>
            <MessageCircle size={20} color={'#aaaaaa'} />
            <Text style={styles.actionText}>{commentCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleRepost}
          disabled={actionLoading.repost}
        >
            <Repeat
              size={20}
              color={reposted ? '#A855F7' : '#B7B7C8'}
              fill={reposted ? '#A855F7' : 'transparent'}
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
              color={bookmarked ? '#7C3AED' : '#B7B7C8'}
              fill={bookmarked ? '#7C3AED' : 'transparent'}
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

      <MediaViewer
        visible={!!viewerMedia}
        media={viewerMedia}
        onClose={() => setViewerMedia(null)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: 16,
    padding: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  repostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  repostText: {
    color: '#B7B7C8',
    fontSize: 12,
    fontWeight: '600',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarContainer: {
    marginRight: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#A855F7',
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  timestamp: {
    color: '#77778A',
    fontSize: 12,
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
    marginLeft: 4,
  },
  postText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 21,
  },
  mediaWrap: {
    marginTop: 12,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  media: {
    width: '100%',
    borderRadius: 20,
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
    borderRadius: 20,
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
  playOverlay: {
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
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  quotedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  quotedAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quotedText: {
    fontSize: 14,
    color: '#B7B7C8',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionText: {
    color: '#B7B7C8',
    fontSize: 12,
    fontWeight: '600',
  },
  actionTextActive: {
    color: '#FF3B8A',
  },
  actionTextRepost: {
    color: '#A855F7',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  menuCard: {
    backgroundColor: '#070711',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    color: '#FFFFFF',
  },
  menuClose: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  menuCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B7B7C8',
  },
  feedbackToast: {
    position: 'absolute',
    bottom: 16,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    zIndex: 100,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

PostCard.displayName = 'PostCard';

export default PostCard;
