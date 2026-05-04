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
  Image,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../context/AuthContext';
import { feedAPI, postAPI, uploadAPI } from '../api/client';
import PostCard from '../components/PostCard';
import { PlusCircle, X, Send, Image as ImageIcon, Camera, Trash2, Search, Bell } from 'lucide-react-native';
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

const Feed = ({ navigation, route }) => {
  const { user: currentUser, logout } = useAuth();
  const insets = useSafeAreaInsets();
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
  const [composeMedia, setComposeMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const actionTimers = useRef({});

  useEffect(() => {
    if (route.params?.openCompose) {
      setComposeOpen(true);
      navigation.setParams({ openCompose: undefined });
    }
  }, [route.params?.openCompose]);

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
    const myKey = currentUser && (currentUser.key || currentUser.userKey || '');
    if (userKey && myKey && String(userKey) === String(myKey)) {
      navigation.navigate('Profile');
    } else {
      navigation.navigate('UserProfile', { userKey });
    }
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setUploadError('Permission to access media library is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: false,
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadLocalMedia(result.assets[0]);
      }
    } catch (err) {
      console.error('Gallery pick error:', err);
      setUploadError('Failed to pick media from gallery.');
    }
  };

  const pickFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setUploadError('Permission to use camera is required.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadLocalMedia(result.assets[0]);
      }
    } catch (err) {
      console.error('Camera pick error:', err);
      setUploadError('Failed to capture media.');
    }
  };

  const uploadLocalMedia = async (asset) => {
    setUploading(true);
    setUploadError(null);
    try {
      console.log('[upload] asset.uri:', asset.uri ? 'present' : 'missing');
      const mime = asset.mimeType || asset.type || (asset.uri.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
      console.log('[upload] mime:', mime);
      const b64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'base64',
      });
      const dataUrl = `data:${mime};base64,${b64}`;
      console.log('[upload] dataUrl length:', dataUrl.length);

      const uploadResponse = await uploadAPI.uploadMedia(dataUrl);
      console.log('[upload] response keys:', Object.keys(uploadResponse.data || {}));
      if (uploadResponse.data.ok) {
        setComposeMedia([uploadResponse.data.media]);
      } else {
        setUploadError(uploadResponse.data.error || 'Upload failed.');
      }
    } catch (err) {
      console.error('[upload] error:', err.message, err.stack);
      setUploadError('Failed to upload media. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = () => {
    setComposeMedia([]);
    setUploadError(null);
  };

  const handleComposeSubmit = async () => {
    if (!composeText.trim() && composeMedia.length === 0) return;
    setComposeSubmitting(true);
    try {
      const response = await postAPI.createPost(
        composeText.trim(),
        composeMedia.length > 0 ? composeMedia : []
      );
      if (response.data.ok) {
        setComposeText('');
        setComposeMedia([]);
        setUploadError(null);
        setComposeOpen(false);
        fetchFeed(true);
      }
    } catch (err) {
      console.error('Create post error:', err);
      setUploadError('Failed to create post.');
    } finally {
      setComposeSubmitting(false);
    }
  };

  const renderStories = () => (
    <View style={styles.storiesWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity style={styles.storyItem} onPress={() => {}} activeOpacity={0.7}>
          <View style={styles.storyRing}>
            {currentUser?.avatarUrl ? (
              <Image source={{ uri: currentUser.avatarUrl }} style={styles.storyAvatar} />
            ) : (
              <View style={styles.storyAvatarPlaceholder}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#77778A' }} />
              </View>
            )}
            <View style={styles.storyPlusBadge}>
              <Text style={styles.storyPlusText}>+</Text>
            </View>
          </View>
          <Text style={styles.storyLabel}>Your Story</Text>
        </TouchableOpacity>

        {[1,2,3,4].map((i) => (
          <TouchableOpacity key={i} style={styles.storyItem} activeOpacity={0.7}>
            <View style={styles.storyRing}>
              <View style={styles.storyAvatarPlaceholder}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#77778A' }} />
              </View>
            </View>
            <Text style={styles.storyLabel}>User {i}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderPost = ({ item }) => (
    <View style={{ marginBottom: 12 }}>
      <PostCard
        post={item}
        onLike={handleLike}
        onBookmark={handleBookmark}
        onComment={handleComment}
        onRepost={handleRepost}
        onViewProfile={handleViewProfile}
      />
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.logoText}>HYSA</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity style={styles.headerIconBtn}>
          <Search size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconBtn}>
          <Bell size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
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

  const renderMediaPreview = () => {
    if (composeMedia.length === 0) return null;
    const media = composeMedia[0];
    const displayUrl = media.fullUrl || media.url;
    return (
      <View style={styles.mediaPreviewContainer}>
        {media.kind === 'video' ? (
          <Image source={{ uri: media.thumbnailUrl || displayUrl }} style={styles.mediaPreview} />
        ) : (
          <Image source={{ uri: displayUrl }} style={styles.mediaPreview} />
        )}
        <TouchableOpacity style={styles.removeMediaBtn} onPress={removeMedia} activeOpacity={0.7}>
          <Trash2 size={16} color="#fff" />
        </TouchableOpacity>
        {media.kind === 'video' && (
          <View style={styles.videoBadge}>
            <Text style={styles.videoBadgeText}>Video</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      {renderHeader()}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => getPostId(item)}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        ListHeaderComponent={renderStories}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#5CCBE3"
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 80 }}
      />

      <Modal visible={composeOpen} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.composeOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
          <View style={styles.composeCard}>
            <View style={styles.composeHandle} />
            <View style={styles.composeHeader}>
              <Text style={styles.composeTitle}>New Post</Text>
              <TouchableOpacity onPress={() => { setComposeOpen(false); setComposeText(''); setComposeMedia([]); setUploadError(null); }} activeOpacity={0.7}>
                <X size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {renderMediaPreview()}

            <TextInput
              style={[styles.composeInput, composeMedia.length > 0 && styles.composeInputWithMedia]}
              placeholder="What's happening?"
              placeholderTextColor={theme.colors.textMuted}
              value={composeText}
              onChangeText={setComposeText}
              multiline
              maxLength={1000}
              autoFocus
            />

            {uploadError && (
              <Text style={styles.uploadErrorText}>{uploadError}</Text>
            )}

            <View style={styles.composeToolbar}>
              <View style={styles.composeToolbarLeft}>
                <TouchableOpacity
                  style={styles.toolbarBtn}
                  onPress={pickFromGallery}
                  disabled={uploading || composeSubmitting}
                  activeOpacity={0.7}
                >
                  <ImageIcon size={20} color={uploading || composeSubmitting ? theme.colors.textMuted : theme.colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolbarBtn}
                  onPress={pickFromCamera}
                  disabled={uploading || composeSubmitting}
                  activeOpacity={0.7}
                >
                  <Camera size={20} color={uploading || composeSubmitting ? theme.colors.textMuted : theme.colors.accent} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.composeSubmit, (!composeText.trim() && composeMedia.length === 0 || composeSubmitting || uploading) && styles.composeSubmitDisabled]}
                onPress={handleComposeSubmit}
                disabled={!composeText.trim() && composeMedia.length === 0 || composeSubmitting || uploading}
                activeOpacity={0.7}
              >
                {composeSubmitting || uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Send size={16} color="#fff" />
                    <Text style={styles.composeSubmitText}>Post</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <View style={{ height: Math.max(insets.bottom, 12) }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  storiesWrap: {
    paddingVertical: 12,
    paddingLeft: 14,
  },
  storyItem: {
    width: 72,
    marginRight: 12,
    alignItems: 'center',
  },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: '#0A0F1E',
    borderWidth: 2,
    borderColor: '#070711',
  },
  storyLabel: {
    marginTop: 6,
    color: '#B7B7C8',
    fontSize: 11,
    maxWidth: 72,
    textAlign: 'center',
  },
  storyPlusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B8A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyPlusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  storyAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: 'rgba(124,58,237,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#070711',
  },
  bgGlowOne: {
    position: 'absolute',
    top: -120,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(124,58,237,0.08)',
    pointerEvents: 'none',
  },
  bgGlowTwo: {
    position: 'absolute',
    top: 240,
    left: -140,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(92,203,227,0.06)',
    pointerEvents: 'none',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    minHeight: 280,
  },
  composeHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  composeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  composeInputWithMedia: {
    marginBottom: 12,
  },
  mediaPreviewContainer: {
    position: 'relative',
    marginBottom: 12,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  mediaPreview: {
    width: '100%',
    height: 180,
    borderRadius: theme.radius.md,
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  videoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  uploadErrorText: {
    fontSize: 13,
    color: theme.colors.danger,
    marginBottom: 8,
  },
  composeToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  composeToolbarLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  composeSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
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
