import React, { useState, memo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
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
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PostCard = memo(({ post, onLike, onBookmark, onComment, onRepost, onViewProfile }) => {
  const [liked, setLiked] = useState(post.likedByMe || false);
  const [bookmarked, setBookmarked] = useState(post.bookmarkedByMe || false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    if (onLike) onLike(post.id);
  };

  const handleBookmark = () => {
    setBookmarked(!bookmarked);
    if (onBookmark) onBookmark(post.id);
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
              onPlaybackStatusUpdate={(status) => {
                if (status.isPlaying !== undefined) {
                  setIsVideoPlaying(status.isPlaying);
                }
              }}
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => onViewProfile && onViewProfile(post.authorKey)}
        >
          {post.authorAvatar ? (
            <Image source={{ uri: post.authorAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={20} color="#666" />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.authorRow}>
            <Text style={styles.authorName}>{post.author}</Text>
            {post.verified && <Verified size={14} color="#1DA1F2" fill="#1DA1F2" />}
          </View>
          <Text style={styles.timestamp}>{formatDate(post.createdAt)}</Text>
        </View>
        <TouchableOpacity style={styles.moreButton}>
          <MoreHorizontal size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {post.text ? (
        <Text style={styles.content}>{post.text}</Text>
      ) : null}

      {/* Media */}
      {renderMedia()}

      {/* Quoted Post */}
      {post.quotedPost && (
        <TouchableOpacity style={styles.quotedPost}>
          <View style={styles.quotedHeader}>
            <Text style={styles.quotedAuthor}>{post.quotedPost.author}</Text>
            {post.quotedPost.verified && <Verified size={12} color="#1DA1F2" fill="#1DA1F2" />}
          </View>
          <Text style={styles.quotedText} numberOfLines={2}>
            {post.quotedPost.text}
          </Text>
        </TouchableOpacity>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Heart
            size={20}
            color={liked ? '#e0245e' : '#666'}
            fill={liked ? '#e0245e' : 'transparent'}
          />
          <Text style={[styles.actionText, liked && styles.actionTextActive]}>
            {likeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onComment && onComment(post.id)}>
          <MessageCircle size={20} color="#666" />
          <Text style={styles.actionText}>{post.commentCount || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onRepost && onRepost(post.id)}>
          <Repeat size={20} color="#666" />
          <Text style={styles.actionText}>{post.repostCount || 0}</Text>
        </TouchableOpacity>

        <View style={styles.actionsRight}>
          <TouchableOpacity style={styles.actionButton} onPress={handleBookmark}>
            <Bookmark
              size={20}
              color={bookmarked ? '#1DA1F2' : '#666'}
              fill={bookmarked ? '#1DA1F2' : 'transparent'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  timestamp: {
    fontSize: 13,
    color: '#999',
  },
  moreButton: {
    padding: 8,
  },
  content: {
    fontSize: 15,
    lineHeight: 20,
    color: '#1a1a2e',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  mediaContainer: {
    width: SCREEN_WIDTH,
    maxHeight: 300,
    marginBottom: 12,
  },
  fullMedia: {
    width: SCREEN_WIDTH,
    height: 250,
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
    borderRadius: 8,
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
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quotedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  quotedAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  quotedText: {
    fontSize: 14,
    color: '#666',
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
    color: '#666',
    marginLeft: 4,
  },
  actionTextActive: {
    color: '#e0245e',
  },
});

PostCard.displayName = 'PostCard';

export default PostCard;