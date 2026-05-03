import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { feedAPI, postAPI } from '../api/client';
import PostCard from '../components/PostCard';
import { TrendingUp } from 'lucide-react-native';

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

  const fetchFeed = async (isRefresh = false) => {
    if (feedRequestInFlight.current) return;
    feedRequestInFlight.current = true;
    try {
      setError(null);
      const response = await feedAPI.getFeed(10, isRefresh ? 0 : (nextCursor || 0));
      
      if (response.data.ok) {
        const newPosts = response.data.posts || [];
        if (isRefresh) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
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
    if (!loadingMore && nextCursor) {
      setLoadingMore(true);
      fetchFeed(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (posts.length === 0) {
        fetchFeed(true);
      }
    }, [])
  );

  const handleLike = async (postId) => {
    try {
      await postAPI.likePost(postId);
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handleBookmark = async (postId) => {
    try {
      await postAPI.bookmarkPost(postId);
    } catch (err) {
      console.error('Bookmark error:', err);
    }
  };

  const handleComment = (postId) => {
    navigation.navigate('PostDetail', { postId });
  };

  const handleRepost = async (postId) => {
    try {
      await postAPI.repostPost(postId);
    } catch (err) {
      console.error('Repost error:', err);
    }
  };

  const handleViewProfile = (userKey) => {
    navigation.navigate('Profile', { userKey });
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
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#1a1a2e" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1a1a2e" />
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
        <Text style={{ fontSize: 48 }}>📝</Text>
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
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1a1a2e"
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
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
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});

export default Feed;
