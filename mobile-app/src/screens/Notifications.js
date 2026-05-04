import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Heart,
  MessageCircle,
  Repeat,
  UserPlus,
  User,
  Bell,
} from 'lucide-react-native';
import { notificationsAPI } from '../api/client';
import theme from '../theme';

function extractNotifications(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.ok) {
    if (Array.isArray(data.notifications)) return data.notifications;
    if (Array.isArray(data.items)) return data.items;
  }
  if (Array.isArray(data.notifications)) return data.notifications;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function safeActor(notif) {
  const actor = notif.actor || notif.user || notif.actorObj || notif.userObj || null;
  return {
    username: (
      notif.actorUsername ||
      notif.username ||
      actor?.username ||
      actor?.key ||
      notif.actorKey ||
      notif.userKey ||
      ''
    ).toString() || 'Someone',
    avatar: notif.actorAvatar || notif.avatarUrl || actor?.avatar || actor?.avatarUrl || actor?.profilePicture || null,
    displayName: (
      notif.actorDisplayName ||
      notif.displayName ||
      actor?.displayName ||
      actor?.display_name ||
      actor?.username ||
      notif.actorUsername ||
      notif.actorKey ||
      notif.userKey ||
      'Someone'
    ).toString() || 'Someone',
  };
}

function safePost(notif) {
  const post = notif.post || notif.postObj || null;
  return {
    id: notif.postId || notif.post_id || post?.id || post?._id || post?.key || '',
    text: post?.text || notif.postText || '',
  };
}

function safeCreatedAt(notif) {
  return notif.createdAt || notif.created_at || notif.timestamp || notif.date || null;
}

function safeType(notif) {
  return (notif.type || notif.kind || notif.action || '').toString().toLowerCase();
}

function safeId(notif) {
  return String(notif.id || notif._id || Math.random());
}

function getNotificationText(type, actorName) {
  switch (type) {
    case 'like':
      return `${actorName} liked your post`;
    case 'comment':
      return `${actorName} commented on your post`;
    case 'repost':
      return `${actorName} reposted your post`;
    case 'new_follower':
    case 'follow':
      return `${actorName} started following you`;
    default:
      return 'New notification';
  }
}

function getNotificationIcon(type) {
  switch (type) {
    case 'like':
      return <Heart size={18} color={theme.colors.like} fill={theme.colors.like} />;
    case 'comment':
      return <MessageCircle size={18} color={theme.colors.bookmark} fill={theme.colors.bookmark} />;
    case 'repost':
      return <Repeat size={18} color={theme.colors.success} fill={theme.colors.success} />;
    case 'new_follower':
    case 'follow':
      return <UserPlus size={18} color={theme.colors.accent} fill={theme.colors.accent} />;
    default:
      return <Bell size={18} color={theme.colors.textMuted} />;
  }
}

function formatDate(dateString) {
  if (!dateString) return 'recently';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'recently';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

const Notifications = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationsAPI.getNotifications();
      const data = response.data || {};
      if (data.ok) {
        setNotifications(extractNotifications(data));
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Notifications fetch error:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleNotificationPress = (item) => {
    const actor = safeActor(item);
    const post = safePost(item);
    if (post.id) {
      navigation.navigate('PostDetail', { postId: post.id });
    } else if (actor.key) {
      navigation.navigate('UserProfile', { userKey: actor.key });
    }
  };

  const renderItem = ({ item }) => {
    const actor = safeActor(item);
    const post = safePost(item);
    const notifType = safeType(item);
    const createdAt = safeCreatedAt(item);
    const isUnread = !item.read && item.read !== true;

    return (
      <TouchableOpacity
        style={[styles.notificationItem, isUnread && styles.unreadItem]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconContainer, isUnread && styles.iconContainerUnread]}>
          {getNotificationIcon(notifType)}
        </View>
        <View style={styles.content}>
          <View style={styles.actorRow}>
            {actor.avatar ? (
              <Image source={{ uri: actor.avatar }} style={styles.actorAvatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={14} color={theme.colors.textMuted} />
              </View>
            )}
            <Text style={styles.actorName} numberOfLines={1}>
              {actor.displayName || actor.username || 'Someone'}
            </Text>
          </View>
          <Text style={styles.notificationText} numberOfLines={2}>
            {getNotificationText(notifType, actor.displayName || actor.username || 'Someone')}
          </Text>
          {item.comment && (
            <Text style={styles.commentText} numberOfLines={1}>
              "{item.comment.text || item.comment}"
            </Text>
          )}
          <Text style={styles.timestamp}>{formatDate(createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => safeId(item)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Bell size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bgGlass,
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
  },
  notificationItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  unreadItem: {
    backgroundColor: theme.colors.bgGlassLight,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  iconContainerUnread: {
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
  },
  content: {
    flex: 1,
  },
  actorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  actorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  actorName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  notificationText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  commentText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginTop: 16,
  },
});

export default Notifications;
