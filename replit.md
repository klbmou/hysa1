# HYSA - Mini Social Media App

## Overview
HYSA is an Arabic-first (RTL) micro-social platform (Twitter/X-like) with Node.js/Express backend + Vanilla JS frontend. Features 6 major feature sets: AI Assistant "بلوطة", Notifications System, Friends System, Security Center, Post Analytics, and Content Features (carousel, highlights, polls, scheduling, bookmarks).

## Feature Set (v2.0)

### Feature 1 — AI Assistant "بلوطة" 🌰
- Floating 🌰 FAB button (bottom-right), slides-up chat panel
- Header: "بلوطة 🌰" + "مساعدك الذكي"
- 4 suggested prompt chips on first open (caption, hashtags, bio, funny caption)
- Backend tries Anthropic Claude → OpenAI → smart local fallback
- Local fallback: 100+ caption templates (food/travel/motivation/funny), hashtag DB by 7 categories, 5+ bio templates, bilingual Arabic/English detection

### Feature 2 — Notifications System
- Bell icon with red badge showing unread count (polls every 30s via `/api/notifications/unread-count`)
- Grouped: Today / This Week / Earlier
- Each item: avatar + text + time + delete (✕) button
- Tap to navigate to relevant content
- Mark all read, delete individual

### Feature 3 — Friends System
- Mutual follow = Friends (badge shown)
- Follow requests (for private accounts)
- Suggested friends (friends-of-friends)
- Close friends table (green ring on stories)
- Privacy toggle (private account / public)

### Feature 4 — Security Center
- Change password with strength bar
- Active sessions list (view + logout individual or all)
- Login history (last 20, color-coded success/fail)
- 2FA with Google Authenticator (speakeasy + qrcode)
- Privacy toggle (private account)

### Feature 5 — Post Analytics
- 📊 button in own profile header
- Stats cards: Views / Likes / Followers / Bookmarks / Posts / Engagement %
- Best performing post highlight
- Best time to post recommendation
- Post-level analytics via `/api/posts/:id/analytics`

### Feature 6 — Content Features
- Story highlights (create/view circles below bio)
- Polls in posts (vote + see results, 24h expiry)
- Post scheduling (scheduled_at column, hidden until time)
- Saved posts page (bookmarks already stored in posts.bookmarks array)

## Project Structure

```
/
├── backend/          # Node.js Express API server (main entry point)
│   ├── server.js     # Main Express server (~4500 lines) - serves API + static frontend
│   ├── data.json     # Local JSON "database" (used when DATABASE_URL not set)
│   ├── schema.sql    # PostgreSQL schema (for production)
│   ├── migrate.js    # DB migration helper
│   └── package.json  # Dependencies: express, dotenv, pg, cloudinary, peer
├── frontend-web/     # Static web frontend (vanilla JS/HTML/CSS)
│   └── public/
│       ├── index.html  # Fully redesigned with glass-morphism 3D UI
│       ├── app.js      # Main frontend app (~3985 lines, fetch-based API calls, JWT auth)
│       └── styles.css  # ~2970 lines (original + glass UI extensions)
├── mobile-app/       # React Native / Expo mobile app (do not touch)
└── php/              # Alternative PHP implementation (MySQL-based)
```

## Architecture

- **Backend**: Express.js server that serves both the REST API (`/api/*`) and static frontend files from `frontend-web/public/`
- **Storage**: 
  - Development: Local `data.json` file (JSON-based MongoDB-like model layer)
  - Production: PostgreSQL via `DATABASE_URL` environment variable (`USE_POSTGRES=true` auto-set)
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
- `DATABASE_URL` - PostgreSQL connection string (required; exits without it in production)
- `USE_POSTGRES` - Set automatically when DATABASE_URL is present
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - Cloudinary media storage (optional)
- `VERIFIED_USERS` - Comma-separated list of verified usernames (default: "hysa,admin,psx")

## Deployment
- Target: autoscale
- Run command: `node backend/server.js`
- Note: Production requires `DATABASE_URL` to be set

## Key Features
- User signup/login with token auth
- Social feed with posts, likes, bookmarks, reposts
- Stories with 24h expiry
- Direct messages (DMs)
- Follow/unfollow system
- Search users
- Notifications
- User profiles with avatar upload
- WebRTC video calls (PeerJS)
- Verified user badges
- AI assistant with smart Arabic/English responses
- Settings panel: dark mode toggle, accent color picker (6 colors), language select, privacy toggle
- Theme system: persisted via localStorage (hysa_theme, hysa_accent, hysa_lang)
- Insights modal: posts, views, likes, saves stats
- Glass-morphism 3D UI redesign

## Completed Parts (8-part upgrade)
- **Part 1 (Feed bug)**: Fixed `pgFindUserByKey` save() closure using `obj.token`, patched PG wrappers
- **Part 2 (3D glass UI)**: index.html fully rewritten, CSS extended with glass components
- **Part 3 (Theme system)**: Dark/light mode, accent color picker, persisted in localStorage
- **Part 4 (Settings page)**: Full settings panel (lang, privacy, dark mode, accent, logout, insights)
- **Part 5 (AI assistant)**: `aiSmartReply()` with smart Arabic/English local responses
- **Parts 6-8**: (media upload improvements, stories improvements, final tests) — not yet started

## Known State
- Duplicate routes cleaned up: removed duplicate `/api/trending/hashtags` and `/api/verification/*`
- `langToggle` button updated to not be overwritten by `applyI18n()` (uses `langToggleLabel` span)
- `insightsSaves` properly wired in `openInsights()` 
