# HYSA - Mini Social Media App

## Overview
HYSA is an Arabic-first (RTL) micro-social platform (Twitter/X + TikTok + WhatsApp hybrid). Built with Node.js/Express backend + Vanilla JS frontend. Full dark mode, glass-morphism UI, RTL support, PWA-ready.

## Feature Set (v2.0)

### Feature 1 — AI Assistant "بلوطة" 🌰
- Floating 🌰 FAB button (bottom-right), slides-up chat panel
- Backend tries Anthropic Claude → OpenAI → smart local fallback
- 100+ caption templates (food/travel/motivation/funny), hashtag DB by 7 categories, bilingual Arabic/English

### Feature 2 — Notifications System
- Bell icon with red badge showing unread count (polls every 30s)
- Grouped: Today / This Week / Earlier; mark all read, delete individual
- Tap to navigate to relevant content

### Feature 3 — Friends System
- Mutual follow = Friends (badge shown)
- Follow requests (for private accounts)
- Suggested friends (friends-of-friends), close friends (green story ring)

### Feature 4 — Security Center
- Change password with strength bar
- Active sessions list (view + logout individual or all)
- Login history (last 20, color-coded success/fail)
- 2FA with Google Authenticator

### Feature 5 — Post Analytics
- Stats cards: Views / Likes / Followers / Bookmarks / Posts / Engagement %
- Best performing post highlight, best time to post recommendation

### Feature 6 — Content Features
- Story highlights (create/view circles below bio)
- Polls in posts (vote + see results, 24h expiry)
- Post scheduling (scheduled_at column, hidden until time)
- Saved posts page (bookmarks)

### Feature 7 — Block/Unblock System (NEW)
- `POST /api/users/block/:key` — block a user
- `DELETE /api/users/block/:key` — unblock a user
- `GET /api/users/blocked` — list blocked users
- Block button in profile header (for other users)
- "Block @username" in post ••• menu
- Schema: `blocked_users` table (blocker_key, blocked_key)

### Feature 8 — Explore Page (NEW)
- `GET /api/explore` — returns top 40 posts by engagement (likes×3 + views + comments×2)
- Accessible via "اكتشاف" compass icon in bottom nav (`#explore` route)
- Instagram-style 3-column masonry grid with hover overlays (like/comment counts)
- Click any tile → opens full post detail

### Feature 9 — Carousel Posts (NEW)
- Multi-image posts auto-display as swipeable carousel
- Touch swipe (left/right), arrow buttons (desktop), dot indicators, count badge (1/N)
- Fully supports mixed image + video slides

### Feature 10 — @Mention Autocomplete (NEW)
- Type `@username` in comment textarea → live dropdown of matching users
- Clicking suggestion inserts `@username ` at cursor position
- `@mentions` in post text render as clickable links to user profile

## Project Structure

```
/
├── backend/          # Node.js Express API server
│   ├── server.js     # Main Express server (~4600 lines)
│   ├── schema.sql    # PostgreSQL schema (auto-runs on startup)
│   └── package.json  # Dependencies: express, dotenv, pg, cloudinary, peer
├── frontend-web/     # Static web frontend (vanilla JS/HTML/CSS)
│   └── public/
│       ├── index.html  # Glass-morphism UI, RTL Arabic, 6-item bottom nav
│       ├── app.js      # Main frontend app (~6900 lines)
│       └── styles.css  # ~5800 lines (full design system)
```

## Architecture

- **Backend**: Express.js server that serves both the REST API (`/api/*`) and static frontend files
- **Storage**: PostgreSQL via `DATABASE_URL` (production) or local `data.json` (dev fallback)
- **Media**: Local uploads directory by default; Cloudinary when credentials are set
- **Auth**: Token-based (stored in localStorage)
- **Real-time**: PeerJS signaling server for WebRTC features

## Running the App

### Development (Replit)
Workflow: `cd backend && PORT=5000 node server.js`

### Environment Variables
- `PORT` — Server port (default: 3000, set to 5000 in Replit)
- `DATABASE_URL` — PostgreSQL connection string
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — optional media storage
- `VERIFIED_USERS` — Comma-separated list: "hysa,admin,psx,france"
- `OWNER_USER_KEY` — Owner account: "france"

## Key API Routes

### Posts
- `GET /api/posts` — feed
- `GET /api/explore` — top posts by engagement
- `POST /api/posts` — create post
- `POST /api/posts/:id/like` — like/unlike

### Users
- `POST /api/users/block/:key` — block user
- `DELETE /api/users/block/:key` — unblock user
- `GET /api/users/blocked` — list blocked
- `POST /api/follow/:key` — follow/unfollow
- `GET /api/search?q=...` — search users + hashtag posts

### Trends
- `GET /api/trends` — top 8 hashtags (authenticated feed)
- `GET /api/trending/hashtags` — top 5 hashtags (all posts)

## Bottom Nav (6 items)
Home → Reels → Explore (🧭 new) → +Create → Notifications → Profile

## Database Schema
Tables: users, posts, stories, dms, reports, notifications, follow_requests, close_friends, sessions, login_history, post_analytics, profile_views, highlights, highlight_stories, post_polls, blocked_users

## Known State
- `USE_POSTGRES=true` via `DATABASE_URL`
- Schema auto-runs on startup using `IF NOT EXISTS` for all tables
- `OWNER_USER_KEY = "france"` — gets owner badge + full moderation access
- All timestamps: `fmtTime()` handles null/undefined/invalid dates gracefully (returns "")
- Carousel: auto-activates for posts with 2+ media items (swipe + arrows + dots)
- @Mention: live autocomplete in comment textarea via `/api/search?q=...`
