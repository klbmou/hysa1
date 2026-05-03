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
import { Search as SearchIcon, User, TrendingUp } from 'lucide-react-native';
import { searchAPI, feedAPI } from '../api/client';

const Search = ({ navigation }) => {
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

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setSearched(true);
    
    try {
      const response = await searchAPI.search(query);
      if (response.data.ok) {
        const posts = response.data.posts || [];
        const users = response.data.users || [];
        setResults([...users.map(u => ({ ...u, isUser: true })), ...posts]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTrendPress = (tag) => {
    setQuery(tag);
    handleSearch();
  };

  const handleUserPress = (userKey) => {
    navigation.navigate('Profile', { userKey });
  };

  const handlePostPress = (postId) => {
    navigation.navigate('PostDetail', { postId });
  };

  const renderTrendItem = ({ item }) => (
    <TouchableOpacity
      style={styles.trendItem}
      onPress={() => handleTrendPress(item.tag)}
    >
      <TrendingUp size={18} color="#1a1a2e" />
      <View style={styles.trendInfo}>
        <Text style={styles.trendTag}>{item.tag}</Text>
        <Text style={styles.trendCount}>{item.count} posts</Text>
      </View>
    </TouchableOpacity>
  );

  const renderResultItem = ({ item }) => {
    if (item.isUser) {
      const userKey = item.userKey || item.key || item.username;
      return (
        <TouchableOpacity
          style={styles.resultItem}
          onPress={() => handleUserPress(userKey)}
        >
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.resultAvatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={18} color="#666" />
            </View>
          )}
          <View style={styles.resultContent}>
            <Text style={styles.resultAuthor}>{item.username || item.key || 'User'}</Text>
            {item.bio ? <Text style={styles.resultText} numberOfLines={1}>{item.bio}</Text> : null}
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handlePostPress(item.id)}
      >
        <TouchableOpacity onPress={() => handleUserPress(item.authorKey)}>
          {item.authorAvatar ? (
            <Image source={{ uri: item.authorAvatar }} style={styles.resultAvatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={18} color="#666" />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.resultContent}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultAuthor}>{item.author}</Text>
            <Text style={styles.resultTime}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <Text style={styles.resultText} numberOfLines={2}>
            {item.text}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <SearchIcon size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search HYSA1"
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={styles.clearButton}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {!searched ? (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Trending</Text>
          {trends.length > 0 ? (
            <FlatList
              data={trends}
              renderItem={renderTrendItem}
              keyExtractor={(item, index) => `trend-${index}`}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>No trends available</Text>
          )}
        </View>
      ) : (
        <View style={styles.content}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#1a1a2e" />
            </View>
          ) : results.length > 0 ? (
            <FlatList
              data={results}
              renderItem={renderResultItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>No results found</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    margin: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    color: '#666',
    fontSize: 14,
    paddingHorizontal: 8,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 16,
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  trendInfo: {
    marginLeft: 12,
  },
  trendTag: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  trendCount: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  resultItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    backgroundColor: '#f0f0f0',
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
    marginBottom: 4,
  },
  resultAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  resultTime: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

export default Search;