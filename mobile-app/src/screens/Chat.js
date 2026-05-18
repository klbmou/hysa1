import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Modal,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft, Send, User, MoreVertical, Phone, Video,
  Shield, Trash2, VolumeX, MessageSquare,
  Flag, UserPlus, Image as ImageIcon, Palette, Info,
  Mic, MicOff, Play, Pause, X, Camera,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dmAPI, uploadAPI } from '../api/client';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio, InterruptionModeAndroid } from 'expo-av';
import * as haptics from '../utils/haptics';
import { displayUsername, nameTextStyle } from '../utils/display';
import theme from '../theme';

const CHAT_BG_KEY = 'chat_bg_';

const CHAT_THEMES = [
  { id: 'default', label: 'HYSA Default', gradient: ['#070711', '#120f24', '#070711'], bubbleMine: '#FF3B8A', bubbleTheir: 'rgba(255,255,255,0.15)', inputBg: 'rgba(7,7,17,0.94)', textMine: '#FFFFFF', textTheir: '#FFFFFF', radius: 20, inputRadius: 22, messageGap: 2, voiceTrack: 'rgba(255,255,255,0.22)', wallpaper: 'rgba(255,59,138,0.025)' },
  { id: 'neon-glass', label: 'Neon Glass', gradient: ['#05050b', '#180a1c', '#071018'], bubbleMine: 'rgba(255,59,138,0.86)', bubbleTheir: 'rgba(255,255,255,0.12)', inputBg: 'rgba(8,8,16,0.78)', textMine: '#FFFFFF', textTheir: '#FFFFFF', radius: 24, inputRadius: 26, messageGap: 4, voiceTrack: 'rgba(255,255,255,0.28)', wallpaper: 'rgba(92,203,227,0.035)' },
  { id: 'algeria', label: 'Algeria Green', gradient: ['#04130d', '#06351f', '#120b0b'], bubbleMine: '#0EA765', bubbleTheir: 'rgba(255,255,255,0.14)', inputBg: 'rgba(4,19,13,0.94)', textMine: '#FFFFFF', textTheir: '#FFFFFF', radius: 18, inputRadius: 20, messageGap: 3, voiceTrack: 'rgba(255,255,255,0.24)', wallpaper: 'rgba(14,167,101,0.04)' },
  { id: 'midnight-pro', label: 'Midnight Pro', gradient: ['#050508', '#111827', '#070711'], bubbleMine: '#4F46E5', bubbleTheir: 'rgba(255,255,255,0.1)', inputBg: 'rgba(8,10,18,0.96)', textMine: '#FFFFFF', textTheir: '#F4F7FF', radius: 12, inputRadius: 14, messageGap: 5, voiceTrack: 'rgba(148,163,184,0.3)', wallpaper: 'rgba(99,102,241,0.028)' },
  { id: 'love', label: 'Love Pink', gradient: ['#1b0712', '#361025', '#160913'], bubbleMine: '#FF4F76', bubbleTheir: 'rgba(255,79,118,0.16)', inputBg: 'rgba(27,7,18,0.94)', textMine: '#FFFFFF', textTheir: '#FFEFF3', radius: 26, inputRadius: 28, messageGap: 4, voiceTrack: 'rgba(255,255,255,0.28)', wallpaper: 'rgba(255,79,118,0.04)' },
  { id: 'gold', label: 'Gold Luxury', gradient: ['#100c06', '#2a1d08', '#070707'], bubbleMine: '#C8912B', bubbleTheir: 'rgba(255,213,122,0.14)', inputBg: 'rgba(20,14,7,0.95)', textMine: '#FFFFFF', textTheir: '#FFF7E5', radius: 16, inputRadius: 18, messageGap: 4, voiceTrack: 'rgba(255,213,122,0.28)', wallpaper: 'rgba(200,145,43,0.035)' },
  { id: 'minimal-black', label: 'Minimal Black', gradient: ['#030304', '#09090b', '#030304'], bubbleMine: '#F5F5F5', bubbleTheir: 'rgba(255,255,255,0.11)', inputBg: 'rgba(5,5,6,0.96)', textMine: '#050505', textTheir: '#FFFFFF', radius: 8, inputRadius: 12, messageGap: 6, voiceTrack: 'rgba(255,255,255,0.18)', wallpaper: 'rgba(255,255,255,0.015)' },
  { id: 'ocean-glow', label: 'Ocean Glow', gradient: ['#03121f', '#05314a', '#07101b'], bubbleMine: '#16A7E8', bubbleTheir: 'rgba(22,167,232,0.16)', inputBg: 'rgba(6,19,34,0.94)', textMine: '#FFFFFF', textTheir: '#EAF8FF', radius: 22, inputRadius: 24, messageGap: 3, voiceTrack: 'rgba(125,211,252,0.25)', wallpaper: 'rgba(22,167,232,0.04)' },
  { id: 'anime-soft', label: 'Anime Soft', gradient: ['#120916', '#2b1231', '#101827'], bubbleMine: '#F472B6', bubbleTheir: 'rgba(186,230,253,0.14)', inputBg: 'rgba(18,9,22,0.92)', textMine: '#FFFFFF', textTheir: '#FDF2F8', radius: 28, inputRadius: 24, messageGap: 4, voiceTrack: 'rgba(251,207,232,0.26)', wallpaper: 'rgba(244,114,182,0.045)' },
  { id: 'cyber-purple', label: 'Cyber Purple', gradient: ['#08020f', '#21113f', '#050914'], bubbleMine: '#8B5CF6', bubbleTheir: 'rgba(139,92,246,0.17)', inputBg: 'rgba(13,9,24,0.94)', textMine: '#FFFFFF', textTheir: '#F7F2FF', radius: 14, inputRadius: 20, messageGap: 3, voiceTrack: 'rgba(196,181,253,0.26)', wallpaper: 'rgba(139,92,246,0.045)' },
  { id: 'pink', label: 'Neon Pink', gradient: ['#190814', '#310a25', '#070711'], bubbleMine: '#FF2F92', bubbleTheir: 'rgba(255,47,146,0.16)', inputBg: 'rgba(25,8,20,0.94)', textMine: '#FFFFFF', textTheir: '#FFFFFF', radius: 22, inputRadius: 24, messageGap: 3, voiceTrack: 'rgba(255,255,255,0.24)', wallpaper: 'rgba(255,47,146,0.035)' },
  { id: 'purple', label: 'Midnight Purple', gradient: ['#0b0715', '#21113f', '#070711'], bubbleMine: '#8B5CF6', bubbleTheir: 'rgba(139,92,246,0.17)', inputBg: 'rgba(13,9,24,0.94)', textMine: '#FFFFFF', textTheir: '#F7F2FF', radius: 18, inputRadius: 22, messageGap: 3, voiceTrack: 'rgba(196,181,253,0.24)', wallpaper: 'rgba(139,92,246,0.035)' },
  { id: 'blue', label: 'Ocean Blue', gradient: ['#061322', '#062f47', '#07101b'], bubbleMine: '#16A7E8', bubbleTheir: 'rgba(22,167,232,0.16)', inputBg: 'rgba(6,19,34,0.94)', textMine: '#FFFFFF', textTheir: '#EAF8FF', radius: 20, inputRadius: 22, messageGap: 3, voiceTrack: 'rgba(125,211,252,0.24)', wallpaper: 'rgba(22,167,232,0.035)' },
  { id: 'emerald', label: 'Emerald', gradient: ['#041411', '#063729', '#06100d'], bubbleMine: '#10B981', bubbleTheir: 'rgba(16,185,129,0.16)', inputBg: 'rgba(4,20,17,0.94)', textMine: '#FFFFFF', textTheir: '#E9FFF7', radius: 18, inputRadius: 20, messageGap: 3, voiceTrack: 'rgba(167,243,208,0.24)', wallpaper: 'rgba(16,185,129,0.035)' },
  { id: 'sunset', label: 'Sunset', gradient: ['#1b0a16', '#3a1515', '#241006'], bubbleMine: '#FF6B4A', bubbleTheir: 'rgba(255,186,73,0.16)', inputBg: 'rgba(27,10,22,0.94)', textMine: '#FFFFFF', textTheir: '#FFF2E7', radius: 20, inputRadius: 22, messageGap: 3, voiceTrack: 'rgba(255,186,73,0.24)', wallpaper: 'rgba(255,107,74,0.035)' },
  { id: 'glass', label: 'Glass Black', gradient: ['#050509', '#14141d', '#070711'], bubbleMine: 'rgba(255,255,255,0.24)', bubbleTheir: 'rgba(255,255,255,0.1)', inputBg: 'rgba(7,7,12,0.9)', textMine: '#FFFFFF', textTheir: '#FFFFFF', radius: 22, inputRadius: 26, messageGap: 4, voiceTrack: 'rgba(255,255,255,0.2)', wallpaper: 'rgba(255,255,255,0.02)' },
];

const SCREEN_W = Dimensions.get('window').width;
const MIN_RECORDING_MS = 900;

const VOICE_RECORDING_OPTIONS = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 96000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 96000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 96000,
  },
};

const Chat = ({ navigation, route }) => {
  const userKey = route.params?.userKey || '';
  const username = route.params?.username || 'User';
  const displayPeerName = displayUsername(username);
  const avatar = route.params?.avatar || null;
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [chatTheme, setChatTheme] = useState('default');
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordingError, setRecordingError] = useState('');
  const [playingAudio, setPlayingAudio] = useState(null);
  const [audioProgress, setAudioProgress] = useState({});
  const [mediaErrors, setMediaErrors] = useState({});
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerActiveNow, setPeerActiveNow] = useState(false);
  const [peerLastActiveAt, setPeerLastActiveAt] = useState('');
  const flatListRef = useRef(null);
  const recordingRef = useRef(null);
  const recordTimerRef = useRef(null);
  const recordDurationRef = useRef(0);
  const recordStartedAtRef = useRef(0);
  const recordingPreparedRef = useRef(false);
  const stoppingRecordingRef = useRef(false);
  const soundRef = useRef(null);
  const activeSoundIdRef = useRef(null);
  const playbackRequestRef = useRef(false);
  const mountedRef = useRef(true);
  const isNearBottomRef = useRef(true);
  const shouldAutoScrollRef = useRef(true);
  const lastMessageSignatureRef = useRef('');
  const typingIdleTimerRef = useRef(null);
  const lastTypingSentAtRef = useRef(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(400)).current;
  const micAnim = useRef(new Animated.Value(1)).current;
  const micLoopRef = useRef(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    loadChatTheme();
  }, [userKey]);

  const loadChatTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem(`${CHAT_BG_KEY}${userKey}`);
      if (saved) setChatTheme(saved);
    } catch (e) {}
  };

  const saveChatTheme = async (id) => {
    setChatTheme(id);
    try {
      await AsyncStorage.setItem(`${CHAT_BG_KEY}${userKey}`, id);
    } catch (e) {}
  };

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      if (recordingRef.current) {
        const recording = recordingRef.current;
        recordingRef.current = null;
        stopAndUnloadRecording(recording).catch(() => {});
      }
      if (soundRef.current) {
        const sound = soundRef.current;
        soundRef.current = null;
        sound.setOnPlaybackStatusUpdate(null);
        sound.unloadAsync().catch(() => {});
      }
      if (micLoopRef.current) {
        micLoopRef.current.stop();
        micLoopRef.current = null;
      }
      if (typingIdleTimerRef.current) {
        clearTimeout(typingIdleTimerRef.current);
        typingIdleTimerRef.current = null;
      }
    };
  }, []);

  const resetRecordingState = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (micLoopRef.current) {
      micLoopRef.current.stop();
      micLoopRef.current = null;
    }
    recordingRef.current = null;
    recordDurationRef.current = 0;
    recordStartedAtRef.current = 0;
    recordingPreparedRef.current = false;
    stoppingRecordingRef.current = false;
    if (mountedRef.current) {
      setRecording(false);
      setRecordDuration(0);
    }
    micAnim.setValue(1);
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const restorePlaybackAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (e) {}
  };

  const showRecordingError = (message) => {
    if (!mountedRef.current) return;
    setRecordingError(message);
    setTimeout(() => {
      if (mountedRef.current) setRecordingError('');
    }, 3200);
  };

  const stopAndUnloadRecording = async (recordingInstance) => {
    if (!recordingInstance || typeof recordingInstance.stopAndUnloadAsync !== 'function') {
      throw new TypeError('Audio recording instance is missing stopAndUnloadAsync.');
    }
    await recordingInstance.stopAndUnloadAsync();
  };

  const stopActiveSound = async ({ resetProgressId = null, updateState = true } = {}) => {
    const sound = soundRef.current;
    soundRef.current = null;
    activeSoundIdRef.current = null;
    playbackRequestRef.current = false;
    if (updateState && mountedRef.current) {
      setPlayingAudio(null);
      if (resetProgressId) {
        setAudioProgress((prev) => ({ ...prev, [resetProgressId]: 0 }));
      }
    }
    if (sound) {
      sound.setOnPlaybackStatusUpdate(null);
      try {
        await sound.stopAsync();
      } catch (e) {}
      try {
        await sound.unloadAsync();
      } catch (e) {}
    }
  };

  const asList = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value.filter(Boolean) : [value];
  };

  const stringField = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  };

  const firstString = (...values) => {
    for (const value of values) {
      if (value === null || value === undefined) continue;
      const direct = stringField(value);
      if (direct) return direct;
      if (Array.isArray(value)) {
        const parts = value.map((entry) => stringField(entry) || firstString(entry)).filter(Boolean);
        if (parts.length) return parts.join(' ');
      }
      if (typeof value === 'object') {
        const nested = firstString(value.text, value.body, value.content, value.message, value.caption, value.value);
        if (nested) return nested;
      }
    }
    return '';
  };

  const normalizeType = (value) => String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');

  const looksLikeAudioUrl = (url) => /\.(m4a|mp3|aac|wav|ogg|oga|webm)(\?|#|$)/i.test(String(url || ''));
  const looksLikeImageUrl = (url) => /\.(jpe?g|png|gif|webp|heic|heif)(\?|#|$)/i.test(String(url || ''));
  const looksLikeVideoUrl = (url) => /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(String(url || ''));

  const getMessageText = (message) => firstString(
    message?.text,
    message?.body,
    message?.content,
    message?.message,
    message?.caption
  );

  const getUrlFrom = (value) => firstString(
    value?.fullUrl,
    value?.url,
    value?.mediaUrl,
    value?.audioUrl,
    value?.fileUrl,
    value?.attachmentUrl,
    value?.secure_url,
    value?.src,
    value?.uri
  );

  const getMediaItems = (message) => {
    const items = [
      ...asList(message?.media),
      ...asList(message?.attachment),
      ...asList(message?.attachments),
      ...asList(message?.file),
      ...asList(message?.files),
    ];
    const directUrl = getUrlFrom(message);
    if (directUrl) items.unshift({ ...message, url: directUrl });
    return items;
  };

  const getMediaKind = (item, message) => {
    const kind = normalizeType(item?.kind || item?.type || message?.type || message?.messageType || message?.mediaType);
    const mime = normalizeType(item?.mime || item?.mimeType || message?.mime || message?.mimeType);
    const url = getUrlFrom(item) || getUrlFrom(message);
    if (['voice', 'audio', 'voice_message'].includes(kind)) return 'audio';
    if (kind === 'media' && (mime.startsWith('audio/') || looksLikeAudioUrl(url))) return 'audio';
    if (kind === 'image' || mime.startsWith('image/') || looksLikeImageUrl(url)) return 'image';
    if (kind === 'video' || mime.startsWith('video/') || looksLikeVideoUrl(url)) return 'video';
    if (mime.startsWith('audio/') || looksLikeAudioUrl(url)) return 'audio';
    return kind;
  };

  const getMessageMedia = (message) => {
    const items = getMediaItems(message);
    const audio = items.find((item) => getMediaKind(item, message) === 'audio' && getUrlFrom(item));
    const video = items.find((item) => getMediaKind(item, message) === 'video' && getUrlFrom(item));
    const image = items.find((item) => getMediaKind(item, message) === 'image' && getUrlFrom(item));
    const fallback = items.find((item) => getUrlFrom(item));
    const type = normalizeType(message?.type || message?.messageType || message?.mediaType);
    const selected = audio || video || image || fallback || null;
    const kind = selected ? getMediaKind(selected, message) : (['voice', 'audio', 'voice_message'].includes(type) ? 'audio' : type);
    return {
      item: selected,
      kind,
      url: selected ? getUrlFrom(selected) : getUrlFrom(message),
    };
  };

  const getMessageDuration = (message, mediaItem) => {
    const value = Number(
      mediaItem?.duration ??
      mediaItem?.durationSeconds ??
      message?.duration ??
      message?.durationSeconds ??
      0
    );
    const ms = Number(mediaItem?.durationMs ?? message?.durationMs ?? 0);
    if (Number.isFinite(value) && value > 0) return value > 1000 ? Math.round(value / 1000) : Math.round(value);
    if (Number.isFinite(ms) && ms > 0) return Math.round(ms / 1000);
    return 0;
  };

  const normalizeMessage = (message, index = 0) => {
    const text = getMessageText(message);
    return {
      ...(message || {}),
      id: getMessageId(message, index),
      text,
      normalizedText: text,
      _textMeta: {
        id: getMessageId(message, index),
        textLength: stringField(message?.text).length,
        normalizedTextLength: text.length,
        fieldsPresent: ['text', 'body', 'content', 'message', 'caption']
          .filter((field) => message && message[field] !== undefined),
      },
    };
  };

  const getMessageId = (message, index = 0) => String(
    message?.id ||
    message?._id ||
    `${message?.from || message?.senderId || 'msg'}-${message?.createdAt || index}`
  );

  const isMessageMine = (message) => message?.mine === true || message?.isMine === true || message?.sender === 'me';

  const messageSignature = (list) => (Array.isArray(list) ? list : [])
    .map((message, index) => `${getMessageId(message, index)}|${message?.createdAt || ''}|${getMessageText(message)}|${getMessageMedia(message).url || ''}`)
    .join('~');

  const dedupeMessages = (list) => {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).map(normalizeMessage).filter((message, index) => {
      const id = getMessageId(message, index);
      const sig = id || `${message?.from || ''}|${message?.to || ''}|${message?.createdAt || ''}|${getMessageText(message)}|${getMessageMedia(message).url || ''}`;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  };

  const isCanceled = (result) => result.canceled || result.cancelled;

  const pickMedia = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Access to photos is needed to send media.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: false,
        quality: 0.85,
        videoMaxDuration: 60,
      });
      if (!isCanceled(result) && result.assets?.length && result.assets[0]?.uri) {
        setMediaPreview(result.assets[0]);
      }
    } catch (err) {
      console.error('Media pick error:', err);
      Alert.alert('Error', 'Failed to pick media.');
    }
  };

  const uploadMediaMessage = async () => {
    if (!mediaPreview || mediaUploading) return;
    setMediaUploading(true);
    try {
      const mime = mediaPreview.mimeType || (mediaPreview.uri.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
      const b64 = await FileSystem.readAsStringAsync(mediaPreview.uri, { encoding: 'base64' });
      const dataUrl = `data:${mime};base64,${b64}`;
      const response = await uploadAPI.uploadMedia(dataUrl);
      if (response.data.ok) {
        const media = response.data.media;
        const msgType = media.kind === 'video' ? 'video' : 'image';
        sendTypingState(false);
        await dmAPI.sendMessage(userKey, text.trim(), { media: [media], type: msgType });
        setMediaPreview(null);
        setText('');
        fetchMessages({ forceScroll: true });
      } else {
        Alert.alert('Upload failed', response.data.error || 'Could not upload media.');
      }
    } catch (err) {
      console.error('Media upload error:', err);
      Alert.alert('Error', 'Failed to send media. Please try again.');
    } finally {
      setMediaUploading(false);
    }
  };

  const cancelMediaPreview = () => {
    setMediaPreview(null);
  };

  const startRecording = async () => {
    if (recording || recordingRef.current || stoppingRecordingRef.current) return;
    try {
      await stopActiveSound();
      await Audio.setIsEnabledAsync(true);
      const currentPermission = await Audio.getPermissionsAsync();
      const permission = currentPermission.status === 'granted'
        ? currentPermission
        : await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        resetRecordingState();
        showRecordingError('Microphone permission is needed to send voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      const { recording: newRecording } = await Audio.Recording.createAsync(
        VOICE_RECORDING_OPTIONS,
        (status) => {
          if (!mountedRef.current || !status?.isRecording) return;
          const seconds = Math.floor((status.durationMillis || 0) / 1000);
          recordDurationRef.current = seconds;
          setRecordDuration(seconds);
        },
        500
      );
      recordingRef.current = newRecording;
      recordingPreparedRef.current = true;
      recordStartedAtRef.current = Date.now();
      setRecordingError('');
      setRecording(true);
      setRecordDuration(0);
      recordDurationRef.current = 0;
      recordTimerRef.current = setInterval(() => {
        recordDurationRef.current += 1;
        if (mountedRef.current) {
          setRecordDuration(recordDurationRef.current);
        }
        if (recordDurationRef.current >= 60) {
          if (!stoppingRecordingRef.current) {
            stopRecording();
          }
        }
      }, 1000);
      micLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(micAnim, { toValue: 1.3, duration: 400, useNativeDriver: true }),
          Animated.timing(micAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      );
      micLoopRef.current.start();
    } catch (err) {
      console.error('Start recording error:', err);
      const failedRecording = recordingRef.current;
      resetRecordingState();
      if (failedRecording) {
        try {
          await stopAndUnloadRecording(failedRecording);
        } catch (e) {}
      }
      await restorePlaybackAudioMode();
      showRecordingError('HYSA could not start the microphone. Check permission and try again.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current || stoppingRecordingRef.current || !recordingPreparedRef.current) return;
    stoppingRecordingRef.current = true;
    const recording = recordingRef.current;
    try {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      if (micLoopRef.current) {
        micLoopRef.current.stop();
        micLoopRef.current = null;
      }
      recordingRef.current = null;
      const elapsed = Date.now() - recordStartedAtRef.current;
      if (elapsed < MIN_RECORDING_MS) {
        await wait(MIN_RECORDING_MS - elapsed);
      }
      const finalStatus = await recording.getStatusAsync().catch(() => null);
      if (!finalStatus || (!finalStatus.canRecord && !finalStatus.isRecording)) {
        throw new Error('Recording was not ready to stop.');
      }
      try {
        await stopAndUnloadRecording(recording);
      } catch (stopErr) {
        const message = String(stopErr?.message || stopErr || '');
        if (message.includes('E_AUDIO_NODATA') || message.includes('no valid audio data')) {
          throw new Error('Recording was too short to save audio data.');
        }
        throw stopErr;
      }
      const uri = recording.getURI();
      if (!uri) {
        throw new Error('Recording stopped without an audio URI.');
      }
      const info = await FileSystem.getInfoAsync(uri).catch(() => null);
      if (!info?.exists || !info?.size) {
        throw new Error('Recording file is missing or empty.');
      }
      const finalDuration = Math.max(1, recordDurationRef.current, Math.ceil((finalStatus?.durationMillis || elapsed) / 1000));
      if (mountedRef.current) setRecording(false);
      micAnim.setValue(1);
      await restorePlaybackAudioMode();
      setMediaPreview({ uri, type: 'audio', duration: finalDuration, mimeType: 'audio/mp4' });
      if (mountedRef.current) setRecordDuration(finalDuration);
      recordDurationRef.current = 0;
      recordStartedAtRef.current = 0;
      recordingPreparedRef.current = false;
      stoppingRecordingRef.current = false;
    } catch (err) {
      console.error('Stop recording error:', {
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
      });
      if (recordingRef.current === recording) recordingRef.current = null;
      resetRecordingState();
      await restorePlaybackAudioMode();
      showRecordingError('Could not finish the voice message. Please try again.');
    }
  };

  const cancelRecording = () => {
    if (stoppingRecordingRef.current) return;
    stoppingRecordingRef.current = true;
    if (recordingRef.current) {
      stopAndUnloadRecording(recordingRef.current).catch(() => {});
      recordingRef.current = null;
    }
    clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    if (micLoopRef.current) {
      micLoopRef.current.stop();
      micLoopRef.current = null;
    }
    setRecording(false);
    setRecordDuration(0);
    recordDurationRef.current = 0;
    recordStartedAtRef.current = 0;
    recordingPreparedRef.current = false;
    stoppingRecordingRef.current = false;
    micAnim.setValue(1);
    restorePlaybackAudioMode();
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopActiveSound();
        if (recordingRef.current) {
          const recordingToStop = recordingRef.current;
          recordingRef.current = null;
          stopAndUnloadRecording(recordingToStop).catch(() => {});
        }
        resetRecordingState();
        restorePlaybackAudioMode();
      };
    }, [])
  );

  const sendVoiceMessage = async () => {
    if (!mediaPreview || mediaPreview.type !== 'audio' || mediaUploading) return;
    setMediaUploading(true);
    try {
      if (!mediaPreview.uri) {
        throw new Error('Voice message is missing an audio URI.');
      }
      const info = await FileSystem.getInfoAsync(mediaPreview.uri).catch(() => null);
      if (!info?.exists || !info?.size) {
        throw new Error('Voice message file is missing or empty.');
      }
      const b64 = await FileSystem.readAsStringAsync(mediaPreview.uri, { encoding: 'base64' });
      const dataUrl = `data:${mediaPreview.mimeType || 'audio/mp4'};base64,${b64}`;
      const response = await uploadAPI.uploadMedia(dataUrl);
      if (response.data.ok) {
        sendTypingState(false);
        await dmAPI.sendMessage(userKey, '', { media: [response.data.media], type: 'voice' });
        setMediaPreview(null);
        fetchMessages({ forceScroll: true });
      } else {
        showRecordingError(response.data.error || 'Could not upload voice message.');
      }
    } catch (err) {
      console.error('Voice upload error:', {
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
      });
      showRecordingError('Failed to send voice message. Please try again.');
    } finally {
      setMediaUploading(false);
    }
  };

  const playAudio = async (uri, msgId) => {
    if (!uri || playbackRequestRef.current) return;
    if (activeSoundIdRef.current === msgId) {
      await stopActiveSound({ resetProgressId: msgId });
      return;
    }
    playbackRequestRef.current = true;
    try {
      await stopActiveSound();
      playbackRequestRef.current = true;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, progressUpdateIntervalMillis: 180 }
      );
      soundRef.current = sound;
      activeSoundIdRef.current = msgId;
      if (mountedRef.current) {
        setPlayingAudio(msgId);
      }
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!mountedRef.current || activeSoundIdRef.current !== msgId) return;
        if (status.isLoaded) {
          setAudioProgress((prev) => ({ ...prev, [msgId]: status.durationMillis > 0 ? status.positionMillis / status.durationMillis : 0 }));
          if (status.didJustFinish) {
            stopActiveSound({ resetProgressId: msgId });
          }
        }
      });
      await sound.playAsync();
    } catch (err) {
      console.error('Audio play error:', err);
      await stopActiveSound({ resetProgressId: msgId });
    } finally {
      playbackRequestRef.current = false;
    }
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const fetchMessages = async ({ silent = false, forceScroll = false } = {}) => {
    try {
      const response = await dmAPI.getConversation(userKey);
      if (response.data.ok) {
        setPeerTyping(!!response.data.typing);
        setPeerActiveNow(!!response.data.peerActiveNow || !!response.data.peer?.activeNow);
        setPeerLastActiveAt(response.data.peerLastActiveAt || response.data.peer?.lastActiveAt || '');
        const nextMessages = dedupeMessages(response.data.messages || []);
        const sample = nextMessages.find((message) => !isMessageMine(message) && getMessageText(message));
        if (sample) {
          console.log('[dm:mobile:message-meta]', sample._textMeta);
        }
        const nextSignature = messageSignature(nextMessages);
        const previousSignature = lastMessageSignatureRef.current;
        if (nextSignature !== previousSignature) {
          const lastMessage = nextMessages[nextMessages.length - 1];
          shouldAutoScrollRef.current = forceScroll || !previousSignature || isNearBottomRef.current || isMessageMine(lastMessage);
          lastMessageSignatureRef.current = nextSignature;
          setMessages(nextMessages);
        }
      }
    } catch (err) {
      if (!silent) console.error('Chat fetch error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const sendTypingState = useCallback((typing) => {
    if (!userKey) return;
    dmAPI.setTyping(userKey, typing).catch(() => {});
  }, [userKey]);

  const handleTextChange = (value) => {
    setText(value);
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    const hasText = !!value.trim();
    if (!hasText) {
      lastTypingSentAtRef.current = 0;
      sendTypingState(false);
      return;
    }
    const now = Date.now();
    if (now - lastTypingSentAtRef.current > 2500) {
      lastTypingSentAtRef.current = now;
      sendTypingState(true);
    }
    typingIdleTimerRef.current = setTimeout(() => {
      lastTypingSentAtRef.current = 0;
      sendTypingState(false);
    }, 4500);
  };

  useFocusEffect(
    useCallback(() => {
      fetchMessages({ silent: true, forceScroll: true });
      const timer = setInterval(() => {
        fetchMessages({ silent: true });
      }, 4000);
      return () => {
        clearInterval(timer);
        if (typingIdleTimerRef.current) {
          clearTimeout(typingIdleTimerRef.current);
          typingIdleTimerRef.current = null;
        }
        lastTypingSentAtRef.current = 0;
        sendTypingState(false);
      };
    }, [userKey, sendTypingState])
  );

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    haptics.light();
    try {
      sendTypingState(false);
      const response = await dmAPI.sendMessage(userKey, text.trim());
      if (response.data.ok) {
        setText('');
        fetchMessages({ forceScroll: true });
      }
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSendWithMedia = async () => {
    if (!text.trim() || !mediaPreview || sending || mediaUploading) return;
    setMediaUploading(true);
    try {
      const mime = mediaPreview.mimeType || (mediaPreview.uri.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
      const b64 = await FileSystem.readAsStringAsync(mediaPreview.uri, { encoding: 'base64' });
      const dataUrl = `data:${mime};base64,${b64}`;
      const response = await uploadAPI.uploadMedia(dataUrl);
      if (response.data.ok) {
        const media = response.data.media;
        sendTypingState(false);
        await dmAPI.sendMessage(userKey, text.trim(), { media: [media], type: media.kind === 'video' ? 'video' : 'image' });
        setMediaPreview(null);
        setText('');
        fetchMessages({ forceScroll: true });
      } else {
        Alert.alert('Upload failed', response.data.error || 'Could not upload media.');
      }
    } catch (err) {
      console.error('Send with media error:', err);
      Alert.alert('Error', 'Failed to send media message.');
    } finally {
      setMediaUploading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatMsgDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const openOptions = () => {
    haptics.light();
    setOptionsOpen(true);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 10 }).start();
  };

  const closeOptions = () => {
    Animated.timing(sheetAnim, { toValue: 400, duration: 250, useNativeDriver: true }).start(() => {
      setOptionsOpen(false);
    });
  };

  const openThemePicker = () => {
    closeOptions();
    setTimeout(() => {
      setThemeOpen(true);
    }, 300);
  };

  const handleVoiceCall = () => {
    haptics.light();
    navigation.navigate('CallScreen', { username: displayPeerName, avatar, callType: 'voice' });
  };

  const handleVideoCall = () => {
    haptics.light();
    navigation.navigate('CallScreen', { username: displayPeerName, avatar, callType: 'video' });
  };

  const handleViewProfile = () => {
    closeOptions();
    navigation.navigate('UserProfile', { userKey });
  };

  const handleMute = () => {
    haptics.light();
    Alert.alert('Mute conversation', 'Notifications will be muted for this chat.');
    closeOptions();
  };

  const handleBlock = () => {
    closeOptions();
    setTimeout(() => {
      Alert.alert('Block User', `Are you sure you want to block @${displayPeerName}? They won't be able to contact you.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            haptics.error();
            Alert.alert('Beta feature', 'User blocking is being tested.');
          },
        },
      ]);
    }, 300);
  };

  const handleReport = () => {
    closeOptions();
    setTimeout(() => {
      Alert.alert('Report User', 'Report this conversation for inappropriate behavior?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            haptics.success();
            Alert.alert('Reported', 'Your report has been submitted. We will review it shortly.');
          },
        },
      ]);
    }, 300);
  };

  const handleDeleteConversation = () => {
    closeOptions();
    setTimeout(() => {
      Alert.alert('Delete conversation', 'This will permanently delete all messages. This action cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            haptics.error();
            Alert.alert('Beta feature', 'Deleting conversations is being tested.');
          },
        },
      ]);
    }, 300);
  };

  const handleSharedMedia = () => {
    closeOptions();
    setTimeout(() => {
      Alert.alert('Beta feature', 'Shared media gallery is being tested.');
    }, 300);
  };

  const handleClearChat = () => {
    closeOptions();
    setTimeout(() => {
      Alert.alert('Clear chat', 'Remove all messages from this conversation?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Beta feature', 'Clearing chat is being tested.');
          },
        },
      ]);
    }, 300);
  };

  const handleNickname = () => {
    closeOptions();
    setTimeout(() => {
      Alert.alert('Beta feature', 'Custom nicknames are being tested.');
    }, 300);
  };

  const renderDateSeparator = (date) => (
    <View style={styles.dateSeparator}>
      <View style={styles.dateLine} />
      <Text style={styles.dateText}>{formatMsgDate(date)}</Text>
      <View style={styles.dateLine} />
    </View>
  );

  const renderMessage = ({ item, index }) => {
    const isMine = isMessageMine(item);
    const isLastMessage = index === messages.length - 1;
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const isContinuation = prevMsg && isMessageMine(prevMsg) === isMine;
    const senderId = item.senderId || item.from || item.senderKey || item.sender?.id;
    const prevSenderId = prevMsg?.senderId || prevMsg?.from || prevMsg?.senderKey || prevMsg?.sender?.id;
    const showAvatar = !isMine && (!prevMsg || isMessageMine(prevMsg) || prevSenderId !== senderId);
    const displayText = item.normalizedText || getMessageText(item);
    const media = getMessageMedia(item);
    const isVoice = media.kind === 'audio';
    const isMedia = media.kind === 'image' || media.kind === 'video';
    const mediaUrl = media.url;
    const messageId = getMessageId(item, index);
    const progress = audioProgress[messageId] || 0;
    const duration = getMessageDuration(item, media.item);

    return (
      <View style={[
        styles.msgRow,
        isMine ? styles.msgRowMine : styles.msgRowTheir,
        { marginBottom: currentTheme.messageGap ?? 2 },
      ]}>
        {!isMine && (
          <View style={[styles.msgAvatarCol, !showAvatar && styles.msgAvatarHidden]}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.msgAvatar} />
            ) : (
              <View style={styles.msgAvatarPlaceholder}>
                <User size={14} color={theme.colors.textMuted} />
              </View>
            )}
          </View>
        )}
        <View style={[
          styles.msgBubbleWrap,
          isMine ? styles.msgBubbleWrapMine : styles.msgBubbleWrapTheir,
        ]}>
          <View style={[
            styles.msgBubble,
            { borderRadius: currentTheme.radius ?? 20 },
            isMine ? [styles.msgBubbleMine, { backgroundColor: currentTheme.bubbleMine }] : [styles.msgBubbleTheir, { backgroundColor: currentTheme.bubbleTheir }],
            isContinuation && isMine && styles.msgBubbleMineCont,
            isContinuation && !isMine && styles.msgBubbleTheirCont,
            isMedia && mediaUrl && styles.msgBubbleMedia,
            isVoice && styles.msgBubbleVoice,
          ]}>
            {isMedia && mediaUrl ? (
              <View>
                <Image source={{ uri: mediaUrl }} style={styles.msgMediaImage} resizeMode="cover" />
                {displayText ? (
                  <Text style={[styles.msgText, { color: isMine ? currentTheme.textMine : currentTheme.textTheir }, isMine && styles.msgTextMine, styles.msgMediaText]}>
                    {displayText}
                  </Text>
                ) : null}
              </View>
            ) : isVoice ? (
              <TouchableOpacity
                style={[styles.voiceBubble, isMine ? styles.voiceBubbleMine : styles.voiceBubbleTheir, !mediaUrl && styles.voiceBubbleUnavailable]}
                onPress={() => mediaUrl ? playAudio(mediaUrl, messageId) : null}
                disabled={!mediaUrl}
                activeOpacity={0.7}
              >
                <View style={styles.voiceIconWrap}>
                  {playingAudio === messageId ? (
                    <Pause size={18} color="#fff" />
                  ) : (
                    <Play size={18} color="#fff" />
                  )}
                </View>
                <View style={[styles.voiceProgressTrack, { backgroundColor: currentTheme.voiceTrack || 'rgba(255,255,255,0.22)' }]}>
                  <View style={[styles.voiceProgressFill, { width: `${progress * 100}%`, backgroundColor: isMine ? (currentTheme.textMine === '#050505' ? '#050505' : '#fff') : theme.colors.accent }]} />
                </View>
                <Text style={[styles.voiceDuration, isMine && styles.voiceDurationMine]}>
                  {mediaUrl ? formatDuration(duration) : '--:--'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.msgText, { color: isMine ? currentTheme.textMine : currentTheme.textTheir }, isMine && styles.msgTextMine]}>
                {displayText || 'Message unavailable'}
              </Text>
            )}
          </View>
          {!isContinuation && (
            <Text style={[
              styles.msgTime,
              isMine ? styles.msgTimeMine : styles.msgTimeTheir,
            ]}>
              {formatTime(item.createdAt)}
            </Text>
          )}
          {isMine && isLastMessage ? (
            <Text style={styles.msgSeen}>{item.seen ? 'Seen' : 'Delivered'}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  const renderMessagesWithDates = () => {
    if (messages.length === 0) return null;

    const items = [];
    let currentDate = null;

    messages.forEach((msg, index) => {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        items.push({ type: 'date', date: msg.createdAt, key: `date-${index}` });
      }
      items.push({ type: 'message', item: msg, key: `msg-${getMessageId(msg, index)}-${index}`, msgIndex: index });
    });

    return (
      <FlatList
        ref={flatListRef}
        data={items}
        renderItem={({ item }) => item.type === 'date'
          ? renderDateSeparator(item.date)
          : renderMessage({ item: item.item, index: item.msgIndex })
        }
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.msgList}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          isNearBottomRef.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - 96;
        }}
        scrollEventThrottle={120}
        onContentSizeChange={() => {
          if (shouldAutoScrollRef.current) {
            flatListRef.current?.scrollToEnd({ animated: true });
            shouldAutoScrollRef.current = false;
          }
        }}
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  const currentTheme = CHAT_THEMES.find(t => t.id === chatTheme) || CHAT_THEMES[0];
  const hasMediaPreview = !!mediaPreview;
  const isBusySending = !!(sending || mediaUploading);
  const canFinishRecording = !!(recordingPreparedRef.current && !stoppingRecordingRef.current);
  const lastActiveMs = peerLastActiveAt ? Date.now() - new Date(peerLastActiveAt).getTime() : 0;
  const headerStatusText = peerTyping
    ? 'typing...'
    : (peerActiveNow ? 'Active now' : (lastActiveMs > 0 && lastActiveMs < 5 * 60000 ? 'Active recently' : 'Tap for profile'));

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#070711', paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <LinearGradient colors={currentTheme.gradient} style={styles.container}>
      <View style={[styles.chatWallpaper, { backgroundColor: currentTheme.wallpaper || 'transparent' }]} pointerEvents="none" />
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <Animated.View style={[styles.header, { opacity: fadeAnim, paddingTop: insets.top + 12, backgroundColor: currentTheme.inputBg }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerUser}
            activeOpacity={0.7}
            onPress={handleViewProfile}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          >
            {avatar ? (
              <View style={styles.headerAvatarWrap}>
                <Image source={{ uri: avatar }} style={styles.headerAvatarImg} />
                {peerActiveNow ? <View style={styles.headerActiveDot} /> : null}
              </View>
            ) : (
              <View style={styles.headerAvatarWrap}>
                <View style={styles.headerAvatar}>
                  <User size={16} color={theme.colors.textMuted} />
                </View>
                {peerActiveNow ? <View style={styles.headerActiveDot} /> : null}
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={[styles.headerTitle, nameTextStyle(displayPeerName)]} numberOfLines={1}>{displayPeerName}</Text>
              <Text style={[styles.headerStatus, (peerTyping || peerActiveNow) && styles.headerStatusLive]}>{headerStatusText}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleVoiceCall} activeOpacity={0.7}>
              <Phone size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleVideoCall} activeOpacity={0.7}>
              <Video size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={openOptions} activeOpacity={0.7}>
              <MoreVertical size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {messages.length === 0 ? (
          <View style={styles.emptyChat}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.emptyAvatarImg} />
            ) : (
              <View style={styles.emptyAvatarCircle}>
                <User size={32} color="#8A8A9A" />
              </View>
            )}
            <Text style={[styles.emptyName, nameTextStyle(displayPeerName, 'center')]}>{displayPeerName}</Text>
            <Text style={styles.emptyText}>Say hello! Start the conversation.</Text>
          </View>
        ) : (
          renderMessagesWithDates()
        )}

        {mediaPreview && (
          <View style={[styles.mediaPreviewBar, { backgroundColor: currentTheme.inputBg }]}>
            {mediaPreview.type === 'audio' ? (
              <View style={styles.audioPreview}>
                <Animated.View style={{ transform: [{ scale: micAnim }] }}>
                  <Mic size={20} color={theme.colors.accent} />
                </Animated.View>
                <Text style={styles.audioPreviewText}>Voice message ({formatDuration(mediaPreview.duration || recordDuration)})</Text>
                <TouchableOpacity style={styles.mediaPreviewCancel} onPress={cancelMediaPreview} activeOpacity={0.7}>
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <Image source={{ uri: mediaPreview.uri }} style={styles.mediaPreviewThumb} />
            )}
            <TouchableOpacity style={styles.mediaPreviewClose} onPress={cancelMediaPreview} activeOpacity={0.7}>
              <X size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {recordingError ? (
          <View style={styles.recordingErrorBar}>
            <Text style={styles.recordingErrorText}>{recordingError}</Text>
          </View>
        ) : null}
        {peerTyping ? (
          <View style={styles.typingInline}>
            <Text style={styles.typingInlineText}>typing...</Text>
          </View>
        ) : null}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: currentTheme.inputBg, borderTopLeftRadius: currentTheme.inputRadius || 0, borderTopRightRadius: currentTheme.inputRadius || 0 }]}>
          {recording ? (
            <View style={styles.recordingBar}>
              <Animated.View style={{ transform: [{ scale: micAnim }] }}>
                <Mic size={20} color="#FF3B8A" />
              </Animated.View>
              <Text style={styles.recordingText}>{formatDuration(recordDuration)}</Text>
              <TouchableOpacity style={styles.recordingCancel} onPress={cancelRecording} activeOpacity={0.7}>
                <Text style={styles.recordingCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.recordingSend, !canFinishRecording && styles.recordingSendDisabled]}
                onPress={stopRecording}
                disabled={!canFinishRecording}
                activeOpacity={0.7}
              >
                <Text style={styles.recordingSendText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.attachBtn} onPress={recording ? null : pickMedia} activeOpacity={0.7} disabled={!!(hasMediaPreview || mediaUploading)}>
                <ImageIcon size={20} color={(hasMediaPreview || mediaUploading) ? '#555' : '#8A8A9A'} />
              </TouchableOpacity>
              <TextInput
                style={[styles.input, mediaPreview && styles.inputWithMedia]}
                selectionColor={currentTheme.bubbleMine}
                placeholder="Message..."
                placeholderTextColor={theme.colors.textMuted}
                value={text}
                onChangeText={handleTextChange}
                onKeyPress={handleKeyPress}
                multiline
                maxLength={600}
                returnKeyType="send"
              />
              {text.trim() || hasMediaPreview ? (
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: currentTheme.bubbleMine }, isBusySending && styles.sendBtnDisabled]}
                  onPress={() => {
                    if (mediaPreview && mediaPreview.type === 'audio') {
                      sendVoiceMessage();
                    } else if (mediaPreview && text.trim()) {
                      handleSendWithMedia();
                    } else if (mediaPreview) {
                      uploadMediaMessage();
                    } else {
                      handleSend();
                    }
                  }}
                  disabled={isBusySending}
                  activeOpacity={0.7}
                >
                  {isBusySending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Send size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.micBtn, { backgroundColor: currentTheme.bubbleMine }]} onPress={startRecording} activeOpacity={0.7}>
                  <Mic size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={optionsOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={closeOptions}>
        <TouchableOpacity style={styles.optionsBackdrop} activeOpacity={1} onPress={closeOptions}>
          <Animated.View style={[styles.optionsSheet, { transform: [{ translateY: sheetAnim }] }]}>
            <View style={styles.optionsHandleWrap}>
              <View style={styles.optionsHandle} />
            </View>
            <View style={styles.optionsHeader}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.optionsAvatar} />
              ) : (
                <View style={styles.optionsAvatarPlaceholder}>
                  <User size={20} color={theme.colors.textMuted} />
                </View>
              )}
              <Text style={[styles.optionsName, nameTextStyle(displayPeerName)]} numberOfLines={1}>{displayPeerName}</Text>
            </View>

            <TouchableOpacity style={styles.optionItem} onPress={handleViewProfile} activeOpacity={0.7}>
              <Info size={18} color="#FFFFFF" />
              <Text style={styles.optionText}>View profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={handleSharedMedia} activeOpacity={0.7}>
              <ImageIcon size={18} color="#FFFFFF" />
              <Text style={styles.optionText}>Shared media</Text>
              <Text style={styles.optionSub}>Beta</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={handleNickname} activeOpacity={0.7}>
              <UserPlus size={18} color="#FFFFFF" />
              <Text style={styles.optionText}>Nickname</Text>
              <Text style={styles.optionSub}>Beta</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={openThemePicker} activeOpacity={0.7}>
              <Palette size={18} color="#FFFFFF" />
              <Text style={styles.optionText}>Chat theme</Text>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            <TouchableOpacity style={styles.optionItem} onPress={handleMute} activeOpacity={0.7}>
              <VolumeX size={18} color="#8A8A9A" />
              <Text style={styles.optionText}>Mute notifications</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={handleBlock} activeOpacity={0.7}>
              <Shield size={18} color={theme.colors.danger} />
              <Text style={[styles.optionText, { color: theme.colors.danger }]}>Block user</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={handleReport} activeOpacity={0.7}>
              <Flag size={18} color={theme.colors.danger} />
              <Text style={[styles.optionText, { color: theme.colors.danger }]}>Report</Text>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            <TouchableOpacity style={styles.optionItem} onPress={handleClearChat} activeOpacity={0.7}>
              <Trash2 size={18} color="#8A8A9A" />
              <Text style={[styles.optionText, { color: '#8A8A9A' }]}>Clear chat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItemDestructive} onPress={handleDeleteConversation} activeOpacity={0.7}>
              <MessageSquare size={18} color={theme.colors.danger} />
              <Text style={[styles.optionText, { color: theme.colors.danger, fontWeight: '700' }]}>Delete conversation</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionsCancel} onPress={closeOptions} activeOpacity={0.7}>
              <Text style={styles.optionsCancelText}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ height: Math.max(insets.bottom, 12) }} />
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={themeOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setThemeOpen(false)}>
        <TouchableOpacity style={styles.themeBackdrop} activeOpacity={1} onPress={() => setThemeOpen(false)}>
          <View style={styles.themeSheet}>
            <View style={styles.themeHandleWrap}>
              <View style={styles.themeHandle} />
            </View>
            <Text style={styles.themeTitle}>Chat Theme</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeGrid}>
              {CHAT_THEMES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.themeCard, chatTheme === t.id && styles.themeCardActive]}
                  onPress={() => { saveChatTheme(t.id); setThemeOpen(false); }}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={t.gradient} style={styles.themePreview}>
                    <View style={[styles.themeBubblePreview, { backgroundColor: t.bubbleMine }]} />
                    <View style={[styles.themeBubblePreviewTheir, { backgroundColor: t.bubbleTheir }]} />
                  </LinearGradient>
                  <Text style={[styles.themeLabel, chatTheme === t.id && styles.themeLabelActive]}>{t.label}</Text>
                  {chatTheme === t.id && <View style={styles.themeCheck} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.themeClose} onPress={() => setThemeOpen(false)} activeOpacity={0.7}>
              <Text style={styles.themeCloseText}>Close</Text>
            </TouchableOpacity>
            <View style={{ height: Math.max(insets.bottom, 12) }} />
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  chatWallpaper: { ...StyleSheet.absoluteFillObject },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 12, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(7,7,17,0.95)',
  },
  backBtn: { padding: 8, marginRight: 8, borderRadius: 20 },
  headerUser: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, alignSelf: 'stretch', paddingVertical: 2, paddingRight: 6 },
  headerAvatarWrap: { width: 36, height: 36, marginRight: 10, position: 'relative' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarImg: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' },
  headerActiveDot: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#49E58F', borderWidth: 2, borderColor: '#070711' },
  headerInfo: { justifyContent: 'center', minWidth: 0, flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  headerStatus: { fontSize: 11, color: '#8A8A9A', marginTop: 1 },
  headerStatusLive: { color: '#49E58F', fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerActionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  msgList: { paddingVertical: 12, paddingHorizontal: 12, flexGrow: 1 },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, marginHorizontal: 8 },
  dateLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  dateText: { fontSize: 11, color: '#8A8A9A', marginHorizontal: 12, fontWeight: '600' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2, paddingHorizontal: 4 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowTheir: { justifyContent: 'flex-start' },
  msgAvatarCol: { marginRight: 6, marginBottom: 18, width: 26 },
  msgAvatarHidden: { opacity: 0 },
  msgAvatar: { width: 26, height: 26, borderRadius: 13 },
  msgAvatarPlaceholder: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  msgBubbleWrap: { maxWidth: '75%', paddingHorizontal: 2 },
  msgBubbleWrapMine: { alignItems: 'flex-end' },
  msgBubbleWrapTheir: { alignItems: 'flex-start' },
  msgBubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  msgBubbleMine: { borderBottomRightRadius: 6 },
  msgBubbleTheir: { backgroundColor: 'rgba(255,255,255,0.14)' },
  msgBubbleMineCont: { borderRadius: 20, borderTopRightRadius: 6, borderBottomRightRadius: 6 },
  msgBubbleTheirCont: { borderRadius: 20, borderTopLeftRadius: 6 },
  msgBubbleMedia: { padding: 0, overflow: 'hidden' },
  msgBubbleVoice: { paddingHorizontal: 12, paddingVertical: 10, minWidth: Math.min(SCREEN_W * 0.58, 230), maxWidth: Math.min(SCREEN_W * 0.7, 292) },
  msgMediaImage: { width: SCREEN_W * 0.65, height: SCREEN_W * 0.5, borderRadius: 16 },
  msgMediaText: { paddingHorizontal: 10, paddingBottom: 8, paddingTop: 6 },
  voiceBubble: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  voiceBubbleMine: {},
  voiceBubbleTheir: {},
  voiceBubbleUnavailable: { opacity: 0.72 },
  voiceIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  voiceProgressTrack: { flex: 1, minWidth: 86, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  voiceProgressFill: { height: '100%', borderRadius: 2 },
  voiceDuration: { width: 42, textAlign: 'right', fontSize: 12, color: '#C9C9D6', fontWeight: '700', fontVariant: ['tabular-nums'] },
  voiceDurationMine: { color: 'rgba(255,255,255,0.82)' },
  mediaPreviewBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(7,7,17,0.97)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  mediaPreviewThumb: { width: 56, height: 56, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  mediaPreviewClose: { marginLeft: 'auto', padding: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  audioPreview: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  audioPreviewText: { fontSize: 13, color: '#8A8A9A', flex: 1 },
  recordingBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  recordingText: { fontSize: 14, color: '#FF3B8A', fontWeight: '700', fontVariant: ['tabular-nums'] },
  recordingCancel: { marginLeft: 'auto', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  recordingCancelText: { fontSize: 13, color: '#8A8A9A', fontWeight: '600' },
  recordingSend: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20, backgroundColor: '#FF3B8A' },
  recordingSendDisabled: { opacity: 0.55 },
  recordingSendText: { fontSize: 13, color: '#fff', fontWeight: '700' },
  recordingErrorBar: { marginHorizontal: 10, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: 'rgba(255,88,116,0.14)', borderWidth: 1, borderColor: 'rgba(255,88,116,0.26)' },
  recordingErrorText: { color: '#FF8AA0', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  typingInline: { paddingHorizontal: 18, paddingVertical: 5, backgroundColor: 'rgba(7,7,17,0.9)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  typingInlineText: { fontSize: 12, color: '#49E58F', fontWeight: '700' },
  msgText: { fontSize: 15, lineHeight: 21, color: '#FFFFFF', writingDirection: 'auto', includeFontPadding: true, minWidth: 18 },
  msgTextMine: { color: '#fff' },
  msgTime: { fontSize: 10, marginTop: 3, marginHorizontal: 6 },
  msgTimeMine: { color: 'rgba(255,255,255,0.4)', textAlign: 'right' },
  msgTimeTheir: { color: '#8A8A9A', textAlign: 'left' },
  msgSeen: { fontSize: 10, marginTop: 2, marginRight: 6, color: 'rgba(255,255,255,0.48)', textAlign: 'right', fontWeight: '600' },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingBottom: 100 },
  emptyAvatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.06)' },
  emptyAvatarImg: { width: 72, height: 72, borderRadius: 36, marginBottom: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.06)' },
  emptyName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  emptyText: { fontSize: 14, color: '#8A8A9A', textAlign: 'center' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(7,7,17,0.97)',
  },
  attachBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 6, marginBottom: 2, flexShrink: 0 },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 9, fontSize: 15, color: '#FFFFFF',
    maxHeight: 100, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  inputWithMedia: { marginRight: 4 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 },
  sendBtnDisabled: { opacity: 0.4 },
  micBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 },
  optionsBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  optionsSheet: { backgroundColor: '#12121f', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 8, overflow: 'hidden' },
  optionsHandleWrap: { alignItems: 'center', paddingVertical: 10 },
  optionsHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  optionsHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  optionsAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' },
  optionsAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  optionsName: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', marginLeft: 12 },
  optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, gap: 14 },
  optionItemDestructive: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, gap: 14 },
  optionText: { fontSize: 15, color: '#FFFFFF', fontWeight: '500', flex: 1 },
  optionSub: { fontSize: 11, color: '#555', fontWeight: '500' },
  optionDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginHorizontal: 16 },
  optionsCancel: { alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginTop: 4, marginHorizontal: 16 },
  optionsCancelText: { fontSize: 15, fontWeight: '700', color: '#8A8A9A' },
  themeBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  themeSheet: { backgroundColor: '#12121f', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 16, overflow: 'hidden' },
  themeHandleWrap: { alignItems: 'center', paddingVertical: 10 },
  themeHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  themeTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', paddingVertical: 8, marginBottom: 8 },
  themeGrid: { paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  themeCard: { alignItems: 'center', width: 92, minHeight: 96, paddingVertical: 8, paddingHorizontal: 4 },
  themeCardActive: { borderWidth: 2, borderColor: '#FF3B8A', borderRadius: 16 },
  themePreview: { width: 60, height: 60, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden' },
  themeBubblePreview: { width: 28, height: 14, borderRadius: 7, alignSelf: 'flex-end', marginRight: 4 },
  themeBubblePreviewTheir: { width: 28, height: 14, borderRadius: 7, alignSelf: 'flex-start', marginLeft: 4, position: 'absolute', top: 8, left: 6 },
  themeLabel: { fontSize: 11, color: '#D7D7E2', fontWeight: '700', marginTop: 6, textAlign: 'center' },
  themeLabelActive: { color: '#FF3B8A' },
  themeCheck: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FF3B8A', position: 'absolute', top: 4, right: 4 },
  themeClose: { alignItems: 'center', paddingVertical: 14, marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 },
  themeCloseText: { fontSize: 15, fontWeight: '700', color: '#8A8A9A' },
});

export default Chat;
