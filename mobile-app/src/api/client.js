import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// TODO: Make this an environment variable (e.g. EXPO_PUBLIC_API_URL) so dev/prod can differ without code changes.
const API_BASE_URL = 'https://hysa1-us9q.onrender.com';

// Backend uses cookie-based auth (hysa_auth) ONLY.
// There is NO Authorization: Bearer support in the backend.
// Mobile extracts the auth cookie from Set-Cookie header on login/signup,
// stores it in SecureStore, and sends it as Cookie + x-csrf-token on every request.

// Normalize various backend auth response shapes into { csrfToken, user }.
// The csrfToken is used for CSRF protection on unsafe HTTP methods.
// The real auth token comes from Set-Cookie header (parsed separately).
// Supports:
//   { ok, token, user }            -- legacy/future Bearer style
//   { ok, accessToken, user }
//   { ok, jwt, user }
//   { ok, csrfToken, me }          <-- current HYSA backend shape
//   { ok, me }
function normalizeAuthResponse(response) {
  const data = response.data || {};
  const user = data.user || data.me || null;
  // csrfToken for CSRF header on POST/PUT/PATCH/DELETE
  const csrfToken = data.csrfToken || data.token || data.accessToken || data.jwt || null;

  return { csrfToken, user };
}

export { normalizeAuthResponse };

// Parse the hysa_auth cookie value from Set-Cookie response header.
// Returns the cookie value string, or null if not found.
function parseAuthCookieFromResponse(response) {
  const setCookie = response.headers['set-cookie'];
  if (!setCookie) return null;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of cookies) {
    const match = c.match(/hysa_auth=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

export { parseAuthCookieFromResponse };

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor: send Cookie + CSRF header for backend auth
api.interceptors.request.use(
  async (config) => {
    try {
      const authCookie = await SecureStore.getItemAsync('authCookie');
      if (authCookie) {
        // Backend reads auth ONLY from hysa_auth cookie, not Authorization header
        config.headers['Cookie'] = `hysa_auth=${authCookie}`;
      }

      // For unsafe methods, send CSRF token required by backend
      const method = String(config.method || '').toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const csrfToken = await SecureStore.getItemAsync('csrfToken');
        if (csrfToken) {
          config.headers['x-csrf-token'] = csrfToken;
        }
      }
    } catch (error) {
      console.error('Error retrieving auth headers:', error);
    }

    // Log request for debugging (no sensitive data)
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
    if (!error.response && (error.code === 'ECONNABORTED' || error.code === 'NETWORK_ERROR')) {
      console.log('Network error, this may be due to Render server sleep. Retrying...');
      try {
        const originalRequest = error.config;
        if (!originalRequest._retry) {
          originalRequest._retry = true;
          await new Promise(resolve => setTimeout(resolve, 2000));
          return api(originalRequest);
        }
      } catch (retryError) {
        console.error('Retry failed:', retryError.message);
      }
    }

    if (error.response?.status === 401) {
      // Token expired or invalid — clear local auth storage
      await SecureStore.deleteItemAsync('authCookie');
      await SecureStore.deleteItemAsync('csrfToken');
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
  getFeed: (limit = 10, cursor = 0) =>
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
