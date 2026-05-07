import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Send, User, MoreVertical, Phone, Video,
  Shield, Trash2, VolumeX, MessageSquare,
  Flag, UserPlus, Image as ImageIcon, Palette, Info,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dmAPI } from '../api/client';
import * as haptics from '../utils/haptics';
import theme from '../theme';

const CHAT_BG_KEY = 'chat_bg_';

const CHAT_THEMES = [
  { id: 'default', label: 'Dark', gradient: ['#070711', '#070711'] },
  { id: 'pink', label: 'Pink', gradient: ['#1a0a14', '#070711'] },
  { id: 'blue', label: 'Ocean', gradient: ['#0a1628', '#070711'] },
  { id: 'glass', label: 'Glass', gradient: ['#0f0f1a', '#0a0a16'] },
  { id: 'purple', label: 'Aurora', gradient: ['#140a24', '#070711'] },
];

const Chat = ({ navigation, route }) => {
  const userKey = route.params?.userKey || '';
  const username = route.params?.username || 'User';
  const avatar = route.params?.avatar || null;
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [chatTheme, setChatTheme] = useState('default');
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    loadChatTheme();
    fetchMessages();
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

  const fetchMessages = async () => {
    try {
      const response = await dmAPI.getConversation(userKey);
      if (response.data.ok) {
        setMessages(response.data.messages || []);
      }
    } catch (err) {
      console.error('Chat fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    haptics.light();
    try {
      const response = await dmAPI.sendMessage(userKey, text.trim());
      if (response.data.ok) {
        setText('');
        fetchMessages();
      }
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
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
    navigation.navigate('CallScreen', { username, avatar, callType: 'voice' });
  };

  const handleVideoCall = () => {
    haptics.light();
    navigation.navigate('CallScreen', { username, avatar, callType: 'video' });
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
      Alert.alert('Block User', `Are you sure you want to block @${username}? They won't be able to contact you.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            haptics.error();
            Alert.alert('Coming soon', 'User blocking will be available in the next update.');
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
            Alert.alert('Coming soon', 'Deleting conversations will be available soon.');
          },
        },
      ]);
    }, 300);
  };

  const handleSharedMedia = () => {
    closeOptions();
    setTimeout(() => {
      Alert.alert('Coming soon', 'Shared media gallery will be available soon.');
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
            Alert.alert('Coming soon', 'Clearing chat will be available soon.');
          },
        },
      ]);
    }, 300);
  };

  const handleNickname = () => {
    closeOptions();
    setTimeout(() => {
      Alert.alert('Coming soon', 'Custom nicknames will be available soon.');
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
    const isMine = item.mine === true;
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const isContinuation = prevMsg && prevMsg.mine === item.mine;
    const showAvatar = !isMine && (!prevMsg || prevMsg.mine || prevMsg.senderId !== item.senderId);

    return (
      <View style={[
        styles.msgRow,
        isMine ? styles.msgRowMine : styles.msgRowTheir,
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
            isMine ? styles.msgBubbleMine : styles.msgBubbleTheir,
            isContinuation && isMine && styles.msgBubbleMineCont,
            isContinuation && !isMine && styles.msgBubbleTheirCont,
          ]}>
            <Text style={[styles.msgText, isMine && styles.msgTextMine]}>
              {item.text}
            </Text>
          </View>
          {!isContinuation && (
            <Text style={[
              styles.msgTime,
              isMine ? styles.msgTimeMine : styles.msgTimeTheir,
            ]}>
              {formatTime(item.createdAt)}
            </Text>
          )}
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
      items.push({ type: 'message', item: msg, key: `msg-${msg.id}-${index}`, msgIndex: index });
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
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  const currentTheme = CHAT_THEMES.find(t => t.id === chatTheme) || CHAT_THEMES[0];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#070711', paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.gradient[0] }]}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <Animated.View style={[styles.header, { opacity: fadeAnim, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerUser}
            activeOpacity={0.7}
            onPress={handleViewProfile}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.headerAvatarImg} />
            ) : (
              <View style={styles.headerAvatar}>
                <User size={16} color={theme.colors.textMuted} />
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>{username}</Text>
              <Text style={styles.headerStatus}>Tap for profile</Text>
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
            <Text style={styles.emptyName}>{username}</Text>
            <Text style={styles.emptyText}>Say hello! Start the conversation.</Text>
          </View>
        ) : (
          renderMessagesWithDates()
        )}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor={theme.colors.textMuted}
            value={text}
            onChangeText={setText}
            onKeyPress={handleKeyPress}
            multiline
            maxLength={600}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={18} color="#fff" />
            )}
          </TouchableOpacity>
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
              <Text style={styles.optionsName}>{username}</Text>
            </View>

            <TouchableOpacity style={styles.optionItem} onPress={handleViewProfile} activeOpacity={0.7}>
              <Info size={18} color="#FFFFFF" />
              <Text style={styles.optionText}>View profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={handleSharedMedia} activeOpacity={0.7}>
              <ImageIcon size={18} color="#FFFFFF" />
              <Text style={styles.optionText}>Shared media</Text>
              <Text style={styles.optionSub}>Coming soon</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={handleNickname} activeOpacity={0.7}>
              <UserPlus size={18} color="#FFFFFF" />
              <Text style={styles.optionText}>Nickname</Text>
              <Text style={styles.optionSub}>Coming soon</Text>
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
                  <View style={[styles.themePreview, { backgroundColor: t.gradient[0] }]} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 12, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(7,7,17,0.95)',
  },
  backBtn: { padding: 8, marginRight: 8, borderRadius: 20 },
  headerUser: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  headerAvatarImg: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' },
  headerInfo: { justifyContent: 'center', minWidth: 0 },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  headerStatus: { fontSize: 11, color: '#8A8A9A', marginTop: 1 },
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
  msgBubbleMine: { backgroundColor: '#FF3B8A', borderBottomRightRadius: 6 },
  msgBubbleTheir: { backgroundColor: 'rgba(255,255,255,0.08)' },
  msgBubbleMineCont: { borderRadius: 20, borderTopRightRadius: 6, borderBottomRightRadius: 6 },
  msgBubbleTheirCont: { borderRadius: 20, borderTopLeftRadius: 6 },
  msgText: { fontSize: 15, lineHeight: 20, flexWrap: 'wrap' },
  msgTextMine: { color: '#fff' },
  msgTime: { fontSize: 10, marginTop: 3, marginHorizontal: 6 },
  msgTimeMine: { color: 'rgba(255,255,255,0.4)', textAlign: 'right' },
  msgTimeTheir: { color: '#8A8A9A', textAlign: 'left' },
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
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 9, fontSize: 15, color: '#FFFFFF',
    maxHeight: 100, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FF3B8A', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnDisabled: { opacity: 0.4 },
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
  themeCard: { alignItems: 'center', width: 80, paddingVertical: 8 },
  themeCardActive: { borderWidth: 2, borderColor: '#FF3B8A', borderRadius: 16 },
  themePreview: { width: 60, height: 60, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  themeLabel: { fontSize: 11, color: '#8A8A9A', fontWeight: '600', marginTop: 6 },
  themeLabelActive: { color: '#FF3B8A' },
  themeCheck: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FF3B8A', position: 'absolute', top: 4, right: 4 },
  themeClose: { alignItems: 'center', paddingVertical: 14, marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 },
  themeCloseText: { fontSize: 15, fontWeight: '700', color: '#8A8A9A' },
});

export default Chat;
