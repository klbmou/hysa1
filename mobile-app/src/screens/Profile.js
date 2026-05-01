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
  Alert,
} from 'react-native';
import {
  User,
  Verified,
  MapPin,
  Link as LinkIcon,
  Calendar,
  Settings,
  LogOut,
  Edit3,
  ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../api/client';
import PostCard from '../components/PostCard';

const Profile = ({ navigation, route }) => {
  const { user: currentUser, logout, isAuthenticated } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isViewingOwnProfile, setIsViewingOwnProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const targetUserKey = route.params?.userKey;

  useEffect(() => {
    fetchProfile();
  }, [targetUserKey]);

  const fetchProfile = async () => {
    setLoading(true);
    
    if (!targetUserKey && currentUser) {
      // Viewing own profile
      setProfileUser(currentUser);
      setIsViewingOwnProfile(true);
      setLoading(false);
      return;
    }

    try {
      const response = await userAPI.getUser(targetUserKey || currentUser?.key);
      if (response.data.ok) {
        setProfileUser(response.data.profile);
        setUserPosts(response.data.posts || []);
        setIsFollowing(response.data.profile.isFollowing || false);
        setIsViewingOwnProfile(false);
      }
    } catch (err) {
      console.error('Profile error:', err);
      if (currentUser) {
        setProfileUser(currentUser);
        setIsViewingOwnProfile(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!targetUserKey) return;
    
    try {
      const response = await userAPI.followUser(targetUserKey);
      if (response.data.ok) {
        setIsFollowing(response.data.following);
        if (profileUser) {
          setProfileUser({
            ...profileUser,
            followerCount: response.data.followerCount,
          });
        }
      }
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handlePostPress = (postId) => {
    navigation.navigate('PostDetail', { postId });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a1a2e" />
      </View>
    );
  }

  if (!profileUser) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>User not found</Text>
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
          navigation.navigate('Profile', { userKey });
        }
      }}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => {}}
        >
          {profileUser.avatarUrl ? (
            <Image
              source={{ uri: profileUser.avatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={40} color="#666" />
            </View>
          )}
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.username}>{profileUser.username}</Text>
            {profileUser.verified && (
              <Verified size={20} color="#1DA1F2" fill="#1DA1F2" />
            )}
          </View>
          <Text style={styles.displayName}>
            @{profileUser.key}
          </Text>
          
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {profileUser.followingCount || 0}
              </Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {profileUser.followerCount || 0}
              </Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        {isViewingOwnProfile ? (
          <>
            <TouchableOpacity style={styles.profileButton}>
              <Edit3 size={18} color="#1a1a2e" />
              <Text style={styles.profileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => {}}>
              <Settings size={22} color="#1a1a2e" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleLogout}>
              <LogOut size={22} color="#e0245e" />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowing && styles.followingButton,
            ]}
            onPress={handleFollow}
          >
            <Text
              style={[
                styles.followButtonText,
                isFollowing && styles.followingButtonText,
              ]}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bio */}
      {profileUser.bio ? (
        <View style={styles.section}>
          <Text style={styles.bio}>{profileUser.bio}</Text>
        </View>
      ) : null}

      {/* Skills */}
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

      {/* Posts */}
      <View style={styles.postsSection}>
        <Text style={styles.sectionLabel}>Posts</Text>
        {userPosts.length > 0 ? (
          <FlatList
            data={userPosts}
            renderItem={renderPost}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyPosts}>
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#e0245e',
  },
  header: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  displayName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  profileButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  profileButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
    marginLeft: 6,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  followButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  followingButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  followingButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  bio: {
    fontSize: 15,
    lineHeight: 20,
    color: '#333',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skillTag: {
    backgroundColor: '#f0f4f8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  skillText: {
    fontSize: 13,
    color: '#1a1a2e',
  },
  postsSection: {
    flex: 1,
  },
  emptyPosts: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default Profile;