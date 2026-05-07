import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Speaker, Video, VideoOff, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import theme from '../theme';

const CallScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const params = route?.params || {};
  const username = params?.username || 'User';
  const avatar = params?.avatar || null;
  const callType = params?.callType || 'voice';
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [callStatus, setCallStatus] = useState('calling');
  const [callDuration, setCallDuration] = useState(0);
  const pulseAnim = useRef(new Animated.Value(0.8)).current;
  const ringRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    try {
      const loopAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.85, duration: 1500, useNativeDriver: true }),
        ])
      );
      loopAnim.start();

      const timer = setTimeout(() => {
        if (isMounted.current && !callStatus) {
          setCallStatus('connected');
          try {
            if (Haptics && Haptics.notificationAsync) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Success || 'success');
            }
          } catch (e) {
            console.log('Haptics not available');
          }
        }
      }, 4000);

      return () => {
        isMounted.current = false;
        clearTimeout(timer);
        try {
          loopAnim.stop();
        } catch (e) {}
        if (ringRef.current) clearInterval(ringRef.current);
      };
    } catch (e) {
      console.error('CallScreen effect error:', e);
    }
  }, []);

  useEffect(() => {
    if (callStatus === 'connected') {
      ringRef.current = setInterval(() => {
        if (isMounted.current) setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => { if (ringRef.current) clearInterval(ringRef.current); };
  }, [callStatus]);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    try {
      Alert.alert(
        'Beta Preview',
        'Real-time calls are coming soon! This is a preview of the call interface.',
        [{ text: 'OK', style: 'default' }]
      );
    } catch (e) {
      console.error('Alert error:', e);
    }
  }, []);

  const handleEndCall = () => {
    try {
      if (Haptics && Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Medium || 'medium');
      }
    } catch (e) {
      console.log('Haptics not available');
    }
    if (navigation && navigation.goBack) {
      navigation.goBack();
    }
  };

  const handleToggleMute = () => {
    try {
      if (Haptics && Haptics.selectionAsync) {
        Haptics.selectionAsync();
      }
    } catch (e) {}
    setIsMuted(prev => !prev);
  };

  const handleToggleSpeaker = () => {
    try {
      if (Haptics && Haptics.selectionAsync) {
        Haptics.selectionAsync();
      }
    } catch (e) {}
    setIsSpeakerOn(prev => !prev);
  };

  const handleToggleVideo = () => {
    try {
      if (Haptics && Haptics.selectionAsync) {
        Haptics.selectionAsync();
      }
    } catch (e) {}
    setIsVideoEnabled(prev => !prev);
  };

  const callStatusLabel = callStatus === 'calling'
    ? (callType === 'video' ? 'Video calling...' : 'Voice calling...')
    : formatDuration(callDuration);

  return (
    <View style={[styles.container, callType === 'video' && styles.videoBg]}>
      <View style={[styles.betaBadge, { top: insets.top + 12 }]}>
        <Text style={styles.betaBadgeText}>BETA PREVIEW</Text>
      </View>

      <View style={styles.avatarContainer}>
        <Animated.View style={[styles.avatarRing, { transform: [{ scale: pulseAnim }] }]}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarInner}>
              <User size={40} color={callType === 'video' ? '#FFFFFF' : theme.colors.accent} />
            </View>
          )}
        </Animated.View>
      </View>

      <Text style={styles.username}>{username}</Text>
      <Text style={styles.status}>
        {callStatusLabel}
        {callStatus === 'calling' && ' (Beta)'}
      </Text>
      {callStatus === 'connected' && (
        <Text style={styles.callMode}>
          {callType === 'video' ? 'Video call' : 'Voice call'} — Beta preview
        </Text>
      )}

      <View style={[styles.controls, { bottom: Math.max(insets.bottom + 28, 56) }]}>
        <TouchableOpacity style={styles.controlBtn} onPress={handleToggleMute} activeOpacity={0.7}>
          <View style={[styles.controlIconBg, isMuted && styles.controlIconBgActive]}>
            {isMuted ? <MicOff size={22} color="#fff" /> : <Mic size={22} color="#fff" />}
          </View>
          <Text style={styles.controlLabel}>Mute</Text>
        </TouchableOpacity>

        {callType === 'video' && (
          <TouchableOpacity style={styles.controlBtn} onPress={handleToggleVideo} activeOpacity={0.7}>
            <View style={[styles.controlIconBg, !isVideoEnabled && styles.controlIconBgActive]}>
              {isVideoEnabled ? <Video size={22} color="#fff" /> : <VideoOff size={22} color="#fff" />}
            </View>
            <Text style={styles.controlLabel}>Video</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.endCallBtnWrap} onPress={handleEndCall} activeOpacity={0.8}>
          <View style={styles.endCallBtn}>
            <PhoneOff size={26} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={handleToggleSpeaker} activeOpacity={0.7}>
          <View style={[styles.controlIconBg, isSpeakerOn && styles.controlIconBgActive]}>
            {isSpeakerOn ? <Speaker size={22} color="#fff" /> : <Volume2 size={22} color="#fff" />}
          </View>
          <Text style={styles.controlLabel}>Speaker</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>
          {callType === 'voice'
            ? 'Beta: Voice calls are a preview feature'
            : 'Beta: Video calls are a preview feature'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070711', alignItems: 'center', justifyContent: 'center' },
  videoBg: { backgroundColor: '#0a0a14' },
  betaBadge: { position: 'absolute', left: 16, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(255,59,138,0.15)', borderWidth: 1, borderColor: 'rgba(255,59,138,0.3)' },
  betaBadgeText: { fontSize: 10, color: '#FF3B8A', fontWeight: '800', letterSpacing: 0.5 },
  avatarContainer: { marginBottom: 28 },
  avatarRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: 'rgba(255,59,138,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 110, height: 110, borderRadius: 55 },
  avatarInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,59,138,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  status: { fontSize: 15, color: theme.colors.accent, fontWeight: '600', marginBottom: 6 },
  callMode: { fontSize: 13, color: '#8A8A9A', fontWeight: '500', marginBottom: 40 },
  controls: { position: 'absolute', left: 24, right: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  controlBtn: { alignItems: 'center', gap: 6, minWidth: 56 },
  controlIconBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  controlIconBgActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  controlLabel: { fontSize: 10, color: '#8A8A9A', fontWeight: '600' },
  endCallBtnWrap: { marginHorizontal: 24 },
  endCallBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF3B3B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  hintContainer: { position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center' },
  hintText: { fontSize: 10, color: '#444', fontStyle: 'italic' },
});

export default CallScreen;
