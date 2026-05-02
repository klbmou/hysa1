-- HYSA1 PostgreSQL Schema
-- Designed for Supabase/Neon free tiers

-- Users table
CREATE TABLE IF NOT EXISTS users (
  user_key VARCHAR(50) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  is_private BOOLEAN DEFAULT FALSE,
  is_pending_verification BOOLEAN DEFAULT FALSE,
  verification_request_at TIMESTAMPTZ,
  email TEXT DEFAULT '',
  display_name TEXT DEFAULT '',
  verified BOOLEAN DEFAULT FALSE,
  role VARCHAR(30) DEFAULT '',
  google_id TEXT DEFAULT '',
  auth_provider VARCHAR(30) DEFAULT 'password',
  skills TEXT[] DEFAULT '{}',
  following TEXT[] DEFAULT '{}',
  token TEXT
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(30) DEFAULT 'password';

UPDATE users
SET verified = TRUE, role = 'owner'
WHERE user_key = 'france' OR LOWER(username) = 'france';

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(50) PRIMARY KEY,
  author_key VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  author VARCHAR(50) NOT NULL,
  text TEXT DEFAULT '',
  media JSONB DEFAULT '[]',
  visibility VARCHAR(20) DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  likes TEXT[] DEFAULT '{}',
  bookmarks TEXT[] DEFAULT '{}',
  repost_of VARCHAR(50),
  quote_text TEXT DEFAULT '',
  is_repost BOOLEAN DEFAULT FALSE,
  repost_type VARCHAR(50) DEFAULT '',
  original_id VARCHAR(50),
  author_id VARCHAR(50),
  comments JSONB DEFAULT '[]',
  views INTEGER DEFAULT 0,
  viewed_by TEXT[] DEFAULT '{}'
);

-- Stories table
CREATE TABLE IF NOT EXISTS stories (
  id VARCHAR(50) PRIMARY KEY,
  author_key VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  author VARCHAR(50) NOT NULL,
  media JSONB NOT NULL,
  filter VARCHAR(50) DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  seen_by TEXT[] DEFAULT '{}'
);

-- Direct Messages table
CREATE TABLE IF NOT EXISTS dms (
  id VARCHAR(50) PRIMARY KEY,
  "from" VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  "to" VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  text TEXT DEFAULT '',
  media JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_by TEXT[] DEFAULT '{}'
);

ALTER TABLE dms
  ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- Story reactions persist independently from story view state.
CREATE TABLE IF NOT EXISTS story_reactions (
  id VARCHAR(50) PRIMARY KEY,
  story_id VARCHAR(50) NOT NULL,
  reactor_key VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  owner_key VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(story_id, reactor_key, emoji)
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(50) PRIMARY KEY,
  reporter VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  target_id VARCHAR(50) NOT NULL,
  reason VARCHAR(50) NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ai JSONB
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(50) PRIMARY KEY,
  user_key VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  actor_key VARCHAR(50),
  post_id VARCHAR(50),
  comment_id VARCHAR(50),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Follow requests (Feature 3 - Friends System)
CREATE TABLE IF NOT EXISTS follow_requests (
  id SERIAL PRIMARY KEY,
  from_id VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  to_id VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_id, to_id)
);

-- Close friends (Feature 3)
CREATE TABLE IF NOT EXISTS close_friends (
  user_id VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  friend_id VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, friend_id)
);

-- Sessions (Feature 4 - Security Center)
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  token_hash VARCHAR(200) NOT NULL,
  device TEXT DEFAULT '',
  ip VARCHAR(100) DEFAULT '',
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Login history (Feature 4)
CREATE TABLE IF NOT EXISTS login_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  ip VARCHAR(100) DEFAULT '',
  device TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Post analytics (Feature 5)
CREATE TABLE IF NOT EXISTS post_analytics (
  post_id VARCHAR(50) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  views INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY(post_id, date)
);

-- Profile views (Feature 5)
CREATE TABLE IF NOT EXISTS profile_views (
  id SERIAL PRIMARY KEY,
  viewer_id VARCHAR(50) REFERENCES users(user_key) ON DELETE SET NULL,
  profile_id VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Story highlights (Feature 6)
CREATE TABLE IF NOT EXISTS highlights (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  cover TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Highlight stories (Feature 6)
CREATE TABLE IF NOT EXISTS highlight_stories (
  highlight_id VARCHAR(50) NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
  story_id VARCHAR(50) NOT NULL,
  PRIMARY KEY(highlight_id, story_id)
);

-- Post polls (Feature 6)
CREATE TABLE IF NOT EXISTS post_polls (
  id VARCHAR(50) PRIMARY KEY,
  post_id VARCHAR(50) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  question TEXT NOT NULL DEFAULT '',
  options JSONB DEFAULT '[]',
  votes JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ALTER TABLE additions for existing tables
ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100) DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_secret TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT FALSE;

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_author_key ON posts(author_key);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_author_key ON stories(author_key);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_dms_from ON dms("from");
CREATE INDEX IF NOT EXISTS idx_dms_to ON dms("to");
CREATE INDEX IF NOT EXISTS idx_dms_created_at ON dms(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_key ON notifications(user_key);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_reactions_story_id ON story_reactions(story_id);
CREATE INDEX IF NOT EXISTS idx_story_reactions_owner_key ON story_reactions(owner_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique ON users(google_id) WHERE google_id <> '';
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
