import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Animated,
  Modal,
  TextInput,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Heart,
  MessageCircle,
  User,
  Verified,
  Share2,
  Repeat,
  MoreHorizontal,
  Flag,
  Link,
  X,
  Send,
  Globe,
  Maximize2,
  Minimize2,
} from 'lucide-react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import { feedAPI, postAPI, userAPI } from '../api/client';
import * as haptics from '../utils/haptics';
import { shareReel, copyLink } from '../utils/share';
import theme from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BATCH_SIZE = 6;
const DOUBLE_TAP_MS = 300;

const CommentItem = React.memo(({ comment, onReply }) => {
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [liked, setLiked] = useState(false);
  const replies = comment.replies || [];
  const replyCount = comment.replyCount || replies.length;

  const handleToggleReply = useCallback(() => {
    setReplying((prev) => !prev);
  }, []);

  const handleToggleReplies = useCallback(() => {
    setShowReplies((prev) => !prev);
  }, []);

  const handleReply = useCallback(async () => {
    const text = replyText.trim();
    if (!text) return;
    setReplySubmitting(true);
    try {
      await onReply(comment.id, text);
      setReplyText('');
      setReplying(false);
      setShowReplies(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to add reply.');
    } finally {
      setReplySubmitting(false);
    }
  }, [replyText, comment.id, onReply]);

  const handleToggleLike = useCallback(() => {
    setLiked((prev) => !prev);
  }, []);

  const formattedTime = useMemo(() => formatDate(comment.createdAt), [comment.createdAt]);

  return (
    <View style={cStyles.commentItem}>
      <View style={cStyles.commentAvatarWrap}>
        {comment.authorAvatar ? (
          <Image source={{ uri: comment.authorAvatar }} style={cStyles.commentAvatarImg} />
        ) : (
          <View style={cStyles.commentAvatarPlaceholder}>
            <User size={14} color={theme.colors.textMuted} />
          </View>
        )}
      </View>
      <View style={cStyles.commentContent}>
        <View style={cStyles.commentHeaderRow}>
          <View style={cStyles.commentNameRow}>
            <Text style={cStyles.commentAuthor}>{comment.author || comment.authorKey || 'User'}</Text>
            {comment.authorVerified && <Verified size={10} color={theme.colors.verified} fill={theme.colors.verified} />}
            <Text style={cStyles.commentTime}> · {formattedTime}</Text>
          </View>
        </View>
        <Text style={cStyles.commentText}>{comment.text}</Text>
        <View style={cStyles.commentActionsRow}>
          <TouchableOpacity onPress={handleToggleReply} activeOpacity={0.6}>
            <Text style={cStyles.replyBtnText}>Reply</Text>
          </TouchableOpacity>
        </View>

        {replies.length > 0 && (
          <TouchableOpacity
            style={cStyles.viewRepliesBtn}
            onPress={handleToggleReplies}
            activeOpacity={0.6}
          >
            <Text style={cStyles.viewRepliesText}>
              {showReplies ? 'Hide' : 'View'} {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </Text>
          </TouchableOpacity>
        )}

        {showReplies && replies.map((reply) => (
          <View key={reply.id || reply.text} style={cStyles.replyItem}>
            <View style={cStyles.replyAvatarWrap}>
              {reply.authorAvatar ? (
                <Image source={{ uri: reply.authorAvatar }} style={cStyles.replyAvatarImg} />
              ) : (
                <View style={cStyles.replyAvatarPlaceholder}>
                  <User size={8} color={theme.colors.textMuted} />
                </View>
              )}
            </View>
            <View style={cStyles.replyContent}>
              <View style={cStyles.replyHeaderRow}>
                <Text style={cStyles.replyAuthor}>{reply.author || 'User'}</Text>
                <Text style={cStyles.replyTime}> · {formatDate(reply.createdAt)}</Text>
              </View>
              <Text style={cStyles.replyText}>{reply.text}</Text>
            </View>
          </View>
        ))}

        {replying && (
          <View style={cStyles.replyInputRow}>
            <TextInput
              style={cStyles.replyInput}
              placeholder={`Reply to ${comment.author}...`}
              placeholderTextColor={theme.colors.textMuted}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              autoFocus
              maxLength={500}
            />
            <TouchableOpacity
              style={[cStyles.replySendBtn, (!replyText.trim() || replySubmitting) && cStyles.replySendBtnDisabled]}
              onPress={handleReply}
              disabled={!replyText.trim() || replySubmitting}
              activeOpacity={0.7}
            >
              {replySubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Send size={12} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={cStyles.commentLikeBtn} onPress={handleToggleLike} activeOpacity={0.6}>
        <Heart size={12} color={liked ? theme.colors.danger : theme.colors.textMuted} fill={liked ? theme.colors.danger : 'transparent'} />
        {comment.likeCount > 0 && (
          <Text style={[cStyles.commentLikeCount, liked && { color: theme.colors.danger }]}>{comment.likeCount}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}, (prev, next) => prev.comment === next.comment && prev.onReply === next.onReply);

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ReelItem = React.memo(({ item, isActive, muted, playbackRate, onLike, onOpenComments, onRepost, onOpenShare, onMore, onDoubleTapVideo, onOpenProfile, onRegisterRef, onToggleMute, onToggleRate, onOpenLandscape, insets }) => {
  const videoRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const heartAnim = useRef(new Animated.Value(0)).current;
  const tapRef = useRef({ lastTap: 0, timer: null, moved: false });

  const videoUrl = useMemo(() => getVideoUrl(item), [item]);
  const reelId = item.id;
  const media = item.media && item.media[0];
  const thumbUrl = useMemo(() => media && (media.thumbnailUrl || media.fullUrl || media.url), [media]);
  const [naturalAspect, setNaturalAspect] = useState(null);
  const videoAspect = useMemo(() => {
    // Use natural aspect if available, otherwise fallback to metadata
    if (naturalAspect) return naturalAspect;
    return media && media.width && media.height ? media.width / media.height : null;
  }, [media, naturalAspect]);

  // Use CONTAIN by default until we know the aspect ratio
  // This prevents 16:9 videos from being cropped
  const isPortrait = videoAspect !== null && videoAspect < 0.8;

  const resizeMode = useMemo(() => {
    if (!videoAspect) return ResizeMode.CONTAIN; // Default to CONTAIN to avoid cropping
    return isPortrait ? ResizeMode.COVER : ResizeMode.CONTAIN;
  }, [videoAspect, isPortrait]);

  const showBlurredBg = videoAspect !== null && !isPortrait;

  useEffect(() => {
    return () => {
      if (tapRef.current.timer) {
        clearTimeout(tapRef.current.timer);
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive || !videoRef.current) return;

    const play = async () => {
      try {
        if (videoReady) {
          await videoRef.current.playAsync();
          setIsPaused(false);
        }
      } catch (e) {}
    };

    play();

    return () => {
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => {});
        videoRef.current.setPositionAsync(0).catch(() => {});
      }
    };
  }, [isActive, videoReady]);

  useEffect(() => {
    if (videoRef.current && videoReady) {
      videoRef.current.setRateAsync(playbackRate).catch(() => {});
    }
  }, [playbackRate, videoReady]);

  useEffect(() => {
    if (onRegisterRef && isActive) {
      onRegisterRef(videoRef.current);
    }
  }, [onRegisterRef, isActive]);

  const handleTapStart = useCallback((evt) => {
    const { locationX, locationY } = evt.nativeEvent;
    tapRef.current.startX = locationX;
    tapRef.current.startY = locationY;
    tapRef.current.moved = false;
  }, []);

  const handleTapMove = useCallback((evt) => {
    const { locationX, locationY } = evt.nativeEvent;
    const dx = Math.abs(locationX - (tapRef.current.startX || 0));
    const dy = Math.abs(locationY - (tapRef.current.startY || 0));
    if (dx > 5 || dy > 5) {
      tapRef.current.moved = true;
    }
  }, []);

  const handleTap = useCallback(() => {
    if (tapRef.current.moved) return;

    const now = Date.now();
    const { lastTap, timer } = tapRef.current;

    if (timer) {
      clearTimeout(timer);
      tapRef.current.timer = null;
    }

    if (lastTap > 0 && (now - lastTap) < DOUBLE_TAP_MS) {
      haptics.medium();
      onDoubleTapVideo(reelId);
      tapRef.current.lastTap = 0;

      heartAnim.setValue(0);
      Animated.sequence([
        Animated.timing(heartAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(heartAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
      return;
    }

    tapRef.current.lastTap = now;

    tapRef.current.timer = setTimeout(() => {
      tapRef.current.lastTap = 0;
      tapRef.current.timer = null;
      if (!videoRef.current) return;
      videoRef.current.getStatusAsync().then((status) => {
        if (status.isLoaded) {
          if (status.isPlaying) {
            videoRef.current.pauseAsync().catch(() => {});
            setIsPaused(true);
          } else {
            videoRef.current.playAsync().catch(() => {});
            setIsPaused(false);
          }
          setShowPauseIcon(true);
          setTimeout(() => setShowPauseIcon(false), 400);
        }
      }).catch(() => {});
    }, DOUBLE_TAP_MS);
  }, [reelId, onDoubleTapVideo, heartAnim]);

  const setRef = useCallback((ref) => {
    videoRef.current = ref;
  }, []);

  const handleLikePress = useCallback(() => onLike(reelId), [onLike, reelId]);
  const handleCommentsPress = useCallback(() => onOpenComments(reelId), [onOpenComments, reelId]);
  const handleRepostPress = useCallback(() => onRepost(reelId), [onRepost, reelId]);
  const handleSharePress = useCallback(() => onOpenShare(item), [onOpenShare, item]);
  const handleMorePress = useCallback(() => onMore(reelId), [onMore, reelId]);
  const handleProfilePress = useCallback(() => onOpenProfile(item), [onOpenProfile, item]);
  const handleLandscapePress = useCallback(() => onOpenLandscape(videoUrl), [onOpenLandscape, videoUrl]);

  const [isFollowing, setIsFollowing] = useState(item.isFollowing || false);

  const handleFollow = useCallback(async () => {
    try {
      const response = await userAPI.followUser(item.authorKey || item.authorId);
      const nowFollowing = response?.data?.following ?? !isFollowing;
      setIsFollowing(nowFollowing);
    } catch (err) {
      console.error('Follow error:', err);
    }
  }, [item.authorKey, item.authorId, isFollowing]);

  const rateHapticFired = useRef(false);

  const handleEdgePressIn = useCallback(() => {
    if (onToggleRate) {
      onToggleRate();
      if (!rateHapticFired.current) {
        haptics.light();
        rateHapticFired.current = true;
      }
    }
  }, [onToggleRate]);

  const handleEdgePressOut = useCallback(() => {
    if (onToggleRate) {
      onToggleRate(); // toggles back to 1x
    }
    rateHapticFired.current = false;
  }, [onToggleRate]);

  return (
    <View style={styles.reelContainer}>
      {videoUrl ? (
        <View style={styles.reelContent}>
          <View style={styles.videoWrap}>
            {showBlurredBg && thumbUrl && (
              <Image
                source={{ uri: thumbUrl }}
                style={styles.bgThumb}
                blurRadius={30}
                resizeMode="cover"
              />
            )}
            {showBlurredBg && <View style={styles.bgDarkOverlay} />}

            <View style={[styles.videoCentering]}>
              <Video
                ref={setRef}
                source={{ uri: videoUrl }}
                style={styles.videoFull}
                resizeMode={resizeMode}
                shouldPlay={isActive}
                isMuted={muted}
                isLooping
                useNativeControls={false}
                onReadyForDisplay={(status) => {
                  setVideoReady(true);
                  if (status.naturalSize) {
                    const { width, height } = status.naturalSize;
                    if (width && height) {
                      setNaturalAspect(width / height);
                    }
                  }
                }}
                onPlaybackStatusUpdate={(status) => {
                  if (status.isLoaded && status.isPlaying !== undefined) {
                    setIsPaused(!status.isPlaying);
                  }
                }}
              />
            </View>

            {/* Edge press zones for speed control - 18% each side */}
            <TouchableOpacity
              style={styles.edgePressLeft}
              onPressIn={handleEdgePressIn}
              onPressOut={handleEdgePressOut}
              activeOpacity={1}
            />
            <TouchableOpacity
              style={styles.edgePressRight}
              onPressIn={handleEdgePressIn}
              onPressOut={handleEdgePressOut}
              activeOpacity={1}
            />

            {/* 2x speed indicator */}
            {playbackRate >= 2 && (
              <View style={styles.speedIndicator}>
                <Text style={styles.speedIndicatorText}>2x</Text>
              </View>
            )}
          </View>

          <View style={styles.overlaysContainer}>
            <View style={styles.bottomGradient} />

            <TouchableOpacity
              style={styles.tapLayer}
              activeOpacity={1}
              onPress={handleTap}
              onPressIn={handleTapStart}
              onTouchMove={handleTapMove}
            />

            <Animated.View style={[styles.heartOverlay, { opacity: heartAnim }]}>
              <Heart size={80} color="#fff" fill="#fff" />
            </Animated.View>

            {showPauseIcon && (
              <View style={styles.pauseOverlay}>
                {isPaused ? (
                  <Play size={48} color="rgba(255,255,255,0.7)" />
                ) : (
                  <Pause size={48} color="rgba(255,255,255,0.7)" />
                )}
              </View>
            )}
          </View>

          <View style={styles.topControls}>
            <TouchableOpacity style={styles.topControlBtn} onPress={onToggleMute} activeOpacity={0.7}>
              {muted ? <VolumeX size={18} color="#fff" /> : <Volume2 size={18} color="#fff" />}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.topControlBtn, playbackRate >= 2 && styles.topControlBtnActive]} onPress={onToggleRate} activeOpacity={0.7}>
              <Text style={[styles.topControlText, playbackRate >= 2 && styles.topControlTextActive]}>
                {playbackRate >= 2 ? '2x' : '1x'}
              </Text>
            </TouchableOpacity>
            {!isPortrait && (
              <TouchableOpacity style={styles.topControlBtn} onPress={handleLandscapePress} activeOpacity={0.7}>
                <Maximize2 size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.rightActions, { bottom: insets.bottom + 140 }]}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleLikePress} activeOpacity={0.7}>
              <View style={[styles.actionIconCircle, item.likedByMe && styles.actionIconCircleActive]}>
                <Heart
                  size={26}
                  color={item.likedByMe ? theme.colors.danger : '#fff'}
                  fill={item.likedByMe ? theme.colors.danger : 'transparent'}
                />
              </View>
              <Text style={styles.actionText}>{item.likeCount || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleCommentsPress} activeOpacity={0.7}>
              <View style={styles.actionIconCircle}>
                <MessageCircle size={26} color="#fff" />
              </View>
              <Text style={styles.actionText}>{item.commentCount || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleRepostPress} activeOpacity={0.7}>
              <View style={[styles.actionIconCircle, item.repostedByMe && styles.actionIconCircleRepost]}>
                <Repeat size={24} color={item.repostedByMe ? theme.colors.success : '#fff'} />
              </View>
              <Text style={styles.actionText}>{item.repostCount || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleSharePress} activeOpacity={0.7}>
              <View style={styles.actionIconCircle}>
                <Share2 size={24} color="#fff" />
              </View>
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleMorePress} activeOpacity={0.7}>
              <View style={styles.actionIconCircle}>
                <MoreHorizontal size={22} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.bottomInfo, { bottom: insets.bottom + 70 }]}>
            <View style={styles.authorRow}>
              <TouchableOpacity style={styles.authorAvatarWrap} onPress={handleProfilePress} activeOpacity={0.7}>
                {item.authorAvatar ? (
                  <Image source={{ uri: item.authorAvatar }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.authorAvatar}>
                    <User size={16} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName} numberOfLines={1}>
                  {item.author || item.authorKey || 'User'}
                </Text>
                {item.verified && (
                  <Verified size={14} color={theme.colors.verified} fill={theme.colors.verified} />
                )}
              </View>
              <TouchableOpacity style={styles.followBtn} onPress={handleFollow} activeOpacity={0.7}>
                <Text style={styles.followBtnText}>{isFollowing ? 'Following' : 'Follow'}</Text>
              </TouchableOpacity>
            </View>
            {item.text ? (
              <Text style={styles.caption} numberOfLines={2}>
                {item.text}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={[styles.videoWrap, styles.emptyReel]}>
          <Text style={styles.emptyText}>No video available</Text>
        </View>
      )}
    </View>
  );
}, (prev, next) => {
  return prev.item === next.item
    && prev.isActive === next.isActive
    && prev.muted === next.muted
    && prev.playbackRate === next.playbackRate;
});

function getVideoUrl(reel) {
  const media = reel.media && reel.media[0];
  return (media && (media.fullUrl || media.url)) || '';
}

const LandscapeViewer = React.memo(({ visible, videoUrl, onClose }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (visible && videoRef.current) {
      videoRef.current.playAsync().catch(() => {});
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => {});
        videoRef.current.unloadAsync().catch(() => {});
      }
    };
  }, [visible]);

  if (!videoUrl) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.landscapeBg}>
        <TouchableOpacity style={styles.landscapeClose} onPress={onClose} activeOpacity={0.7}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.landscapeVideoWrap}>
          <Video
            ref={videoRef}
            source={{ uri: videoUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isMuted={false}
            isLooping
            useNativeControls={false}
          />
        </View>
      </View>
    </Modal>
  );
});

const COMMENTS_SHEET_HEIGHT = SCREEN_H * 0.65;
const COMMENT_ITEM_HEIGHT = 80; // Approximate height for getItemLayout

const Reels = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchingRef = useRef(false);
  const pendingLikes = useRef(new Set());
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsReelId, setCommentsReelId] = useState(null);
  const [commentsList, setCommentsList] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareReel, setShareReel] = useState(null);
  const [landscapeOpen, setLandscapeOpen] = useState(false);
  const [landscapeUrl, setLandscapeUrl] = useState(null);

  const commentsSheetAnim = useRef(new Animated.Value(COMMENTS_SHEET_HEIGHT)).current;
  const commentsBgAnim = useRef(new Animated.Value(0)).current;

  const videoRefsArr = useRef([]);

  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.error('Audio mode error:', e);
      }
    })();
    fetchReels();
    return () => stopAllVideos();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      return () => stopAllVideos();
    }, [])
  );

  const stopAllVideos = useCallback(() => {
    videoRefsArr.current.forEach((ref) => {
      if (ref) {
        ref.pauseAsync().catch(() => {});
      }
    });
  }, []);

  const registerVideoRef = useCallback((ref, index) => {
    videoRefsArr.current[index] = ref;
  }, []);

  const fetchReels = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      setLoading(true);
      const response = await feedAPI.getReels(BATCH_SIZE);
      if (response.data.ok) {
        setReels(response.data.reels || []);
        setNextCursor(response.data.nextCursor);
      }
    } catch (err) {
      console.error('Reels fetch error:', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const fetchMoreReels = async () => {
    if (loadingMore || !nextCursor || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const response = await feedAPI.getReels(BATCH_SIZE, nextCursor);
      if (response.data.ok && response.data.reels && response.data.reels.length > 0) {
        setReels((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const newReels = response.data.reels.filter((r) => !existingIds.has(r.id));
          return [...prev, ...newReels];
        });
        setNextCursor(response.data.nextCursor || null);
      } else {
        setNextCursor(null);
      }
    } catch (err) {
      console.error('Reels pagination error:', err);
    } finally {
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const visibleItem = viewableItems[0];
      if (typeof visibleItem.index === 'number') {
        setActiveIndex(visibleItem.index);
      }
    }
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  const handleDoubleTapVideo = useCallback((reelId) => {
    if (pendingLikes.current.has(String(reelId))) return;
    pendingLikes.current.add(String(reelId));
    setReels((prev) =>
      prev.map((r) =>
        String(r.id) === String(reelId) && !r.likedByMe
          ? { ...r, likeCount: (r.likeCount || 0) + 1, likedByMe: true }
          : r
      )
    );
    postAPI.likePost(reelId).then(() => {
      pendingLikes.current.delete(String(reelId));
    }).catch(() => {
      pendingLikes.current.delete(String(reelId));
    });
  }, []);

  const handleLike = useCallback(async (reelId) => {
    if (pendingLikes.current.has(String(reelId))) return;
    pendingLikes.current.add(String(reelId));
    haptics.light();
    setReels((prev) =>
      prev.map((r) => {
        if (String(r.id) !== String(reelId)) return r;
        const toggled = !r.likedByMe;
        return {
          ...r,
          likedByMe: toggled,
          likeCount: toggled ? (r.likeCount || 0) + 1 : Math.max(0, (r.likeCount || 0) - 1),
        };
      })
    );
    try {
      await postAPI.likePost(reelId);
    } catch (err) {
      console.error('Reel like error:', err);
    } finally {
      pendingLikes.current.delete(String(reelId));
    }
  }, []);

  const openComments = useCallback((reelId) => {
    setCommentsReelId(reelId);
    setCommentsList([]);
    setCommentsLoading(true);
    setCommentsOpen(true);
    commentsSheetAnim.setValue(COMMENTS_SHEET_HEIGHT);
    commentsBgAnim.setValue(0);
    Animated.parallel([
      Animated.spring(commentsSheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 9,
      }),
      Animated.timing(commentsBgAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
    fetchCommentsForReel(reelId);
  }, []);

  const closeComments = useCallback(() => {
    Animated.parallel([
      Animated.timing(commentsSheetAnim, {
        toValue: COMMENTS_SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(commentsBgAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCommentsOpen(false);
      setCommentsList([]);
    });
  }, []);

  const fetchCommentsForReel = async (reelId) => {
    try {
      const response = await postAPI.getComments(reelId);
      if (response.data.ok) {
        setCommentsList(response.data.comments || []);
      }
    } catch (err) {
      console.error('Comments fetch error:', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim() || !commentsReelId) return;
    setCommentSubmitting(true);
    try {
      const response = await postAPI.addComment(commentsReelId, commentText.trim());
      if (response.data.ok) {
        setCommentText('');
        fetchCommentsForReel(commentsReelId);
        setReels((prev) =>
          prev.map((r) =>
            String(r.id) === String(commentsReelId)
              ? { ...r, commentCount: (r.commentCount || 0) + 1 }
              : r
          )
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to add comment.');
    } finally {
      setCommentSubmitting(false);
    }
  }, [commentText, commentsReelId]);

  const handleCommentReply = useCallback(async (parentId, text) => {
    if (!commentsReelId) return;
    try {
      await postAPI.addReply(commentsReelId, parentId, text);
      fetchCommentsForReel(commentsReelId);
    } catch (err) {
      console.error('Reply error:', err);
      throw err;
    }
  }, [commentsReelId]);

  const handleRepost = useCallback(async (reelId) => {
    haptics.light();
    try {
      await postAPI.repostPost(reelId);
      setReels((prev) =>
        prev.map((r) =>
          String(r.id) === String(reelId)
            ? { ...r, repostCount: (r.repostCount || 0) + 1, repostedByMe: true }
            : r
        )
      );
    } catch (err) {
      Alert.alert('Coming soon', 'Reposting will be available soon.');
    }
  }, []);

  const openShareSheet = useCallback((reel) => {
    setShareReel(reel);
    setShareSheetOpen(true);
  }, []);

  const handleExternalShare = useCallback(async () => {
    if (!shareReel) return;
    setShareSheetOpen(false);
    await shareReel({
      reelId: shareReel.id,
      author: shareReel.authorKey || shareReel.author,
    });
  }, [shareReel]);

  const handleCopyLink = useCallback(async () => {
    if (!shareReel) return;
    setShareSheetOpen(false);
    const url = `https://hysa1.com/reel/${shareReel.id}`;
    await copyLink(url, 'Reel link');
  }, [shareReel]);

  const openMoreMenu = useCallback((reelId) => {
    setShareReel(reels.find((r) => String(r.id) === String(reelId)) || null);
    setShowMoreMenu(true);
  }, [reels]);

  const handleReport = useCallback(() => {
    setShowMoreMenu(false);
    Alert.alert('Coming soon', 'Reporting will be available soon.');
  }, []);

  const handleOpenProfile = useCallback((item) => {
    if (!item) return;
    haptics.light();
    navigation.navigate('UserProfile', { userKey: item.authorKey || item.authorId });
  }, [navigation]);

  const getItemLayout = useCallback((_, index) => ({
    length: SCREEN_H,
    offset: SCREEN_H * index,
    index,
  }), []);

  const renderReel = useCallback(({ item, index }) => {
    const isActive = index === activeIndex;
    return (
      <ReelItem
        item={item}
        isActive={isActive}
        muted={muted}
        playbackRate={playbackRate}
        onLike={handleLike}
        onOpenComments={openComments}
        onRepost={handleRepost}
        onOpenShare={openShareSheet}
        onMore={openMoreMenu}
        onDoubleTapVideo={handleDoubleTapVideo}
        onOpenProfile={handleOpenProfile}
        onRegisterRef={(ref) => registerVideoRef(ref, index)}
        onToggleMute={() => setMuted((p) => !p)}
        onToggleRate={() => setPlaybackRate((p) => (p >= 2 ? 1 : 2))}
        onOpenLandscape={(url) => { setLandscapeUrl(url); setLandscapeOpen(true); }}
        insets={insets}
      />
    );
  }, [activeIndex, muted, playbackRate, handleLike, openComments, handleRepost, openShareSheet, openMoreMenu, handleDoubleTapVideo, handleOpenProfile, registerVideoRef, insets]);

  const keyExtractor = useCallback((item) => `reel-${item.id}`, []);

  const renderComment = useCallback(({ item }) => (
    <CommentItem comment={item} onReply={handleCommentReply} />
  ), [handleCommentReply]);

  const commentKeyExtractor = useCallback((item) => String(item.id || item.text), []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No reels yet</Text>
          <Text style={styles.emptySubtext}>Video reels will appear here when available.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reels}
        renderItem={renderReel}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        snapToInterval={SCREEN_H}
        decelerationRate="fast"
        removeClippedSubviews
        maxToRenderPerBatch={2}
        windowSize={3}
        onEndReached={fetchMoreReels}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
            </View>
          ) : null
        }
      />

      <Modal visible={commentsOpen} transparent statusBarTranslucent onRequestClose={closeComments}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.commentsOverlay}>
            <Animated.View style={[styles.commentsBackdrop, { opacity: commentsBgAnim }]} />
            <TouchableOpacity style={styles.commentsBackdrop} activeOpacity={1} onPress={closeComments} />
            <Animated.View style={[styles.commentsSheet, { transform: [{ translateY: commentsSheetAnim }] }]}>
              <View style={styles.commentsHandleWrap}>
                <View style={styles.commentsHandle} />
              </View>
              <View style={styles.commentsHeader}>
                <Text style={styles.commentsTitle}>Comments</Text>
                <TouchableOpacity onPress={closeComments} activeOpacity={0.7} style={styles.commentsClose}>
                  <X size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              {commentsLoading ? (
                <View style={styles.commentsLoading}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={styles.commentSkeleton}>
                      <View style={[styles.commentAvatarPlaceholder, { width: 32, height: 32, borderRadius: 16 }]} />
                      <View style={styles.commentSkeletonContent}>
                        <View style={styles.skeletonLineShort} />
                        <View style={styles.skeletonLine} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <FlatList
                  data={commentsList}
                  renderItem={renderComment}
                  keyExtractor={commentKeyExtractor}
                  style={styles.commentsList}
                  contentContainerStyle={[
                    commentsList.length === 0 ? styles.commentsListCenter : null,
                    { paddingBottom: 12 }
                  ]}
                  keyboardShouldPersistTaps="handled"
                  removeClippedSubviews={true}
                  initialNumToRender={8}
                  maxToRenderPerBatch={6}
                  windowSize={5}
                  updateCellsBatchingPeriod={100}
                  ListEmptyComponent={<Text style={styles.noComments}>No comments yet. Be the first!</Text>}
                  getItemLayout={(data, index) => ({
                    length: 80,
                    offset: 80 * index,
                    index,
                  })}
                />
              )}
              <View style={[styles.commentInputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                  returnKeyType="send"
                  onSubmitEditing={commentText.trim() ? handleAddComment : undefined}
                />
                <TouchableOpacity
                  style={[styles.commentSendBtn, (!commentText.trim() || commentSubmitting) && styles.commentSendBtnDisabled]}
                  onPress={handleAddComment}
                  disabled={!commentText.trim() || commentSubmitting}
                  activeOpacity={0.7}
                >
                  {commentSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Send size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={shareSheetOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShareSheetOpen(false)}>
        <View style={styles.shareOverlay}>
          <TouchableOpacity style={styles.shareBackdrop} activeOpacity={1} onPress={() => setShareSheetOpen(false)} />
          <View style={styles.shareSheet}>
            <View style={styles.shareHandleWrap}>
              <View style={styles.shareHandle} />
            </View>
            <Text style={styles.shareTitle}>Share</Text>
            {shareReel && (
              <View style={styles.shareReelInfo}>
                {shareReel.authorAvatar ? (
                  <Image source={{ uri: shareReel.authorAvatar }} style={styles.shareReelAvatar} />
                ) : (
                  <View style={styles.shareReelAvatarPlaceholder}>
                    <User size={14} color={theme.colors.textMuted} />
                  </View>
                )}
                <Text style={styles.shareReelAuthor} numberOfLines={1}>
                  {shareReel.author || shareReel.authorKey || 'User'}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.shareSheetItem} onPress={handleExternalShare} activeOpacity={0.7}>
              <View style={[styles.shareIconCircle, styles.shareIconCircleHighlight]}>
                <Globe size={18} color={theme.colors.accent} />
              </View>
              <View style={styles.shareItemText}>
                <Text style={styles.shareItemLabel}>External share</Text>
                <Text style={styles.shareItemSub}>Share to other apps</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.shareDivider} />
            <TouchableOpacity style={styles.shareSheetItem} onPress={handleCopyLink} activeOpacity={0.7}>
              <View style={styles.shareIconCircle}>
                <Link size={18} color={theme.colors.textSecondary} />
              </View>
              <Text style={styles.shareItemLabel}>Copy link</Text>
            </TouchableOpacity>
            <View style={styles.shareDivider} />
            <TouchableOpacity style={styles.shareSheetItem} onPress={() => setShareSheetOpen(false)} activeOpacity={0.7}>
              <Text style={styles.shareCancelText}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ height: Math.max(insets.bottom, 12) }} />
          </View>
        </View>
      </Modal>

      <Modal visible={showMoreMenu} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowMoreMenu(false)}>
        <TouchableOpacity style={styles.moreOverlay} activeOpacity={1} onPress={() => setShowMoreMenu(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.moreSheet}>
            <TouchableOpacity style={styles.moreSheetItem} onPress={handleExternalShare} activeOpacity={0.7}>
              <Globe size={18} color={theme.colors.textPrimary} />
              <Text style={styles.moreSheetText}>External share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreSheetItem} onPress={handleCopyLink} activeOpacity={0.7}>
              <Link size={18} color={theme.colors.textPrimary} />
              <Text style={styles.moreSheetText}>Copy link</Text>
            </TouchableOpacity>
            <View style={styles.moreSheetDivider} />
            <TouchableOpacity style={styles.moreSheetItem} onPress={handleReport} activeOpacity={0.7}>
              <Flag size={18} color={theme.colors.danger} />
              <Text style={[styles.moreSheetText, { color: theme.colors.danger }]}>Report</Text>
            </TouchableOpacity>
            <View style={styles.moreSheetDivider} />
            <TouchableOpacity style={styles.moreSheetItem} onPress={() => setShowMoreMenu(false)} activeOpacity={0.7}>
              <Text style={styles.moreSheetCloseText}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ height: Math.max(insets.bottom, 12) }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <LandscapeViewer visible={landscapeOpen} videoUrl={landscapeUrl} onClose={() => setLandscapeOpen(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  reelContainer: { width: SCREEN_W, height: SCREEN_H, backgroundColor: '#000' },
  reelContent: { width: SCREEN_W, height: SCREEN_H, backgroundColor: '#000' },
  videoWrap: { width: SCREEN_W, height: SCREEN_H, backgroundColor: '#000' },
  overlaysContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  videoCentering: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  videoFull: { width: '100%', height: '100%' },
  overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bgThumb: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bgDarkOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 4, pointerEvents: 'none' },
  tapLayer: { ...StyleSheet.absoluteFillObject, zIndex: 5 },
  heartOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 6, pointerEvents: 'none' },
  pauseOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 6, pointerEvents: 'none' },
  topControls: { position: 'absolute', top: 50, right: 10, flexDirection: 'row', gap: 6, zIndex: 11 },
  topControlBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  topControlBtnActive: { backgroundColor: 'rgba(124,58,237,0.5)' },
  topControlText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  topControlTextActive: { color: '#fff' },
  rightActions: { position: 'absolute', right: 10, bottom: 160, alignItems: 'center', zIndex: 10 },
  actionBtn: { alignItems: 'center', marginBottom: 12 },
  actionIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  actionIconCircleActive: { backgroundColor: 'rgba(255,88,116,0.18)' },
  actionIconCircleRepost: { backgroundColor: 'rgba(23,191,99,0.18)' },
  actionText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  bottomInfo: { position: 'absolute', bottom: 90, left: 12, right: 70, zIndex: 10 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  authorAvatarWrap: { marginRight: 8 },
  authorAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 32, height: 32, borderRadius: 16 },
  authorNameRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  authorName: { fontSize: 15, fontWeight: '700', color: '#fff', marginRight: 6, flex: 1 },
  followBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 6, backgroundColor: theme.colors.accent, marginLeft: 8 },
  followBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  caption: { fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 18 },
  edgePressLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '18%', zIndex: 7 },
  edgePressRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '18%', zIndex: 7 },
  speedIndicator: { position: 'absolute', top: 100, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, zIndex: 12 },
  speedIndicatorText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyReel: { justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center' },
  emptyText: { fontSize: 16, color: theme.colors.textMuted },
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
  commentsOverlay: { flex: 1 },
  commentsBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  commentsSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.colors.bgSecondary, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, height: COMMENTS_SHEET_HEIGHT, overflow: 'hidden' },
  commentsHandleWrap: { alignItems: 'center', paddingVertical: 10 },
  commentsHandle: { width: 32, height: 3, borderRadius: 2, backgroundColor: theme.colors.border },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderLight },
  commentsTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  commentsClose: { padding: 4 },
  commentsList: { flex: 1 },
  commentsListCenter: { justifyContent: 'center', alignItems: 'center', paddingVertical: 32 },
  noComments: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  commentsLoading: { paddingVertical: 8, paddingHorizontal: 14 },
  commentSkeleton: { flexDirection: 'row', paddingVertical: 10, gap: 10 },
  commentSkeletonContent: { flex: 1 },
  skeletonLine: { height: 10, backgroundColor: theme.colors.bgInput, borderRadius: 5, marginBottom: 6 },
  skeletonLineShort: { height: 8, width: '40%', backgroundColor: theme.colors.bgInput, borderRadius: 4, marginBottom: 8 },
  commentInputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.colors.bgSecondary, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderLight },
  commentInput: { flex: 1, backgroundColor: theme.colors.bgInput, borderRadius: theme.radius.full, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: theme.colors.textPrimary, maxHeight: 80 },
  commentSendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  commentSendBtnDisabled: { opacity: 0.4 },
  shareOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  shareBackdrop: { ...StyleSheet.absoluteFillObject },
  shareSheet: { backgroundColor: theme.colors.bgSecondary, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, paddingBottom: 8, overflow: 'hidden' },
  shareHandleWrap: { alignItems: 'center', paddingVertical: 8 },
  shareHandle: { width: 32, height: 3, borderRadius: 2, backgroundColor: theme.colors.border },
  shareTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, textAlign: 'center', paddingVertical: 4, marginBottom: 4 },
  shareReelInfo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  shareReelAvatar: { width: 24, height: 24, borderRadius: 12 },
  shareReelAvatarPlaceholder: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.bgInput, alignItems: 'center', justifyContent: 'center' },
  shareReelAuthor: { fontSize: 13, color: theme.colors.textSecondary, flex: 1 },
  shareSheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  shareIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  shareIconCircleHighlight: { backgroundColor: 'rgba(124,58,237,0.12)', borderColor: 'rgba(124,58,237,0.2)', borderWidth: 1 },
  shareItemText: { flex: 1 },
  shareItemLabel: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  shareItemSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  shareDivider: { height: 1, backgroundColor: theme.colors.borderLight, marginHorizontal: 16, marginVertical: 2 },
  shareCancelText: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: 8 },
  moreOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  moreSheet: { backgroundColor: theme.colors.bgCard, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, paddingBottom: 8 },
  moreSheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, gap: 14 },
  moreSheetText: { fontSize: 16, color: theme.colors.textPrimary },
  moreSheetDivider: { height: 1, backgroundColor: theme.colors.borderLight, marginVertical: 4 },
  moreSheetCloseText: { fontSize: 16, fontWeight: '600', color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: 10 },
  landscapeBg: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  landscapeClose: { position: 'absolute', top: 50, left: 16, zIndex: 10, padding: 8 },
  landscapeVideoWrap: { width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' },
  landscapeVideo: { width: SCREEN_W, height: SCREEN_H * 0.4, maxWidth: SCREEN_H * 0.7111 },
});

const cStyles = StyleSheet.create({
  commentItem: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  commentAvatarWrap: { marginTop: 2, flexShrink: 0 },
  commentAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  commentAvatarPlaceholder: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.bgInput, alignItems: 'center', justifyContent: 'center' },
  commentContent: { flex: 1, minWidth: 0 },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 1 },
  commentNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  commentAuthor: { fontSize: 12, fontWeight: '600', color: theme.colors.textPrimary, marginRight: 4 },
  commentTime: { fontSize: 10, color: theme.colors.textMuted },
  commentText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 16, marginBottom: 3 },
  commentActionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  replyBtnText: { fontSize: 11, color: theme.colors.accent, fontWeight: '600' },
  viewRepliesBtn: { paddingVertical: 3, paddingLeft: 2 },
  viewRepliesText: { fontSize: 11, color: theme.colors.accent, fontWeight: '600' },
  replyItem: { flexDirection: 'row', marginTop: 4, paddingTop: 4, paddingLeft: 2 },
  replyAvatarWrap: { marginRight: 5, marginTop: 1, flexShrink: 0 },
  replyAvatarImg: { width: 18, height: 18, borderRadius: 9 },
  replyAvatarPlaceholder: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.colors.bgInput, alignItems: 'center', justifyContent: 'center' },
  replyContent: { flex: 1, minWidth: 0 },
  replyHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 1 },
  replyAuthor: { fontSize: 11, fontWeight: '600', color: theme.colors.textPrimary, marginRight: 4 },
  replyTime: { fontSize: 9, color: theme.colors.textMuted },
  replyText: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 15, marginBottom: 2 },
  replyInputRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
  replyInput: { flex: 1, backgroundColor: theme.colors.bgInput, borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, color: theme.colors.textPrimary, maxHeight: 50, marginRight: 4 },
  replySendBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  replySendBtnDisabled: { opacity: 0.4 },
  commentLikeBtn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginTop: 2 },
  commentLikeCount: { fontSize: 9, color: theme.colors.textMuted, marginTop: 1 },
});

export default Reels;
