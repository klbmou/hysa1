/* eslint-disable no-console */
"use strict";

const path = require("path");
const fs = require("fs");

// Load dotenv only if .env file exists
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

const { Pool } = require("pg");
const DATA_FILE = path.join(__dirname, "data.json");
const SCHEMA_FILE = path.join(__dirname, "schema.sql");
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL environment variable is not set");
  console.error("Please set DATABASE_URL in your environment or create a .env file in the backend directory");
  process.exit(1);
}

if (!fs.existsSync(DATA_FILE)) {
  console.error(`Error: data.json not found at ${DATA_FILE}`);
  process.exit(1);
}

if (!fs.existsSync(SCHEMA_FILE)) {
  console.error(`Error: schema.sql not found at ${SCHEMA_FILE}`);
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

function readDataFile() {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

async function migrate() {
  console.log("========================================");
  console.log("HYSA1 Data Migration");
  console.log("========================================");
  console.log(`Source: ${DATA_FILE}`);
  console.log(`Target: PostgreSQL`);
  console.log("----------------------------------------");

  // Read and execute schema
  console.log("[1/6] Creating database tables...");
  const schemaSql = fs.readFileSync(SCHEMA_FILE, "utf8");
  await pool.query(schemaSql);
  console.log("✓ Tables created");

  const data = readDataFile();

  // Migrate users
  console.log("[2/6] Migrating users...");
  const users = Object.entries(data.users || {});
  let userCount = 0;
  for (const [userKey, user] of users) {
    await pool.query(
      `INSERT INTO users (
        user_key, username, password, created_at, bio, avatar_url,
        is_private, is_pending_verification, verification_request_at,
        skills, following, token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_key) DO NOTHING`,
      [
        userKey,
        user.username || userKey,
        user.password,
        user.createdAt || new Date().toISOString(),
        user.bio || "",
        user.avatarUrl || "",
        !!user.isPrivate,
        !!user.isPendingVerification,
        user.verificationRequestAt || null,
        Array.isArray(user.skills) ? user.skills : [],
        Array.isArray(user.following) ? user.following : [],
        user.token || "",
      ]
    );
    userCount++;
  }
  console.log(`✓ Users migrated: ${userCount}`);

  // Migrate posts
  console.log("[3/6] Migrating posts...");
  const posts = Array.isArray(data.posts) ? data.posts : [];
  let postCount = 0;
  for (const post of posts) {
    await pool.query(
      `INSERT INTO posts (
        id, author_key, author, text, media, visibility, created_at,
        likes, bookmarks, repost_of, quote_text, is_repost, repost_type,
        original_id, author_id, comments, views, viewed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (id) DO NOTHING`,
      [
        post.id,
        post.authorKey || post.authorId || (post.author ? post.author.toLowerCase() : ""),
        post.author || "",
        post.text || post.content || "",
        JSON.stringify(Array.isArray(post.media) ? post.media : []),
        post.visibility || "public",
        post.createdAt || new Date().toISOString(),
        Array.isArray(post.likes) ? post.likes : [],
        Array.isArray(post.bookmarks) ? post.bookmarks : [],
        post.repostOf || post.originalId || "",
        post.quoteText || "",
        !!(post.isRepost || post.repostOf || post.originalId),
        post.repostType || "",
        post.originalId || post.repostOf || "",
        post.authorId || post.authorKey || (post.author ? post.author.toLowerCase() : ""),
        JSON.stringify(Array.isArray(post.comments) ? post.comments : []),
        Number(post.views) || 0,
        Array.isArray(post.viewedBy) ? post.viewedBy : [],
      ]
    );
    postCount++;
  }
  console.log(`✓ Posts migrated: ${postCount}`);

  // Migrate stories
  console.log("[4/6] Migrating stories...");
  const stories = Array.isArray(data.stories) ? data.stories : [];
  let storyCount = 0;
  for (const story of stories) {
    await pool.query(
      `INSERT INTO stories (
        id, author_key, author, media, filter, created_at, expires_at, seen_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING`,
      [
        story.id,
        story.authorKey || (story.author ? story.author.toLowerCase() : ""),
        story.author || "",
        JSON.stringify(story.media || {}),
        story.filter || "normal",
        story.createdAt || new Date().toISOString(),
        story.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        Array.isArray(story.seenBy) ? story.seenBy : [],
      ]
    );
    storyCount++;
  }
  console.log(`✓ Stories migrated: ${storyCount}`);

  // Migrate DMs
  console.log("[5/6] Migrating direct messages...");
  const dms = Array.isArray(data.dms) ? data.dms : [];
  let dmCount = 0;
  for (const dm of dms) {
    await pool.query(
      `INSERT INTO dms (
        id, "from", "to", text, media, created_at, read_by, reactions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING`,
      [
        dm.id,
        dm.from,
        dm.to,
        dm.text || "",
        JSON.stringify(Array.isArray(dm.media) ? dm.media : []),
        dm.createdAt || new Date().toISOString(),
        Array.isArray(dm.readBy) ? dm.readBy : [],
        JSON.stringify(dm.reactions && typeof dm.reactions === "object" ? dm.reactions : {}),
      ]
    );
    dmCount++;
  }
  console.log(`✓ DMs migrated: ${dmCount}`);

  // Migrate reports and notifications
  console.log("[6/6] Migrating reports and notifications...");
  const reports = Array.isArray(data.reports) ? data.reports : [];
  let reportCount = 0;
  for (const report of reports) {
    await pool.query(
      `INSERT INTO reports (
        id, reporter, type, target_id, reason, note, created_at, ai
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING`,
      [
        report.id,
        report.reporter,
        report.type,
        report.targetId,
        report.reason,
        report.note || "",
        report.createdAt || new Date().toISOString(),
        report.ai ? JSON.stringify(report.ai) : null,
      ]
    );
    reportCount++;
  }

  const notifications = Array.isArray(data.notifications) ? data.notifications : [];
  let notificationCount = 0;
  for (const notification of notifications) {
    await pool.query(
      `INSERT INTO notifications (
        id, user_key, type, actor_key, post_id, comment_id, read, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING`,
      [
        notification.id,
        notification.userKey,
        notification.type,
        notification.actorKey || "",
        notification.postId || "",
        notification.commentId || "",
        !!notification.read,
        notification.createdAt || new Date().toISOString(),
      ]
    );
    notificationCount++;
  }
  console.log(`✓ Reports migrated: ${reportCount}`);
  console.log(`✓ Notifications migrated: ${notificationCount}`);

  console.log("----------------------------------------");
  console.log("Migration complete!");
  console.log("========================================");

  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
