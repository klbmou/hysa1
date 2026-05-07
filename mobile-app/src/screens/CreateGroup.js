import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Animated,
  Alert,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, User, X, Check, Search } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as haptics from '../utils/haptics';
import theme from '../theme';

const CreateGroup = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const pickGroupAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Access to photos is needed to set a group image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        setGroupAvatar(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Avatar pick error:', err);
    }
  };

  const toggleMember = (userKey) => {
    haptics.selectionAsync();
    setSelectedMembers(prev =>
      prev.includes(userKey) ? prev.filter(k => k !== userKey) : [...prev, userKey]
    );
  };

  const handleCreate = () => {
    if (!groupName.trim()) {
      Alert.alert('Group name required', 'Please enter a name for your group.');
      return;
    }
    if (selectedMembers.length < 2) {
      Alert.alert('Need more members', 'Add at least 2 members to create a group.');
      return;
    }
    Alert.alert('Beta feature', 'Group chat creation is being tested.');
  };

  const isFormValid = groupName.trim().length > 0 && selectedMembers.length >= 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Group</Text>
        <TouchableOpacity
          style={[styles.createBtn, !isFormValid && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!isFormValid}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.createBtnText, !isFormValid && styles.createBtnTextDisabled]}>Create</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.avatarSection}>
        <TouchableOpacity style={styles.avatarWrap} onPress={pickGroupAvatar} activeOpacity={0.7}>
          {groupAvatar ? (
            <Image source={{ uri: groupAvatar }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Camera size={24} color="#8A8A9A" />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Add group photo</Text>
      </View>

      <View style={styles.nameSection}>
        <TextInput
          style={styles.nameInput}
          placeholder="Group name"
          placeholderTextColor={theme.colors.textMuted}
          value={groupName}
          onChangeText={setGroupName}
          maxLength={50}
        />
        <Text style={styles.nameHint}>Choose a name that describes your group</Text>
      </View>

      {selectedMembers.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={styles.sectionLabel}>
            {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
          </Text>
          <View style={styles.selectedAvatars}>
            {selectedMembers.map((key) => (
              <View key={key} style={styles.selectedChip}>
                <User size={12} color="#fff" />
                <Text style={styles.selectedChipText} numberOfLines={1}>{key.slice(0, 8)}</Text>
                <TouchableOpacity onPress={() => toggleMember(key)} activeOpacity={0.7}>
                  <X size={12} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.searchWrap}>
        <Search size={16} color={theme.colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people..."
          placeholderTextColor={theme.colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      <View style={styles.suggestionsSection}>
        <Text style={styles.sectionLabel}>Suggested</Text>
        <Text style={styles.suggestionsHint}>Select members to add to your group</Text>

        <View style={styles.comingSoonCard}>
          <User size={24} color={theme.colors.accent} />
          <Text style={styles.comingSoonTitle}>Member Selection</Text>
          <Text style={styles.comingSoonText}>
            Group chat member selection will be available in the next update. You can add friends once the feature launches.
          </Text>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonBadgeText}>Beta</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070711' },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { padding: 6, marginRight: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', flex: 1 },
  createBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: '#FF3B8A' },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  createBtnTextDisabled: { color: '#fff' },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatarWrap: { marginBottom: 8 },
  avatarImg: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)' },
  avatarHint: { fontSize: 12, color: '#8A8A9A' },
  nameSection: { paddingHorizontal: 20, marginBottom: 16 },
  nameInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  nameHint: { fontSize: 12, color: '#8A8A9A', marginTop: 6, marginLeft: 4 },
  selectedSection: { paddingHorizontal: 20, marginBottom: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  selectedAvatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectedChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,59,138,0.15)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, gap: 4, borderWidth: 1, borderColor: 'rgba(255,59,138,0.25)' },
  selectedChipText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#FFFFFF' },
  suggestionsSection: { paddingHorizontal: 20 },
  suggestionsHint: { fontSize: 12, color: '#8A8A9A', marginBottom: 16 },
  comingSoonCard: { alignItems: 'center', padding: 24, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  comingSoonTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 12, marginBottom: 6 },
  comingSoonText: { fontSize: 13, color: '#8A8A9A', textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  comingSoonBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,59,138,0.15)', borderWidth: 1, borderColor: 'rgba(255,59,138,0.25)' },
  comingSoonBadgeText: { fontSize: 12, color: '#FF3B8A', fontWeight: '700' },
});

export default CreateGroup;
