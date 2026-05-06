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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Send, User, MoreVertical, Phone, Video } from 'lucide-react-native';
import { dmAPI } from '../api/client';
import * as haptics from '../utils/haptics';
import theme from '../theme';

const Chat = ({ navigation, route }) => {
  const { userKey, username, avatar } = route.params;
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    fetchMessages();
  }, [userKey]);

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

  const renderDateSeparator = (date) => (
    <View style={styles.dateSeparator}>
      <View style={styles.dateLine} />
      <Text style={styles.dateText}>{formatMsgDate(date)}</Text>
      <View style={styles.dateLine} />
    </View>
  );

  const renderMessage = ({ item, index }) => {
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const isContinuation = prevMsg && prevMsg.mine === item.mine;
    const showAvatar = !item.mine && (!prevMsg || prevMsg.mine || prevMsg.senderId !== item.senderId);

    return (
      <View style={[
        styles.msgContainer,
        isContinuation && styles.msgContinuation
      ]}>
        {!item.mine && (
          <View style={[styles.msgAvatarWrap, !showAvatar && styles.msgAvatarHidden]}>
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
          item.mine ? styles.msgBubbleRight : styles.msgBubbleLeft,
          isContinuation && (item.mine ? styles.msgBubbleRightCont : styles.msgBubbleLeftCont)
        ]}>
          <View style={[
            styles.msgBubble,
            item.mine ? styles.msgBubbleMine : styles.msgBubbleTheir,
            !isContinuation && item.mine && styles.msgBubbleMineFirst,
            !isContinuation && !item.mine && styles.msgBubbleTheirFirst,
            isContinuation && item.mine && styles.msgBubbleMineCont,
            isContinuation && !item.mine && styles.msgBubbleTheirCont,
          ]}>
            <Text style={[styles.msgText, item.mine && styles.msgTextMine]}>
              {item.text}
            </Text>
          </View>
          <Text style={[
            styles.msgTime,
            item.mine ? styles.msgTimeMine : styles.msgTimeTheir,
            isContinuation && styles.msgTimeHidden
          ]}>
            {formatTime(item.createdAt)}
          </Text>
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
      items.push({ type: 'message', item: msg, key: `msg-${msg.id}`, msgIndex: index });
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
      />
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Animated.View style={[styles.header, { opacity: fadeAnim, paddingTop: insets.top + 15 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerUser} activeOpacity={0.7}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.headerAvatarImg} />
          ) : (
            <View style={styles.headerAvatar}>
              <User size={16} color={theme.colors.textMuted} />
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{username || 'User'}</Text>
            <Text style={styles.headerStatus}>Active now</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.7}>
            <Phone size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.7}>
            <Video size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.7}>
            <MoreVertical size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {messages.length === 0 ? (
        <View style={styles.emptyChat}>
          <View style={styles.emptyAvatar}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.emptyAvatarImg} />
            ) : (
              <User size={32} color="#8A8A9A" />
            )}
          </View>
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
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070711' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(7,7,17,0.92)',
  },
  backBtn: { padding: 6, marginRight: 12 },
  headerUser: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  headerAvatarImg: { width: 38, height: 38, borderRadius: 19, marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  headerInfo: { justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  headerStatus: { fontSize: 12, color: '#34D399', marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerActionBtn: { padding: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
  msgList: { paddingVertical: 12, paddingHorizontal: 14, flexGrow: 1 },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dateLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  dateText: { fontSize: 12, color: '#8A8A9A', marginHorizontal: 12, fontWeight: '600' },
  msgContainer: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 3 },
  msgContinuation: { marginTop: 2, marginBottom: 0 },
  msgAvatarWrap: { marginRight: 8, marginBottom: 18 },
  msgAvatarHidden: { opacity: 0 },
  msgAvatar: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarPlaceholder: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  msgBubbleWrap: { maxWidth: '78%', alignItems: 'flex-end' },
  msgBubbleRight: { alignItems: 'flex-end' },
  msgBubbleLeft: { alignItems: 'flex-start' },
  msgBubbleRightCont: { marginTop: 2, borderTopRightRadius: 6 },
  msgBubbleLeftCont: { marginTop: 2, marginLeft: 36, borderTopLeftRadius: 6 },
  msgBubble: { paddingHorizontal: 14, paddingVertical: 9 },
  msgBubbleMine: { backgroundColor: '#FF3B8A', borderRadius: 20, borderTopRightRadius: 20 },
  msgBubbleTheir: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, borderTopLeftRadius: 20 },
  msgBubbleMineFirst: { borderTopRightRadius: 20, borderRadius: 20 },
  msgBubbleTheirFirst: { borderTopLeftRadius: 20, borderRadius: 20 },
  msgBubbleMineCont: { borderRadius: 20, borderTopRightRadius: 6 },
  msgBubbleTheirCont: { borderRadius: 20, borderTopLeftRadius: 6 },
  msgText: { fontSize: 15, lineHeight: 21, color: '#FFFFFF' },
  msgTextMine: { color: '#fff' },
  msgTime: { fontSize: 10, marginTop: 4, marginHorizontal: 4 },
  msgTimeMine: { color: 'rgba(255,255,255,0.5)', alignSelf: 'flex-end' },
  msgTimeTheir: { color: '#8A8A9A', alignSelf: 'flex-start' },
  msgTimeHidden: { opacity: 0 },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingBottom: 120 },
  emptyAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.06)' },
  emptyAvatarImg: { width: 72, height: 72, borderRadius: 36 },
  emptyName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#8A8A9A', textAlign: 'center' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(7,7,17,0.95)',
  },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 22,
    paddingHorizontal: 18, paddingVertical: 10, fontSize: 15, color: '#FFFFFF',
    maxHeight: 100, marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF3B8A', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});

export default Chat;
