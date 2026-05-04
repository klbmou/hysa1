import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, User, Verified, MessageSquare } from 'lucide-react-native';
import { dmAPI } from '../api/client';
import * as haptics from '../utils/haptics';
import theme from '../theme';

const DMThreads = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    try {
      const response = await dmAPI.getThreads();
      if (response.data.ok) {
        setThreads(response.data.threads || []);
      }
    } catch (err) {
      console.error('DM threads error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openThread = (thread) => {
    haptics.light();
    if (thread.type === 'direct') {
      navigation.navigate('Chat', { userKey: thread.peerKey, username: thread.peerUsername, avatar: thread.peerAvatar });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.threadItem} onPress={() => openThread(item)} activeOpacity={0.7}>
      <View style={styles.avatarWrap}>
        {item.peerAvatar ? (
          <Image source={{ uri: item.peerAvatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <User size={20} color={theme.colors.textMuted} />
          </View>
        )}
        {item.unreadCount > 0 && <View style={styles.unreadDot} />}
      </View>
      <View style={styles.threadContent}>
        <View style={styles.threadHeader}>
          <View style={styles.nameRow}>
            <Text style={styles.peerName}>{item.peerUsername}</Text>
            {item.peerVerified && <Verified size={12} color={theme.colors.verified} fill={theme.colors.verified} />}
          </View>
          <Text style={styles.threadTime}>{formatDate(item.createdAt)}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage || 'Start a conversation'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 22 }} />
      </View>

      {threads.length === 0 ? (
        <View style={styles.emptyState}>
          <MessageSquare size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtext}>Start a conversation from a user's profile.</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          renderItem={renderItem}
          keyExtractor={(item, i) => `${item.peerKey}-${i}`}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.bgGlass },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary },
  threadItem: { flexDirection: 'row', padding: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.bgInput, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.accent, borderWidth: 2, borderColor: theme.colors.bgPrimary },
  threadContent: { flex: 1 },
  threadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  peerName: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  threadTime: { fontSize: 12, color: theme.colors.textMuted },
  lastMessage: { fontSize: 14, color: theme.colors.textSecondary },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center' },
});

export default DMThreads;
