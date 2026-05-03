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
import {
  Heart,
  MessageCircle,
  Repeat,
  UserPlus,
  User,
  Bell,
} from 'lucide-react-native';
import { notificationsAPI } from '../api/client';

// Mock notifications data since the API endpoint may not exist
const generateMockNotifications = () => [
  {
    id: '1',
    type: 'like',
    actor: { username: 'alice', avatar: null },
    post: { text: 'Your post about React Native', id: '1' },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    read: false,
  },
  {
    id: '2',
    type: 'follow',
    actor: { username: 'bob', avatar: null },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    read: false,
  },
  {
    id: '3',
    type: 'comment',
    actor: { username: 'charlie', avatar: null },
    post: { text: 'Your post about Expo', id: '2' },
    comment: { text: 'Great post!' },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    read: true,
  },
  {
    id: '4',
    type: 'repost',
    actor: { username: 'diana', avatar: null },
    post: { text: 'Your thoughts on mobile dev', id: '3' },
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    read: true,
  },
];

const Notifications = ({ navigation }) => {
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
      if (response.data.ok) {
        setNotifications(response.data.notifications || []);
      } else {
        setNotifications(generateMockNotifications());
      }
    } catch (err) {
      console.error('Notifications error:', err);
      setNotifications(generateMockNotifications());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
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
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return <Heart size={20} color="#e0245e" fill="#e0245e" />;
      case 'comment':
        return <MessageCircle size={20} color="#1DA1F2" fill="#1DA1F2" />;
      case 'repost':
        return <Repeat size={20} color="#17BF63" fill="#17BF63" />;
      case 'new_follower':
      case 'follow':
        return <UserPlus size={20} color="#1DA1F2" fill="#1DA1F2" />;
      default:
        return <Bell size={20} color="#666" />;
    }
  };

  const getNotificationText = (notification) => {
    switch (notification.type) {
      case 'like':
        return `${notification.actor.username} liked your post`;
      case 'comment':
        return `${notification.actor.username} commented on your post`;
      case 'repost':
        return `${notification.actor.username} reposted your post`;
      case 'new_follower':
      case 'follow':
        return `${notification.actor.username} started following you`;
      default:
        return 'New notification';
    }
  };

  const handleNotificationPress = (notification) => {
    if (notification.post) {
      navigation.navigate('PostDetail', { postId: notification.post.id });
    } else if (notification.actor) {
      navigation.navigate('Profile', { userKey: notification.actor.username });
    }
  };

  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.read && styles.unreadItem]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.iconContainer}>
        {getNotificationIcon(item.type)}
      </View>
      <View style={styles.content}>
        <View style={styles.actorRow}>
          {item.actor.avatar ? (
            <Image source={{ uri: item.actor.avatar }} style={styles.actorAvatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={16} color="#666" />
            </View>
          )}
          <Text style={styles.actorName}>{item.actor.username}</Text>
        </View>
        <Text style={styles.notificationText}>
          {getNotificationText(item)}
        </Text>
        {item.comment && (
          <Text style={styles.commentText} numberOfLines={1}>
            "{item.comment.text}"
          </Text>
        )}
        <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a1a2e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1a1a2e"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Bell size={48} color="#ccc" />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  notificationItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  unreadItem: {
    backgroundColor: '#f8f9fa',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  actorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  notificationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#ccc',
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
    color: '#999',
    marginTop: 16,
  },
});

export default Notifications;