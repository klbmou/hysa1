import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  Verified,
  Settings,
  LogOut,
  Edit3,
  X,
  Save,
  MessageSquare,
  Share2,
  ArrowLeft,
  Bell,
  Shield,
  ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../api/client';
import PostCard from '../components/PostCard';
import AnimatedPressable from '../components/AnimatedPressable';
import * as haptics from '../utils/haptics';
import theme from '../theme';

const Profile = ({ navigation, route }) => {
  const { user: currentUser, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isViewingOwnProfile, setIsViewingOwnProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messageSheetOpen, setMessageSheetOpen] = useState(false);

  const settingsAnim = useRef(new Animated.Value(0)).current;
  const messageAnim = useRef(new Animated.Value(0)).current;

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
    if (!targetUserKey || followLoading) return;

    setFollowLoading(true);
    try {
      const response = await userAPI.followUser(targetUserKey);
      if (response.data.ok) {
        haptics.success();
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
      haptics.error();
    } finally {
      setFollowLoading(false);
    }
  };

  const handleLogout = async () => {
    setSettingsOpen(false);
    haptics.medium();
    await logout();
  };

  const handleOpenEdit = () => {
    haptics.light();
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
        haptics.success();
        setProfileUser((prev) => ({
          ...prev,
          bio: editBio,
          skills,
        }));
        setEditOpen(false);
      }
    } catch (err) {
      console.error('Update profile error:', err);
      haptics.error();
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleShareProfile = async () => {
    haptics.light();
    if (!profileUser) return;
    try {
      await Share.share({
        message: `Check out @${profileUser.username || profileUser.key} on HYSA1`,
        title: `${profileUser.username || profileUser.key}'s Profile`,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const openMessageSheet = () => {
    haptics.light();
    setMessageSheetOpen(true);
    Animated.spring(messageAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 8,
    }).start();
  };

  const closeMessageSheet = () => {
    Animated.timing(messageAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setMessageSheetOpen(false));
  };

  const openSettingsSheet = () => {
    haptics.light();
    setSettingsOpen(true);
    Animated.spring(settingsAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 8,
    }).start();
  };

  const closeSettingsSheet = () => {
    Animated.timing(settingsAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSettingsOpen(false));
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
          navigation.navigate('Profile', { userKey });
        }
      }}
    />
  );

  const slideUpStyle = {
    transform: [
      {
        translateY: settingsAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [300, 0],
        }),
      },
    ],
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {!isViewingOwnProfile ? (
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text style={styles.headerTitle}>
          {isViewingOwnProfile ? 'Profile' : profileUser.username}
        </Text>
        {isViewingOwnProfile && (
          <TouchableOpacity style={styles.headerIconBtn} onPress={openSettingsSheet}>
            <Settings size={18} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        )}
        {!isViewingOwnProfile && <View style={{ width: 22 }} />}
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
          {isViewingOwnProfile ? (
            <>
              <TouchableOpacity style={styles.actionBtn} onPress={handleOpenEdit} activeOpacity={0.7}>
                <Edit3 size={16} color={theme.colors.textPrimary} />
                <Text style={styles.actionBtnText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleShareProfile} activeOpacity={0.7}>
                <Share2 size={18} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.followBtn,
                  isFollowing && styles.followingBtn,
                  followLoading && styles.followLoadingBtn,
                ]}
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
              <TouchableOpacity style={styles.iconBtn} onPress={openMessageSheet} activeOpacity={0.7}>
                <MessageSquare size={18} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleShareProfile} activeOpacity={0.7}>
                <Share2 size={18} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </>
          )}
        </View>

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

      {/* Edit Profile Modal */}
      <Modal visible={editOpen} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.editOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
          <View style={styles.editCard}>
            <View style={styles.editHandle} />
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditOpen(false)} activeOpacity={0.7}>
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
              activeOpacity={0.7}
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
            <View style={{ height: Math.max(insets.bottom, 12) }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settings Sheet */}
      <Modal visible={settingsOpen} transparent animationType="fade" statusBarTranslucent>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closeSettingsSheet}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <Animated.View style={[styles.settingsSheet, slideUpStyle]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Settings</Text>

              <View style={styles.sheetItem}>
                <User size={20} color={theme.colors.textSecondary} />
                <Text style={styles.sheetItemText}>Account</Text>
                <Text style={styles.sheetItemSubtext}>Coming soon</Text>
                <ChevronRight size={16} color={theme.colors.textMuted} />
              </View>

              <View style={styles.sheetItem}>
                <Shield size={20} color={theme.colors.textSecondary} />
                <Text style={styles.sheetItemText}>Privacy</Text>
                <Text style={styles.sheetItemSubtext}>Coming soon</Text>
                <ChevronRight size={16} color={theme.colors.textMuted} />
              </View>

              <View style={styles.sheetItem}>
                <Bell size={20} color={theme.colors.textSecondary} />
                <Text style={styles.sheetItemText}>Notifications</Text>
                <Text style={styles.sheetItemSubtext}>Coming soon</Text>
                <ChevronRight size={16} color={theme.colors.textMuted} />
              </View>

              <View style={styles.sheetDivider} />

              <TouchableOpacity style={styles.sheetItemDanger} onPress={handleLogout} activeOpacity={0.6}>
                <LogOut size={20} color={theme.colors.danger} />
                <Text style={[styles.sheetItemText, { color: theme.colors.danger }]}>Logout</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeSettingsSheet} activeOpacity={0.7}>
                <Text style={styles.sheetCloseText}>Cancel</Text>
              </TouchableOpacity>
              <View style={{ height: Math.max(insets.bottom, 16) }} />
            </Animated.View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Message Sheet */}
      <Modal visible={messageSheetOpen} transparent animationType="fade" statusBarTranslucent>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closeMessageSheet}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <Animated.View style={[styles.messageSheet, slideUpStyle]}>
              <View style={styles.sheetHandle} />
              <View style={styles.messageSheetIcon}>
                <MessageSquare size={32} color={theme.colors.accent} />
              </View>
              <Text style={styles.messageSheetTitle}>Messages</Text>
              <Text style={styles.messageSheetDesc}>
                Direct messaging is coming soon to HYSA.{'\n'}
                You will be able to chat with other users privately.
              </Text>
              <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeMessageSheet} activeOpacity={0.7}>
                <Text style={styles.sheetCloseText}>Got it</Text>
              </TouchableOpacity>
              <View style={{ height: Math.max(insets.bottom, 16) }} />
            </Animated.View>
          </TouchableOpacity>
        </TouchableOpacity>
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
  loadingText: {
    ...theme.typography.bodySm,
    color: theme.colors.textMuted,
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.danger,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bgGlass,
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSection: {
    flexDirection: 'row',
    padding: 16,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
    marginBottom: 10,
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
    fontSize: 13,
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bgInput,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  iconBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bgInput,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  followBtn: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
  },
  followBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  followingBtn: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  followingBtnText: {
    color: theme.colors.textPrimary,
  },
  followLoadingBtn: {
    opacity: 0.7,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  sectionLabel: {
    ...theme.typography.bodySm,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  bio: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillTag: {
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
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
    paddingTop: 8,
    minHeight: 300,
  },
  editHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 16,
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
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    backgroundColor: theme.colors.bgCard,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  messageSheet: {
    backgroundColor: theme.colors.bgCard,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  sheetItemText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  sheetItemSubtext: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginRight: 8,
  },
  sheetItemDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: 8,
  },
  sheetCloseBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  sheetCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  messageSheetIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  messageSheetTitle: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  messageSheetDesc: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
});

export default Profile;
