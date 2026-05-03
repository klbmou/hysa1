import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { feedAPI, postAPI } from '../api/client';
import PostCard from '../components/PostCard';
import { TrendingUp, X, Send } from 'lucide-react-native';
import theme from '../theme';

const THROTTLE_MS = 800;

function getPostId(post) {
  return String(post.id || post._id || post.key || post.createdAt || Math.random());
}

function dedupePosts(posts) {
  const seen = new Set();
  return posts.filter((post) => {
    const id = getPostId(post);
    if (!id || id.startsWith('0.')) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const Feed = ({ navigation }) => {
  const { logout } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const feedRequestInFlight = useRef(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [composeSubmitting, setComposeSubmitting] = useState(false);

  const actionTimers = useRef({});

  const throttledAction = useCallback((key, fn) => {
    const now = Date.now();
    const last = actionTimers.current[key] || 0;
    if (now - last < THROTTLE_MS) return;
    actionTimers.current[key] = now;
    fn();
  }, []);

  const fetchFeed = async (isRefresh = false) => {
    if (feedRequestInFlight.current) return;
    feedRequestInFlight.current = true;
    try {
      setError(null);
      const cursor = isRefresh ? 0 : (nextCursor ?? 0);
      const response = await feedAPI.getFeed(10, cursor);

      if (response.data.ok) {
        const newPosts = response.data.posts || [];
        if (isRefresh) {
          setPosts(dedupePosts(newPosts));
        } else {
          setPosts((prev) => dedupePosts([...prev, ...newPosts]));
        }
        setNextCursor(response.data.nextCursor);
      }
    } catch (err) {
      console.error('Feed error:', err);
      const status = err.response?.status;
      setErrorStatus(status);
      if (status === 401) {
        setError('UNAUTHORIZED');
      } else if (status === 503) {
        setError('Server is starting up. Please wait and try again.');
      } else {
        setError('Failed to load feed');
      }
    } finally {
      feedRequestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setNextCursor(null);
    fetchFeed(true);
  };

  const loadMore = () => {
    if (loadingMore || feedRequestInFlight.current || !nextCursor) return;
    setLoadingMore(true);
    fetchFeed(false);
  };

  useFocusEffect(
    useCallback(() => {
      if (posts.length === 0) {
        fetchFeed(true);
      }
    }, [])
  );

  const handleLike = (postId) => throttledAction(`like-${postId}`, async () => {
    try { await postAPI.likePost(postId); } catch (err) { console.error('Like error:', err); }
  });

  const handleBookmark = (postId) => throttledAction(`bm-${postId}`, async () => {
    try { await postAPI.bookmarkPost(postId); } catch (err) { console.error('Bookmark error:', err); }
  });

  const handleComment = (postId) => {
    navigation.navigate('PostDetail', { postId });
  };

  const handleRepost = (postId) => throttledAction(`rp-${postId}`, async () => {
    try { await postAPI.repostPost(postId); } catch (err) { console.error('Repost error:', err); }
  });

  const handleViewProfile = (userKey) => {
    navigation.navigate('Profile', { userKey });
  };

  const handleComposeSubmit = async () => {
    if (!composeText.trim()) return;
    setComposeSubmitting(true);
    try {
      const response = await postAPI.createPost(composeText.trim());
      if (response.data.ok) {
        setComposeText('');
        setComposeOpen(false);
        fetchFeed(true);
      }
    } catch (err) {
      console.error('Create post error:', err);
    } finally {
      setComposeSubmitting(false);
    }
  };

  const renderPost = ({ item }) => (
    <PostCard
      post={item}
      onLike={handleLike}
      onBookmark={handleBookmark}
      onComment={handleComment}
      onRepost={handleRepost}
      onViewProfile={handleViewProfile}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>HYSA1</Text>
      <TouchableOpacity style={styles.composeButton} onPress={() => setComposeOpen(true)}>
        <TrendingUp size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.emptyText}>Loading feed...</Text>
        </View>
      );
    }

    if (error) {
      if (errorStatus === 401) {
        return (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>Please sign in again.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => logout()}>
              <Text style={styles.retryText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyEmoji}>📝</Text>
        <Text style={styles.emptyText}>No posts yet</Text>
        <Text style={styles.emptySubtext}>Be the first to post!</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => getPostId(item)}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={composeOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.composeOverlay}
        >
          <View style={styles.composeCard}>
            <View style={styles.composeHeader}>
              <Text style={styles.composeTitle}>New Post</Text>
              <TouchableOpacity onPress={() => { setComposeOpen(false); setComposeText(''); }}>
                <X size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.composeInput}
              placeholder="What's happening?"
              placeholderTextColor={theme.colors.textMuted}
              value={composeText}
              onChangeText={setComposeText}
              multiline
              maxLength={1000}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.composeSubmit, (!composeText.trim() || composeSubmitting) && styles.composeSubmitDisabled]}
              onPress={handleComposeSubmit}
              disabled={!composeText.trim() || composeSubmitting}
            >
              {composeSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Send size={16} color="#fff" />
                  <Text style={styles.composeSubmitText}>Post</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bgGlass,
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
  },
  composeButton: {
    backgroundColor: theme.colors.accent,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    ...theme.typography.bodySm,
    color: theme.colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
  },
  errorText: {
    ...theme.typography.body,
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
    ...theme.typography.button,
    color: '#fff',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  composeOverlay: {
    flex: 1,
    backgroundColor: theme.colors.bgOverlay,
    justifyContent: 'flex-end',
  },
  composeCard: {
    backgroundColor: theme.colors.bgCard,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: 20,
    minHeight: 280,
  },
  composeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  composeTitle: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
  },
  composeInput: {
    backgroundColor: theme.colors.bgInput,
    borderRadius: theme.radius.md,
    padding: 14,
    fontSize: 16,
    color: theme.colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  composeSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    gap: 8,
  },
  composeSubmitDisabled: {
    opacity: 0.5,
  },
  composeSubmitText: {
    ...theme.typography.button,
    color: '#fff',
  },
});

export default Feed;
