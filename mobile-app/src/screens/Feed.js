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
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { feedAPI, postAPI, uploadAPI, storiesAPI } from '../api/client';
import PostCard from '../components/PostCard';
import { User } from 'lucide-react-native';
import { X, Send, Image as ImageIcon, Camera, Trash2, Search, Bell, Volume2, VolumeX } from 'lucide-react-native';
import theme from '../theme';

const THROTTLE_MS = 800;

const STORY_FILTERS = [
  { name: 'Normal', color: 'transparent' },
  { name: 'Warm', color: 'rgba(255, 120, 0, 0.15)' },
  { name: 'Cool', color: 'rgba(0, 120, 255, 0.15)' },
  { name: 'Mono', color: 'rgba(0, 0, 0, 0.35)' },
  { name: 'Pink', color: 'rgba(255, 59, 138, 0.15)' },
  { name: 'Dream', color: 'rgba(124, 58, 237, 0.1)' },
];

function formatStoryDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

function normalizeStory(story) {
  const username = story?.author || 'Story';
  const avatar = story?.authorAvatar || null;
  const media = story?.media || {};
  const thumbnail =
    media?.thumbnailUrl ||
    media?.previewUrl ||
    media?.url ||
    null;
  const isVideo = media?.kind === 'video';

  return {
    story,
    username,
    avatar,
    media,
    thumbnail,
    isVideo,
  };
}

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
  const [stories, setStories] = useState([]);
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

  // Stories States
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyMedia, setStoryMedia] = useState(null);
  const [storyFilter, setStoryFilter] = useState(STORY_FILTERS[0]);
  const [isStoryViewerVisible, setIsStoryViewerVisible] = useState(false);
  const [videoDuration, setVideoDuration] = useState(5000); // Default to 5s for images or if video duration not loaded
  const [viewingStoryUserIndex, setViewingStoryUserIndex] = useState(0);
  const [viewingStoryMediaIndex, setViewingStoryMediaIndex] = useState(0);
  const [storyIsPaused, setStoryIsPaused] = useState(false);
  const [storyIsMuted, setStoryIsMuted] = useState(false);
  const [storyMediaLoading, setStoryMediaLoading] = useState(false);
  const [storySubmitting, setStorySubmitting] = useState(false);

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
      handleApiError(err, 'Failed to load feed');
    } finally {
      feedRequestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const fetchStories = async () => {
    try {
      const response = await storiesAPI.getStories();
      const data = response.data;
      const items = data.stories || data.items || (Array.isArray(data) ? data : []);
      setStories(items.filter(Boolean));
    } catch (err) {
      console.error('Stories fetch error:', err);
    }
  };

  const handleApiError = (err, defaultMsg) => {
      console.error(err);
      const status = err.response?.status;
      setErrorStatus(status);
      if (status === 401) {
        setError('UNAUTHORIZED');
      } else if (status === 503) {
        setError('Server is starting up. Please wait and try again.');
      } else {
        setError(defaultMsg);
      }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setNextCursor(null);
    fetchFeed(true);
    fetchStories();
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
        fetchStories();
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

  const uploadLocalMedia = async (asset, isStory = false) => {
    setUploading(true);
    setUploadError(null);
    try {
      const mime = asset.mimeType || asset.type || (asset.uri.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
      const b64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'base64',
      });
      const dataUrl = `data:${mime};base64,${b64}`;

      const uploadResponse = await uploadAPI.uploadMedia(dataUrl);
      if (uploadResponse.data.ok) {
        if (isStory) {
          setStoryMedia(uploadResponse.data.media);
        } else {
          setComposeMedia([uploadResponse.data.media]);
        }
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

  const handleStorySubmit = async () => {
    if (!storyMedia || storySubmitting) return;
    setStorySubmitting(true);
    setUploadError(null);
    try {
      const response = await storiesAPI.createStory({
        media: [storyMedia],
        filter: storyFilter.name,
      });
      if (response.data.ok) {
        setStoryMedia(null);
        setStoryFilter(STORY_FILTERS[0]);
        setStoryComposerOpen(false);
        fetchStories();
      } else {
        setUploadError(response.data.error || 'Failed to post story.');
      }
    } catch (err) {
      console.error('Create story error:', err);
      setUploadError('Failed to post story. Please try again.');
    } finally {
      setStorySubmitting(false);
    }
  };

  const openStoryPicker = async (useCamera = false) => {
    setUploadError(null);
    try {
      const { status } = useCamera 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        setUploadError('Media permissions are required. Please enable them in settings.');
        return;
      }

      const result = useCamera 
        ? await ImagePicker.launchCameraAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.All })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.All });

      if (!result.canceled) {
        setStoryComposerOpen(true);
        await uploadLocalMedia(result.assets[0], true);
      }
    } catch (e) {
      console.error('Story picker error:', e);
      setUploadError('Failed to pick media for story.');
    }
  };

  const closeStoryComposer = () => {
    setStoryComposerOpen(false);
    setStoryMedia(null);
    setStoryFilter(STORY_FILTERS[0]);
  };

  // Story Viewer Logic
  const storyVideoRef = useRef(null);
  const storyProgressAnim = useRef(new Animated.Value(0)).current;
  const storyProgressTimerRef = useRef(null);

  const currentStory = stories[viewingStoryUserIndex];
  const currentStoryData = normalizeStory(currentStory);
  const currentStoryMedia = currentStoryData.media;
  const currentStoryMediaUrl = currentStoryMedia?.url || null;
  const hasCurrentStory = Boolean(currentStory && currentStoryMediaUrl);

  const closeStoryViewer = useCallback(() => {
    setIsStoryViewerVisible(false);
    setStoryIsPaused(false);
    storyProgressAnim.setValue(0);
    if (storyProgressTimerRef.current) clearTimeout(storyProgressTimerRef.current);
    if (storyVideoRef.current) {
      storyVideoRef.current.pauseAsync().catch(() => {});
    }
  }, [storyProgressAnim]);

  const startStoryProgress = useCallback((duration) => {
    if (!currentStoryMediaUrl) return;
    if (storyProgressTimerRef.current) clearTimeout(storyProgressTimerRef.current);
    storyProgressAnim.setValue(0);
    const dur = duration || (currentStoryMedia?.kind === 'video' ? videoDuration : 5000);
    Animated.timing(storyProgressAnim, {
      toValue: 1,
      duration: dur,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !storyIsPaused) {
        handleNextStory();
      }
    });
  }, [currentStoryMedia, currentStoryMediaUrl, storyIsPaused, videoDuration, storyProgressAnim]);

  const handleNextStory = useCallback(() => {
    storyProgressAnim.setValue(0);
    if (storyProgressTimerRef.current) clearTimeout(storyProgressTimerRef.current);
    if (viewingStoryUserIndex < stories.length - 1) {
      setViewingStoryUserIndex(prev => prev + 1);
      setViewingStoryMediaIndex(0);
    } else {
      closeStoryViewer();
    }
  }, [viewingStoryUserIndex, stories.length, closeStoryViewer, storyProgressAnim]);

  const handlePrevStory = useCallback(() => {
    storyProgressAnim.setValue(0);
    if (storyProgressTimerRef.current) clearTimeout(storyProgressTimerRef.current);
    if (viewingStoryUserIndex > 0) {
      setViewingStoryUserIndex(prev => prev - 1);
      setViewingStoryMediaIndex(0);
    } else {
      startStoryProgress(0);
    }
  }, [viewingStoryUserIndex, storyProgressAnim, startStoryProgress]);

  const openStoryViewer = useCallback((userIndex) => {
    setViewingStoryUserIndex(userIndex);
    setViewingStoryMediaIndex(0);
    setVideoDuration(5000);
    setIsStoryViewerVisible(true);
    setStoryIsPaused(false);
    setStoryIsMuted(false);
  }, []);

  const handleHoldPress = useCallback(() => {
    setStoryIsPaused(true);
    storyProgressAnim.stopAnimation();
    if (storyVideoRef.current) storyVideoRef.current.pauseAsync().catch(() => {});
  }, [storyProgressAnim]);

  const handleReleasePress = useCallback(() => {
    setStoryIsPaused(false);
    if (storyVideoRef.current) storyVideoRef.current.playAsync().catch(() => {});
    startStoryProgress();
  }, [startStoryProgress]);

  useEffect(() => {
    if (isStoryViewerVisible && hasCurrentStory && !storyIsPaused) {
      startStoryProgress();
    }
    return () => {
      storyProgressAnim.stopAnimation();
      if (storyProgressTimerRef.current) clearTimeout(storyProgressTimerRef.current);
    };
  }, [isStoryViewerVisible, hasCurrentStory, viewingStoryUserIndex, storyIsPaused, startStoryProgress, storyProgressAnim]);

  useEffect(() => {
    if (isStoryViewerVisible && hasCurrentStory) {
      setStoryMediaLoading(true);
    }
  }, [isStoryViewerVisible, hasCurrentStory, viewingStoryUserIndex]);

  const renderStories = () => (
    <View style={styles.storiesWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity style={styles.storyItem} onPress={() => openStoryPicker(false)} activeOpacity={0.7}>
          <View style={styles.storyRing}>
            {currentUser?.avatarUrl ? (
              <Image source={{ uri: currentUser.avatarUrl }} style={styles.storyAvatar} />
            ) : (
              <View style={styles.storyAvatarPlaceholder}>
                <User size={24} color="#fff" />
              </View>
            )}
            <View style={styles.storyPlusBadge}>
              <Text style={styles.storyPlusText}>+</Text>
            </View>
          </View>
          <Text style={styles.storyLabel} numberOfLines={1}>Your Story</Text>
        </TouchableOpacity>

        {stories.map((storyUser, index) => {
          const { story, username, avatar, thumbnail, isVideo } = normalizeStory(storyUser);
          
          return (
          <TouchableOpacity key={story?.id || story?._id || story?.createdAt || index} style={styles.storyItem} activeOpacity={0.7} onPress={() => openStoryViewer(index)}>
            <View style={styles.storyRing}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.storyAvatar} />
              ) : thumbnail ? (
                <Image source={{ uri: thumbnail }} style={styles.storyAvatar} />
              ) : (
                <View style={styles.storyAvatarPlaceholder}>
                   <User size={24} color="#fff" />
                </View>
              )}
              {isVideo && <View style={styles.storyVideoDot} />}
            </View>
            <Text style={styles.storyLabel} numberOfLines={1}>{username}</Text>
          </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderPost = ({ item }) => (
    <View style={{ marginBottom: 4 }}>
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
      <Text style={styles.logoText}>HYSA</Text> {/* Ensure consistent capitalization */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Explore')}>
          <Search size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Notifications')}>
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
        contentContainerStyle={styles.feedContent}
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

      {/* Story Composer Modal */}
      <Modal visible={storyComposerOpen} animationType="fade" transparent>
        <View style={styles.storyComposerContainer}>
          {uploadError && (
            <View style={styles.storyErrorBar}>
              <Text style={styles.storyErrorText}>{uploadError}</Text>
              <TouchableOpacity onPress={() => setUploadError(null)} style={styles.storyErrorClose}>
                <Text style={styles.storyErrorCloseText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
          {storyMedia ? (
            <View style={{ flex: 1 }}>
              {storyMedia.kind === 'video' ? (
                <Video
                  source={{ uri: storyMedia.fullUrl || storyMedia.url }}
                  style={styles.storyPreviewImage}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay
                  isMuted
                  isLooping
                />
              ) : (
                <Image source={{ uri: storyMedia.fullUrl || storyMedia.url }} style={styles.storyPreviewImage} />
              )}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: storyFilter.color }]} pointerEvents="none" />
              
              <View style={styles.storyFilterBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {STORY_FILTERS.map((f) => (
                    <TouchableOpacity 
                      key={f.name} 
                      style={[styles.filterBtn, storyFilter.name === f.name && styles.filterBtnActive]}
                      onPress={() => setStoryFilter(f)}
                    >
                      <Text style={styles.filterBtnText}>{f.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.storyComposerControls}>
                <TouchableOpacity style={styles.storyCancelBtn} onPress={closeStoryComposer}>
                  <Text style={styles.storyCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.storyPostBtn} onPress={handleStorySubmit} disabled={storySubmitting}>
                  {storySubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.storyPostText}>Share Story</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ActivityIndicator size="large" color={theme.colors.accent} style={{ flex: 1 }} />
          )}
        </View>
      </Modal>

      {/* Story Viewer Modal */}
      <Modal visible={isStoryViewerVisible} animationType="fade" transparent statusBarTranslucent>
        {hasCurrentStory && (
          <View style={styles.storyViewerContainer}>
            {/* Progress Bars */}
            <View style={styles.storyViewerProgressContainer}>
              {stories.map((_, idx) => (
                <View key={idx} style={styles.storyViewerProgressBarTrack}>
                  <Animated.View
                    style={[
                      styles.storyViewerProgressBarFill,
                      {
                        width: viewingStoryUserIndex === idx ? storyProgressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }) : (viewingStoryUserIndex > idx ? '100%' : '0%'),
                      },
                    ]}
                  />
                </View>
              ))}
            </View>

            {/* Header (Avatar, Username, Time, Close) */}
            <View style={styles.storyViewerHeader}>
              <TouchableOpacity onPress={() => handleViewProfile(currentStory?.authorKey)} style={styles.storyViewerAvatarBtn}>
                {currentStoryData.avatar ? (
                  <Image source={{ uri: currentStoryData.avatar }} style={styles.storyViewerAvatar} />
                ) : (
                  <View style={styles.storyViewerAvatarPlaceholder}>
                    <User size={16} color="#fff" />
                  </View>
                )}
                <Text style={styles.storyViewerUsername}>{currentStoryData.username}</Text>
              </TouchableOpacity>
              <Text style={styles.storyViewerTime}>{formatStoryDate(currentStory?.createdAt)}</Text>
              <TouchableOpacity onPress={closeStoryViewer} style={styles.storyViewerCloseBtn}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Media (Image/Video) */}
            <View style={styles.storyViewerMediaContainer}>
              {currentStoryData.isVideo ? (
                <Video
                  key={currentStoryMediaUrl}
                  ref={storyVideoRef}
                  source={{ uri: currentStoryMediaUrl }}
                  style={styles.storyViewerVideo}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={!storyIsPaused}
                  isMuted={storyIsMuted}
                  isLooping={false}
                  useNativeControls={false}
                  onLoadStart={() => setStoryMediaLoading(true)}
                  onLoad={(status) => {
                    setStoryMediaLoading(false);
                    if (status?.durationMillis) {
                      setVideoDuration(status.durationMillis);
                      startStoryProgress(status.durationMillis);
                    }
                  }}
                  onPlaybackStatusUpdate={(status) => {
                    if (status.isLoaded) {
                      if (status.durationMillis) setVideoDuration(status.durationMillis);
                      if (status.didJustFinish && !storyIsPaused) handleNextStory();
                    }
                  }}
                  onError={(e) => {
                    setStoryMediaLoading(false);
                  }}
                />
              ) : (
                <Image
                  source={{ uri: currentStoryMediaUrl }}
                  style={styles.storyViewerImage}
                  resizeMode="contain"
                  onLoadStart={() => setStoryMediaLoading(true)}
                  onLoadEnd={() => setStoryMediaLoading(false)}
                />
              )}
              {storyMediaLoading && <ActivityIndicator size="large" color="#fff" style={styles.storyViewerLoadingIndicator} />}
            </View>

            {/* Tap/Hold Gestures */}
            <View style={styles.storyViewerGestureLayer} pointerEvents="box-none">
              <TouchableOpacity style={styles.storyViewerTapLeft} onPress={handlePrevStory} activeOpacity={0} />
              <TouchableOpacity
                style={styles.storyViewerTapCenter}
                onLongPress={handleHoldPress}
                onPressOut={handleReleasePress}
                delayLongPress={100}
                activeOpacity={1}
              />
              <TouchableOpacity style={styles.storyViewerTapRight} onPress={handleNextStory} activeOpacity={0} />
            </View>

            {/* Mute Toggle */}
            {currentStoryData.isVideo && (
              <TouchableOpacity onPress={() => setStoryIsMuted(prev => !prev)} style={styles.storyViewerMuteBtn}>
                {storyIsMuted ? <VolumeX size={24} color="#fff" /> : <Volume2 size={24} color="#fff" />}
              </TouchableOpacity>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#070711',
  },
  feedContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 92,
    backgroundColor: '#070711',
  },
  storiesWrap: {
    paddingVertical: 10,
    paddingLeft: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  storyItem: {
    width: 64,
    marginRight: 14,
    alignItems: 'center',
  },
  storyRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  storyLabel: {
    marginTop: 5,
    color: '#B7B7C8',
    fontSize: 10,
    fontWeight: '600',
    maxWidth: 64,
    textAlign: 'center',
  },
  storyPlusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B8A',
    borderWidth: 2,
    borderColor: '#070711',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  storyPlusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginTop: -1,
  },
  storyAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyVideoDot: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5CCBE3',
    borderWidth: 1,
    borderColor: '#070711',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#070711',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 15, color: '#8A8A9A', textAlign: 'center', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#8A8A9A', textAlign: 'center', marginTop: 4 },
  emptyEmoji: { fontSize: 32 },
  errorText: { fontSize: 15, color: '#FF3B8A', textAlign: 'center', marginBottom: 12 },
  retryButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  footer: { paddingVertical: 16, alignItems: 'center' },
  composeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  composeCard: { backgroundColor: '#0F0F1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 8 },
  composeHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },
  composeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  composeTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  composeInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, fontSize: 15, color: '#FFFFFF', maxHeight: 160, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  composeInputWithMedia: { maxHeight: 100 },
  mediaPreviewContainer: { marginBottom: 12, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  mediaPreview: { width: '100%', height: 180 },
  removeMediaBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, padding: 6 },
  videoBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  videoBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  composeToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  composeToolbarLeft: { flexDirection: 'row', gap: 10 },
  toolbarBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  composeSubmit: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FF3B8A', flexDirection: 'row', alignItems: 'center', gap: 6 },
  composeSubmitDisabled: { opacity: 0.5 },
  composeSubmitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  uploadErrorText: { color: '#FF3B8A', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  storyComposerContainer: { flex: 1, backgroundColor: '#070711' },
  storyErrorBar: { position: 'absolute', top: 60, left: 16, right: 16, backgroundColor: 'rgba(255,59,138,0.15)', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,59,138,0.3)', zIndex: 30 },
  storyErrorText: { color: '#FF3B8A', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
  storyErrorClose: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,59,138,0.2)' },
  storyErrorCloseText: { color: '#FF3B8A', fontSize: 12, fontWeight: '700' },
  storyPreviewImage: { width: '100%', height: '100%' },
  storyFilterBar: { position: 'absolute', left: 0, right: 0, bottom: 88, paddingHorizontal: 12, paddingVertical: 10 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, marginRight: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterBtnActive: { backgroundColor: '#FF3B8A', borderColor: '#FF3B8A' },
  filterBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  storyComposerControls: { position: 'absolute', left: 16, right: 16, bottom: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storyCancelBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  storyCancelText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  storyPostBtn: { minWidth: 120, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 21, backgroundColor: '#FF3B8A', alignItems: 'center', justifyContent: 'center' },
  storyPostText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  storyViewerContainer: { flex: 1, backgroundColor: '#000' },
  storyViewerProgressContainer: { position: 'absolute', top: 48, left: 10, right: 10, zIndex: 20, flexDirection: 'row', gap: 4 },
  storyViewerProgressBarTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  storyViewerProgressBarFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 2 },
  storyViewerHeader: { position: 'absolute', top: 60, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', zIndex: 15 },
  storyViewerAvatarBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  storyViewerAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  storyViewerAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  storyViewerUsername: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginLeft: 8 },
  storyViewerTime: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 8, fontWeight: '500' },
  storyViewerCloseBtn: { marginLeft: 'auto', padding: 6 },
  storyViewerMediaContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  storyViewerVideo: { width: '100%', height: '100%' },
  storyViewerImage: { width: '100%', height: '100%' },
  storyViewerLoadingIndicator: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20 },
  storyViewerGestureLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, flexDirection: 'row' },
  storyViewerTapLeft: { flex: 1 },
  storyViewerTapCenter: { flex: 1.5 },
  storyViewerTapRight: { flex: 1 },
  storyViewerMuteBtn: { position: 'absolute', bottom: 80, left: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, zIndex: 12 },
  absoluteFill: { ...StyleSheet.absoluteFillObject },
});

export default Feed;
