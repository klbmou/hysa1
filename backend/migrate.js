/* eslint-disable no-console */
"use strict";

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

const DATA_FILE = path.join(__dirname, "data.json");
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL environment variable is not set");
  process.exit(1);
}

if (!fs.existsSync(DATA_FILE)) {
  console.error(`Error: data.json not found at ${DATA_FILE}`);
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function readDataFile() {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

async function migrate() {
  console.log("[migrate] Starting migration from data.json to PostgreSQL...");

  const data = await readDataFile();

  // Create tables (we'll run the schema.sql here too)
  const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  console.log("[migrate] Creating tables...");
  await pool.query(schemaSql);

  // Migrate users
  console.log("[migrate] Migrating users...");
  const users = Object.entries(data.users || {});
  for (const [userKey, user] of users) {
    await pool.query(
      `INSERT INTO users (
        user_key, username, password, created_at, bio, avatar_url, 
        is_private, is_pending_verification, verification_request_at, 
        skills, following, token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_key) DO UPDATE SET
        username = EXCLUDED.username,
        password = EXCLUDED.password,
        bio = EXCLUDED.bio,
        avatar_url = EXCLUDED.avatar_url,
        is_private = EXCLUDED.is_private,
        skills = EXCLUDED.skills,
        following = EXCLUDED.following,
        token = EXCLUDED.token`,
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
  }

  // Migrate posts
  console.log("[migrate] Migrating posts...");
  const posts = Array.isArray(data.posts) ? data.posts : [];
  for (const post of posts) {
    await pool.query(
      `INSERT INTO posts (
        id, author_key, author, text, media, visibility, created_at,
        likes, bookmarks, repost_of, quote_text, is_repost, repost_type,
        original_id, author_id, comments, views, viewed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (id) DO UPDATE SET
        author_key = EXCLUDED.author_key,
        author = EXCLUDED.author,
        text = EXCLUDED.text,
        media = EXCLUDED.media,
        visibility = EXCLUDED.visibility,
        likes = EXCLUDED.likes,
        bookmarks = EXCLUDED.bookmarks,
        repost_of = EXCLUDED.repost_of,
        quote_text = EXCLUDED.quote_text,
        is_repost = EXCLUDED.is_repost,
        comments = EXCLUDED.comments,
        views = EXCLUDED.views,
        viewed_by = EXCLUDED.viewed_by`,
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
  }

  // Migrate stories
  console.log("[migrate] Migrating stories...");
  const stories = Array.isArray(data.stories) ? data.stories : [];
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
  }

  // Migrate DMs
  console.log("[migrate] Migrating DMs...");
  const dms = Array.isArray(data.dms) ? data.dms : [];
  for (const dm of dms) {
    await pool.query(
      `INSERT INTO dms (
        id, "from", "to", text, media, created_at, read_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING`,
      [
        dm.id,
        dm.from,
        dm.to,
        dm.text || "",
        JSON.stringify(Array.isArray(dm.media) ? dm.media : []),
        dm.createdAt || new Date().toISOString(),
        Array.isArray(dm.readBy) ? dm.readBy : [],
      ]
    );
  }

  // Migrate reports
  console.log("[migrate] Migrating reports...");
  const reports = Array.isArray(data.reports) ? data.reports : [];
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
  }

  // Migrate notifications
  console.log("[migrate] Migrating notifications...");
  const notifications = Array.isArray(data.notifications) ? data.notifications : [];
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
  }

  console.log("[migrate] Migration complete!");
  await pool.end();
}

migrate().catch((err) => {
  console.error("[migrate] Migration failed:", err);
  process.exit(1);
});
