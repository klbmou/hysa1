# HYSA1 Mobile App

A React Native (Expo) mobile application for HYSA1 social media platform.

## Features

- **Authentication**: Login and signup with JWT token storage using SecureStore
- **Feed**: Scrollable feed with pull-to-refresh and infinite loading
- **Search**: Search posts and users with trending hashtags
- **Notifications**: View likes, comments, follows, and reposts
- **Profile**: View and edit profile, follow/unfollow users
- **Media Support**: Display images and videos using Base64 data URLs

## Tech Stack

- **React Native** with **Expo**
- **React Navigation** (Bottom Tabs + Stack)
- **Axios** for API requests
- **Expo SecureStore** for token storage
- **expo-av** for video playback
- **lucide-react-native** for icons

## Project Structure

```
mobile-app/
├── src/
│   ├── api/
│   │   └── client.js          # Axios client with interceptors
│   ├── components/
│   │   └── PostCard.js        # Reusable post card component
│   ├── context/
│   │   └── AuthContext.js     # Authentication state management
│   ├── navigation/
│   │   └── AppNavigator.js    # Navigation configuration
│   └── screens/
│       ├── Feed.js            # Main feed screen
│       ├── Login.js           # Login screen
│       ├── Signup.js          # Signup screen
│       ├── Search.js          # Search screen
│       ├── Notifications.js   # Notifications screen
│       └── Profile.js         # Profile screen
├── App.js                     # Main app entry point
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- Expo Go app (for development)

### Installation

1. Navigate to the mobile-app directory:
   ```bash
   cd mobile-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npx expo start
   ```

4. Scan the QR code with the Expo Go app on your phone, or press:
   - `w` for web
   - `a` for Android emulator
   - `i` for iOS simulator (macOS only)

## API Configuration

The app connects to the HYSA1 backend at `https://onrender.com`. To change the API base URL, edit `src/api/client.js`:

```javascript
const API_BASE_URL = 'https://onrender.com'; // Change this
```

## Available API Endpoints

- `POST /api/login` - User login
- `POST /api/signup` - User registration
- `POST /api/logout` - User logout
- `GET /api/me` - Get current user
- `GET /api/feed` - Get feed posts
- `GET /api/reels` - Get video reels
- `GET /api/trends` - Get trending posts
- `GET /api/trending/hashtags` - Get top 5 hashtags
- `POST /api/posts` - Create a post
- `POST /api/posts/:id/like` - Like/unlike a post
- `POST /api/posts/:id/bookmark` - Bookmark/unbookmark a post
- `POST /api/posts/:id/repost` - Repost a post
- `POST /api/follow/:key` - Follow/unfollow a user
- `GET /api/user/:key` - Get user profile

## License

MIT