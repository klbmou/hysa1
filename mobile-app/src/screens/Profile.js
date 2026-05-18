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
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
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
  Camera,
  Globe,
  Info,
  Moon,
  Smartphone,
  LifeBuoy,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { userAPI, uploadAPI, postAPI } from '../api/client';
import PostCard from '../components/PostCard';
import AnimatedPressable from '../components/AnimatedPressable';
import * as haptics from '../utils/haptics';
import { shareProfile } from '../utils/share';
import { displayHandle, displayUsername, nameTextStyle } from '../utils/display';
import theme from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const [editAvatarUri, setEditAvatarUri] = useState(null);
  const [editAvatarUploading, setEditAvatarUploading] = useState(false);
  const [editAvatarError, setEditAvatarError] = useState(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messageSheetOpen, setMessageSheetOpen] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  const settingsAnim = useRef(new Animated.Value(0)).current;
  const messageAnim = useRef(new Animated.Value(0)).current;

  const targetUserKey = route.params?.userKey;

  const currentKey = currentUser && (currentUser.key || currentUser.userKey || '');

  useEffect(() => {
    const isOwn = !targetUserKey || (currentKey && String(targetUserKey) === String(currentKey));
    setIsViewingOwnProfile(isOwn);
    fetchProfile(isOwn);
  }, [targetUserKey, currentKey]);

  useFocusEffect(
    React.useCallback(() => {
      if (!targetUserKey && currentUser) {
        setIsViewingOwnProfile(true);
        setProfileUser(currentUser);
        setLoading(false);
      }
    }, [targetUserKey, currentUser])
  );

  const fetchProfile = async (isOwn) => {
    setLoading(true);
    try {
      // Always fetch from API to get the posts, even for own profile
      const userKey = targetUserKey || currentUser?.key || currentUser?.username;
      const response = await userAPI.getUser(userKey);
      if (response.data.ok) {
        setProfileUser(response.data.profile);
        setUserPosts(response.data.posts || []);
        setIsFollowing(response.data.profile.isFollowing || false);
        setIsViewingOwnProfile(isOwn);
        setIsPrivate(!!response.data.profile.isPrivate);
      }
    } catch (err) {
      console.error('Profile error:', err);
      if (isOwn && currentUser) {
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

  const handleTogglePrivacy = async () => {
    setPrivacyLoading(true);
    try {
      const newValue = !isPrivate;
      const response = await userAPI.setPrivacy(newValue);
      if (response.data.ok) {
        setIsPrivate(newValue);
        setProfileUser((prev) => prev ? { ...prev, isPrivate: newValue } : prev);
        haptics.success();
      }
    } catch (err) {
      console.error('Privacy error:', err);
      haptics.error();
    } finally {
      setPrivacyLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim()) {
      setPasswordError('Both fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    setPasswordLoading(true);
    setPasswordError(null);
    try {
      const response = await userAPI.changePassword(oldPassword, newPassword);
      if (response.data.ok) {
        setOldPassword('');
        setNewPassword('');
        setChangePasswordOpen(false);
        haptics.success();
      } else {
        setPasswordError(response.data.error || 'Failed to change password.');
      }
    } catch (err) {
      console.error('Password change error:', err);
      setPasswordError('Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleOpenEdit = () => {
    haptics.light();
    if (profileUser) {
      setEditBio(profileUser.bio || '');
      setEditSkills(Array.isArray(profileUser.skills) ? profileUser.skills.join(', ') : '');
      setEditAvatarUri(null);
      setEditAvatarUploading(false);
      setEditAvatarError(null);
      setEditOpen(true);
    }
  };

  const handleChangeAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setEditAvatarError('Permission to access media library is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setEditAvatarUploading(true);
        setEditAvatarError(null);
        try {
          const asset = result.assets[0];
          const mime = asset.mimeType || asset.type || 'image/jpeg';
          const b64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: 'base64',
          });
          const dataUrl = `data:${mime};base64,${b64}`;

          const uploadResponse = await uploadAPI.uploadMedia(dataUrl);
          if (uploadResponse.data.ok) {
            setEditAvatarUri(uploadResponse.data.media.fullUrl || uploadResponse.data.media.url);
            setEditAvatarUploading(false);
          } else {
            setEditAvatarError(uploadResponse.data.error || 'Upload failed.');
            setEditAvatarUploading(false);
          }
        } catch (err) {
          console.error('Avatar upload error:', err);
          setEditAvatarError('Failed to upload avatar.');
          setEditAvatarUploading(false);
        }
      }
    } catch (err) {
      console.error('Avatar pick error:', err);
      setEditAvatarError('Failed to pick image.');
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
      if (editAvatarUri) {
        updates.avatarUrl = editAvatarUri;
      }
      const response = await userAPI.updateProfile(updates);
      if (response.data.ok) {
        haptics.success();
        const updatedUser = {
          ...profileUser,
          bio: editBio,
          skills,
        };
        if (editAvatarUri) {
          updatedUser.avatarUrl = editAvatarUri;
        }
        setProfileUser(updatedUser);
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
    await shareProfile({
      username: profileUser.username,
      userKey: profileUser.key,
    });
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

  const handleViewProfile = (userKey) => {
    const myKey = currentUser && (currentUser.key || currentUser.userKey || '');
    if (userKey && myKey && String(userKey) === String(myKey)) {
      navigation.navigate('Profile');
    } else if (userKey) {
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

  const slideUpStyle = {
    transform: [
      {
        translateY: settingsAnim.interpolate({
          inputRange: [0, 1], // 0 means hidden (bottom), 1 means visible (top)
          outputRange: [SCREEN_HEIGHT, 0], // Start from off-screen bottom, animate to 0 (visible)
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
          {isViewingOwnProfile ? 'Profile' : displayUsername(profileUser.username)}
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
              <Text style={[styles.username, nameTextStyle(displayUsername(profileUser.username))]} numberOfLines={1}>{displayUsername(profileUser.username)}</Text>
              {profileUser.verified && ( // Changed size to 14 for consistency
                <Verified size={14} color={theme.colors.verified} fill={theme.colors.verified} style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={[styles.displayName, nameTextStyle(displayHandle(profileUser.key || profileUser.username))]} numberOfLines={1}>@{displayHandle(profileUser.key || profileUser.username)}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statCard}> 
                <Text style={styles.statValue}>{profileUser.followingCount || 0}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
              <View style={styles.statCard}> 
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

            <TouchableOpacity style={styles.avatarEditRow} onPress={handleChangeAvatar} disabled={editAvatarUploading} activeOpacity={0.7}>
              {editAvatarUri ? (
                <Image source={{ uri: editAvatarUri }} style={styles.avatarEditPreview} />
              ) : editAvatarUploading ? (
                <View style={styles.avatarEditPlaceholder}>
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                </View>
              ) : (
                <View style={styles.avatarEditPlaceholder}>
                  <Camera size={24} color={theme.colors.accent} />
                </View>
              )}
              <View style={styles.avatarEditInfo}>
                <Text style={styles.avatarEditLabel}>Change avatar</Text>
                <Text style={styles.avatarEditSubtext}>Tap to pick an image</Text>
              </View>
            </TouchableOpacity>

            {editAvatarError && (
              <Text style={styles.editErrorText}>{editAvatarError}</Text>
            )}

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

              <Text style={styles.sheetSectionLabel}>Account</Text>

              <TouchableOpacity style={styles.sheetItem} onPress={() => { setSettingsOpen(false); navigation.navigate('DMThreads'); haptics.light(); }} activeOpacity={0.7}>
                <View style={styles.sheetItemIcon}>
                  <MessageSquare size={18} color={theme.colors.accent} />
                </View>
                <View style={styles.sheetItemContent}>
                  <Text style={styles.sheetItemText}>Messages</Text>
                  <Text style={styles.sheetItemSubtext}>Direct messages and threads</Text>
                </View>
                <ChevronRight size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetItem} onPress={handleOpenEdit} activeOpacity={0.7}>
                <View style={styles.sheetItemIcon}>
                  <Edit3 size={18} color={theme.colors.textSecondary} />
                </View>
                <View style={styles.sheetItemContent}>
                  <Text style={styles.sheetItemText}>Edit Profile</Text>
                  <Text style={styles.sheetItemSubtext}>Bio, skills, avatar</Text>
                </View>
                <ChevronRight size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetItem} onPress={() => { setChangePasswordOpen(true); setPasswordError(null); setOldPassword(''); setNewPassword(''); haptics.light(); }} activeOpacity={0.7}>
                <View style={styles.sheetItemIcon}>
                  <Shield size={18} color={theme.colors.textSecondary} />
                </View>
                <View style={styles.sheetItemContent}>
                  <Text style={styles.sheetItemText}>Change Password</Text>
                  <Text style={styles.sheetItemSubtext}>Update your security credentials</Text>
                </View>
                <ChevronRight size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.sheetSectionDivider} />
              <Text style={styles.sheetSectionLabel}>Preferences</Text>

              <TouchableOpacity style={styles.sheetItem} onPress={handleTogglePrivacy} disabled={privacyLoading} activeOpacity={0.7}>
                <View style={styles.sheetItemIcon}>
                  <Shield size={18} color={isPrivate ? theme.colors.accent : theme.colors.textSecondary} />
                </View>
                <View style={styles.sheetItemContent}>
                  <Text style={styles.sheetItemText}>Private Account</Text>
                  <Text style={styles.sheetItemSubtext}>{isPrivate ? 'Only followers can see your posts' : 'Anyone can view your posts'}</Text>
                </View>
                <View style={styles.toggleTrack}>
                  <View style={[styles.toggleThumb, isPrivate && styles.toggleThumbOn, privacyLoading && styles.toggleThumbLoading]} />
                </View>
              </TouchableOpacity>

              <View style={[styles.sheetItem, { opacity: 0.45 }]}>
                <View style={styles.sheetItemIcon}>
                  <Globe size={18} color={theme.colors.textMuted} />
                </View>
                <View style={styles.sheetItemContent}>
                  <Text style={styles.sheetItemText}>Language</Text>
                  <Text style={styles.sheetItemSubtext}>Coming later</Text>
                </View>
              </View>

              <View style={[styles.sheetItem, { opacity: 0.45 }]}>
                <View style={styles.sheetItemIcon}>
                  <Bell size={18} color={theme.colors.textMuted} />
                </View>
                <View style={styles.sheetItemContent}>
                  <Text style={styles.sheetItemText}>Notifications</Text>
                  <Text style={styles.sheetItemSubtext}>Coming later</Text>
                </View>
              </View>

              <View style={styles.sheetSectionDivider} />
              <Text style={styles.sheetSectionLabel}>Support</Text>

              <View style={[styles.sheetItem, { opacity: 0.45 }]}>
                <View style={styles.sheetItemIcon}>
                  <LifeBuoy size={18} color={theme.colors.textMuted} />
                </View>
                <View style={styles.sheetItemContent}>
                  <Text style={styles.sheetItemText}>Help & Support</Text>
                  <Text style={styles.sheetItemSubtext}>Coming later</Text>
                </View>
              </View>

              <View style={[styles.sheetItem, { opacity: 0.45 }]}>
                <View style={styles.sheetItemIcon}>
                  <Info size={18} color={theme.colors.textMuted} />
                </View>
                <View style={styles.sheetItemContent}>
                  <Text style={styles.sheetItemText}>About HYSA</Text>
                  <Text style={styles.sheetItemSubtext}>Version 1.0.0</Text>
                </View>
              </View>

              <View style={styles.sheetDivider} />

              <TouchableOpacity style={styles.sheetItemDanger} onPress={handleLogout} activeOpacity={0.6}>
                <View style={styles.sheetItemIcon}>
                  <LogOut size={18} color={theme.colors.danger} />
                </View>
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

      {/* Change Password Modal */}
      <Modal visible={changePasswordOpen} transparent animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.editOverlay} keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
          <View style={styles.editCard}>
            <View style={styles.editHandle} />
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setChangePasswordOpen(false)} activeOpacity={0.7}>
                <X size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.editLabel}>Current Password</Text>
            <TextInput
              style={styles.editInput}
              placeholder="Enter current password"
              placeholderTextColor={theme.colors.textMuted}
              value={oldPassword}
              onChangeText={setOldPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.editLabel}>New Password</Text>
            <TextInput
              style={styles.editInput}
              placeholder="Enter new password (min 8 chars)"
              placeholderTextColor={theme.colors.textMuted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {passwordError && <Text style={styles.editErrorText}>{passwordError}</Text>}

            <TouchableOpacity
              style={[styles.editSubmit, passwordLoading && styles.editSubmitDisabled]}
              onPress={handleChangePassword}
              disabled={passwordLoading}
              activeOpacity={0.7}
            >
              {passwordLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.editSubmitText}>Update Password</Text>
              )}
            </TouchableOpacity>
            <View style={{ height: Math.max(insets.bottom, 12) }} />
          </View>
        </KeyboardAvoidingView>
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
  container: { flex: 1, backgroundColor: '#070711' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#8A8A9A', marginTop: 12 },
  errorText: { fontSize: 16, color: '#FF3B8A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(7,7,17,0.92)',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)' },
  headerSection: { flexDirection: 'row', padding: 20, alignItems: 'center' },
  avatarContainer: { marginRight: 18 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)' },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.06)', justifyContent: 'center' },
  headerInfo: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  username: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  displayName: { fontSize: 14, color: '#8A8A9A', marginBottom: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statCard: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 12, color: '#8A8A9A', marginTop: 2 },
  statDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 8 },
  actionsRow: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 18, gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 10, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 6,
  },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  iconBtn: {
    width: 42, height: 42, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  followBtn: { flex: 1, backgroundColor: '#FF3B8A', paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  followBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  followingBtn: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  followingBtnText: { color: '#ffffff' },
  followLoadingBtn: { opacity: 0.7 },
  section: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#8A8A9A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  bio: { fontSize: 15, lineHeight: 22, color: '#D0D0DA' },
  skillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillTag: { backgroundColor: 'rgba(124, 58, 237, 0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(124, 58, 237, 0.2)' },
  skillText: { fontSize: 13, color: '#A78BFA', fontWeight: '600' },
  postsSection: { paddingHorizontal: 0, paddingBottom: 120 },
  emptyPosts: { padding: 60, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#8A8A9A' },
  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  editCard: { backgroundColor: '#0C0C1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12, minHeight: 300, borderWidth: 1, borderTopWidth: 0, borderColor: 'rgba(255,255,255,0.06)' },
  editHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', marginBottom: 16 },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  editTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  editLabel: { fontSize: 13, fontWeight: '600', color: '#8A8A9A', marginBottom: 8 },
  editInput: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, fontSize: 15,
    color: '#FFFFFF', minHeight: 80, textAlignVertical: 'top', marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  editSubmit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FF3B8A', borderRadius: 20, paddingVertical: 14, marginTop: 8, gap: 8,
  },
  editSubmitDisabled: { opacity: 0.5 },
  editSubmitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  avatarEditRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, marginBottom: 8, gap: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, paddingHorizontal: 14 },
  avatarEditPreview: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)' },
  avatarEditPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  avatarEditInfo: { flex: 1 },
  avatarEditLabel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  avatarEditSubtext: { fontSize: 13, color: '#8A8A9A' },
  editErrorText: { fontSize: 13, color: '#FF3B8A', marginBottom: 10 },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  settingsSheet: { backgroundColor: '#0C0C1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8, maxHeight: SCREEN_HEIGHT * 0.85, borderWidth: 1, borderTopWidth: 0, borderColor: 'rgba(255,255,255,0.06)' },
  sheetSectionLabel: { fontSize: 11, fontWeight: '700', color: '#8A8A9A', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 10, marginBottom: 6, paddingLeft: 4 },
  sheetSectionDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 8 },
  sheetItemIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  sheetItemContent: { flex: 1 },
  messageSheet: { backgroundColor: '#0C0C1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 8, alignItems: 'center', borderWidth: 1, borderTopWidth: 0, borderColor: 'rgba(255,255,255,0.06)' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 20, textAlign: 'center' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  sheetItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  sheetItemSubtext: { fontSize: 13, color: '#8A8A9A', marginTop: 2 },
  toggleTrack: { width: 48, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', paddingHorizontal: 3 },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#8A8A9A' },
  toggleThumbOn: { backgroundColor: '#FF3B8A', alignSelf: 'flex-end' },
  toggleThumbLoading: { opacity: 0.5 },
  sheetItemDanger: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  sheetDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 8 },
  sheetCloseBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  sheetCloseText: { fontSize: 15, fontWeight: '700', color: '#8A8A9A' },
  messageSheetIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255, 59, 138, 0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 18, borderWidth: 1, borderColor: 'rgba(255, 59, 138, 0.2)' },
  messageSheetTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff', marginBottom: 8 },
  messageSheetDesc: { fontSize: 15, color: '#D0D0DA', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
});

export default Profile;
