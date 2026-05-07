import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Alert,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Camera,
  FlipHorizontal,
  Zap,
  ZapOff,
  X,
  Check,
  Image as ImageIcon,
} from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import theme from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const FILTERS = [
  { name: 'Normal', overlay: 'transparent', icon: '\u25EF' },
  { name: 'Warm', overlay: 'rgba(255, 160, 50, 0.18)', icon: '\u2600' },
  { name: 'Cool', overlay: 'rgba(50, 140, 255, 0.18)', icon: '\u2744' },
  { name: 'Vivid', overlay: 'rgba(255, 59, 138, 0.12)', icon: '\u2726' },
  { name: 'Mono', overlay: 'rgba(0, 0, 0, 0.35)', icon: '\u25D0' },
  { name: 'Dream', overlay: 'rgba(124, 58, 237, 0.14)', icon: '\u25C8' },
];

const StoryCameraScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [mode, setMode] = useState('picture');
  const [filter, setFilter] = useState(FILTERS[0]);
  const [capturedMedia, setCapturedMedia] = useState(null);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState(null);
  const shutterAnim = useRef(new Animated.Value(1)).current;
  const recordTimerRef = useRef(null);
  const [recordDuration, setRecordDuration] = useState(0);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
      };
    }, [])
  );

  useEffect(() => {
    if (!cameraPermission?.granted) {
      requestCameraPermission();
    }
  }, []);

  const triggerShutter = () => {
    Animated.sequence([
      Animated.timing(shutterAnim, { toValue: 0.3, duration: 50, useNativeDriver: true }),
      Animated.timing(shutterAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const startRecordingTimer = () => {
    setRecordDuration(0);
    recordTimerRef.current = setInterval(() => {
      setRecordDuration((prev) => {
        if (prev >= 60) {
          stopRecording();
          return 60;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecordingTimer = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady || processing) return;
    try {
      triggerShutter();
      setProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
      });
      if (photo?.uri) {
        const fileInfo = await FileSystem.getInfoAsync(photo.uri);
        setCapturedMedia({
          uri: photo.uri,
          type: 'image',
          mimeType: 'image/jpeg',
          width: photo.width,
          height: photo.height,
          size: fileInfo.exists ? fileInfo.size : null,
        });
      }
    } catch (err) {
      console.error('Take picture error:', err);
      setError('Failed to capture photo.');
    } finally {
      setProcessing(false);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || !cameraReady || recording || processing) return;
    try {
      setRecording(true);
      startRecordingTimer();
      const video = await cameraRef.current.recordAsync({
        maxDuration: 60,
        mute: !micPermission?.granted,
        videoQuality: '1080p',
      });
      if (video?.uri) {
        const fileInfo = await FileSystem.getInfoAsync(video.uri);
        setCapturedMedia({
          uri: video.uri,
          type: 'video',
          mimeType: 'video/mp4',
          width: video.width,
          height: video.height,
          size: fileInfo.exists ? fileInfo.size : null,
          duration: recordDuration,
        });
      }
    } catch (err) {
      if (err.message?.includes('stopped')) {
        return;
      }
      console.error('Record video error:', err);
      setError('Failed to record video.');
    } finally {
      setRecording(false);
      stopRecordingTimer();
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && recording) {
      cameraRef.current.stopRecording();
    }
  };

  const handleCapturePress = () => {
    if (mode === 'video') {
      if (recording) {
        stopRecording();
      } else {
        startRecording();
      }
    } else {
      takePicture();
    }
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'));
  };

  const useCaptured = () => {
    if (!capturedMedia) return;
    navigation.replace('StoryComposer', { media: capturedMedia });
  };

  const retake = () => {
    setCapturedMedia(null);
    setRecordDuration(0);
  };

  const openGallery = () => {
    navigation.navigate('StoryComposer', { openGallery: true });
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!cameraPermission?.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.permissionCard}>
          <Camera size={48} color={theme.colors.accent} />
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionText}>We need camera access to create stories.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestCameraPermission} activeOpacity={0.8}>
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (capturedMedia) {
    const isVideoPreview = capturedMedia.type === 'video';
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.previewContainer, { opacity: shutterAnim }]}>
          {isVideoPreview ? (
            <Video
              source={{ uri: capturedMedia.uri }}
              style={styles.previewMedia}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isMuted
              isLooping
            />
          ) : (
            <Image source={{ uri: capturedMedia.uri }} style={styles.previewMedia} resizeMode="contain" />
          )}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: filter.overlay }]} pointerEvents="none" />

          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={styles.topBarBtn} onPress={retake} activeOpacity={0.7}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarBtn} onPress={() => navigation.navigate('StoryComposer', { media: null })} activeOpacity={0.7}>
              <ImageIcon size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity style={styles.retakeBtn} onPress={retake} activeOpacity={0.7}>
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.useBtn} onPress={useCaptured} activeOpacity={0.7} disabled={processing}>
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Check size={18} color="#fff" />
                  <Text style={styles.useBtnText}>{isVideoPreview ? 'Use Video' : 'Use Photo'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={[styles.errorBar, { top: insets.top + 12 }]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)} activeOpacity={0.7}>
            <X size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        mode={mode}
        mute={!micPermission?.granted}
        onCameraReady={() => setCameraReady(true)}
        onMountError={(e) => {
          console.error('Camera mount error:', e);
          setError('Camera not available.');
        }}
      />

      <View style={[StyleSheet.absoluteFill, { backgroundColor: filter.overlay }]} pointerEvents="none" />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity style={styles.topBarBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity style={styles.topBarBtn} onPress={toggleFlash} activeOpacity={0.7}>
            {flash === 'off' ? <ZapOff size={20} color="#fff" /> : <Zap size={20} color="#FFD700" />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.topBarBtn} onPress={toggleFacing} activeOpacity={0.7}>
            <FlipHorizontal size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {recording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>{formatDuration(recordDuration)}</Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRail}
        style={{ position: 'absolute', bottom: 160, left: 0, right: 0, zIndex: 12 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.name}
            style={[styles.filterChip, filter.name === f.name && styles.filterChipActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipIcon, filter.name === f.name && styles.filterChipIconActive]}>{f.icon}</Text>
            <Text style={[styles.filterChipLabel, filter.name === f.name && styles.filterChipLabelActive]}>{f.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'picture' && styles.modeBtnActive]}
            onPress={() => setMode('picture')}
            activeOpacity={0.7}
          >
            <Text style={[styles.modeBtnText, mode === 'picture' && styles.modeBtnTextActive]}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'video' && styles.modeBtnActive]}
            onPress={() => setMode('video')}
            activeOpacity={0.7}
          >
            <Text style={[styles.modeBtnText, mode === 'video' && styles.modeBtnTextActive]}>Video</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.captureRow}>
          <TouchableOpacity style={styles.galleryBtn} onPress={openGallery} activeOpacity={0.7}>
            <ImageIcon size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureBtn, recording && styles.captureBtnRecording]}
            onPress={handleCapturePress}
            activeOpacity={0.7}
            disabled={processing}
          >
            <View style={styles.captureInner}>
              {recording ? (
                <View style={styles.recordSquare} />
              ) : mode === 'video' ? (
                <View style={styles.videoCaptureInner} />
              ) : (
                <View style={styles.photoCaptureInner} />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.galleryBtn} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  previewContainer: { flex: 1 },
  previewMedia: { width: SCREEN_W, height: SCREEN_H },
  closeBtn: { position: 'absolute', top: 16, left: 16, zIndex: 20, padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  permissionCard: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  permissionTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 16, marginBottom: 8 },
  permissionText: { fontSize: 14, color: '#8A8A9A', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  permissionBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 24, backgroundColor: theme.colors.accent },
  permissionBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 15 },
  topBarLeft: { flexDirection: 'row', gap: 8 },
  topBarRight: { flexDirection: 'row', gap: 8 },
  topBarBtn: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  errorBar: { position: 'absolute', left: 16, right: 16, backgroundColor: 'rgba(255,59,138,0.15)', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,59,138,0.3)', zIndex: 30 },
  errorText: { color: '#FF3B8A', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
  recordingIndicator: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center', zIndex: 15, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B8A' },
  recordingText: { color: '#FF3B8A', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  filterRail: { position: 'absolute', bottom: 160, left: 0, right: 0, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 8, zIndex: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', marginRight: 6 },
  filterChipActive: { backgroundColor: 'rgba(255,59,138,0.25)', borderColor: '#FF3B8A' },
  filterChipIcon: { fontSize: 16, color: '#aaa', marginBottom: 2 },
  filterChipIconActive: { color: '#FF3B8A' },
  filterChipLabel: { fontSize: 11, fontWeight: '700', color: '#aaa' },
  filterChipLabelActive: { color: '#FF3B8A' },
  bottomControls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, zIndex: 12 },
  modeToggle: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 20, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 3, alignSelf: 'center' },
  modeBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 18 },
  modeBtnActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  modeBtnText: { fontSize: 13, fontWeight: '700', color: '#8A8A9A' },
  modeBtnTextActive: { color: '#fff' },
  captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 20 },
  galleryBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  captureBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  captureBtnRecording: { borderColor: '#FF3B8A', backgroundColor: 'rgba(255,59,138,0.2)' },
  captureInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  photoCaptureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  videoCaptureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF3B8A' },
  recordSquare: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#FF3B8A' },
  bottomActions: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  retakeBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  retakeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  useBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24, backgroundColor: theme.colors.accent, gap: 8 },
  useBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default StoryCameraScreen;
