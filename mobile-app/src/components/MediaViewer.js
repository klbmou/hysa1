import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
  Text,
  PanResponder,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Play, Pause, Volume2, VolumeX, Zap } from 'lucide-react-native';
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import theme from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SWIPE_CLOSE_THRESHOLD = 120;
const SPEEDS = [1, 1.5, 2];

const MediaViewer = ({ visible, media, onClose }) => {
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [savedScale, setSavedScale] = useState(1);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const videoRef = useRef(null);
  const controlsTimer = useRef(null);

  const displayUrl = media?.fullUrl || media?.url || '';
  const kind = media?.kind || 'image';

  useEffect(() => {
    if (!visible) {
      setIsPlaying(true);
      setIsMuted(false);
      setPosition(0);
      setDuration(0);
      setControlsVisible(true);
      setSpeedIdx(0);
      setZoomScale(1);
      setSavedScale(1);
      fadeAnim.setValue(1);
      panY.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (kind === 'video') setControlsVisible(false);
    }, 3000);
  }, [kind]);

  const handleTogglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    } catch (err) {
      console.error('Video play/pause error:', err);
    }
  }, [isPlaying]);

  const handleToggleMute = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
    } catch (err) {
      console.error('Video mute error:', err);
    }
  }, [isMuted]);

  const handleSpeedCycle = useCallback(async () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (videoRef.current) {
      try {
        await videoRef.current.setRateAsync(SPEEDS[next]);
      } catch (err) {
        console.error('Video speed error:', err);
      }
    }
  }, [speedIdx]);

  const handleSeek = useCallback(async (value) => {
    if (!videoRef.current || !duration) return;
    const seekPos = (value / 100) * duration;
    try {
      await videoRef.current.setPositionAsync(seekPos);
      setPosition(seekPos);
    } catch (err) {
      console.error('Video seek error:', err);
    }
  }, [duration]);

  const handleClose = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    onClose();
  }, [onClose]);

  const swipeGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-10, 10])
    .onUpdate((e) => {
      if (e.translationY > 0) {
        panY.setValue(e.translationY);
      }
    })
    .onEnd((e) => {
      if (e.translationY > SWIPE_CLOSE_THRESHOLD) {
        Animated.timing(panY, {
          toValue: SCREEN_H,
          duration: 200,
          useNativeDriver: true,
        }).start(() => handleClose());
      } else {
        Animated.spring(panY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      setZoomScale(savedScale * e.scale);
    })
    .onEnd(() => {
      const s = Math.max(0.5, Math.min(zoomScale, 4));
      setSavedScale(s);
      setZoomScale(s);
    })
    .onFinalize(() => {
      setSavedScale(zoomScale);
    });

  const tapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = zoomScale > 1 ? 1 : 2;
      setZoomScale(next);
      setSavedScale(next);
    });

  const composedGestures = Gesture.Simultaneous(swipeGesture, pinchGesture, tapGesture);

  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;
  const speed = SPEEDS[speedIdx];

  const panStyle = {
    transform: [{ translateY: panY }],
  };

  const mediaContent = (
    <Animated.View style={[styles.zoomContainer, { transform: [{ scale: zoomScale }] }]}>
      {kind === 'video' ? (
        <Video
          ref={videoRef}
          source={{ uri: displayUrl }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={isPlaying}
          isMuted={isMuted}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded) {
              setPosition(status.positionMillis || 0);
              setDuration(status.durationMillis || 0);
              if (status.didJustFinish) {
                setIsPlaying(false);
              }
            }
          }}
        />
      ) : (
        <Image
          source={{ uri: displayUrl }}
          style={styles.image}
          resizeMode="contain"
        />
      )}
    </Animated.View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={composedGestures}>
          <Animated.View style={[styles.overlay, panStyle]}>
            <TouchableOpacity
              style={styles.mediaWrapper}
              activeOpacity={1}
              onPress={showControls}
            >
              {mediaContent}
            </TouchableOpacity>

            <Animated.View style={[styles.controlsOverlay, { opacity: fadeAnim }]}>
              <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
                  <X size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {kind === 'video' && (
                <View style={styles.bottomControls}>
                  <View style={styles.videoControls}>
                    <TouchableOpacity onPress={handleTogglePlay} activeOpacity={0.7} style={styles.controlBtn}>
                      {isPlaying ? <Pause size={24} color="#fff" /> : <Play size={24} color="#fff" />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleToggleMute} activeOpacity={0.7} style={styles.controlBtn}>
                      {isMuted ? <VolumeX size={20} color="#fff" /> : <Volume2 size={20} color="#fff" />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSpeedCycle} activeOpacity={0.7} style={styles.speedBtn}>
                      <Zap size={14} color="#fff" style={styles.speedIcon} />
                      <Text style={styles.speedText}>{speed}x</Text>
                    </TouchableOpacity>
                    <Text style={styles.timeText}>{formatTime(position)}</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                    </View>
                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                  </View>
                </View>
              )}
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomContainer: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControls: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  videoControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    gap: 4,
  },
  speedIcon: {
    opacity: 0.8,
  },
  speedText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
});

export default MediaViewer;
