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
import { useAuth } from '../context/AuthContext';
import { userAPI, postAPI } from '../api/client';
import PostCard from '../components/PostCard';
import * as haptics from '../utils/haptics';
import { shareProfile } from '../utils/share';
import { sanitizeBio } from '../utils/safety';
import { displayHandle, displayUsername, nameTextStyle } from '../utils/display';
import theme from '../theme';

const UserProfile = ({ navigation, route }) => {
  const { user: currentUser } = useAuth();
  const targetUserKey = route.params?.userKey;
  const insets = useSafeAreaInsets();
  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    const myKey = currentUser && (currentUser.key || currentUser.userKey || '');
    if (targetUserKey && myKey && String(targetUserKey) === String(myKey)) {
      navigation.replace('Profile');
      return;
    }
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

  const handleViewProfile = (userKey) => {
    const myKey = currentUser && (currentUser.key || currentUser.userKey || '');
    if (userKey && myKey && String(userKey) === String(myKey)) {
      navigation.navigate('Profile');
    } else if (userKey && userKey !== profileUser?.key) {
      navigation.navigate('UserProfile', { userKey });
    }
  };

  const handleProfileRepost = async (postId) => {
    const response = await postAPI.repostPost(postId);
    const payload = response?.data || {};
    setUserPosts((prev) => prev.map((post) => {
      if (String(post.id) !== String(postId)) return post;
      const currentRepostCount = post.repostCount ?? post.repostsCount ?? post.reposts?.length ?? 0;
      return {
        ...post,
        repostedByMe: typeof payload.reposted === 'boolean' ? payload.reposted : !post.repostedByMe,
        repostCount: typeof payload.repostCount === 'number'
          ? payload.repostCount
          : Math.max(0, currentRepostCount + (post.repostedByMe ? -1 : 1)),
      };
    }));
    return payload;
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
      onRepost={handleProfileRepost}
      onViewProfile={handleViewProfile}
    />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, nameTextStyle(displayUsername(profileUser.username), 'center')]}>{displayUsername(profileUser.username)}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.headerSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarRingOuter}>
              <View style={styles.avatarRingInner}>
                {profileUser.avatarUrl ? (
                  <Image source={{ uri: profileUser.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <User size={40} color={theme.colors.textMuted} />
                  </View>
                )}
              </View>
            </View>
            {profileUser.verified && (
              <View style={styles.verifiedBadge}>
                <Verified size={14} color="#fff" fill="#fff" />
              </View>
            )}
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.username, nameTextStyle(displayUsername(profileUser.username))]} numberOfLines={1}>{displayUsername(profileUser.username)}</Text>
            </View>
            <Text style={[styles.displayName, nameTextStyle(displayHandle(profileUser.key || profileUser.username))]} numberOfLines={1}>@{displayHandle(profileUser.key || profileUser.username)}</Text>

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
                <Text style={styles.bio}>{sanitizeBio(profileUser.bio)}</Text>
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
  loadingText: { fontSize: 14, color: '#8A8A9A', marginTop: 12 },
  errorText: { fontSize: 16, color: '#FF3B8A', textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', backgroundColor: 'rgba(7,7,17,0.92)' },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  headerSection: { flexDirection: 'row', padding: 20, alignItems: 'center' },
  avatarContainer: { marginRight: 18, position: 'relative' },
  avatarRingOuter: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,59,138,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,59,138,0.15)' },
  avatarRingInner: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#070711', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 74, height: 74, borderRadius: 37 },
  avatarPlaceholder: { width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  verifiedBadge: { position: 'absolute', bottom: -2, right: 12, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FF3B8A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#070711' },
  headerInfo: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  username: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', flex: 1 },
  displayName: { fontSize: 14, color: '#8A8A9A', marginBottom: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 12, color: '#8A8A9A', marginTop: 2 },
  statDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 10 },
  followBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 20, backgroundColor: '#FF3B8A' },
  followingBtn: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  followLoadingBtn: { opacity: 0.7 },
  followBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  followingBtnText: { color: '#FFFFFF' },
  iconBtn: { width: 42, height: 42, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  privateSection: { padding: 40, alignItems: 'center' },
  privateText: { fontSize: 15, color: '#8A8A9A' },
  section: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  bio: { fontSize: 15, color: '#D0D0DA', lineHeight: 22 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#8A8A9A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  skillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(124, 58, 237, 0.12)', borderWidth: 1, borderColor: 'rgba(124, 58, 237, 0.2)' },
  skillText: { fontSize: 13, color: '#A78BFA', fontWeight: '600' },
  postsSection: { paddingHorizontal: 0, paddingTop: 8, paddingBottom: 120 },
  emptyPosts: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#8A8A9A' },
});

export default UserProfile;
