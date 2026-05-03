import React, { useState, useEffect } from 'react';
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
import { Video, ResizeMode } from 'expo-av';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Repeat,
  Bookmark,
  User,
  Verified,
  Send,
} from 'lucide-react-native';
import { postAPI } from '../api/client';

const PostDetail = ({ navigation, route }) => {
  const postId = route.params?.postId;
  const passedPost = route.params?.post;

  const [post, setPost] = useState(passedPost || null);
  const [loading, setLoading] = useState(!passedPost);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMedia = () => {
    if (!post?.media || post.media.length === 0) return null;
    return post.media.map((media, index) => {
      if (media.kind === 'video' && media.url) {
        return (
          <View key={index} style={styles.mediaContainer}>
            <Video
              source={{ uri: media.url }}
              style={styles.media}
              useNativeControls
              resizeMode={ResizeMode.COVER}
            />
          </View>
        );
      }
      if (media.url) {
        return (
          <View key={index} style={styles.mediaContainer}>
            <Image source={{ uri: media.url }} style={styles.media} resizeMode="cover" />
          </View>
        );
      }
      return null;
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a1a2e" />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="#1a1a2e" />
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Author */}
        <View style={styles.authorSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => {
              if (post.authorKey) {
                navigation.navigate('Profile', { userKey: post.authorKey });
              }
            }}
          >
            {post.authorAvatar ? (
              <Image source={{ uri: post.authorAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={24} color="#666" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.authorInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.authorName}>{post.author || post.authorKey || 'Unknown'}</Text>
              {post.verified && <Verified size={16} color="#1DA1F2" fill="#1DA1F2" />}
            </View>
            <Text style={styles.authorKey}>@{post.authorKey || ''}</Text>
            <Text style={styles.timestamp}>{formatDate(post.createdAt)}</Text>
          </View>
        </View>

        {/* Text */}
        {post.text ? <Text style={styles.postText}>{post.text}</Text> : null}

        {/* Media */}
        {renderMedia()}

        {/* Quoted post */}
        {post.quotedPost && (
          <View style={styles.quotedPost}>
            <Text style={styles.quotedAuthor}>{post.quotedPost.author}</Text>
            <Text style={styles.quotedText} numberOfLines={2}>
              {post.quotedPost.text}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <View style={styles.action}>
            <Heart size={20} color="#666" />
            <Text style={styles.actionText}>{post.likeCount || 0}</Text>
          </View>
          <View style={styles.action}>
            <MessageCircle size={20} color="#666" />
            <Text style={styles.actionText}>{post.commentCount || comments.length || 0}</Text>
          </View>
          <View style={styles.action}>
            <Repeat size={20} color="#666" />
            <Text style={styles.actionText}>{post.repostCount || 0}</Text>
          </View>
          <View style={[styles.action, { marginLeft: 'auto' }]}>
            <Bookmark size={20} color="#666" />
          </View>
        </View>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            Comments ({comments.length})
          </Text>
          {comments.length === 0 ? (
            <Text style={styles.noComments}>No comments yet.</Text>
          ) : (
            comments.map((comment) => (
              <View key={comment.id || comment.text} style={styles.commentItem}>
                <View style={styles.commentAvatar}>
                  <User size={16} color="#666" />
                </View>
                <View style={styles.commentContent}>
                  <Text style={styles.commentAuthor}>
                    {comment.author || comment.authorKey || 'User'}
                  </Text>
                  <Text style={styles.commentText}>{comment.text}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Comment input */}
      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder="Write a comment..."
          placeholderTextColor="#999"
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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
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
    backgroundColor: '#f0f0f0',
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
    color: '#1a1a2e',
  },
  authorKey: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  postText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#1a1a2e',
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
    borderRadius: 12,
  },
  quotedPost: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quotedAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  quotedText: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  actionText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  commentsSection: {
    padding: 16,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  noComments: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  commentContent: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 16,
    color: '#e0245e',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PostDetail;
