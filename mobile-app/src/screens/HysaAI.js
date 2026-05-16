import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Check, Copy, RefreshCcw, RotateCcw, Send, Sparkles } from 'lucide-react-native';
import api, { aiAPI } from '../api/client';
import theme from '../theme';

const STARTERS = [
  'Draft a post idea',
  'Write a caption',
  'Suggest hashtags',
  'Improve my post',
  'Bio ideas',
];

const initialMessages = [
  {
    id: 'ai-welcome',
    role: 'ai',
    text: 'I can help shape captions, replies, bios, hashtags, and post ideas. Drop the vibe and I’ll make it usable.',
  },
];

const buildContext = (items) =>
  items
    .map((item) => ({ ...item, text: item.fullText || item.text }))
    .filter((item) => !item.isError && item.id !== 'ai-welcome' && item.text)
    .slice(-8)
    .map((item) => ({ role: item.role, text: item.text }));

const MarkdownText = ({ children, style }) => {
  const text = String(children || '');
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, index) => {
        const isBold = part.startsWith('**') && part.endsWith('**');
        return (
          <Text key={`${part}-${index}`} style={isBold ? styles.boldText : null}>
            {isBold ? part.slice(2, -2) : part}
          </Text>
        );
      })}
    </Text>
  );
};

const BUFFER_IDEA_TEXT_LIMIT = 2000;
const BUFFER_IDEA_TITLE_LIMIT = 120;

const plainTitleText = (value) => String(value || '')
  .replace(/[*_`>#]/g, ' ')
  .replace(/^[\s-]+/gm, '')
  .replace(/\s+/g, ' ')
  .trim();

const buildBufferIdeaTitle = (item) => {
  const body = String(item?.fullText || item?.text || '').trim();
  const firstLine = body.split(/\r?\n/).map(plainTitleText).find(Boolean);
  const promptLine = plainTitleText(item?.prompt);
  const title = firstLine || promptLine || 'HYSA post idea';
  return title.length > BUFFER_IDEA_TITLE_LIMIT
    ? `${title.slice(0, BUFFER_IDEA_TITLE_LIMIT - 3).trim()}...`
    : title;
};

const AnimatedMessage = ({
  item,
  copiedId,
  bufferSendingId,
  bufferSentId,
  onCopy,
  onRegenerate,
  onSendToBuffer,
}) => {
  const appear = useRef(new Animated.Value(0)).current;
  const isUser = item.role === 'user';
  const isRevealing = item.fullText && item.text !== item.fullText;
  const showActions = !isUser && !item.isError && item.id !== 'ai-welcome' && !isRevealing;
  const isSendingToBuffer = bufferSendingId === item.id;
  const isSentToBuffer = bufferSentId === item.id || !!item.bufferIdeaId;

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [appear]);

  return (
    <Animated.View
      style={[
        styles.messageRow,
        isUser ? styles.messageRowUser : styles.messageRowAi,
        {
          opacity: appear,
          transform: [{
            translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
          }],
        },
      ]}
    >
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Sparkles size={15} color="#fff" />
        </View>
      )}
      <View style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.aiBubble,
        item.isError && styles.errorBubble,
      ]}>
        <MarkdownText style={[styles.bubbleText, isUser && styles.userBubbleText]}>{item.text}</MarkdownText>
        {showActions && (
          <View style={styles.aiActions}>
            <TouchableOpacity style={styles.aiActionBtn} onPress={() => onCopy(item)} activeOpacity={0.72}>
              {copiedId === item.id ? <Check size={13} color="#fff" /> : <Copy size={13} color="#fff" />}
              <Text style={styles.aiActionText}>{copiedId === item.id ? 'Copied' : 'Copy'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.aiActionBtn} onPress={() => onRegenerate(item)} activeOpacity={0.72}>
              <RotateCcw size={13} color="#fff" />
              <Text style={styles.aiActionText}>Regenerate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.aiActionBtn,
                styles.bufferActionBtn,
                isSentToBuffer && styles.bufferActionBtnSent,
                isSendingToBuffer && styles.aiActionBtnDisabled,
              ]}
              onPress={() => onSendToBuffer(item)}
              disabled={isSendingToBuffer || isSentToBuffer}
              activeOpacity={0.72}
            >
              {isSendingToBuffer ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : isSentToBuffer ? (
                <Check size={13} color="#fff" />
              ) : (
                <Send size={13} color="#fff" />
              )}
              <Text style={styles.aiActionText}>
                {isSendingToBuffer ? 'Sending' : isSentToBuffer ? 'Buffer Idea' : 'Send to Buffer Ideas'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const TypingIndicator = () => (
  <View style={[styles.messageRow, styles.messageRowAi, styles.typingRow]}>
    <View style={styles.aiAvatar}>
      <Sparkles size={15} color="#fff" />
    </View>
    <View style={[styles.bubble, styles.aiBubble, styles.typingBubble]}>
      <View style={styles.typingDot} />
      <View style={[styles.typingDot, styles.typingDotMid]} />
      <View style={styles.typingDot} />
    </View>
  </View>
);

const HysaAI = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const revealTimerRef = useRef(null);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastPrompt, setLastPrompt] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [bufferSendingId, setBufferSendingId] = useState('');
  const [bufferSentId, setBufferSentId] = useState('');

  useEffect(() => () => {
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
  }, []);

  const scrollToEnd = () => {
    setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 80);
  };

  const revealAiReply = (reply, meta = {}) => {
    const id = `a-${Date.now()}`;
    const cleanReply = reply || 'HYSA AI did not return a reply. Try again.';
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    setMessages((prev) => [...prev, { id, role: 'ai', text: '', fullText: cleanReply, ...meta }]);
    let cursor = 0;
    revealTimerRef.current = setInterval(() => {
      cursor = Math.min(cleanReply.length, cursor + 5);
      setMessages((prev) => prev.map((item) => (
        item.id === id ? { ...item, text: cleanReply.slice(0, cursor) } : item
      )));
      scrollToEnd();
      if (cursor >= cleanReply.length) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    }, 14);
  };

  const requestAi = async (prompt, context, meta = {}) => {
    setLastPrompt(prompt);
    setLoading(true);
    setError('');
    scrollToEnd();
    try {
      const response = await aiAPI.chat(prompt, context);
      const reply = String(response.data?.reply || '').trim();
      revealAiReply(reply, meta);
    } catch (err) {
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message;
      const fallback = status === 429
        ? 'Rate limit reached. Try again in a few minutes.'
        : serverMessage || 'HYSA AI is unavailable right now. Try again.';
      setError(fallback);
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: 'ai', text: fallback, isError: true }]);
    } finally {
      setLoading(false);
      scrollToEnd();
    }
  };

  const sendPrompt = async (promptValue = input) => {
    const prompt = String(promptValue || '').trim();
    if (!prompt || loading) return;
    if (prompt.length > 1000) {
      setError('Keep messages under 1000 characters.');
      return;
    }
    const userMessage = { id: `u-${Date.now()}`, role: 'user', text: prompt };
    const context = buildContext(messages);
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    await requestAi(prompt, context, { prompt });
  };

  const copyMessage = (item) => {
    try {
      Clipboard.setString(String(item.fullText || item.text || ''));
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(''), 1400);
    } catch (err) {
      setError('Copy is unavailable on this device.');
    }
  };

  const regenerateMessage = async (item) => {
    if (loading) return;
    const index = messages.findIndex((message) => message.id === item.id);
    if (index <= 0) return;
    const promptIndex = [...messages].slice(0, index).map((message, idx) => ({ message, idx })).reverse()
      .find(({ message }) => message.role === 'user')?.idx;
    if (promptIndex === undefined) return;
    const prompt = messages[promptIndex].text;
    const context = buildContext(messages.slice(0, promptIndex));
    setMessages((prev) => prev.filter((message) => message.id !== item.id));
    await requestAi(prompt, context, { prompt });
  };

  const sendToBufferIdea = async (item) => {
    if (bufferSendingId) return;
    const text = String(item?.fullText || item?.text || '').trim();
    if (!text) {
      setError('Nothing to send to Buffer Ideas yet.');
      return;
    }
    if (text.length > BUFFER_IDEA_TEXT_LIMIT) {
      setError('Buffer Ideas text must stay under 2000 characters.');
      return;
    }

    const title = buildBufferIdeaTitle(item);
    setBufferSendingId(item.id);
    setError('');
    try {
      const response = await api.post('/api/social/idea', { title, text });
      const ideaId = String(response.data?.ideaId || '');
      setBufferSentId(item.id);
      setMessages((prev) => prev.map((message) => (
        message.id === item.id ? { ...message, bufferIdeaId: ideaId } : message
      )));
      Alert.alert('Saved to Buffer Ideas', 'This was saved as a Buffer Idea for review. Nothing was published.');
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.error;
      const fallback = status === 429
        ? 'Buffer Ideas rate limit reached. Try again in a few minutes.'
        : code === 'BUFFER_NOT_CONFIGURED'
          ? 'Buffer is not configured on the server yet.'
          : 'Could not save this to Buffer Ideas. Try again.';
      setError(fallback);
    } finally {
      setBufferSendingId('');
    }
  };

  const renderMessage = ({ item }) => (
    <AnimatedMessage
      item={item}
      copiedId={copiedId}
      bufferSendingId={bufferSendingId}
      bufferSentId={bufferSentId}
      onCopy={copyMessage}
      onRegenerate={regenerateMessage}
      onSendToBuffer={sendToBufferIdea}
    />
  );

  return (
    <LinearGradient colors={['#070711', '#151123', '#070711']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>HYSA AI</Text>
            <Text style={styles.subtitle}>Smarter captions, replies, bios, and ideas</Text>
          </View>
          <View style={styles.headerMark}>
            <Sparkles size={20} color="#fff" />
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
          ListFooterComponent={loading ? <TypingIndicator /> : null}
          ListHeaderComponent={
            <View style={styles.starterWrap}>
              {STARTERS.map((starter) => (
                <TouchableOpacity key={starter} style={styles.starterChip} onPress={() => sendPrompt(starter)} activeOpacity={0.75}>
                  <Text style={styles.starterText}>{starter}</Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
            {lastPrompt ? (
              <TouchableOpacity style={styles.retryBtn} onPress={() => sendPrompt(lastPrompt)} disabled={loading} activeOpacity={0.7}>
                <RefreshCcw size={14} color="#fff" />
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask HYSA AI..."
            placeholderTextColor="rgba(255,255,255,0.48)"
            multiline
            maxLength={1000}
            selectionColor="#FF3B8A"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendPrompt()}
            disabled={!input.trim() || loading}
            activeOpacity={0.75}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(7,7,17,0.72)',
  },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  headerTitleWrap: { flex: 1, paddingHorizontal: 12 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.56)', fontSize: 12, fontWeight: '700', marginTop: 2 },
  headerMark: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF3B8A', shadowColor: '#FF3B8A', shadowOpacity: 0.35, shadowRadius: 12, elevation: 4 },
  messageList: { padding: 14, paddingBottom: 22 },
  starterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  starterChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  starterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  messageRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end' },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowAi: { justifyContent: 'flex-start' },
  aiAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,59,138,0.9)', alignItems: 'center', justifyContent: 'center', marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  userBubble: { backgroundColor: '#FF3B8A', borderBottomRightRadius: 6 },
  aiBubble: { backgroundColor: 'rgba(255,255,255,0.105)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderBottomLeftRadius: 6 },
  errorBubble: { backgroundColor: 'rgba(255,88,116,0.14)', borderColor: 'rgba(255,88,116,0.24)' },
  bubbleText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  boldText: { fontWeight: '900', color: '#FFFFFF' },
  userBubbleText: { fontWeight: '700' },
  aiActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  aiActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  aiActionBtnDisabled: { opacity: 0.55 },
  bufferActionBtn: { backgroundColor: 'rgba(255,59,138,0.18)', borderColor: 'rgba(255,59,138,0.28)' },
  bufferActionBtnSent: { backgroundColor: 'rgba(46,213,115,0.16)', borderColor: 'rgba(46,213,115,0.3)' },
  aiActionText: { color: 'rgba(255,255,255,0.86)', fontSize: 11, fontWeight: '900' },
  typingRow: { marginTop: 2 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 12, paddingHorizontal: 14, minWidth: 58 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.56)' },
  typingDotMid: { backgroundColor: '#FF3B8A' },
  errorBar: { marginHorizontal: 12, marginBottom: 8, padding: 10, borderRadius: 14, backgroundColor: 'rgba(255,88,116,0.14)', borderWidth: 1, borderColor: 'rgba(255,88,116,0.24)', flexDirection: 'row', alignItems: 'center', gap: 10 },
  errorText: { flex: 1, color: '#FF9CAF', fontSize: 12, fontWeight: '800' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)' },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(7,7,17,0.9)' },
  input: { flex: 1, maxHeight: 112, minHeight: 42, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', paddingHorizontal: 14, paddingVertical: 10, color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF3B8A', marginBottom: 1 },
  sendBtnDisabled: { opacity: 0.45 },
});

export default HysaAI;
