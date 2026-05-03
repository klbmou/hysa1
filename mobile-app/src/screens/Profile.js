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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
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
  X,
  Save,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../api/client';
import PostCard from '../components/PostCard';
import theme from '../theme';

const Profile = ({ navigation, route }) => {
  const { user: currentUser, logout, isAuthenticated } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isViewingOwnProfile, setIsViewingOwnProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const targetUserKey = route.params?.userKey;

  useEffect(() => {
    fetchProfile();
  }, [targetUserKey]);

  const fetchProfile = async () => {
    setLoading(true);

    if (!targetUserKey && currentUser) {
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
        onPress: async () => { await logout(); },
      },
    ]);
  };

  const handleOpenEdit = () => {
    if (profileUser) {
      setEditBio(profileUser.bio || '');
      setEditSkills(Array.isArray(profileUser.skills) ? profileUser.skills.join(', ') : '');
      setEditOpen(true);
    }
  };

  const handleEditSubmit = async () => {
    setEditSubmitting(true);
    try {
      const skills = editSkills
        ? editSkills.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const updates = { bio: editBio };
      if (skills.length > 0) updates.skills = skills;
      const response = await userAPI.updateProfile(updates);
      if (response.data.ok) {
        setProfileUser((prev) => ({
          ...prev,
          bio: editBio,
          skills,
        }));
        setEditOpen(false);
      }
    } catch (err) {
      console.error('Update profile error:', err);
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handlePostPress = (postId) => {
    navigation.navigate('PostDetail', { postId });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.avatarContainer}>
          {profileUser.avatarUrl ? (
            <Image source={{ uri: profileUser.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={40} color={theme.colors.textMuted} />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.username}>{profileUser.username}</Text>
            {profileUser.verified && (
              <Verified size={18} color={theme.colors.verified} fill={theme.colors.verified} />
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

      <View style={styles.actionsRow}>
        {isViewingOwnProfile ? (
          <>
            <TouchableOpacity style={styles.profileButton} onPress={handleOpenEdit}>
              <Edit3 size={16} color={theme.colors.textPrimary} />
              <Text style={styles.profileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => {}}>
              <Settings size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleLogout}>
              <LogOut size={20} color={theme.colors.danger} />
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

      <ScrollView showsVerticalScrollIndicator={false}>
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
      </ScrollView>

      <Modal visible={editOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.editOverlay}
        >
          <View style={styles.editCard}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditOpen(false)}>
                <X size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.editLabel}>Bio</Text>
            <TextInput
              style={styles.editInput}
              placeholder="Tell us about yourself..."
              placeholderTextColor={theme.colors.textMuted}
              value={editBio}
              onChangeText={setEditBio}
              multiline
              maxLength={280}
            />

            <Text style={styles.editLabel}>Skills (comma separated)</Text>
            <TextInput
              style={styles.editInput}
              placeholder="e.g. React, Node.js, Design"
              placeholderTextColor={theme.colors.textMuted}
              value={editSkills}
              onChangeText={setEditSkills}
            />

            <TouchableOpacity
              style={[styles.editSubmit, editSubmitting && styles.editSubmitDisabled]}
              onPress={handleEditSubmit}
              disabled={editSubmitting}
            >
              {editSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Save size={16} color="#fff" />
                  <Text style={styles.editSubmitText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.danger,
  },
  header: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
    backgroundColor: theme.colors.bgInput,
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
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
  },
  displayName: {
    fontSize: 14,
    color: theme.colors.textMuted,
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
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: theme.colors.border,
    marginHorizontal: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  profileButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bgInput,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  profileButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginLeft: 6,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    backgroundColor: theme.colors.bgInput,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  followButton: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  followingButton: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  followingButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  sectionLabel: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  bio: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skillTag: {
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    marginRight: 8,
    marginBottom: 8,
  },
  skillText: {
    fontSize: 13,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  postsSection: {
    flex: 1,
    paddingBottom: 20,
  },
  emptyPosts: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  editOverlay: {
    flex: 1,
    backgroundColor: theme.colors.bgOverlay,
    justifyContent: 'flex-end',
  },
  editCard: {
    backgroundColor: theme.colors.bgCard,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: 20,
    minHeight: 300,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  editTitle: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
  },
  editLabel: {
    ...theme.typography.bodySm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: theme.colors.bgInput,
    borderRadius: theme.radius.md,
    padding: 14,
    fontSize: 15,
    color: theme.colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  editSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    marginTop: 8,
    gap: 8,
  },
  editSubmitDisabled: {
    opacity: 0.5,
  },
  editSubmitText: {
    ...theme.typography.button,
    color: '#fff',
  },
});

export default Profile;
