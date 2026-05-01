import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'https://hysa1-4.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  // Enable withCredentials for CORS
  withCredentials: false,
});

// Simple retry mechanism for Render server wake-up
const retryRequest = async (config, maxRetries = 2) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await axios(config);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
};

// Request interceptor to add JWT token and handle retries
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error retrieving token:', error);
    }
    
    // Log request for debugging
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and retries
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle network errors with retry
    if (!error.response && error.code === 'ECONNABORTED' || error.code === 'NETWORK_ERROR') {
      console.log('Network error, this may be due to Render server sleep. Retrying...');
      try {
        const originalRequest = error.config;
        if (!originalRequest._retry) {
          originalRequest._retry = true;
          // Wait a bit for Render to wake up
          await new Promise(resolve => setTimeout(resolve, 2000));
          return api(originalRequest);
        }
      } catch (retryError) {
        console.error('Retry failed:', retryError.message);
      }
    }
    
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage
      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('userData');
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username, password) =>
    api.post('/api/login', { username, password }),
  signup: (username, password) =>
    api.post('/api/signup', { username, password }),
  logout: () => api.post('/api/logout'),
  getMe: () => api.get('/api/me'),
};

// Feed API
export const feedAPI = {
  getFeed: (limit = 20, cursor = 0) =>
    api.get(`/api/feed?limit=${limit}&cursor=${cursor}`),
  getReels: (limit = 15) => api.get(`/api/reels?limit=${limit}`),
  getTrends: () => api.get('/api/trends'),
  getTrendingHashtags: () => api.get('/api/trending/hashtags'),
};

// Post API
export const postAPI = {
  getPost: (id) => api.get(`/api/posts/${id}`),
  createPost: (text, media = []) =>
    api.post('/api/posts', { text, media }),
  likePost: (id) => api.post(`/api/posts/${id}/like`),
  bookmarkPost: (id) => api.post(`/api/posts/${id}/bookmark`),
  repostPost: (id, repostType = 'post', quoteText = '') =>
    api.post(`/api/posts/${id}/repost`, { repostType, quoteText }),
  deletePost: (id) => api.delete(`/api/posts/${id}`),
  viewPost: (id) => api.post(`/api/posts/${id}/view`),
  // Comments
  getComments: (id, limit = 50) =>
    api.get(`/api/posts/${id}/comments?limit=${limit}`),
  addComment: (id, text, parentId = '') =>
    api.post(`/api/posts/${id}/comments`, { text, parentId }),
  addReply: (id, commentId, text) =>
    api.post(`/api/posts/${id}/comments/${commentId}/replies`, { text }),
  deleteComment: (id, commentId) =>
    api.delete(`/api/posts/${id}/comments/${commentId}`),
};

// User API
export const userAPI = {
  getUser: (key) => api.get(`/api/user/${key}`),
  followUser: (key) => api.post(`/api/follow/${key}`),
  updateProfile: (data) => api.post('/api/profile', data),
  getInsights: () => api.get('/api/insights'),
  getPostInsights: (id) => api.get(`/api/posts/${id}/insights`),
};

// Stories API
export const storiesAPI = {
  getStories: () => api.get('/api/stories'),
  createStory: (media) => api.post('/api/stories', { media }),
};

// Verification API
export const verificationAPI = {
  requestVerification: () => api.post('/api/verification/request'),
  getVerificationStatus: () => api.get('/api/verification/status'),
};

// Notifications API
export const notificationsAPI = {
  getNotifications: () => api.get('/api/notifications'),
  markAsRead: (id) => api.post(`/api/notifications/${id}/read`),
  markAllAsRead: () => api.post('/api/notifications/read-all'),
};

// Search API
export const searchAPI = {
  search: (query, type = 'all') =>
    api.get(`/api/search?q=${encodeURIComponent(query)}&type=${type}`),
};

export default api;