# HYSA - Mini Social Media App

## Overview
HYSA is a mini social media web application (similar to Twitter/X) supporting signup/login, feed posts, follow, like/bookmark, search, and more. It includes Arabic language support.

## Project Structure

```
/
├── backend/          # Node.js Express API server (main entry point)
│   ├── server.js     # Main Express server (2800+ lines) - serves API + static frontend
│   ├── data.json     # Local JSON "database" (used when DATABASE_URL not set)
│   ├── schema.sql    # PostgreSQL schema (for production)
│   ├── migrate.js    # DB migration helper
│   └── package.json  # Dependencies: express, dotenv, pg, cloudinary, peer
├── frontend-web/     # Static web frontend (vanilla JS/HTML/CSS)
│   └── public/
│       ├── index.html
│       ├── app.js    # Main frontend app (fetch-based API calls, JWT auth)
│       └── styles.css
├── mobile-app/       # React Native / Expo mobile app
│   └── src/
│       ├── App.js
│       ├── api/client.js      # Axios client
│       ├── context/AuthContext.js
│       ├── navigation/AppNavigator.js
│       └── screens/           # Feed, Login, Signup, Search, Notifications, Profile
└── php/              # Alternative PHP implementation (MySQL-based)
```

## Architecture

- **Backend**: Express.js server that serves both the REST API (`/api/*`) and static frontend files from `frontend-web/public/`
- **Storage**: 
  - Development: Local `data.json` file (JSON-based MongoDB-like model layer)
  - Production: PostgreSQL via `DATABASE_URL` environment variable
- **Media**: Local uploads directory by default; Cloudinary when credentials are set
- **Auth**: Token-based (stored in localStorage on web, expo-secure-store on mobile)
- **Real-time**: PeerJS signaling server for WebRTC features

## Running the App

### Development (Replit)
The workflow runs: `cd backend && PORT=5000 node server.js`
- App available at port 5000
- Serves frontend static files + API endpoints

### Environment Variables
- `PORT` - Server port (default: 3000, set to 5000 in Replit)
- `DATABASE_URL` - PostgreSQL connection string (optional; uses data.json if not set)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - Cloudinary media storage (optional)
- `VERIFIED_USERS` - Comma-separated list of verified usernames (default: "hysa,admin,psx")
- `DATA_DIR` - Custom data directory path (optional)

## Deployment
- Target: autoscale
- Run command: `node backend/server.js`
- Note: Production requires `DATABASE_URL` to be set (exits with error otherwise)

## Key Features
- User signup/login with token auth
- Social feed with posts, likes, bookmarks, reposts
- Stories
- Direct messages (DMs)
- Follow/unfollow system
- Search
- Notifications
- User profiles with avatar upload
- WebRTC video calls (PeerJS)
- Verified user badges
- Arabic/multilingual UI support
