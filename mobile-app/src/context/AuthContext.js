import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authAPI, normalizeAuthResponse, parseAuthCookieFromResponse } from '../api/client';

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
  const [authCookie, setAuthCookie] = useState(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedCookie = await SecureStore.getItemAsync('authCookie');
      const storedUser = await SecureStore.getItemAsync('userData');

      if (storedCookie && storedUser) {
        const userData = JSON.parse(storedUser);
        setAuthCookie(storedCookie);
        setUser(userData);
      } else if (storedUser && !storedCookie) {
        // Orphaned user data without auth cookie — clean up
        await SecureStore.deleteItemAsync('userData');
        await SecureStore.deleteItemAsync('csrfToken');
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
      const { csrfToken, user: newUser } = normalizeAuthResponse(response);

      // Extract the real auth cookie from Set-Cookie header
      const cookieValue = parseAuthCookieFromResponse(response) || csrfToken;

      if (!newUser) {
        return { ok: false, error: 'Login succeeded but no user data was returned.' };
      }

      if (cookieValue) {
        await SecureStore.setItemAsync('authCookie', cookieValue);
      }
      if (csrfToken) {
        await SecureStore.setItemAsync('csrfToken', csrfToken);
      }
      await SecureStore.setItemAsync('userData', JSON.stringify(newUser));

      setAuthCookie(cookieValue);
      setUser(newUser);

      return { ok: true };
    } catch (error) {
      console.log('API Error:', error.response?.data?.error || error.message);
      if (error.response) {
        console.log('Error status:', error.response.status);
      }
      const errorMessage = error.response?.data?.error || 'LOGIN_FAILED';
      return { ok: false, error: errorMessage };
    }
  };

  const signup = async (username, password) => {
    try {
      console.log('Attempting signup for user:', username);
      const response = await authAPI.signup(username, password);
      const { csrfToken, user: newUser } = normalizeAuthResponse(response);

      // Extract the real auth cookie from Set-Cookie header
      const cookieValue = parseAuthCookieFromResponse(response) || csrfToken;

      if (!newUser) {
        return { ok: false, error: 'Signup succeeded but no user data was returned.' };
      }

      if (cookieValue) {
        await SecureStore.setItemAsync('authCookie', cookieValue);
      }
      if (csrfToken) {
        await SecureStore.setItemAsync('csrfToken', csrfToken);
      }
      await SecureStore.setItemAsync('userData', JSON.stringify(newUser));

      setAuthCookie(cookieValue);
      setUser(newUser);

      return { ok: true };
    } catch (error) {
      console.log('API Error:', error.response?.data?.error || error.message);
      if (error.response) {
        console.log('Error status:', error.response.status);
      }
      const errorMessage = error.response?.data?.error || 'SIGNUP_FAILED';
      return { ok: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // Logout may fail (403) if CSRF/auth is already invalid — still clear local state
      console.log('Logout request failed (expected if session expired):', error.message);
    }

    await SecureStore.deleteItemAsync('authCookie');
    await SecureStore.deleteItemAsync('csrfToken');
    await SecureStore.deleteItemAsync('userData');

    setAuthCookie(null);
    setUser(null);
  };

  const updateProfile = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    SecureStore.setItemAsync('userData', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    authCookie,
    loading,
    login,
    signup,
    logout,
    updateProfile,
    isAuthenticated: !!authCookie && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
