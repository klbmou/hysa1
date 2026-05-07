import React, { useState, useEffect, useRef } from 'react';
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
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Image as ImageIcon, X, Send, Volume2, VolumeX, Zap, Smile, Type, Music, RotateCcw } from 'lucide-react-native';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Video, ResizeMode } from 'expo-av';
import { storiesAPI, uploadAPI } from '../api/client';
import theme from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const FILTERS = [
  { name: 'Normal', overlay: 'transparent', icon: '◯' },
  { name: 'Warm', overlay: 'rgba(255, 160, 50, 0.18)', icon: '☀' },
  { name: 'Cool', overlay: 'rgba(50, 140, 255, 0.18)', icon: '❄' },
  { name: 'Vivid', overlay: 'rgba(255, 59, 138, 0.12)', icon: '✦' },
  { name: 'Mono', overlay: 'rgba(0, 0, 0, 0.35)', icon: '◐' },
  { name: 'Dream', overlay: 'rgba(124, 58, 237, 0.14)', icon: '◈' },
];

const StoryComposer = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [media, setMedia] = useState(route.params?.media || null);
  const [filter, setFilter] = useState(FILTERS[0]);
  const [isMuted, setIsMuted] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const isCanceled = (result) => result.canceled || result.cancelled;

  const uploadMedia = async (asset) => {
    if (!asset || !asset.uri) {
      setError('No media selected. Please try again.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const mime = asset.mimeType || asset.type || (asset.uri.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      const dataUrl = `data:${mime};base64,${b64}`;
      const response = await uploadAPI.uploadMedia(dataUrl);
      if (response.data.ok) {
        setMedia(response.data.media);
      } else {
        setError(response.data.error || 'Upload failed.');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload media. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Access to photos is needed to create stories.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: false,
        quality: 0.85,
        videoMaxDuration: 60,
      });
      if (!isCanceled(result) && result.assets?.length && result.assets[0]?.uri) {
        await uploadMedia(result.assets[0]);
      }
    } catch (err) {
      console.error('Gallery pick error:', err);
      setError('Failed to pick media from gallery.');
      setUploading(false);
    }
  };

  const pickFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to create stories.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.85,
        videoMaxDuration: 60,
      });
      if (!isCanceled(result) && result.assets?.length && result.assets[0]?.uri) {
        await uploadMedia(result.assets[0]);
      }
    } catch (err) {
      console.error('Camera pick error:', err);
      setError('Failed to capture media.');
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!media || submitting || uploading) return;
    setSubmitting(true);
    try {
      const response = await storiesAPI.createStory({
        media: [media],
        filter: filter.name,
      });
      if (response.data.ok) {
        navigation.goBack();
      } else {
        setError(response.data.error || 'Failed to post story.');
      }
    } catch (err) {
      console.error('Story submit error:', err);
      setError('Failed to post story. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (media || uploading) {
      Alert.alert('Discard Story?', 'Your story will not be saved.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const mediaUrl = media?.fullUrl || media?.url;
  const isVideo = media?.kind === 'video';
  const hasMedia = !!media;
  const isLoading = !hasMedia && uploading;

  if (!cameraPermission?.granted && !hasMedia) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <TouchableOpacity style={styles.backBtnTop} onPress={handleBack} activeOpacity={0.7}>
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

  return (
    <View style={styles.container}>
      {hasMedia ? (
        <Animated.View style={[styles.previewContainer, { opacity: fadeAnim }]}>
          {error && (
            <View style={styles.errorBar}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)} activeOpacity={0.7}>
                <X size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {isVideo ? (
            <Video
              source={{ uri: mediaUrl }}
              style={styles.previewMedia}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isMuted={isMuted}
              isLooping
            />
          ) : (
            <Image source={{ uri: mediaUrl }} style={styles.previewMedia} resizeMode="cover" />
          )}

          <View style={[StyleSheet.absoluteFill, { backgroundColor: filter.overlay }]} pointerEvents="none" />

          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={styles.topBarBtn} onPress={handleBack} activeOpacity={0.7}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
            {isVideo && (
              <TouchableOpacity style={styles.topBarBtn} onPress={() => setIsMuted(p => !p)} activeOpacity={0.7}>
                {isMuted ? <VolumeX size={20} color="#fff" /> : <Volume2 size={20} color="#fff" />}
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
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

          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.bottomRow}>
              <TouchableOpacity style={styles.bottomIconBtn} onPress={pickFromGallery} activeOpacity={0.7} disabled={uploading || submitting}>
                <ImageIcon size={22} color={(uploading || submitting) ? '#555' : '#fff'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.bottomIconBtn} onPress={pickFromCamera} activeOpacity={0.7} disabled={uploading || submitting}>
                <Camera size={22} color={(uploading || submitting) ? '#555' : '#fff'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.bottomIconBtn} onPress={() => setToolsOpen(p => !p)} activeOpacity={0.7}>
                <Type size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.bottomIconBtn} activeOpacity={0.7}>
                <Smile size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.bottomIconBtn} activeOpacity={0.7}>
                <Music size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.shareBtn, (!media || submitting || uploading) && styles.shareBtnDisabled]}
              onPress={handleSubmit}
              disabled={!media || submitting || uploading}
              activeOpacity={0.7}
            >
              {(submitting || uploading) ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Send size={16} color="#fff" />
                  <Text style={styles.shareBtnText}>Share Story</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : (
        <View style={styles.emptyContainer}>
          <TouchableOpacity style={[styles.backBtnTop, { top: insets.top + 12 }]} onPress={handleBack} activeOpacity={0.7}>
            <X size={24} color="#fff" />
          </TouchableOpacity>

          {isLoading ? (
            <View style={styles.emptyCenter}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={styles.emptyLoadingText}>Uploading media...</Text>
            </View>
          ) : (
            <View style={styles.emptyCenter}>
              <View style={styles.emptyIconWrap}>
                <Camera size={56} color={theme.colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>Create Your Story</Text>
              <Text style={styles.emptySubtitle}>Capture a moment or pick from your gallery</Text>

              {error && <Text style={styles.emptyError}>{error}</Text>}

              <View style={styles.emptyActions}>
                <TouchableOpacity style={styles.emptyActionBtn} onPress={pickFromCamera} activeOpacity={0.8} disabled={uploading}>
                  <Camera size={22} color={uploading ? '#555' : '#fff'} />
                  <Text style={[styles.emptyActionText, uploading && styles.emptyActionTextDisabled]}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.emptyActionBtn} onPress={pickFromGallery} activeOpacity={0.8} disabled={uploading}>
                  <ImageIcon size={22} color={uploading ? '#555' : '#fff'} />
                  <Text style={[styles.emptyActionText, uploading && styles.emptyActionTextDisabled]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backBtnTop: { position: 'absolute', top: 16, left: 16, zIndex: 20, padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  permissionCard: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  permissionTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 16, marginBottom: 8 },
  permissionText: { fontSize: 14, color: '#8A8A9A', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  permissionBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 24, backgroundColor: theme.colors.accent },
  permissionBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  previewContainer: { flex: 1 },
  previewMedia: { width: SCREEN_W, height: SCREEN_H },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 15 },
  topBarBtn: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  errorBar: { position: 'absolute', top: 60, left: 16, right: 16, backgroundColor: 'rgba(255,59,138,0.15)', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,59,138,0.3)', zIndex: 30 },
  errorText: { color: '#FF3B8A', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
  filterRail: { position: 'absolute', bottom: 140, left: 0, right: 0, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 8, zIndex: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', marginRight: 6 },
  filterChipActive: { backgroundColor: 'rgba(255,59,138,0.25)', borderColor: '#FF3B8A' },
  filterChipIcon: { fontSize: 16, color: '#aaa', marginBottom: 2 },
  filterChipIconActive: { color: '#FF3B8A' },
  filterChipLabel: { fontSize: 11, fontWeight: '700', color: '#aaa' },
  filterChipLabelActive: { color: '#FF3B8A' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, zIndex: 12 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 20, paddingHorizontal: 8 },
  bottomIconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 26, backgroundColor: theme.colors.accent, gap: 8 },
  shareBtnDisabled: { opacity: 0.4 },
  shareBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  emptyContainer: { flex: 1, backgroundColor: '#070711' },
  emptyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,59,138,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#8A8A9A', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  emptyError: { fontSize: 13, color: '#FF3B8A', textAlign: 'center', marginBottom: 16 },
  emptyActions: { flexDirection: 'row', gap: 16 },
  emptyActionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10 },
  emptyActionText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  emptyActionTextDisabled: { color: '#555' },
  emptyLoadingText: { fontSize: 14, color: '#8A8A9A', marginTop: 16, textAlign: 'center' },
});

export default StoryComposer;
