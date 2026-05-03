import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search as SearchIcon, User, TrendingUp } from 'lucide-react-native';
import { searchAPI, feedAPI } from '../api/client';
import theme from '../theme';

const Search = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [trends, setTrends] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    try {
      const response = await feedAPI.getTrendingHashtags();
      if (response.data.ok) {
        setTrends(response.data.trending || []);
      }
    } catch (err) {
      console.error('Trends error:', err);
    }
  };

  const normalizeQuery = (q) => {
    let trimmed = q.trim();
    if (trimmed.startsWith('@')) {
      trimmed = trimmed.slice(1);
    }
    return trimmed;
  };

  const extractResults = (data) => {
    if (!data || !data.ok) return [];

    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      return data.results;
    }

    const merged = [];

    if (data.users && Array.isArray(data.users)) {
      data.users.forEach((u) => merged.push({ ...u, type: 'user' }));
    }
    if (data.posts && Array.isArray(data.posts)) {
      data.posts.forEach((p) => merged.push({ ...p, type: 'post' }));
    }
    if (data.hashtags && Array.isArray(data.hashtags)) {
      data.hashtags.forEach((h) => merged.push({ ...h, type: 'hashtag' }));
    }

    return merged;
  };

  const performSearch = async (searchQuery) => {
    const trimmed = normalizeQuery(searchQuery);
    if (!trimmed) return;

    setLoading(true);
    setSearched(true);

    try {
      const response = await searchAPI.search(trimmed);
      const extracted = extractResults(response.data);
      setResults(extracted);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    performSearch(query);
  };

  const clearSearch = () => {
    setQuery('');
    setSearched(false);
    setResults([]);
  };

  const handleTrendPress = (tag) => {
    setQuery(tag);
    setTimeout(() => {
      performSearch(tag);
    }, 0);
  };

  const handleUserPress = (userKey) => {
    if (userKey) navigation.navigate('Profile', { userKey });
  };

  const handlePostPress = (postId) => {
    if (postId) navigation.navigate('PostDetail', { postId });
  };

  const renderTrendItem = ({ item }) => (
    <TouchableOpacity
      style={styles.trendItem}
      onPress={() => handleTrendPress(item.tag)}
    >
      <View style={styles.trendIcon}>
        <TrendingUp size={18} color={theme.colors.accent} />
      </View>
      <View style={styles.trendInfo}>
        <Text style={styles.trendTag}>{item.tag}</Text>
        <Text style={styles.trendCount}>{item.count} posts</Text>
      </View>
    </TouchableOpacity>
  );

  const renderResultItem = ({ item }) => {
    if (item.type === 'user') {
      const userKey = item.key || item.userKey || item.username;
      return (
        <TouchableOpacity
          style={styles.resultItem}
          onPress={() => handleUserPress(userKey)}
        >
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.resultAvatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={18} color={theme.colors.textMuted} />
            </View>
          )}
          <View style={styles.resultContent}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultAuthor}>
                {item.displayName || item.username || 'User'}
              </Text>
              {item.verified && (
                <Text style={styles.verifiedBadge}>&#10003;</Text>
              )}
            </View>
            <Text style={styles.resultHandle}>@{item.username || item.key || ''}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (item.type === 'hashtag') {
      return (
        <TouchableOpacity
          style={styles.trendItem}
          onPress={() => handleTrendPress(item.tag || item.name || item._id)}
        >
          <View style={styles.trendIcon}>
            <TrendingUp size={18} color={theme.colors.accentSecondary} />
          </View>
          <View style={styles.trendInfo}>
            <Text style={styles.trendTag}>{item.tag || item.name || '#'}</Text>
            <Text style={styles.trendCount}>{item.count || item.postCount || 0} posts</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handlePostPress(item.id)}
      >
        <TouchableOpacity
          onPress={() => handleUserPress(item.authorKey)}
        >
          {item.authorAvatar ? (
            <Image source={{ uri: item.authorAvatar }} style={styles.resultAvatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={18} color={theme.colors.textMuted} />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.resultContent}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultAuthor}>{item.author || 'User'}</Text>
            {item.createdAt && (
              <Text style={styles.resultTime}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            )}
          </View>
          <Text style={styles.resultText} numberOfLines={2}>
            {item.text || ''}
          </Text>
          {item.hashtag && (
            <Text style={styles.hashtag}>{item.hashtag}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const hasAnyResults = results.length > 0;

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      );
    }
    if (searched && !hasAnyResults) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No results found</Text>
        </View>
      );
    }
    return (
      <View>
        <Text style={styles.sectionTitle}>Trending</Text>
        {trends.length > 0 ? (
          trends.map((item) => (
            <TouchableOpacity
              key={item.tag || item.id || Math.random()}
              style={styles.trendItem}
              onPress={() => handleTrendPress(item.tag)}
            >
              <View style={styles.trendIcon}>
                <TrendingUp size={18} color={theme.colors.accent} />
              </View>
              <View style={styles.trendInfo}>
                <Text style={styles.trendTag}>{item.tag}</Text>
                <Text style={styles.trendCount}>{item.count || 0} posts</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>No trends available</Text>
        )}
      </View>
    );
  };

  const listData = !searched && trends.length > 0 && results.length === 0 ? trends : results;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.searchBar}>
        <SearchIcon size={20} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search HYSA1"
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clearSearch}>
            <Text style={styles.clearButton}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={listData}
        renderItem={!searched ? renderTrendItem : renderResultItem}
        keyExtractor={(item, index) => {
          if (item.type === 'user') return `user-${item.key || item.username || index}`;
          if (item.type === 'post') return `post-${item.id || index}`;
          if (item.type === 'hashtag') return `hashtag-${item.tag || item.name || index}`;
          return `trend-${item.tag || index}`;
        }}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgInput,
    borderRadius: theme.radius.md,
    margin: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  clearButton: {
    color: theme.colors.accentSecondary,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  content: {
    padding: 12,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  trendIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trendInfo: {
    marginLeft: 12,
  },
  trendTag: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  trendCount: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  resultItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContent: {
    flex: 1,
    marginLeft: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  resultAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  verifiedBadge: {
    fontSize: 12,
    color: theme.colors.verified,
    marginLeft: 4,
  },
  resultHandle: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  resultTime: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginLeft: 8,
  },
  resultText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  hashtag: {
    fontSize: 13,
    color: theme.colors.accent,
    marginTop: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});

export default Search;
