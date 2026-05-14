import React from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
import StoryComposerScreen from '../screens/StoryComposer';
import StoryCameraScreen from '../screens/StoryCameraScreen';
import CallScreen from '../screens/CallScreen';
import CreateGroupScreen from '../screens/CreateGroup';
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
      <LinearGradient
        colors={['#FF3B8A', '#FF2F92', '#7C3AED']}
        style={styles.centerButtonGradient}
      >
        <Plus size={26} color="#FFFFFF" />
      </LinearGradient>
    </TouchableOpacity>
  );
};

const MainTabs = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [styles.tabBar, { paddingBottom: Math.max(insets.bottom, 6) }],
        tabBarBackground: () => (
          <LinearGradient
            colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.105)', 'rgba(255,59,138,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.58)',
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        tabBarIcon: ({ focused, color, size }) => {
          let Icon = Home;
          switch (route.name) {
            case 'Home':
              Icon = Home;
              break;
            case 'Explore':
              Icon = SearchIcon;
              break;
            case 'Reels':
              Icon = Film;
              break;
            case 'Notifications':
              Icon = Bell;
              break;
            case 'Profile':
              Icon = User;
              break;
            default:
              Icon = Home;
          }
          return (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              {focused ? (
                <LinearGradient
                  colors={['#FF3B8A', '#FF2F92', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tabIconActiveGradient}
                >
                  <Icon size={22} color="#FFFFFF" />
                </LinearGradient>
              ) : (
                <Icon size={21} color={color} />
              )}
            </View>
          );
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
      <Stack.Screen name="StoryComposer" component={StoryComposerScreen} />
      <Stack.Screen name="StoryCamera" component={StoryCameraScreen} />
      <Stack.Screen name="CallScreen" component={CallScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#070711' },
  tabBar: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    height: 70,
    borderRadius: 34,
    position: 'absolute',
    bottom: 14,
    marginHorizontal: 14,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#FF3B8A',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    paddingTop: 8,
    paddingBottom: 2,
    paddingHorizontal: 10,
  },
  tabBarLabel: { fontSize: 10, fontWeight: '900', marginTop: 2 },
  tabBarItem: { paddingTop: 2, borderRadius: 26 },
  tabIconWrap: {
    width: 42,
    height: 32,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: {
    shadowColor: '#FF3B8A',
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 7,
  },
  tabIconActiveGradient: {
    width: 42,
    height: 32,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  centerButton: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
    top: -12,
    shadowColor: '#FF3B8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  centerButtonGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppNavigator;
