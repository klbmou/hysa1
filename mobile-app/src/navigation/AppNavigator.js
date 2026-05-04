import React from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  Bell,
  User,
  Search as SearchIcon,
  Film,
  Plus,
  MessageSquare,
} from 'lucide-react-native';

import { useAuth } from '../context/AuthContext';
import FeedScreen from '../screens/Feed';
import SearchScreen from '../screens/Search';
import NotificationsScreen from '../screens/Notifications';
import ProfileScreen from '../screens/Profile';
import UserProfileScreen from '../screens/UserProfile';
import PostDetailScreen from '../screens/PostDetail';
import ReelsScreen from '../screens/Reels';
import DMThreadsScreen from '../screens/DMThreads';
import ChatScreen from '../screens/Chat';
import LoginScreen from '../screens/Login';
import SignupScreen from '../screens/Signup';
import theme from '../theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const CenterComposeButton = () => {
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      style={styles.centerButton}
      onPress={() => navigation.navigate('Home', { openCompose: Date.now() })}
      activeOpacity={0.8}
    >
      <Plus size={26} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

const MainTabs = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [styles.tabBar, { paddingBottom: Math.max(insets.bottom, 4) }],
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        tabBarIcon: ({ focused, color, size }) => {
          switch (route.name) {
            case 'Home':
              return <Home size={22} color={color} />;
            case 'Explore':
              return <SearchIcon size={22} color={color} />;
            case 'Reels':
              return <Film size={22} color={color} />;
            case 'Notifications':
              return <Bell size={22} color={color} />;
            case 'Profile':
              return <User size={22} color={color} />;
            default:
              return <Home size={22} color={color} />;
          }
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={FeedScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Explore"
        component={SearchScreen}
        options={{ tabBarLabel: 'Explore' }}
      />
      <Tab.Screen
        name="Compose"
        component={FeedScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: () => null,
          tabBarButton: () => <CenterComposeButton />,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarLabel: 'Alerts' }}
      />
      <Tab.Screen
        name="Reels"
        component={ReelsScreen}
        options={{ tabBarLabel: 'Reels' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
};

const AppStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="DMThreads" component={DMThreadsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bgPrimary,
  },
  tabBar: {
    backgroundColor: theme.colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 4,
    height: 64,
    paddingBottom: 4,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  tabBarItem: {
    paddingTop: 2,
  },
  centerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    top: -8,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default AppNavigator;
