import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  User,
  Verified,
  MessageSquare,
  Share2,
} from 'lucide-react-native';
import { userAPI } from '../api/client';
import PostCard from '../components/PostCard';
import * as haptics from '../utils/haptics';
import { shareProfile } from '../utils/share';
import theme from '../theme';

const UserProfile = ({ navigation, route }) => {
  const targetUserKey = route.params?.userKey;
  const insets = useSafeAreaInsets();
  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [targetUserKey]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await userAPI.getUser(targetUserKey);
      if (response.data.ok) {
        setProfileUser(response.data.profile);
        setUserPosts(response.data.posts || []);
        setIsFollowing(response.data.profile.isFollowing || false);
      }
    } catch (err) {
      console.error('UserProfile error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!targetUserKey || followLoading) return;
    setFollowLoading(true);
    try {
      const response = await userAPI.followUser(targetUserKey);
      if (response.data.ok) {
        haptics.success();
        setIsFollowing(response.data.following);
        setProfileUser((prev) => prev ? { ...prev, followerCount: response.data.followerCount } : prev);
      }
    } catch (err) {
      console.error('Follow error:', err);
      haptics.error();
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShareProfile = async () => {
    haptics.light();
    if (!profileUser) return;
    await shareProfile({
      username: profileUser.username,
      userKey: profileUser.key,
    });
  };

  const handlePostPress = (postId) => {
    navigation.navigate('PostDetail', { postId });
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profileUser) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>User not found</Text>
        </View>
      </View>
    );
  }

  const renderPost = ({ item }) => (
    <PostCard
      post={item}
      onLike={() => {}}
      onBookmark={() => {}}
      onComment={handlePostPress}
      onRepost={() => {}}
      onViewProfile={(userKey) => {
        if (userKey !== profileUser.key) {
          navigation.navigate('UserProfile', { userKey });
        }
      }}
    />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profileUser.username}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        <View style={styles.headerSection}>
          <View style={styles.avatarContainer}>
            {profileUser.avatarUrl ? (
              <Image source={{ uri: profileUser.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={40} color={theme.colors.textMuted} />
              </View>
            )}
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.username}>{profileUser.username}</Text>
              {profileUser.verified && (
                <Verified size={16} color={theme.colors.verified} fill={theme.colors.verified} />
              )}
            </View>
            <Text style={styles.displayName}>@{profileUser.key}</Text>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{profileUser.followingCount || 0}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{profileUser.followerCount || 0}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followingBtn, followLoading && styles.followLoadingBtn]}
            onPress={handleFollow}
            disabled={followLoading}
            activeOpacity={0.7}
          >
            {followLoading ? (
              <ActivityIndicator size="small" color={isFollowing ? theme.colors.textPrimary : '#fff'} />
            ) : (
              <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Chat', { userKey: profileUser.key, username: profileUser.username })} activeOpacity={0.7}>
            <MessageSquare size={18} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleShareProfile} activeOpacity={0.7}>
            <Share2 size={18} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {profileUser.private && userPosts.length === 0 ? (
          <View style={styles.privateSection}>
            <Text style={styles.privateText}>This account is private.</Text>
          </View>
        ) : (
          <>
            {profileUser.bio ? (
              <View style={styles.section}>
                <Text style={styles.bio}>{profileUser.bio}</Text>
              </View>
            ) : null}

            {profileUser.skills && profileUser.skills.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Skills</Text>
                <View style={styles.skillsContainer}>
                  {profileUser.skills.map((skill, index) => (
                    <View key={index} style={styles.skillTag}>
                      <Text style={styles.skillText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}

        <View style={styles.postsSection}>
          <Text style={styles.sectionLabel}>Posts</Text>
          {userPosts.length > 0 ? (
            <FlatList
              data={userPosts}
              renderItem={renderPost}
              keyExtractor={(item) => String(item.id || item._id || item.key || '')}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyPosts}>
              <Text style={styles.emptyText}>No posts yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070711' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { fontSize: 14, color: theme.colors.textMuted, marginTop: 12 },
  errorText: { fontSize: 16, color: theme.colors.danger, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.bgGlass },
  backButton: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  headerSection: { flexDirection: 'row', padding: 16 },
  avatarContainer: { marginRight: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.bgInput, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  displayName: { fontSize: 14, color: theme.colors.textMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', marginTop: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 12, color: '#B7B7C8', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(168, 85, 247, 0.2)' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  followBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 22, backgroundColor: '#FF3B8A' },
  followingBtn: { backgroundColor: 'rgba(124, 58, 237, 0.10)', borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.15)' },
  followLoadingBtn: { opacity: 0.7 },
  followBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  followingBtnText: { color: '#FFFFFF' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124, 58, 237, 0.10)', alignItems: 'center', justifyContent: 'center', marginLeft: 8, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.15)' },
  privateSection: { padding: 24, alignItems: 'center' },
  privateText: { fontSize: 15, color: theme.colors.textMuted },
  section: { paddingHorizontal: 16, paddingVertical: 12 },
  bio: { fontSize: 14, color: '#B7B7C8', lineHeight: 20 },
  sectionLabel: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
  skillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(124, 58, 237, 0.12)' },
  skillText: { fontSize: 13, color: '#A855F7' },
  postsSection: { paddingHorizontal: 16, paddingTop: 8 },
  emptyPosts: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontSize: 14, color: theme.colors.textMuted },
});

export default UserProfile;
