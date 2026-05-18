import React, { useState, memo, useCallback, useEffect, useMemo } from 'react';
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
  Play,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import MediaViewer from './MediaViewer';
import { Avatar, GlassCard, MediaFallback } from './ui';
import * as haptics from '../utils/haptics';
import { sharePost } from '../utils/share';
import { displayUsername, nameTextStyle } from '../utils/display';
import theme from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getCount = (...values) => {
  for (const value of values) {
    if (typeof value === 'number') return value;
    if (Array.isArray(value)) return value.length;
  }
  return 0;
};

const getMediaUrl = (media) => media?.fullUrl || media?.url || media?.secure_url || '';
const getMediaKind = (media) => {
  const kind = media?.kind || media?.type || media?.resource_type || '';
  return kind === 'video' || kind === 'reel' ? 'video' : 'image';
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getRepostCount = (post) => getCount(post?.repostCount, post?.repostsCount, post?.reposts, post?.stats?.reposts);
const getLikeCount = (post) => getCount(post?.likeCount, post?.likesCount, post?.likes?.length, post?.reactions?.likes, post?.stats?.likes, 0);

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
  const [likeCount, setLikeCount] = useState(getLikeCount(post));
  const commentCount = getCount(post.commentCount, post.commentsCount, post.comments, post.stats?.comments);
  const [repostCount, setRepostCount] = useState(getRepostCount(post));
  const [actionLoading, setActionLoading] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [viewerMedia, setViewerMedia] = useState(null);
  const [mediaError, setMediaError] = useState(false);
  const authorName = useMemo(() => displayUsername(post.author || post.authorKey || 'User'), [post.author, post.authorKey]);
  const repostAuthorName = useMemo(() => displayUsername(
    post.repostedBy?.username ||
    post.repostUser?.username ||
    post.repostAuthor?.username ||
    post.repostedByName ||
    post.repostedBy ||
    ''
  ), [post.repostedBy, post.repostUser, post.repostAuthor, post.repostedByName]);

  const isOwner = currentUser && (post.authorKey === currentUser.key || post.authorId === currentUser.id);

  useEffect(() => {
    setLiked(!!post.likedByMe);
    setBookmarked(!!post.bookmarkedByMe);
    setReposted(!!post.repostedByMe);
    setLikeCount(getLikeCount(post));
    setRepostCount(getRepostCount(post));
    setMediaError(false);
  }, [post.id, post.likedByMe, post.bookmarkedByMe, post.repostedByMe, post.likeCount, post.likesCount, post.repostCount, post.repostsCount]);

  const openMediaViewer = useCallback((media) => {
    const url = getMediaUrl(media);
    if (!url) {
      setMediaError(true);
      return;
    }
    haptics.light();
    setViewerMedia({ ...media, fullUrl: media.fullUrl || media.url || media.secure_url, kind: getMediaKind(media) });
  }, []);

  const setLoading = (key, value) => {
    setActionLoading((prev) => ({ ...prev, [key]: value }));
  };

  const handleLike = useCallback(async () => {
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
  }, [actionLoading.like, liked, likeCount, onLike, post.id]);

  const handleBookmark = useCallback(async () => {
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
  }, [actionLoading.bookmark, bookmarked, onBookmark, post.id]);

  const handleRepost = useCallback(async () => {
    if (actionLoading.repost || !onRepost) return;
    setLoading('repost', true);
    haptics.medium();
    setReposted(!reposted);
    setRepostCount(reposted ? repostCount - 1 : repostCount + 1);
    try {
      const result = await onRepost(post.id);
      const payload = result?.data || result || {};
      if (typeof payload.reposted === 'boolean') setReposted(payload.reposted);
      if (typeof payload.repostCount === 'number') setRepostCount(payload.repostCount);
      if (onRepostSuccess) onRepostSuccess(post.id);
    } catch (err) {
      setReposted(!reposted);
      setRepostCount(reposted ? repostCount + 1 : repostCount - 1);
    } finally {
      setLoading('repost', false);
    }
  }, [actionLoading.repost, onRepost, onRepostSuccess, post.id, reposted, repostCount]);

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
    if (mediaError) {
      return (
        <MediaFallback style={styles.mediaErrorWrap} />
      );
    }

    const mediaItems = post.media.slice(0, 4);

    if (mediaItems.length === 1) {
      const media = mediaItems[0];
      const displayUrl = getMediaUrl(media);
      const thumbUrl = media.thumbnailUrl || displayUrl;
      const mediaKind = getMediaKind(media);
      if (!displayUrl) return null;

      const aspectRatio = media.width && media.height ? media.width / media.height : null;
      const frameAspect = aspectRatio ? clamp(aspectRatio, 0.72, 1.55) : null;

      return (
        <View style={styles.mediaWrap}>
          <TouchableOpacity
            style={[styles.singleMediaFrame, frameAspect ? { aspectRatio: frameAspect } : { height: Math.min(330, SCREEN_WIDTH * 0.78) }]}
            onPress={() => openMediaViewer(media)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: mediaKind === 'video' ? thumbUrl : displayUrl }}
              style={styles.media}
              resizeMode="contain"
              onError={() => setMediaError(true)}
            />
          </TouchableOpacity>
          {mediaKind === 'video' && (
            <View style={styles.playOverlay} pointerEvents="none">
              <Play size={32} color="#fff" fill="#fff" />
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.mediaGrid}>
        {mediaItems.map((media, index) => {
          const displayUrl = getMediaUrl(media);
          const thumbUrl = media.thumbnailUrl || displayUrl;
          const mediaKind = getMediaKind(media);
          if (!displayUrl) return null;
          return (
            <View key={index} style={[styles.gridItem, mediaItems.length === 1 && styles.gridItemFull]}>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => openMediaViewer(media)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: mediaKind === 'video' ? thumbUrl : displayUrl }}
                  style={styles.gridImage}
                  resizeMode="contain"
                  onError={() => setMediaError(true)}
                />
              </TouchableOpacity>
              {mediaKind === 'video' && (
                <View style={styles.gridPlayOverlay} pointerEvents="none">
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
    repostAuthorName || null;

  return (
    <GlassCard gradient style={styles.card} contentStyle={styles.cardContent}>
      {repostUser ? (
        <View style={styles.repostRow}>
          <Repeat size={13} color={theme.colors.purple} />
          <Text style={[styles.repostText, nameTextStyle(repostUser)]}>@{repostUser} reposted</Text>
        </View>
      ) : null}

      <View style={styles.authorRow}>
        <TouchableOpacity 
          style={styles.avatarContainer}
          onPress={() => onViewProfile && onViewProfile(post.authorKey)}
        >
          <Avatar uri={post.authorAvatar} name={authorName} size={38} ring />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.authorNameRow}>
            <Text style={[styles.authorName, nameTextStyle(authorName)]} numberOfLines={1}>{authorName}</Text>
            {post.verified && <Verified size={14} color={theme.colors.verified} fill={theme.colors.verified} style={{ marginLeft: 4 }} />}
          </View>
          <Text style={styles.timestamp}>{formatDate(post.createdAt)}</Text>
        </View>
        <TouchableOpacity style={styles.moreButton} onPress={() => setMenuOpen(true)}>
          <MoreHorizontal size={20} color={theme.colors.textSecondary} />
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
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike} disabled={actionLoading.like}>
            <Heart
              size={20}
              color={liked ? theme.colors.accent : theme.colors.textSecondary}
              fill={liked ? theme.colors.accent : 'transparent'}
            />
            <Text style={[styles.actionText, liked && styles.actionTextActive]}>
              {likeCount}
            </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onComment && onComment(post.id)}>
            <MessageCircle size={20} color={theme.colors.textSecondary} />
            <Text style={styles.actionText}>{commentCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleRepost} 
          disabled={actionLoading.repost}
        >
            <Repeat
              size={20}
              color={reposted ? theme.colors.purple : theme.colors.textSecondary}
              fill={reposted ? theme.colors.purple : 'transparent'}
            />
            <Text style={[styles.actionText, reposted && styles.actionTextRepost]}>
              {repostCount}
            </Text>
        </TouchableOpacity>

        <View style={styles.actionsRight}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleBookmark}
            disabled={actionLoading.bookmark}
          >
            <Bookmark
              size={20}
              color={bookmarked ? theme.colors.purple : theme.colors.textSecondary}
              fill={bookmarked ? theme.colors.purple : 'transparent'}
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
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 10,
    marginBottom: 10,
    borderColor: 'rgba(255,255,255,0.105)',
  },
  cardContent: {
    padding: 12,
  },
  repostRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  repostText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatarContainer: { marginRight: 9 },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  authorName: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  headerInfo: { flex: 1 },
  timestamp: { color: theme.colors.textMuted, fontSize: 11, marginTop: 1, fontWeight: '600' },
  moreButton: { padding: 8, marginLeft: 4, borderRadius: 16 },
  postText: { color: theme.colors.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  mediaWrap: { marginTop: 10, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  singleMediaFrame: { width: '100%', minHeight: 180, maxHeight: 420, alignItems: 'center', justifyContent: 'center', backgroundColor: '#05050C' },
  media: { width: '100%', height: '100%', borderRadius: 15 },
  mediaErrorWrap: { marginTop: 10 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 4 },
  gridItem: { width: '49%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  gridItemFull: { width: '100%', aspectRatio: 4/3, margin: 0, borderRadius: 14, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%', borderRadius: 8 },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  gridPlayOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  quotedPost: { marginTop: 9, padding: 10, backgroundColor: 'rgba(255,255,255,0.045)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  quotedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  quotedAuthor: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary },
  quotedText: { fontSize: 14, color: theme.colors.textSoft, lineHeight: 19 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11, paddingTop: 9, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.055)' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 6, borderRadius: 14 },
  actionsRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700' },
  actionTextActive: { color: theme.colors.accent },
  actionTextRepost: { color: theme.colors.purple },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', alignItems: 'center' },
  menuCard: { width: '85%', backgroundColor: theme.colors.bgGlassStrong, borderRadius: 22, padding: 8, borderWidth: 1, borderColor: theme.colors.border },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderRadius: 12 },
  menuItemText: { fontSize: 15, color: theme.colors.textPrimary, fontWeight: '600' },
  menuClose: { alignItems: 'center', padding: 14, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle, marginTop: 4 },
  menuCloseText: { fontSize: 15, fontWeight: '800', color: theme.colors.textMuted },
  feedbackToast: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: theme.colors.bgGlassStrong, borderRadius: 18, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  feedbackText: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '700' },
});

PostCard.displayName = 'PostCard';

export default PostCard;
