import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../api/client';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('userToken');
      const storedUser = await SecureStore.getItemAsync('userData');
      
      if (storedToken && storedUser) {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      console.log('Attempting login for user:', username);
      const response = await authAPI.login(username, password);
      console.log('Login response:', response.data);
      const { token: newToken, me } = response.data;
      
      await SecureStore.setItemAsync('userToken', newToken);
      await SecureStore.setItemAsync('userData', JSON.stringify(me));
      
      setToken(newToken);
      setUser(me);
      
      return { ok: true };
    } catch (error) {
      console.log('API Error:', error.response?.data);
      console.log('Full error:', error.message);
      if (error.response) {
        console.log('Error status:', error.response.status);
        console.log('Error data:', JSON.stringify(error.response.data));
      } else if (error.request) {
        console.log('No response received:', error.request);
      }
      const errorMessage = error.response?.data?.error || 'LOGIN_FAILED';
      return { ok: false, error: errorMessage };
    }
  };

  const signup = async (username, password) => {
    try {
      console.log('Attempting signup for user:', username);
      const response = await authAPI.signup(username, password);
      console.log('Signup response:', response.data);
      const { token: newToken, me } = response.data;
      
      await SecureStore.setItemAsync('userToken', newToken);
      await SecureStore.setItemAsync('userData', JSON.stringify(me));
      
      setToken(newToken);
      setUser(me);
      
      return { ok: true };
    } catch (error) {
      console.log('API Error:', error.response?.data);
      console.log('Full error:', error.message);
      if (error.response) {
        console.log('Error status:', error.response.status);
        console.log('Error data:', JSON.stringify(error.response.data));
      } else if (error.request) {
        console.log('No response received:', error.request);
      }
      const errorMessage = error.response?.data?.error || 'SIGNUP_FAILED';
      return { ok: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userData');
    
    setToken(null);
    setUser(null);
  };

  const updateProfile = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    SecureStore.setItemAsync('userData', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    token,
    loading,
    login,
    signup,
    logout,
    updateProfile,
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;