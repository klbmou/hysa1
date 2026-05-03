/* eslint-disable no-console */
"use strict";

require("dotenv").config({ path: require("path").join(__dirname, ".env") });

// HYSA1 (Render-ready JSON backend)
// - Binds to process.env.PORT (Render) and 0.0.0.0 (HOST)
// - Serves /public statically
// - Stores app data in data.json and uploaded media under the configured uploads directory.
// - Implements the endpoints expected by public/app.js (feed, upload, profile, etc)

const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const crypto = require("crypto");
const os = require("os");
const http = require("http");
const express = require("express");
const { ExpressPeerServer } = require("peer");
const { OAuth2Client } = require("google-auth-library");

// Optional pg and cloudinary (loaded only if needed)
let Pool, cloudinary;
try {
  Pool = require("pg").Pool;
  cloudinary = require("cloudinary").v2;
} catch {
  // Ignore, will use fallback
}

// Render/Production Config
const PORT = Number(process.env.PORT || 3000);
const HOST = String(process.env.HOST || "0.0.0.0");
const NODE_ENV = process.env.NODE_ENV || "development";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
const JSON_LIMIT = "50mb";
const RATE_LIMITS = {
  auth: { windowMs: 15 * 60 * 1000, max: 25 },
  posts: { windowMs: 60 * 1000, max: 40 },
  comments: { windowMs: 60 * 1000, max: 80 },
  uploads: { windowMs: 10 * 60 * 1000, max: 30 },
};
const ALLOWED_UPLOAD_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
]);
const VERIFIED_USERS = new Set(
  String(process.env.VERIFIED_USERS || "hysa,admin,psx,france")
    .split(",")
    .map((x) => String(x || "").trim().toLowerCase())
    .filter(Boolean),
);

// -----------------------------
// Data & Storage Mode Detection
// -----------------------------

const DATABASE_URL = process.env.DATABASE_URL;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
const AUTH_COOKIE_NAME = "hysa_auth";
const AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_SECRET = String(
  process.env.CSRF_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.JWT_SECRET ||
  process.env.DATABASE_URL ||
  crypto.randomBytes(32).toString("hex")
);

function contentSecurityPolicy(req, nonce) {
  const host = String(req && req.headers && req.headers.host || "").trim();
  const websocketSelf = host ? [`wss://${host}`, NODE_ENV === "production" ? "" : `ws://${host}`].filter(Boolean) : [];
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' https://accounts.google.com`,
    "script-src-attr 'none'",
    `style-src-elem 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com https://lh3.googleusercontent.com",
    "media-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com",
    `connect-src 'self' https://accounts.google.com ${websocketSelf.join(" ")}`.trim(),
    "frame-src https://accounts.google.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "report-uri /csp-report",
  ];
  if (String(process.env.ENABLE_TRUSTED_TYPES || "").toLowerCase() === "true") {
    directives.push("require-trusted-types-for 'script'");
  }
  if (NODE_ENV === "production") directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

let USE_POSTGRES = !!process.env.DATABASE_URL;
const USE_CLOUDINARY = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);
const OWNER_USER_KEY = "france";
const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID || undefined);
void GOOGLE_CLIENT_SECRET;

if (NODE_ENV === "production" && !USE_POSTGRES) {
  console.warn("[data] DATABASE_URL is not set; using data.json fallback");
}

// Initialize PostgreSQL pool if DATABASE_URL is present
let pgPool = null;
if (USE_POSTGRES && Pool) {
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });
}

// Initialize Cloudinary if credentials are present
if (USE_CLOUDINARY && cloudinary) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
}

async function initPostgresSchema() {
  if (!pgPool) return;
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    await pgPool.query(schemaSql);
    await pgPool.query("ALTER TABLE IF EXISTS reels ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0");
    await pgPool.query("ALTER TABLE IF EXISTS reels ADD COLUMN IF NOT EXISTS viewed_by TEXT[] DEFAULT '{}'");
    console.log("[postgres] Schema initialized (CREATE TABLE IF NOT EXISTS)");
  } catch (err) {
    console.error("[postgres] Schema initialization failed:", err.message);
    throw err;
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isDir(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function ensureDirSync(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function isProbablyWritable(dir) {
  try {
    if (!ensureDirSync(dir)) return false;
    const testPath = path.join(dir, `.writetest_${crypto.randomBytes(6).toString("hex")}`);
    fs.writeFileSync(testPath, "1", "utf8");
    fs.unlinkSync(testPath);
    return true;
  } catch {
    return false;
  }
}

function asArray(x) {
  if (Array.isArray(x)) return x;
  if (!x) return [];
  if (typeof x === "object" && x.constructor === Object) return Object.values(x);
  return [];
}

function isSamePath(a, b) {
  try {
    return path.resolve(a) === path.resolve(b);
  } catch {
    return false;
  }
}

const PUBLIC_DIR = path.join(__dirname, '../frontend-web/public');
const INDEX_HTML = path.join(PUBLIC_DIR, "index.html");
const REPO_DATA_FILE = path.join(__dirname, "data.json");
const REPO_UPLOADS_DIR = path.join(__dirname, "uploads");
const DATA_DIR_ENV = process.env.DATA_DIR ? String(process.env.DATA_DIR).trim() : "";
const STORAGE_DIR = path.resolve(__dirname, DATA_DIR_ENV || ".");
const DATA_FILE = path.join(STORAGE_DIR, "data.json");
const UPLOADS_DIR = path.join(STORAGE_DIR, "uploads");
const USING_PERSISTENT_STORAGE = !!DATA_DIR_ENV && !isSamePath(STORAGE_DIR, __dirname);
ensureDirSync(STORAGE_DIR);
ensureDirSync(UPLOADS_DIR);

function seedPersistentStorageSync() {
  if (!isFile(DATA_FILE) && isFile(REPO_DATA_FILE) && !isSamePath(DATA_FILE, REPO_DATA_FILE)) {
    fs.copyFileSync(REPO_DATA_FILE, DATA_FILE);
    console.log("[data] Seeded persistent data.json from repository copy");
  }

  if (!isSamePath(UPLOADS_DIR, REPO_UPLOADS_DIR) && isDir(REPO_UPLOADS_DIR)) {
    const hasUploads = isDir(UPLOADS_DIR) && fs.readdirSync(UPLOADS_DIR).length > 0;
    if (!hasUploads) {
      fs.cpSync(REPO_UPLOADS_DIR, UPLOADS_DIR, { recursive: true });
      console.log("[data] Seeded persistent uploads from repository copy");
    }
  }
}

seedPersistentStorageSync();

// -----------------------------
// data.json models
// -----------------------------

function clonePlain(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isOperatorObject(value) {
  return !!(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).some((k) => k.startsWith("$")));
}

function valuesEqual(a, b) {
  return String(a ?? "") === String(b ?? "");
}

function matchesCondition(actual, condition) {
  if (condition instanceof RegExp) return condition.test(String(actual ?? ""));
  if (isOperatorObject(condition)) {
    for (const [op, expected] of Object.entries(condition)) {
      if (op === "$options") continue;
      if (op === "$in") {
        const list = asArray(expected);
        const ok = Array.isArray(actual)
          ? actual.some((x) => list.some((y) => valuesEqual(x, y)))
          : list.some((x) => valuesEqual(actual, x));
        if (!ok) return false;
      } else if (op === "$nin") {
        const list = asArray(expected);
        const ok = Array.isArray(actual)
          ? actual.every((x) => !list.some((y) => valuesEqual(x, y)))
          : !list.some((x) => valuesEqual(actual, x));
        if (!ok) return false;
      } else if (op === "$ne") {
        const ok = Array.isArray(actual)
          ? !actual.some((x) => valuesEqual(x, expected))
          : !valuesEqual(actual, expected);
        if (!ok) return false;
      } else if (op === "$gt") {
        if (!(String(actual ?? "") > String(expected ?? ""))) return false;
      } else if (op === "$regex") {
        const flags = String(condition.$options || "");
        const regex = expected instanceof RegExp ? expected : new RegExp(String(expected || ""), flags);
        if (!regex.test(String(actual ?? ""))) return false;
      }
    }
    return true;
  }
  if (Array.isArray(actual)) return actual.some((x) => valuesEqual(x, condition));
  return valuesEqual(actual, condition);
}

function matchesFilter(doc, filter) {
  const criteria = filter && typeof filter === "object" ? filter : {};
  for (const [field, condition] of Object.entries(criteria)) {
    if (field === "$or") {
      if (!asArray(condition).some((item) => matchesFilter(doc, item))) return false;
      continue;
    }
    if (field === "$and") {
      if (!asArray(condition).every((item) => matchesFilter(doc, item))) return false;
      continue;
    }
    if (!matchesCondition(doc[field], condition)) return false;
  }
  return true;
}

function sortDocuments(docs, sortSpec) {
  if (!sortSpec || typeof sortSpec !== "object") return docs;
  const entries = Object.entries(sortSpec);
  return docs.sort((a, b) => {
    for (const [field, direction] of entries) {
      const dir = Number(direction) < 0 ? -1 : 1;
      const av = a[field] ?? "";
      const bv = b[field] ?? "";
      if (av < bv) return dir < 0 ? 1 : -1;
      if (av > bv) return dir < 0 ? -1 : 1;
    }
    return 0;
  });
}

function modelKey(config, doc) {
  return String((doc && doc[config.keyField]) || (doc && doc._id) || "");
}

function attachModelDocument(config, record) {
  const doc = clonePlain(record) || {};
  const key = modelKey(config, doc);
  Object.defineProperty(doc, "_id", { value: key, enumerable: false, configurable: true });
  Object.defineProperty(doc, "save", {
    enumerable: false,
    value: async () => {
      await saveJsonDocument(config, doc);
      return doc;
    },
  });
  Object.defineProperty(doc, "toObject", {
    enumerable: false,
    value: () => clonePlain(doc),
  });
  return doc;
}

function selectDocumentFields(config, doc, fields) {
  const selected = {};
  for (const field of fields) {
    if (!field || field.startsWith("-")) continue;
    selected[field] = doc[field];
  }
  return attachModelDocument(config, selected);
}

class JsonQuery {
  constructor(config, filter) {
    this.config = config;
    this.filter = filter || {};
    this.sortSpec = null;
    this.limitCount = null;
    this.selectSpec = "";
  }

  sort(sortSpec) {
    this.sortSpec = sortSpec;
    return this;
  }

  limit(limitCount) {
    this.limitCount = Number(limitCount);
    return this;
  }

  select(selectSpec) {
    this.selectSpec = String(selectSpec || "");
    return this;
  }

  async exec() {
    let docs = readJsonDocuments(this.config).filter((doc) => matchesFilter(doc, this.filter));
    docs = sortDocuments(docs, this.sortSpec);
    if (Number.isFinite(this.limitCount) && this.limitCount >= 0) docs = docs.slice(0, this.limitCount);
    const fields = this.selectSpec.split(/\s+/).filter(Boolean);
    if (fields.length) docs = docs.map((doc) => selectDocumentFields(this.config, doc, fields));
    return docs;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

function readJsonDocuments(config) {
  return config.read(readDataFile()).map((record) => attachModelDocument(config, record));
}

async function saveJsonDocument(config, doc) {
  const data = readDataFile();
  const docs = config.read(data);
  const normalized = config.normalize(doc);
  const key = modelKey(config, normalized);
  const idx = docs.findIndex((item) => modelKey(config, item) === key);
  if (idx >= 0) docs[idx] = normalized;
  else docs.push(normalized);
  config.write(data, docs);
  await writeDataFile(data);
}

function applyJsonUpdate(doc, update) {
  const changes = update && typeof update === "object" ? update : {};
  if (changes.$set && typeof changes.$set === "object") {
    Object.assign(doc, changes.$set);
  }
  if (changes.$push && typeof changes.$push === "object") {
    for (const [field, value] of Object.entries(changes.$push)) {
      if (!Array.isArray(doc[field])) doc[field] = [];
      doc[field].push(value);
    }
  }
  return doc;
}

function createJsonModel(config) {
  return {
    find(filter = {}) {
      return new JsonQuery(config, filter);
    },
    async findOne(filter = {}) {
      const docs = await new JsonQuery(config, filter).limit(1);
      return docs[0] || null;
    },
    async countDocuments(filter = {}) {
      const docs = await new JsonQuery(config, filter);
      return docs.length;
    },
    async create(record) {
      const doc = attachModelDocument(config, config.normalize(record));
      await saveJsonDocument(config, doc);
      return doc;
    },
    async deleteOne(filter = {}) {
      const data = readDataFile();
      const docs = config.read(data);
      const idx = docs.findIndex((record) => matchesFilter(attachModelDocument(config, record), filter));
      if (idx >= 0) docs.splice(idx, 1);
      config.write(data, docs);
      await writeDataFile(data);
      return { deletedCount: idx >= 0 ? 1 : 0 };
    },
    async updateMany(filter = {}, update = {}) {
      const data = readDataFile();
      const docs = config.read(data);
      let modifiedCount = 0;
      const nextDocs = docs.map((record) => {
        const doc = attachModelDocument(config, record);
        if (!matchesFilter(doc, filter)) return record;
        modifiedCount += 1;
        return config.normalize(applyJsonUpdate(doc, update));
      });
      config.write(data, nextDocs);
      await writeDataFile(data);
      return { modifiedCount };
    },
  };
}

const User = createJsonModel({
  keyField: "userKey",
  read: (data) => Object.entries(data.users || {})
    .map(([key, value]) => normalizeUserObject({ ...(value || {}), userKey: key }, key)),
  write: (data, docs) => {
    data.users = {};
    for (const doc of docs) {
      const user = normalizeUserObject(doc, doc && doc.userKey);
      if (user.userKey) data.users[user.userKey] = user;
    }
  },
  normalize: (doc) => normalizeUserObject(doc, doc && doc.userKey),
});

const Post = createJsonModel({
  keyField: "id",
  read: (data) => asArray(data.posts).map(normalizePostObject).filter(Boolean),
  write: (data, docs) => {
    data.posts = docs.map(normalizePostObject).filter(Boolean);
    data.nextPostId = data.posts.reduce((max, p) => Math.max(max, (Number.parseInt(p.id, 10) || 0) + 1), 1);
  },
  normalize: (doc) => normalizePostObject(doc),
});

const Story = createJsonModel({
  keyField: "id",
  read: (data) => asArray(data.stories).map(normalizeStoryObject).filter(Boolean),
  write: (data, docs) => {
    data.stories = docs.map(normalizeStoryObject).filter(Boolean);
  },
  normalize: (doc) => normalizeStoryObject(doc),
});

function normalizeDmReactions(value) {
  const source = value && typeof value === "object" ? value : {};
  const reactions = {};
  for (const [emoji, users] of Object.entries(source)) {
    const list = Array.from(new Set(asArray(users).map(String).filter(Boolean)));
    if (!emoji || !list.length) continue;
    reactions[String(emoji)] = list;
  }
  return reactions;
}

function normalizeDmObject(m) {
  return {
    id: String((m && m.id) || crypto.randomBytes(12).toString("base64url")),
    from: String((m && m.from) || ""),
    to: String((m && m.to) || ""),
    text: String((m && m.text) || ""),
    media: asArray(m && m.media),
    createdAt: String((m && m.createdAt) || new Date().toISOString()),
    readBy: asArray(m && m.readBy).map(String),
    reactions: normalizeDmReactions(m && m.reactions),
  };
}

const DM = createJsonModel({
  keyField: "id",
  read: (data) => asArray(data.dms).map(normalizeDmObject),
  write: (data, docs) => {
    data.dms = docs.map(normalizeDmObject);
  },
  normalize: (doc) => normalizeDmObject(doc),
});

const Report = createJsonModel({
  keyField: "id",
  read: (data) => asArray(data.reports).map((r) => clonePlain(r)).filter(Boolean),
  write: (data, docs) => {
    data.reports = docs.map((r) => clonePlain(r)).filter(Boolean);
  },
  normalize: (doc) => ({
    id: String((doc && doc.id) || crypto.randomBytes(12).toString("base64url")),
    reporter: String((doc && doc.reporter) || ""),
    type: String((doc && doc.type) || ""),
    targetId: String((doc && doc.targetId) || ""),
    reason: String((doc && doc.reason) || ""),
    note: String((doc && doc.note) || ""),
    createdAt: String((doc && doc.createdAt) || new Date().toISOString()),
    ai: doc && doc.ai ? clonePlain(doc.ai) : undefined,
  }),
});

async function connectDataFile() {
  ensureDirSync(STORAGE_DIR);
  ensureDirSync(UPLOADS_DIR);
  const current = readDataFile();
  await writeDataFile(current);
}

// -----------------------------
// PostgreSQL Model Functions
// -----------------------------
async function pgFindUserByKey(key) {
  const res = await pgPool.query("SELECT * FROM users WHERE user_key = $1", [key]);
  if (!res.rows.length) return null;
  const row = res.rows[0];
  const obj = {
    ...row,
    userKey: row.user_key,
    avatarUrl: row.avatar_url,
    avatar: row.avatar || row.avatar_url,
    isPrivate: row.is_private,
    isPendingVerification: row.is_pending_verification,
    verificationRequestAt: row.verification_request_at,
    displayName: row.display_name,
    verified: !!row.verified || row.user_key === OWNER_USER_KEY,
    role: row.user_key === OWNER_USER_KEY ? "owner" : String(row.role || ""),
    googleId: row.google_id,
    authProvider: row.auth_provider,
  };
  obj.save = async () => {
    await pgPool.query(
      `UPDATE users SET
        username = $2,
        password = $3,
        bio = $4,
        avatar_url = $5,
        is_private = $6,
        is_pending_verification = $7,
        verification_request_at = $8,
        skills = $9,
        following = $10,
        token = $11,
        email = $12,
        display_name = $13,
        verified = $14,
        role = $15,
        google_id = $16,
        auth_provider = $17,
        avatar = $18
      WHERE user_key = $1`,
      [
        obj.user_key || obj.userKey,
        obj.username,
        obj.password,
        obj.bio,
        obj.avatar_url || obj.avatarUrl,
        obj.is_private ?? obj.isPrivate,
        obj.is_pending_verification ?? obj.isPendingVerification,
        obj.verification_request_at || obj.verificationRequestAt,
        obj.skills,
        obj.following,
        obj.token,
        obj.email || "",
        obj.display_name || obj.displayName || "",
        !!(obj.verified || obj.userKey === OWNER_USER_KEY || obj.user_key === OWNER_USER_KEY),
        (obj.userKey === OWNER_USER_KEY || obj.user_key === OWNER_USER_KEY) ? "owner" : String(obj.role || ""),
        obj.google_id || obj.googleId || "",
        obj.auth_provider || obj.authProvider || "password",
        obj.avatar || obj.avatar_url || obj.avatarUrl || "",
      ]
    );
  };
  return obj;
}

async function pgFindUserByToken(token) {
  const res = await pgPool.query("SELECT * FROM users WHERE token = $1", [token]);
  if (!res.rows.length) return null;
  return pgFindUserByKey(res.rows[0].user_key);
}

async function pgFindUserByUsername(username) {
  const value = String(username || "").trim();
  if (!value) return null;
  const res = await pgPool.query("SELECT user_key FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1", [value]);
  if (!res.rows.length) return null;
  return pgFindUserByKey(res.rows[0].user_key);
}

async function pgCreateUser(user) {
  await pgPool.query(
    `INSERT INTO users (
      user_key, username, password, created_at, bio, avatar_url,
      is_private, is_pending_verification, verification_request_at,
      skills, following, token, email, display_name, verified, role, google_id, auth_provider, avatar
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (user_key) DO UPDATE SET
      username = EXCLUDED.username,
      password = EXCLUDED.password,
      bio = EXCLUDED.bio,
      avatar_url = EXCLUDED.avatar_url,
      skills = EXCLUDED.skills,
      following = EXCLUDED.following,
      token = EXCLUDED.token,
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      verified = EXCLUDED.verified,
      role = EXCLUDED.role,
      google_id = EXCLUDED.google_id,
      auth_provider = EXCLUDED.auth_provider,
      avatar = EXCLUDED.avatar`,
    [
      user.userKey,
      user.username,
      user.password,
      user.createdAt,
      user.bio,
      user.avatarUrl,
      !!user.isPrivate,
      !!user.isPendingVerification,
      user.verificationRequestAt || null,
      user.skills || [],
      user.following || [],
      user.token || "",
      user.email || "",
      user.displayName || "",
      !!(user.verified || user.userKey === OWNER_USER_KEY),
      user.userKey === OWNER_USER_KEY ? "owner" : String(user.role || ""),
      user.googleId || user.google_id || "",
      user.authProvider || user.auth_provider || "password",
      user.avatar || user.avatarUrl || "",
    ]
  );
  return pgFindUserByKey(user.userKey);
}

async function pgCountFollowers(userKey) {
  const res = await pgPool.query(
    "SELECT COUNT(*) FROM users WHERE $1 = ANY(following)",
    [userKey]
  );
  return Number(res.rows[0].count);
}

async function pgFindPrivateUsers() {
  const res = await pgPool.query("SELECT user_key FROM users WHERE is_private = TRUE");
  return res.rows.map((r) => r.user_key);
}

async function pgFindAllPosts() {
  const res = await pgPool.query("SELECT * FROM posts ORDER BY created_at DESC, id DESC");
  return res.rows.map((row) => ({
    ...row,
    authorKey: row.author_key,
    repostOf: row.repost_of,
    quoteText: row.quote_text,
    isRepost: row.is_repost,
    repostType: row.repost_type,
    originalId: row.original_id,
    authorId: row.author_id,
    viewedBy: row.viewed_by,
  }));
}

async function pgFindRankedReelPosts(viewer, limit, cursor) {
  const viewerKey = String(viewer && viewer.userKey || "");
  const viewerFollowing = asArray(viewer && viewer.following).map(String);
  const res = await pgPool.query(
    `SELECT p.*,
      (
        (CARDINALITY(COALESCE(p.likes, '{}')) * 3) +
        COALESCE(p.views, 0) +
        CASE
          WHEN p.created_at >= NOW() - INTERVAL '1 hour' THEN 500
          WHEN p.created_at >= NOW() - INTERVAL '24 hours' THEN 200
          WHEN p.created_at >= NOW() - INTERVAL '7 days' THEN 50
          ELSE 0
        END
      ) AS reel_score,
      CASE
        WHEN p.author_key = ANY($2::text[]) THEN 0
        WHEN p.author_key = $1 THEN 0
        ELSE 1
      END AS relationship_rank
     FROM posts p
     LEFT JOIN users u ON u.user_key = p.author_key
     WHERE EXISTS (
       SELECT 1 FROM jsonb_array_elements(COALESCE(p.media, '[]'::jsonb)) AS media_item
       WHERE media_item->>'kind' = 'video'
     )
     AND (
       p.visibility = 'public'
       OR p.author_key = $1
       OR p.author_key = ANY($2::text[])
     )
     AND (
       COALESCE(u.is_private, FALSE) = FALSE
       OR p.author_key = $1
       OR p.author_key = ANY($2::text[])
     )
     ORDER BY relationship_rank ASC, reel_score DESC, p.created_at DESC, p.id DESC
     OFFSET $3 LIMIT $4`,
    [viewerKey, viewerFollowing, cursor, limit + 1],
  );
  return res.rows.map((row) => ({
    ...row,
    authorKey: row.author_key,
    repostOf: row.repost_of,
    quoteText: row.quote_text,
    isRepost: row.is_repost,
    repostType: row.repost_type,
    originalId: row.original_id,
    authorId: row.author_id,
    viewedBy: row.viewed_by,
    reelScore: Number(row.reel_score || 0),
  }));
}

async function pgFindPostById(id) {
  const res = await pgPool.query("SELECT * FROM posts WHERE id = $1", [id]);
  if (!res.rows.length) return null;
  const row = res.rows[0];
  return {
    ...row,
    authorKey: row.author_key,
    repostOf: row.repost_of,
    quoteText: row.quote_text,
    isRepost: row.is_repost,
    repostType: row.repost_type,
    originalId: row.original_id,
    authorId: row.author_id,
    viewedBy: row.viewed_by,
    save: async () => {
      await pgPool.query(
        `UPDATE posts SET
          author_key = $2,
          author = $3,
          text = $4,
          media = $5,
          visibility = $6,
          likes = $7,
          bookmarks = $8,
          repost_of = $9,
          quote_text = $10,
          is_repost = $11,
          comments = $12,
          views = $13,
          viewed_by = $14
        WHERE id = $1`,
        [
          row.id,
          row.author_key,
          row.author,
          row.text,
          JSON.stringify(row.media || []),
          row.visibility,
          row.likes || [],
          row.bookmarks || [],
          row.repost_of,
          row.quote_text,
          !!row.is_repost,
          JSON.stringify(row.comments || []),
          row.views,
          row.viewed_by || [],
        ]
      );
    },
  };
}

async function pgCreatePost(post) {
  await pgPool.query(
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
      post.authorKey,
      post.author,
      post.text,
      JSON.stringify(post.media || []),
      post.visibility,
      post.createdAt,
      post.likes || [],
      post.bookmarks || [],
      post.repostOf,
      post.quoteText,
      !!post.isRepost,
      post.repostType,
      post.originalId,
      post.authorId,
      JSON.stringify(post.comments || []),
      post.views || 0,
      post.viewedBy || [],
    ]
  );
  return pgFindPostById(post.id);
}

async function pgDeletePost(id) {
  await pgPool.query("DELETE FROM posts WHERE id = $1", [id]);
  return { deletedCount: 1 };
}

async function pgCountReposts(originalId) {
  const res = await pgPool.query("SELECT COUNT(*) FROM posts WHERE repost_of = $1", [originalId]);
  return Number(res.rows[0].count);
}

async function pgFindRepostByAuthor(originalId, authorKey) {
  const res = await pgPool.query(
    "SELECT * FROM posts WHERE repost_of = $1 AND author_key = $2 LIMIT 1",
    [originalId, authorKey]
  );
  if (!res.rows.length) return null;
  return pgFindPostById(res.rows[0].id);
}

async function pgFindAllStories() {
  const res = await pgPool.query("SELECT * FROM stories ORDER BY created_at DESC");
  return res.rows.map((row) => ({
    ...row,
    authorKey: row.author_key,
    seenBy: row.seen_by,
  }));
}

async function pgCreateStory(story) {
  await pgPool.query(
    `INSERT INTO stories (
      id, author_key, author, media, filter, created_at, expires_at, seen_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO NOTHING`,
    [
      story.id,
      story.authorKey,
      story.author,
      JSON.stringify(story.media || {}),
      story.filter,
      story.createdAt,
      story.expiresAt,
      story.seenBy || [],
    ]
  );
}

async function pgFindAllDMs() {
  const res = await pgPool.query('SELECT * FROM dms ORDER BY created_at');
  return res.rows.map((row) => normalizeDmObject({
    id: row.id,
    from: row.from,
    to: row.to,
    text: row.text,
    media: row.media,
    createdAt: row.created_at,
    readBy: row.read_by,
    reactions: row.reactions,
  }));
}

async function pgFindUserByGoogleId(googleId) {
  const id = String(googleId || "");
  if (!id) return null;
  const res = await pgPool.query("SELECT user_key FROM users WHERE google_id = $1 LIMIT 1", [id]);
  if (!res.rows.length) return null;
  return pgFindUserByKey(res.rows[0].user_key);
}

async function pgFindUserByEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value) return null;
  const res = await pgPool.query("SELECT user_key FROM users WHERE LOWER(email) = $1 LIMIT 1", [value]);
  if (!res.rows.length) return null;
  return pgFindUserByKey(res.rows[0].user_key);
}

async function pgCreateDM(dm) {
  await pgPool.query(
    `INSERT INTO dms (
      id, "from", "to", text, media, created_at, read_by, reactions
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO NOTHING`,
    [
      dm.id,
      dm.from,
      dm.to,
      dm.text,
      JSON.stringify(dm.media || []),
      dm.createdAt,
      dm.readBy || [],
      JSON.stringify(normalizeDmReactions(dm.reactions)),
    ]
  );
  if (process.env.DM_DEBUG === "1") console.log("[dm] saved to postgres", dm.id);
}

async function pgFindDmById(id) {
  const res = await pgPool.query('SELECT * FROM dms WHERE id = $1 LIMIT 1', [id]);
  if (!res.rows.length) return null;
  return normalizeDmObject({
    id: res.rows[0].id,
    from: res.rows[0].from,
    to: res.rows[0].to,
    text: res.rows[0].text,
    media: res.rows[0].media,
    createdAt: res.rows[0].created_at,
    readBy: res.rows[0].read_by,
    reactions: res.rows[0].reactions,
  });
}

async function pgUpdateDmMeta(dm) {
  await pgPool.query(
    `UPDATE dms
       SET read_by = $2,
           reactions = $3
     WHERE id = $1`,
    [
      dm.id,
      asArray(dm.readBy).map(String),
      JSON.stringify(normalizeDmReactions(dm.reactions)),
    ]
  );
}

async function pgFindAllReports() {
  const res = await pgPool.query("SELECT * FROM reports ORDER BY created_at");
  return res.rows;
}

async function pgCreateReport(report) {
  await pgPool.query(
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
      report.note,
      report.createdAt,
      report.ai ? JSON.stringify(report.ai) : null,
    ]
  );
}

async function pgFindNotificationsByUser(userKey) {
  const res = await pgPool.query(
    "SELECT * FROM notifications WHERE user_key = $1 ORDER BY created_at DESC LIMIT 100",
    [userKey]
  );
  return res.rows.map((row) => ({
    ...row,
    userKey: row.user_key,
    actorKey: row.actor_key,
    postId: row.post_id,
    commentId: row.comment_id,
  }));
}

async function pgCreateNotification(notification) {
  await pgPool.query(
    `INSERT INTO notifications (
      id, user_key, type, actor_key, post_id, comment_id, read, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      notification.id,
      notification.userKey,
      notification.type,
      notification.actorKey,
      notification.postId,
      notification.commentId,
      !!notification.read,
      notification.createdAt,
    ]
  );
}

async function pgCreateStoryReaction({ storyId, reactorKey, ownerKey, emoji }) {
  const id = crypto.randomBytes(12).toString("base64url");
  await pgPool.query(
    `INSERT INTO story_reactions (id, story_id, reactor_key, owner_key, emoji, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (story_id, reactor_key, emoji) DO UPDATE SET created_at = EXCLUDED.created_at`,
    [id, storyId, reactorKey, ownerKey, emoji, new Date().toISOString()]
  );
}

async function pgFindStoryReactions(storyId) {
  const res = await pgPool.query(
    "SELECT emoji, reactor_key FROM story_reactions WHERE story_id = $1 ORDER BY created_at DESC",
    [storyId]
  );
  return res.rows.map((row) => ({ emoji: row.emoji, reactorKey: row.reactor_key }));
}

// ============================
// PG-aware model wrappers
// ============================

async function findPostById(id) {
  const k = String(id || "");
  if (USE_POSTGRES) return pgFindPostById(k);
  return Post.findOne({ id: k });
}

async function createPostRecord(post) {
  if (USE_POSTGRES) return pgCreatePost(post);
  return Post.create(post);
}

async function deletePostById(id) {
  const k = String(id || "");
  if (USE_POSTGRES) return pgDeletePost(k);
  return Post.deleteOne({ id: k });
}

async function countReposts(originalId) {
  const k = String(originalId || "");
  if (USE_POSTGRES) return pgCountReposts(k);
  return Post.countDocuments({ repostOf: k });
}

async function findRepostByAuthorSimple(originalId, authorKey) {
  const oid = String(originalId || "");
  const ak = String(authorKey || "");
  if (USE_POSTGRES) return pgFindRepostByAuthor(oid, ak);
  return Post.findOne({ repostOf: oid, authorKey: ak, quoteText: "" });
}

async function clearRepostLinks(originalId) {
  const k = String(originalId || "");
  if (USE_POSTGRES) {
    await pgPool.query(
      "UPDATE posts SET repost_of = '', original_id = '' WHERE repost_of = $1",
      [k]
    );
    return;
  }
  await Post.updateMany({ repostOf: k }, { $set: { originalId: "", repostOf: "" } });
}

async function findPostsByUser(authorKey) {
  const k = String(authorKey || "");
  if (USE_POSTGRES) {
    const all = await pgFindAllPosts();
    return all
      .filter((p) => String(p.authorKey || "") === k || String(p.authorId || "") === k)
      .sort((a, b) => String(b.createdAt || "") > String(a.createdAt || "") ? 1 : -1);
  }
  const results = await Post.find({ $or: [{ authorKey: k }, { authorId: k }] });
  return results.sort((a, b) => String(b.createdAt || "") > String(a.createdAt || "") ? 1 : -1);
}

async function findAllPostsForInsights(authorKey) {
  const k = String(authorKey || "");
  if (USE_POSTGRES) {
    const all = await pgFindAllPosts();
    return all.filter((p) => String(p.authorKey || "") === k);
  }
  return Post.find({ authorKey: k });
}

async function findAllPostsForTrending() {
  if (USE_POSTGRES) {
    const all = await pgFindAllPosts();
    return all.slice(0, 100);
  }
  return Post.find().sort({ createdAt: -1 }).limit(100);
}

// --- Story helpers ---

function normalizeStoryRow(row) {
  let media = row.media;
  if (typeof media === "string") {
    try { media = JSON.parse(media); } catch { media = null; }
  }
  return {
    id: row.id,
    authorKey: row.author_key || row.authorKey || "",
    author: row.author || "",
    media,
    filter: row.filter || "normal",
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    expiresAt: row.expires_at || row.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    seenBy: Array.isArray(row.seen_by) ? row.seen_by : (Array.isArray(row.seenBy) ? row.seenBy : []),
  };
}

async function pgFindAllStoriesFromDB() {
  if (!pgPool) return [];
  const res = await pgPool.query("SELECT * FROM stories ORDER BY created_at DESC");
  return res.rows.map(normalizeStoryRow);
}

async function pgFindStoryByIdFromDB(id) {
  if (!pgPool) return null;
  const res = await pgPool.query("SELECT * FROM stories WHERE id = $1", [id]);
  if (!res.rows.length) return null;
  const story = normalizeStoryRow(res.rows[0]);
  story.save = async () => {
    await pgPool.query(
      "UPDATE stories SET seen_by = $2 WHERE id = $1",
      [story.id, story.seenBy || []]
    );
  };
  return story;
}

async function findActiveStories() {
  const now = new Date().toISOString();
  if (USE_POSTGRES) {
    const all = await pgFindAllStoriesFromDB();
    return all.filter((s) => String(s.expiresAt || "") > now);
  }
  return Story.find({ expiresAt: { $gt: now } }).sort({ createdAt: -1 });
}

async function findStoryById(id) {
  const k = String(id || "");
  if (USE_POSTGRES) return pgFindStoryByIdFromDB(k);
  return Story.findOne({ id: k });
}

async function createStoryRecord(story) {
  if (USE_POSTGRES) {
    await pgCreateStory(story);
    return story;
  }
  return Story.create(story);
}

function normalizeUsername(input) {
  const display = String(input ?? "").trim();
  const key = display.toLowerCase();
  return { display, key };
}

function validateUsername(display) {
  if (!display || display.length < 3 || display.length > 20) return "INVALID_USERNAME";
  if (!/^[a-z0-9_]+$/i.test(display)) return "INVALID_USERNAME";
  return null;
}

function validatePassword(pass) {
  const p = String(pass ?? "");
  if (p.length < 6 || p.length > 200) return "INVALID_PASSWORD";
  return null;
}

function newToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function hashPassword(password) {
  // Keep same shape as the older server so existing users can still login.
  const iterations = 120000;
  const keylen = 32;
  const digest = "sha256";
  const salt = crypto.randomBytes(32).toString("base64");
  const derived = crypto.pbkdf2Sync(String(password), Buffer.from(salt, "base64"), iterations, keylen, digest);
  return { salt, hash: derived.toString("base64"), iterations, keylen, digest };
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  if (typeof stored === "string") return String(password) === stored;
  if (typeof stored !== "object") return false;
  const saltB64 = String(stored.salt || "");
  const hashB64 = String(stored.hash || "");
  const iterations = Number(stored.iterations || 0);
  const keylen = Number(stored.keylen || 0);
  const digest = String(stored.digest || "sha256");
  if (!saltB64 || !hashB64 || !iterations || !keylen) return false;
  const derived = crypto.pbkdf2Sync(String(password), Buffer.from(saltB64, "base64"), iterations, keylen, digest);
  const a = Buffer.from(hashB64, "base64");
  const b = derived;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Word Filter for profanity masking
const PROFANITY_FILTER = [
  "fuck", "shit", "damn", "ass", "bitch", "crap", "bastard", "bullshit",
  "cunt", "dick", "cock", "pussy", "whore", "slut", "prick", "fag", "nigger",
  "retard", "idiot", "stupid", "moron", "dumb"
];

function filterProfanity(text) {
  if (!text || typeof text !== "string") return "";
  let filtered = text;
  for (const word of PROFANITY_FILTER) {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "gi");
    filtered = filtered.replace(regex, "****");
  }
  return filtered;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function coerceVisibility(v) {
  const s = String(v || "public");
  return s === "private" ? "private" : "public";
}

function stripUnsafeText(input, maxLen = 1000) {
  return String(input ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function sanitizeBio(input) {
  const b = stripUnsafeText(input, 160);
  if (b.length > 160) return { ok: false, error: "BIO_TOO_LONG" };
  return { ok: true, bio: b };
}

function sanitizeSkills(input) {
  const source = Array.isArray(input) ? input : String(input ?? "").split(",");
  const seen = new Set();
  const skills = [];
  for (const item of source) {
    const skill = String(item || "").trim().replace(/\s+/g, " ");
    if (!skill || skill.length > 40) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push(skill);
    if (skills.length >= 20) break;
  }
  return skills;
}

function normalizeUserObject(u, fallbackKey) {
  const username = String(u && u.username ? u.username : fallbackKey || "").trim();
  const { display, key } = normalizeUsername(username);
  const userKey = String(u && u.userKey ? u.userKey : key);
  return {
    userKey,
    username: display,
    password: u && u.password ? u.password : null,
    createdAt: String((u && u.createdAt) || new Date().toISOString()),
    bio: String((u && u.bio) || ""),
    avatarUrl: publicStoredUrl(u && u.avatarUrl),
    isPrivate: !!(u && u.isPrivate),
    isPendingVerification: !!(u && u.isPendingVerification),
    verificationRequestAt: String((u && u.verificationRequestAt) || ""),
    email: String((u && u.email) || ""),
    displayName: String((u && (u.displayName || u.display_name)) || ""),
    verified: !!(u && u.verified) || userKey === OWNER_USER_KEY,
    role: userKey === OWNER_USER_KEY ? "owner" : String((u && u.role) || ""),
    googleId: String((u && (u.googleId || u.google_id)) || ""),
    authProvider: String((u && (u.authProvider || u.auth_provider)) || "password"),
    skills: asArray(u && u.skills).map(String).slice(0, 20),
    following: asArray(u && u.following).map(String),
    token: typeof (u && u.token) === "string" ? String(u.token) : "",
  };
}

function normalizePostObject(p) {
  const id = String(p && p.id ? p.id : "").trim();
  if (!id) return null;

  const author = String((p && p.author) || "");
  const { key: authorKey } = normalizeUsername((p && (p.authorKey || p.userKey)) || author);

  const likes = asArray(p && p.likes).map(String);
  const comments = asArray(p && p.comments).filter(Boolean);
  const media = asArray(p && p.media).filter(Boolean);

  const viewedBy = asArray(p && p.viewedBy).map(String);
  const views = Number.isFinite(Number(p && p.views)) ? Number(p.views) : viewedBy.length;

  return {
    id,
    author,
    authorKey,
    text: String((p && (p.text || p.content)) || ""),
    media: media.map((m) => ({
      url: String(m && m.url ? m.url : ""),
      kind: String(m && m.kind ? m.kind : ""),
      mime: String(m && m.mime ? m.mime : ""),
    })),
    visibility: coerceVisibility(p && p.visibility),
    createdAt: String((p && p.createdAt) || new Date().toISOString()),
    likes,
    bookmarks: asArray(p && p.bookmarks).map(String),
    repostOf: String((p && p.repostOf) || ""),
    quoteText: String((p && p.quoteText) || ""),
    isRepost: !!(p && (p.isRepost || p.repostOf || p.originalId)),
    repostType: String((p && p.repostType) || ""),
    originalId: String((p && (p.originalId || p.repostOf)) || ""),
    authorId: String((p && (p.authorId || p.authorKey)) || authorKey),
    comments: comments.map((c) => ({
      id: String((c && c.id) || crypto.randomBytes(12).toString("base64url")),
      authorKey: String((c && c.authorKey) || normalizeUsername(c && c.author).key || ""),
      author: String((c && c.author) || ""),
      text: String((c && c.text) || ""),
      parentId: String((c && c.parentId) || ""),
      createdAt: String((c && c.createdAt) || new Date().toISOString()),
    })),
    views,
    viewedBy,
  };
}

function normalizeStoryObject(s) {
  if (!s || typeof s !== "object") return null;
  const id = String(s.id || "").trim() || crypto.randomBytes(12).toString("base64url");
  const authorKey = String(s.authorKey || normalizeUsername(s.author).key || "");
  if (!authorKey) return null;
  const media = s.media && typeof s.media === "object" ? s.media : null;
  const mediaUrl = String(media && media.url ? media.url : "");
  const mediaKind = String(media && media.kind ? media.kind : "");
  const mediaMime = String(media && media.mime ? media.mime : "");
  if (!mediaUrl || !isAllowedMediaUrl(mediaUrl)) return null;
  if (mediaKind !== "image" && mediaKind !== "video") return null;
  if (!mediaMime || (!mediaMime.startsWith("image/") && !mediaMime.startsWith("video/"))) return null;
  return {
    id,
    authorKey,
    author: String(s.author || ""),
    media: { url: mediaUrl, kind: mediaKind, mime: mediaMime },
    filter: normalizeStoryFilter(s.filter),
    createdAt: String(s.createdAt || new Date().toISOString()),
    expiresAt: String(s.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
    seenBy: asArray(s.seenBy).map(String),
  };
}

const STORY_FILTERS = new Set(["normal", "warm", "cool", "contrast", "grayscale", "glow"]);

function normalizeStoryFilter(value) {
  const filter = String(value || "normal").toLowerCase();
  return STORY_FILTERS.has(filter) ? filter : "normal";
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || "");
  const cookies = {};
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    const value = part.slice(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

function getAuthToken(req) {
  return String(parseCookies(req)[AUTH_COOKIE_NAME] || "");
}

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  };
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, String(token || ""), authCookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
  });
}

function csrfTokenForAuthToken(authToken) {
  const token = String(authToken || "");
  if (!token) return "";
  return crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(token)
    .digest("base64url");
}

function safeEqualString(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function authUserFromReq(req) {
  const token = getAuthToken(req);
  if (!token) return null;
  
  if (USE_POSTGRES) {
    return await pgFindUserByToken(token);
  }
  
  return await User.findOne({ token });
}

async function requireAuth(req, res) {
  const u = await authUserFromReq(req);
  if (!u) {
    res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });
    return null;
  }
  return u;
}

const rateLimitBuckets = new Map();
function rateLimitKey(req, bucket) {
  const token = getAuthToken(req);
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "unknown")
    .split(",")[0]
    .trim();
  return `${bucket}:${token || ip}`;
}

function rateLimit(bucketName) {
  const config = RATE_LIMITS[bucketName] || RATE_LIMITS.posts;
  return (req, res, next) => {
    const now = Date.now();
    const key = rateLimitKey(req, bucketName);
    const current = rateLimitBuckets.get(key);
    const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + config.windowMs };
    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);
    if (bucket.count > config.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ ok: false, error: "RATE_LIMITED" });
    }
    if (rateLimitBuckets.size > 5000 && Math.random() < 0.02) {
      for (const [entryKey, entry] of rateLimitBuckets.entries()) {
        if (!entry || entry.resetAt <= now) rateLimitBuckets.delete(entryKey);
      }
    }
    return next();
  };
}

async function findUserByKey(key) {
  const k = String(key || "");
  
  if (USE_POSTGRES) {
    return await pgFindUserByKey(k);
  }
  
  return await User.findOne({ userKey: k });
}

async function findUserByCurrentUsername(username) {
  const display = String(username || "").trim();
  if (!display) return null;

  if (USE_POSTGRES) {
    return await pgFindUserByUsername(display);
  }

  return await User.findOne({ username: { $regex: `^${escapeRegex(display)}$`, $options: "i" } });
}

async function findUserByEmailAddress(email) {
  const value = String(email || "").trim();
  if (!value) return null;

  if (USE_POSTGRES) {
    return await pgFindUserByEmail(value);
  }

  return await User.findOne({ email: { $regex: `^${escapeRegex(value)}$`, $options: "i" } });
}

async function findUserByKeyOrName(input) {
  const raw = String(input || "").trim();
  const { key } = normalizeUsername(raw);
  if (!key) return null;

  const byKey = await findUserByKey(key);
  if (byKey) return byKey;

  const byUsername = await findUserByCurrentUsername(raw);
  if (byUsername) return byUsername;

  if (raw.includes("@")) {
    return await findUserByEmailAddress(raw);
  }

  return null;
}

async function findUserForLogin(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  if (raw.includes("@")) {
    const byEmail = await findUserByEmailAddress(raw);
    if (byEmail) return byEmail;
  }

  return await findUserByKeyOrName(raw);
}

async function followerCountFor(userKey) {
  if (USE_POSTGRES) {
    return await pgCountFollowers(userKey);
  }
  
  return await User.countDocuments({ following: userKey });
}

async function isFriendKeys(aKey, bKey) {
  const a = await findUserByKey(String(aKey || ""));
  const b = await findUserByKey(String(bKey || ""));
  return !!(
    a &&
    b &&
    asArray(a.following).map(String).includes(String(b.userKey)) &&
    asArray(b.following).map(String).includes(String(a.userKey))
  );
}

function toPublicMe(u) {
  const key = String(u && u.userKey ? u.userKey : normalizeUsername(u && u.username).key);
  const role = key === OWNER_USER_KEY ? "owner" : String((u && u.role) || "");
  return {
    key,
    userKey: key,
    username: String(u && u.username ? u.username : ""),
    displayName: String((u && (u.displayName || u.display_name)) || ""),
    email: String((u && u.email) || ""),
    bio: String((u && u.bio) || ""),
    avatarUrl: publicStoredUrl(u && u.avatarUrl),
    isPrivate: !!(u && u.isPrivate),
    skills: asArray(u && u.skills).map(String),
    verified: !!(u && u.verified) || VERIFIED_USERS.has(key) || role === "owner",
    role,
    createdAt: String((u && (u.createdAt || u.created_at)) || ""),
  };
}

function slugFromGoogleProfile(email, name) {
  const source = String((email && email.split("@")[0]) || name || "google_user").toLowerCase();
  const slug = source.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 18);
  return slug || "google_user";
}

async function uniqueGoogleUsername(email, name) {
  const base = slugFromGoogleProfile(email, name);
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base.slice(0, Math.max(3, 18 - String(i).length - 1))}_${i}`;
    const err = validateUsername(candidate);
    if (err) continue;
    if (!await findUserByKey(candidate) && !await findUserByCurrentUsername(candidate)) return candidate;
  }
  return `user_${crypto.randomBytes(5).toString("hex")}`;
}

async function toPublicProfile(target, viewer) {
  const key = String(target.userKey);
  const isFollowing = viewer ? asArray(viewer.following).includes(key) : false;
  const isFriend = viewer ? isFollowing && asArray(target.following).map(String).includes(String(viewer.userKey)) : false;
  const role = key === OWNER_USER_KEY ? "owner" : String(target.role || "");
  return {
    key,
    userKey: key,
    username: String(target.username || ""),
    displayName: String((target && (target.displayName || target.display_name)) || ""),
    bio: String(target.bio || ""),
    avatarUrl: publicStoredUrl(target.avatarUrl),
    isPrivate: !!target.isPrivate,
    skills: asArray(target.skills).map(String),
    verified: !!target.verified || VERIFIED_USERS.has(key) || role === "owner",
    role,
    createdAt: String((target && (target.createdAt || target.created_at)) || ""),
    followerCount: await followerCountFor(key),
    followingCount: asArray(target.following).length,
    isFollowing,
    isFriend,
  };
}

async function toPublicStory(s, viewer) {
  const author = await findUserByKey(String(s.authorKey || ""));
  const viewerKey = viewer ? String(viewer.userKey) : "";
  const seenBy = asArray(s.seenBy).map(String);
  const media = toPublicMediaList([s.media])[0] || null;
  return {
    id: String(s.id || ""),
    authorKey: String(s.authorKey || ""),
    author: String((author && author.username) || s.author || ""),
    authorAvatar: publicStoredUrl(author && author.avatarUrl),
    authorVerified: !!(author && author.verified) || VERIFIED_USERS.has(String(s.authorKey || "")) || String(s.authorKey || "") === OWNER_USER_KEY,
    authorRole: String(s.authorKey || "") === OWNER_USER_KEY ? "owner" : String((author && author.role) || ""),
    authorCreatedAt: String((author && (author.createdAt || author.created_at)) || ""),
    media,
    filter: normalizeStoryFilter(s.filter),
    createdAt: String(s.createdAt || ""),
    expiresAt: String(s.expiresAt || ""),
    seen: !!(viewerKey && seenBy.includes(viewerKey)),
  };
}

async function toPublicComment(c, viewerKey = "") {
  const authorKey = String((c && c.authorKey) || normalizeUsername(c && c.author).key || "");
  const authorUser = await findUserByKey(authorKey);
  const likes = asArray(c && c.likes).map(String);
  return {
    id: String((c && c.id) || ""),
    authorKey,
    author: String((authorUser && authorUser.username) || (c && c.author) || ""),
    authorAvatar: publicStoredUrl(authorUser && authorUser.avatarUrl),
    authorVerified: !!(authorUser && authorUser.verified) || VERIFIED_USERS.has(authorKey) || authorKey === OWNER_USER_KEY,
    authorRole: authorKey === OWNER_USER_KEY ? "owner" : String((authorUser && authorUser.role) || ""),
    authorCreatedAt: String((authorUser && (authorUser.createdAt || authorUser.created_at)) || ""),
    text: String((c && c.text) || ""),
    parentId: String((c && c.parentId) || ""),
    createdAt: String((c && c.createdAt) || new Date().toISOString()),
    likeCount: likes.length,
    likedByMe: !!(viewerKey && likes.includes(viewerKey)),
  };
}

function nestComments(flatComments) {
  const byId = new Map();
  const roots = [];
  for (const c of flatComments) {
    byId.set(String(c.id), { ...c, replies: [] });
  }
  for (const c of byId.values()) {
    const parentId = String(c.parentId || "");
    if (parentId && byId.has(parentId)) byId.get(parentId).replies.push(c);
    else roots.push(c);
  }
  return roots;
}

async function toPublicPost(p, viewer) {
  const authorKey = String(p.authorKey || normalizeUsername(p.author).key || "");
  const author = await findUserByKey(authorKey);
  const authorRole = authorKey === OWNER_USER_KEY ? "owner" : String((author && author.role) || "");
  const likes = asArray(p.likes).map(String);
  const bookmarks = asArray(p.bookmarks).map(String);
  const viewerKey = viewer ? String(viewer.userKey) : "";
  const likedByMe = !!(viewerKey && likes.includes(viewerKey));
  const bookmarkedByMe = !!(viewerKey && bookmarks.includes(viewerKey));
  const isFollowingAuthor = !!(
    viewerKey &&
    authorKey &&
    authorKey !== viewerKey &&
    asArray(viewer && viewer.following).map(String).includes(authorKey)
  );
  const comments = asArray(p.comments);
  const viewCount = Number.isFinite(Number(p.views)) ? Number(p.views) : 0;
  const id = String(p.id);
  
  let repostCount, repostedByMe;
  if (USE_POSTGRES) {
    repostCount = await pgCountReposts(id);
    repostedByMe = viewerKey ? !!(await pgFindRepostByAuthor(id, viewerKey)) : false;
  } else {
    repostCount = await Post.countDocuments({ repostOf: id });
    repostedByMe = viewerKey ? !!(await Post.findOne({ repostOf: id, authorKey: viewerKey })) : false;
  }
  
  let quotedPost = null;
  const repostOf = String(p.repostOf || "");
  if (repostOf) {
    let original;
    if (USE_POSTGRES) {
      original = await pgFindPostById(repostOf);
    } else {
      original = await Post.findOne({ id: repostOf });
    }
    
    if (original && await canViewerSeePost(original, viewer)) {
      const originalAuthorKey = String(original.authorKey || normalizeUsername(original.author).key || "");
      const originalAuthor = await findUserByKey(originalAuthorKey);
      quotedPost = {
        id: String(original.id),
        authorKey: originalAuthorKey,
        author: String((originalAuthor && originalAuthor.username) || original.author || ""),
        authorAvatar: publicStoredUrl(originalAuthor && originalAuthor.avatarUrl),
        verified: !!(originalAuthor && originalAuthor.verified) || VERIFIED_USERS.has(originalAuthorKey) || originalAuthorKey === OWNER_USER_KEY,
        authorRole: originalAuthorKey === OWNER_USER_KEY ? "owner" : String((originalAuthor && originalAuthor.role) || ""),
        authorCreatedAt: String((originalAuthor && (originalAuthor.createdAt || originalAuthor.created_at)) || ""),
        text: String(original.text || ""),
        media: toPublicMediaList(original.media),
        createdAt: String(original.createdAt || ""),
      };
    }
  }

  return {
    id,
    authorKey,
    authorId: String(p.authorId || authorKey),
    author: String((author && author.username) || p.author || ""),
    authorAvatar: publicStoredUrl(author && author.avatarUrl),
    verified: !!(author && author.verified) || VERIFIED_USERS.has(authorKey) || authorRole === "owner",
    authorRole,
    authorCreatedAt: String((author && (author.createdAt || author.created_at)) || ""),
    text: String(p.text || ""),
    content: String(p.text || ""),
    media: toPublicMediaList(p.media),
    repostOf,
    quoteText: String(p.quoteText || ""),
    isRepost: !!(p.isRepost || repostOf || p.originalId),
    repostType: String(p.repostType || ""),
    originalId: String(p.originalId || repostOf || ""),
    quotedPost,
    visibility: coerceVisibility(p.visibility),
    createdAt: String(p.createdAt || new Date().toISOString()),
    likeCount: likes.length,
    commentCount: comments.length,
    viewCount,
    views: viewCount,
    repostCount,
    bookmarkCount: bookmarks.length,
    likedByMe,
    bookmarkedByMe,
    repostedByMe,
    isFollowingAuthor,
  };
}

function conversationKey(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  return x < y ? `${x}:${y}` : `${y}:${x}`;
}

async function visiblePostsForViewer(viewer) {
  const viewerKey = viewer ? String(viewer.userKey) : "";
  const viewerFollowing = asArray(viewer && viewer.following).map(String);
  
  if (USE_POSTGRES) {
    const privateUsers = await pgFindPrivateUsers();
    const hiddenAuthors = privateUsers.filter((k) => k && k !== viewerKey && !viewerFollowing.includes(k));
    const allPosts = await pgFindAllPosts();
    return allPosts.filter((post) => {
      const authorKey = String(post.authorKey || normalizeUsername(post.author).key || "");
      if (hiddenAuthors.includes(authorKey)) return false;
      const visibility = coerceVisibility(post.visibility);
      return (
        visibility === "public" ||
        authorKey === viewerKey ||
        viewerFollowing.includes(authorKey)
      );
    });
  }
  
  const privateUsers = await User.find({ isPrivate: true }).select("userKey");
  const hiddenAuthors = privateUsers
    .map((u) => String(u.userKey || ""))
    .filter((k) => k && k !== viewerKey && !viewerFollowing.includes(k));
  return await Post.find({
    authorKey: { $nin: hiddenAuthors },
    $or: [
      { visibility: "public" },
      { authorKey: viewerKey },
      { authorKey: { $in: viewerFollowing } }
    ]
  }).sort({ createdAt: -1, id: -1 });
}

async function canViewerSeePost(post, viewer) {
  if (!post || !viewer) return false;
  const viewerKey = String(viewer.userKey || "");
  const authorKey = String(post.authorKey || normalizeUsername(post.author).key || "");
  if (!authorKey) return false;
  if (authorKey === viewerKey) return true;
  const followsAuthor = asArray(viewer.following).map(String).includes(authorKey);
  if (coerceVisibility(post.visibility) === "private" && !followsAuthor) return false;
  const author = await findUserByKey(authorKey);
  if (author && author.isPrivate && !followsAuthor) return false;
  return true;
}

function reelRecencyBonus(post) {
  const createdAt = new Date(String(post && (post.createdAt || post.created_at) || ""));
  const ageMs = Date.now() - createdAt.getTime();
  if (!Number.isFinite(ageMs)) return 0;
  if (ageMs <= 60 * 60 * 1000) return 500;
  if (ageMs <= 24 * 60 * 60 * 1000) return 200;
  if (ageMs <= 7 * 24 * 60 * 60 * 1000) return 50;
  return 0;
}

function reelRankScore(post) {
  const likes = asArray(post && post.likes).length;
  const views = Number.isFinite(Number(post && post.views)) ? Number(post.views) : 0;
  return (likes * 3) + views + reelRecencyBonus(post);
}

function sortReelsForViewer(posts, viewer) {
  const viewerKey = String(viewer && viewer.userKey || "");
  const following = asArray(viewer && viewer.following).map(String);
  return posts.slice().sort((a, b) => {
    const aAuthor = String(a && (a.authorKey || normalizeUsername(a.author).key) || "");
    const bAuthor = String(b && (b.authorKey || normalizeUsername(b.author).key) || "");
    const aFollowed = aAuthor === viewerKey || following.includes(aAuthor);
    const bFollowed = bAuthor === viewerKey || following.includes(bAuthor);
    if (aFollowed !== bFollowed) return aFollowed ? -1 : 1;
    const scoreDelta = reelRankScore(b) - reelRankScore(a);
    if (scoreDelta) return scoreDelta;
    const aTime = new Date(String(a && (a.createdAt || a.created_at) || "")).getTime() || 0;
    const bTime = new Date(String(b && (b.createdAt || b.created_at) || "")).getTime() || 0;
    return bTime - aTime;
  });
}

async function nextPostId() {
  if (USE_POSTGRES) {
    const posts = await pgFindAllPosts();
    const maxId = posts.reduce((max, p) => Math.max(max, Number.parseInt(String(p.id || ""), 10) || 0), 0);
    return String(maxId + 1);
  }
  
  const posts = await Post.find().select("id");
  const maxId = posts.reduce((max, p) => Math.max(max, Number.parseInt(String(p.id || ""), 10) || 0), 0);
  return String(maxId + 1);
}

function validateMediaList(media) {
  const list = asArray(media);
  if (list.length > 4) return { ok: false, error: "INVALID_MEDIA" };
  for (const m of list) {
    const url = String(m && m.url ? m.url : "");
    const kind = String(m && m.kind ? m.kind : "");
    const mime = String(m && m.mime ? m.mime : "");
    if (!url || !isAllowedMediaUrl(url)) return { ok: false, error: "INVALID_MEDIA" };
    if (kind !== "image" && kind !== "video") return { ok: false, error: "INVALID_MEDIA" };
    if (!mime || (!mime.startsWith("image/") && !mime.startsWith("video/"))) return { ok: false, error: "INVALID_MEDIA" };
  }
  return { ok: true, media: list.map((m) => ({ url: String(m.url), kind: String(m.kind), mime: String(m.mime) })) };
}

function isAllowedMediaUrl(url) {
  const s = String(url || "");
  return /^data:(image|video|audio)\/[a-z0-9.+-]+;base64,/i.test(s) || 
    /^\/uploads\/[a-z0-9._-]+$/i.test(s) ||
    /^https?:\/\/(res\.cloudinary\.com|.*\.cloudinary\.com)/i.test(s);
}

function uploadUrlExists(url) {
  const s = String(url || "");
  if (/^https?:\/\/(res\.cloudinary\.com|.*\.cloudinary\.com)/i.test(s)) {
    return true;
  }
  const m = /^\/uploads\/([a-z0-9._-]+)$/i.exec(s);
  if (!m) return true;
  return isFile(path.join(UPLOADS_DIR, m[1]));
}

function publicStoredUrl(url) {
  const s = String(url || "");
  if (/^https?:\/\/(res\.cloudinary\.com|.*\.cloudinary\.com)/i.test(s)) {
    return s;
  }
  return s && uploadUrlExists(s) ? s : "";
}

function cloudinaryTransformUrl(url, transform) {
  const s = String(url || "");
  const t = String(transform || "").replace(/^\/+|\/+$/g, "");
  if (!t || !/^https?:\/\/(res\.cloudinary\.com|.*\.cloudinary\.com)\//i.test(s)) return "";
  return s.replace(/\/(image|video|raw)\/upload\//i, (_match, type) => `/${type}/upload/${t}/`);
}

function publicMediaVariants(url, kind) {
  const publicUrl = publicStoredUrl(url);
  const mediaKind = String(kind || "");
  if (!publicUrl) return { url: "", fullUrl: "", previewUrl: "", thumbnailUrl: "" };
  if (!/^https?:\/\/(res\.cloudinary\.com|.*\.cloudinary\.com)\//i.test(publicUrl)) {
    return { url: publicUrl, fullUrl: publicUrl, previewUrl: "", thumbnailUrl: "" };
  }
  if (mediaKind === "image") {
    return {
      url: cloudinaryTransformUrl(publicUrl, "f_auto,q_auto:eco,c_limit,w_720"),
      fullUrl: publicUrl,
      previewUrl: cloudinaryTransformUrl(publicUrl, "f_auto,q_auto:low,c_limit,w_720"),
      thumbnailUrl: cloudinaryTransformUrl(publicUrl, "f_auto,q_auto:low,c_fill,w_240,h_240"),
    };
  }
  if (mediaKind === "video") {
    return {
      url: cloudinaryTransformUrl(publicUrl, "f_auto,q_auto:eco,c_limit,w_720"),
      fullUrl: publicUrl,
      previewUrl: cloudinaryTransformUrl(publicUrl, "f_auto,q_auto:low,c_limit,w_720"),
      thumbnailUrl: cloudinaryTransformUrl(publicUrl, "so_0,f_jpg,q_auto:low,c_fill,w_360,h_640"),
    };
  }
  return { url: publicUrl, fullUrl: publicUrl, previewUrl: "", thumbnailUrl: "" };
}

function normalizePublicMediaUrls(media) {
  const kind = String(media && media.kind || "");
  const originalFull = publicStoredUrl(media && media.fullUrl);
  const originalUrl = publicStoredUrl(media && media.url);
  const originalPreview = publicStoredUrl(media && media.previewUrl);
  const originalThumb = publicStoredUrl(media && media.thumbnailUrl);
  const baseUrl = originalFull || originalUrl || originalPreview || originalThumb;
  const variants = publicMediaVariants(baseUrl, kind);
  const fullUrl = originalFull || variants.fullUrl || originalUrl || originalPreview || variants.url || variants.previewUrl || "";
  const url = variants.url || originalUrl || originalPreview || fullUrl;
  const previewUrl = originalPreview || variants.previewUrl || url || fullUrl;
  let thumbnailUrl = originalThumb || variants.thumbnailUrl || "";
  if (!thumbnailUrl && /^https?:\/\/(res\.cloudinary\.com|.*\.cloudinary\.com)\//i.test(fullUrl || url || previewUrl)) {
    thumbnailUrl = cloudinaryTransformUrl(fullUrl || url || previewUrl, kind === "video"
      ? "so_0,f_jpg,q_auto:low,c_fill,w_360,h_640"
      : "f_auto,q_auto:low,c_fill,w_240,h_240");
  }
  if (!thumbnailUrl) thumbnailUrl = previewUrl || url || fullUrl;
  return { url, fullUrl, previewUrl, thumbnailUrl };
}

function toPublicMediaList(media) {
  return asArray(media)
    .map((m) => ({
      url: String(m && m.url ? m.url : ""),
      fullUrl: String(m && m.fullUrl ? m.fullUrl : ""),
      previewUrl: String(m && m.previewUrl ? m.previewUrl : ""),
      thumbnailUrl: String(m && m.thumbnailUrl ? m.thumbnailUrl : ""),
      kind: String(m && m.kind ? m.kind : ""),
      mime: String(m && m.mime ? m.mime : ""),
      type: String(m && m.type ? m.type : ""),
      effect: String(m && m.effect ? m.effect : ""),
      speed: Number.isFinite(Number(m && m.speed)) ? Number(m.speed) : undefined,
      duration: Number.isFinite(Number(m && m.duration)) ? Number(m.duration) : undefined,
    }))
    .filter((m) => m.kind && m.mime)
    .map((m) => {
      const candidateUrl = m.fullUrl || m.url || m.previewUrl || m.thumbnailUrl;
      if (!candidateUrl || !uploadUrlExists(candidateUrl)) return { ...m, url: "", fullUrl: "", previewUrl: "", thumbnailUrl: "", missing: true };
      return { ...m, ...normalizePublicMediaUrls(m) };
    });
}

function validateDmMediaList(media) {
  const list = asArray(media);
  if (list.length > 4) return { ok: false, error: "INVALID_MEDIA" };
  for (const m of list) {
    const url = String(m && m.url ? m.url : "");
    const kind = String(m && m.kind ? m.kind : "");
    const mime = String(m && m.mime ? m.mime : "");
    if (!url || !isAllowedMediaUrl(url)) return { ok: false, error: "INVALID_MEDIA" };
    if (!["image", "video", "audio"].includes(kind)) return { ok: false, error: "INVALID_MEDIA" };
    if (!mime || !mime.startsWith(`${kind}/`)) return { ok: false, error: "INVALID_MEDIA" };
  }
  return {
    ok: true,
    media: list.map((m) => ({
      url: String(m.url),
      kind: String(m.kind),
      mime: String(m.mime),
      type: String(m.type || ""),
      effect: String(m.effect || ""),
      speed: Number.isFinite(Number(m.speed)) ? Number(m.speed) : undefined,
      duration: Number.isFinite(Number(m.duration)) ? Number(m.duration) : undefined,
    })),
  };
}

function parseDataUrl(dataUrl) {
  const s = String(dataUrl || "");
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(s);
  if (!m) return null;
  const mime = String(m[1] || "");
  const b64 = String(m[2] || "").replace(/\s+/g, "");
  return { mime, b64 };
}

function extForMime(mime) {
  if (!ALLOWED_UPLOAD_MIMES.has(String(mime || "").toLowerCase())) return "";
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
  };
  return map[mime] || "";
}

function readDataFile() {
  const fallback = { users: {}, posts: [], stories: [], dms: [], nextPostId: 1, reports: [], notifications: [] };
  try {
    if (!isFile(DATA_FILE)) return fallback;
    const parsed = safeJsonParse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!parsed || typeof parsed !== "object") return fallback;
    return {
      users: parsed.users && typeof parsed.users === "object" ? parsed.users : {},
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      stories: Array.isArray(parsed.stories) ? parsed.stories : [],
      dms: Array.isArray(parsed.dms) ? parsed.dms : [],
      nextPostId: Number(parsed.nextPostId || 1) || 1,
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
    };
  } catch {
    return fallback;
  }
}

async function writeDataFile(data) {
  await fsp.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tmp = path.join(path.dirname(DATA_FILE), `data.${process.pid}.${Date.now()}.tmp`);
  await fsp.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fsp.rename(tmp, DATA_FILE);
}

async function upsertPostInDataFile(post) {
  const data = readDataFile();
  const plain = {
    id: String(post.id || ""),
    authorKey: String(post.authorKey || ""),
    author: String(post.author || ""),
    text: String(post.text || ""),
    media: asArray(post.media).map((m) => ({
      url: String(m && m.url ? m.url : ""),
      kind: String(m && m.kind ? m.kind : ""),
      mime: String(m && m.mime ? m.mime : ""),
    })),
    visibility: coerceVisibility(post.visibility),
    createdAt: String(post.createdAt || new Date().toISOString()),
    likes: asArray(post.likes).map(String),
    bookmarks: asArray(post.bookmarks).map(String),
    repostOf: String(post.repostOf || ""),
    quoteText: String(post.quoteText || ""),
    isRepost: !!(post.isRepost || post.repostOf || post.originalId),
    repostType: String(post.repostType || ""),
    originalId: String(post.originalId || post.repostOf || ""),
    authorId: String(post.authorId || post.authorKey || ""),
    comments: asArray(post.comments),
    views: Number(post.views || 0) || 0,
    viewedBy: asArray(post.viewedBy).map(String),
  };
  const idx = data.posts.findIndex((p) => String(p && p.id) === plain.id);
  if (idx >= 0) data.posts[idx] = { ...data.posts[idx], ...plain };
  else data.posts.push(plain);
  const numericId = Number.parseInt(plain.id, 10);
  if (Number.isFinite(numericId)) data.nextPostId = Math.max(Number(data.nextPostId || 1), numericId + 1);
  await writeDataFile(data);
}

async function syncDataJson() {
  if (USE_POSTGRES) return; // PostgreSQL manages its own state
  const current = readDataFile();
  const users = {};
  const dbUsers = await User.find();
  for (const u of dbUsers) {
    const key = String(u.userKey || normalizeUsername(u.username).key || "");
    if (!key) continue;
    users[key] = {
      userKey: key,
      username: String(u.username || ""),
      password: u.password || null,
      createdAt: String(u.createdAt || ""),
      bio: String(u.bio || ""),
      avatarUrl: String(u.avatarUrl || ""),
      isPrivate: !!u.isPrivate,
      isPendingVerification: !!u.isPendingVerification,
      verificationRequestAt: String(u.verificationRequestAt || ""),
      skills: asArray(u.skills).map(String),
      following: asArray(u.following).map(String),
      token: String(u.token || ""),
    };
  }
  const dbPosts = await Post.find().sort({ createdAt: 1, id: 1 });
  const posts = dbPosts.map((p) => ({
    id: String(p.id || ""),
    authorKey: String(p.authorKey || ""),
    authorId: String(p.authorId || p.authorKey || ""),
    author: String(p.author || ""),
    text: String(p.text || ""),
    media: asArray(p.media),
    visibility: coerceVisibility(p.visibility),
    createdAt: String(p.createdAt || ""),
    likes: asArray(p.likes).map(String),
    bookmarks: asArray(p.bookmarks).map(String),
    isRepost: !!(p.isRepost || p.repostOf || p.originalId),
    repostType: String(p.repostType || ""),
    originalId: String(p.originalId || p.repostOf || ""),
    repostOf: String(p.repostOf || p.originalId || ""),
    quoteText: String(p.quoteText || ""),
    comments: asArray(p.comments),
    views: Number(p.views || 0) || 0,
    viewedBy: asArray(p.viewedBy).map(String),
  }));
  const dbStories = await Story.find().sort({ createdAt: 1 });
  const stories = dbStories.map((s) => ({
    id: String(s.id || ""),
    authorKey: String(s.authorKey || ""),
    author: String(s.author || ""),
    media: s.media || null,
    filter: normalizeStoryFilter(s.filter),
    createdAt: String(s.createdAt || ""),
    expiresAt: String(s.expiresAt || ""),
    seenBy: asArray(s.seenBy).map(String),
  }));
  const dbDms = await DM.find().sort({ createdAt: 1 });
  const dms = dbDms.map((m) => ({
    id: String(m.id || ""),
    from: String(m.from || ""),
    to: String(m.to || ""),
    text: String(m.text || ""),
    media: asArray(m.media),
    createdAt: String(m.createdAt || ""),
    readBy: asArray(m.readBy).map(String),
    reactions: normalizeDmReactions(m.reactions),
  }));
  const reports = await Report.find().sort({ createdAt: 1 });
  await writeDataFile({
    ...current,
    users,
    posts,
    stories,
    dms,
    nextPostId: posts.reduce((max, p) => Math.max(max, (Number.parseInt(p.id, 10) || 0) + 1), 1),
    reports: reports.map((r) => (typeof r.toObject === "function" ? r.toObject() : r)),
    notifications: asArray(current.notifications),
  });
}

async function addNotification({ userKey, type, actorKey, postId = "", commentId = "" }) {
  const target = String(userKey || "");
  if (!target || target === String(actorKey || "")) return;
  const notification = {
    id: crypto.randomBytes(12).toString("base64url"),
    userKey: target,
    type: String(type || ""),
    actorKey: String(actorKey || ""),
    postId: String(postId || ""),
    commentId: String(commentId || ""),
    read: false,
    createdAt: new Date().toISOString(),
  };
  if (USE_POSTGRES) {
    await pgCreateNotification(notification);
    return;
  }
  const data = readDataFile();
  data.notifications = asArray(data.notifications);
  data.notifications.unshift(notification);
  data.notifications = data.notifications.slice(0, 500);
  await writeDataFile(data);
}

// -----------------------------
// Express app
// -----------------------------

const app = express();
app.disable("x-powered-by");
const httpServer = http.createServer(app);

function wrapAsyncRoute(handler) {
  if (typeof handler !== "function" || handler.length >= 4) return handler;
  return function wrappedRoute(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

for (const method of ["get", "post", "put", "patch", "delete"]) {
  const original = app[method].bind(app);
  app[method] = (path, ...handlers) => original(path, ...handlers.map(wrapAsyncRoute));
}

// JSON/Body parsing middleware - MUST be first for Base64 data handling
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ limit: JSON_LIMIT, extended: true }));

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64url");
  res.setHeader("Content-Security-Policy", contentSecurityPolicy(req, res.locals.cspNonce));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  if (NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  return next();
});

app.use((req, res, next) => {
  const startedAt = Date.now();
  let approxBytes = 0;
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  res.write = (chunk, encoding, cb) => {
    if (chunk) approxBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), encoding);
    return originalWrite(chunk, encoding, cb);
  };
  res.end = (chunk, encoding, cb) => {
    if (chunk) approxBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), encoding);
    const result = originalEnd(chunk, encoding, cb);
    const route = req.route && req.route.path ? req.route.path : req.path;
    console.log(`[bandwidth] ${req.method} ${route} ${res.statusCode} ${approxBytes}b ${Date.now() - startedAt}ms`);
    return result;
  };
  next();
});

// (Optional) CORS for debugging / split deployments.
app.use((req, res, next) => {
  const origin = String(req.headers.origin || "");
  const allowedOrigin = !origin || origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`;
  if (allowedOrigin && origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", `Content-Type, ${CSRF_HEADER_NAME}`);
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
});

app.use((req, res, next) => {
  const method = String(req.method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next();
  if (!String(req.path || "").startsWith("/api/")) return next();

  const publicAuthPaths = new Set([
    "/api/login",
    "/api/register",
    "/api/signup",
    "/api/auth/google",
  ]);
  if (publicAuthPaths.has(String(req.path || ""))) return next();

  const authToken = getAuthToken(req);
  const expected = csrfTokenForAuthToken(authToken);
  const provided = String(req.headers[CSRF_HEADER_NAME] || "");
  if (!authToken || !expected || !provided || !safeEqualString(provided, expected)) {
    return res.status(403).json({ ok: false, error: "INVALID_CSRF_TOKEN" });
  }
  return next();
});

app.post(
  "/csp-report",
  express.json({
    type: ["application/csp-report", "application/reports+json", "application/json"],
    limit: "16kb",
  }),
  (req, res) => {
    const report = req.body && (req.body["csp-report"] || req.body);
    const blocked = String(report && (report["blocked-uri"] || report.blockedURL || report.blockedURL) || "");
    const directive = String(report && (report["violated-directive"] || report.effectiveDirective || "") || "");
    console.warn(`[csp] violation directive=${directive || "unknown"} blocked=${blocked || "unknown"}`);
    return res.status(204).end();
  }
);

// PeerJS server with error handling
try {
  const peerServer = ExpressPeerServer(httpServer, { path: "/peerjs", proxied: true });
  app.use("/peerjs", peerServer);
  console.log("[PeerJS] Server initialized successfully");
} catch (err) {
  console.warn("[PeerJS] Failed to initialize:", err.message);
}

// Health check for Render
app.get("/healthz", (req, res) => res.status(200).send("ok"));

app.use((req, res, next) => {
  const pathName = String(req.path || "");
  if (pathName.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  } else if (pathName.startsWith("/uploads/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else if (/\.(?:js|css|svg|png|jpg|jpeg|webp|gif|woff2?)$/i.test(pathName)) {
    res.setHeader("Cache-Control", "public, max-age=86400");
  }
  next();
});

// -----------------------------
// API
// -----------------------------

app.get("/api/version", (req, res) => res.status(200).json({
  ok: true,
  version: "hysa1-json-persistent-2026-05-01",
  dataMode: USE_POSTGRES ? "postgres" : "data.json",
  storageMode: USE_CLOUDINARY ? "cloudinary" : "local",
  persistentStorage: USING_PERSISTENT_STORAGE,
}));

async function handleRegister(req, res) {
  const body = req.body || {};
  const { display, key } = normalizeUsername(body.username);
  const usernameErr = validateUsername(display);
  if (usernameErr) return res.status(400).json({ ok: false, error: usernameErr });
  const passErr = validatePassword(body.password);
  if (passErr) return res.status(400).json({ ok: false, error: passErr });

  if (await findUserByKey(key) || await findUserByCurrentUsername(display)) {
    return res.status(409).json({ ok: false, error: "USERNAME_TAKEN" });
  }

  const u = normalizeUserObject(
    {
      userKey: key,
      username: display,
      password: hashPassword(body.password),
      createdAt: new Date().toISOString(),
      bio: "",
      avatarUrl: "",
      following: [],
      token: newToken(),
    },
    key,
  );
  
  let createdUser;
  if (USE_POSTGRES) {
    createdUser = await pgCreateUser(u);
  } else {
    await User.create(u);
    await syncDataJson();
    createdUser = u;
  }
  
  setAuthCookie(res, createdUser.token);
  return res.status(200).json({ ok: true, csrfToken: csrfTokenForAuthToken(createdUser.token), me: toPublicMe(createdUser) });
}

app.post("/api/register", rateLimit("auth"), handleRegister);
app.post("/api/signup", rateLimit("auth"), handleRegister);

app.post("/api/login", rateLimit("auth"), async (req, res) => {
  const body = req.body || {};
  const login = String(body.username ?? body.email ?? "").trim();
  const password = String(body.password ?? "");

  const u = await findUserForLogin(login);
  if (!u || !verifyPassword(password, u.password)) {
    return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
  }

  u.token = newToken();
  await u.save();
  if (!USE_POSTGRES) {
    await syncDataJson();
  }
  setAuthCookie(res, u.token);
  return res.status(200).json({ ok: true, csrfToken: csrfTokenForAuthToken(u.token), me: toPublicMe(u) });
});

app.post("/api/auth/google", rateLimit("auth"), async (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ ok: false, error: "GOOGLE_AUTH_NOT_CONFIGURED" });
  }
  const credential = String((req.body && req.body.credential) || "").trim();
  if (!credential) return res.status(400).json({ ok: false, error: "INVALID_GOOGLE_CREDENTIAL" });

  let payload;
  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ ok: false, error: "INVALID_GOOGLE_CREDENTIAL" });
  }

  const googleId = String(payload && payload.sub || "");
  const email = String(payload && payload.email || "").trim().toLowerCase();
  const emailVerified = payload && payload.email_verified === true;
  const displayName = String(payload && payload.name || "").trim();
  const picture = String(payload && payload.picture || "").trim();
  if (!googleId || !email || !emailVerified) {
    return res.status(401).json({ ok: false, error: "INVALID_GOOGLE_CREDENTIAL" });
  }

  let user = USE_POSTGRES
    ? await pgFindUserByGoogleId(googleId)
    : await User.findOne({ googleId });

  if (!user) {
    user = USE_POSTGRES
      ? await pgFindUserByEmail(email)
      : await User.findOne({ email });
  }

  if (user) {
    user.googleId = googleId;
    user.google_id = googleId;
    user.authProvider = user.authProvider || user.auth_provider || "google";
    user.auth_provider = user.authProvider;
    user.email = email;
    if (displayName) user.displayName = displayName;
    if (picture) {
      user.avatarUrl = picture;
      user.avatar_url = picture;
      user.avatar = picture;
    }
    user.token = newToken();
    await user.save();
    if (!USE_POSTGRES) await syncDataJson();
    setAuthCookie(res, user.token);
    return res.status(200).json({ ok: true, csrfToken: csrfTokenForAuthToken(user.token), me: toPublicMe(user) });
  }

  const username = await uniqueGoogleUsername(email, displayName);
  const created = normalizeUserObject({
    userKey: username,
    username,
    password: hashPassword(crypto.randomBytes(18).toString("base64url")),
    createdAt: new Date().toISOString(),
    bio: "",
    avatarUrl: picture,
    avatar: picture,
    email,
    displayName,
    googleId,
    authProvider: "google",
    isPrivate: false,
    skills: [],
    following: [],
    token: newToken(),
  }, username);

  const saved = USE_POSTGRES ? await pgCreateUser(created) : await User.create(created);
  if (!USE_POSTGRES) await syncDataJson();
  setAuthCookie(res, saved.token);
  return res.status(200).json({ ok: true, csrfToken: csrfTokenForAuthToken(saved.token), me: toPublicMe(saved) });
});

app.get("/api/config", (_req, res) => {
  return res.status(200).json({
    ok: true,
    googleClientId: GOOGLE_CLIENT_ID,
  });
});

app.post("/api/logout", async (req, res) => {
  clearAuthCookie(res);
  const u = await authUserFromReq(req);
  if (!u) return res.status(200).json({ ok: true });
  u.token = "";
  await u.save();
  if (!USE_POSTGRES) {
    await syncDataJson();
  }
  return res.status(200).json({ ok: true });
});

app.get("/api/me", async (req, res) => {
  const u = await requireAuth(req, res);
  if (!u) return;
  return res.status(200).json({ ok: true, csrfToken: csrfTokenForAuthToken(getAuthToken(req)), me: toPublicMe(u) });
});

function paginationFromReq(req) {
  const pageRaw = Number.parseInt(String(req.query.page || "1"), 10);
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const limitRaw = Number.parseInt(String(req.query.limit || "5"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5, limitRaw)) : 5;
  const cursorRaw = Number.parseInt(String(req.query.cursor || ""), 10);
  const cursor = Number.isFinite(cursorRaw) && cursorRaw >= 0 ? cursorRaw : (page - 1) * limit;
  return { page, limit, cursor };
}

async function paginatedPostsForViewer(req, viewer) {
  const { page, limit, cursor } = paginationFromReq(req);
  const posts = await visiblePostsForViewer(viewer);
  const slice = await Promise.all(posts.slice(cursor, cursor + limit).map((p) => toPublicPost(p, viewer)));
  const nextCursor = cursor + slice.length < posts.length ? String(cursor + slice.length) : null;
  const nextPage = nextCursor ? page + 1 : null;
  return {
    page,
    limit,
    total: posts.length,
    data: slice,
    posts: slice,
    nextPage,
    nextCursor,
  };
}

app.get("/api/posts", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const result = await paginatedPostsForViewer(req, viewer);
  return res.status(200).json(result);
});

// Scheduled posts — MUST be before /api/posts/:id to avoid shadowing
app.get("/api/posts/scheduled", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  if (!USE_POSTGRES) return res.status(200).json({ ok: true, posts: [] });
  const r = await pgPool.query(
    "SELECT * FROM posts WHERE author_key = $1 AND scheduled_at > NOW() ORDER BY scheduled_at ASC",
    [viewerKey]
  );
  return res.status(200).json({ ok: true, posts: r.rows.map(formatPostRow) });
});

app.get("/api/feed", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const result = await paginatedPostsForViewer(req, viewer);
  return res.status(200).json({ ok: true, ...result });
});

app.get("/api/reels", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const limitRaw = Number.parseInt(String(req.query.limit || "3"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5, limitRaw)) : 3;
  const cursorRaw = Number.parseInt(String(req.query.cursor || "0"), 10);
  const cursor = Number.isFinite(cursorRaw) && cursorRaw >= 0 ? cursorRaw : 0;
  let slice;
  let hasMore = false;
  if (USE_POSTGRES) {
    const ranked = await pgFindRankedReelPosts(viewer, limit, cursor);
    slice = ranked.slice(0, limit);
    hasMore = ranked.length > limit;
  } else {
    const all = await visiblePostsForViewer(viewer);
    const candidates = sortReelsForViewer(
      all.filter((p) => asArray(p.media).some((m) => String(m.kind) === "video")),
      viewer,
    );
    slice = candidates.slice(cursor, cursor + limit);
    hasMore = cursor + slice.length < candidates.length;
  }
  const reels = await Promise.all(slice.map((p) => toPublicPost(p, viewer)));
  const nextCursor = hasMore ? String(cursor + slice.length) : null;
  return res.status(200).json({ ok: true, reels, nextCursor });
});

app.get("/api/trends", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const posts = await visiblePostsForViewer(viewer);
  const counts = new Map();
  for (const p of posts) {
    const text = String(p.text || "");
    for (const match of text.matchAll(/(^|\s)#([a-z0-9_]{2,30})/gi)) {
      const tag = `#${String(match[2] || "").toLowerCase()}`;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  const trends = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));
  return res.status(200).json({ ok: true, trends });
});

// Trending Hashtags - Top 5 from last 100 posts
app.get("/api/trending/hashtags", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const posts = await findAllPostsForTrending();
  const counts = new Map();
  for (const p of posts) {
    const text = String(p.text || "");
    for (const match of text.matchAll(/(^|\s)#([a-z0-9_]{2,30})/gi)) {
      const tag = `#${String(match[2] || "").toLowerCase()}`;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  const trending = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
  return res.status(200).json({ ok: true, trending });
});

// Verification Request
app.post("/api/verification/request", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  viewer.isPendingVerification = true;
  viewer.verificationRequestAt = new Date().toISOString();
  await viewer.save();
  await syncDataJson();
  return res.status(200).json({ ok: true, pending: true, requestedAt: viewer.verificationRequestAt });
});

// Get Verification Status
app.get("/api/verification/status", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  return res.status(200).json({ 
    ok: true, 
    verified: !!viewer.verified || VERIFIED_USERS.has(String(viewer.userKey)) || String(viewer.userKey) === OWNER_USER_KEY,
    role: String(viewer.userKey) === OWNER_USER_KEY ? "owner" : String(viewer.role || ""),
    pending: !!viewer.isPendingVerification,
    requestedAt: viewer.verificationRequestAt || ""
  });
});

app.get("/api/stories", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const now = Date.now();
  const list = await findActiveStories();
  const stories = await Promise.all(list.map((s) => toPublicStory(s, viewer)));
  return res.status(200).json({ ok: true, stories });
});

app.post("/api/stories", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const media = req.body && req.body.media ? req.body.media : null;
  const mediaUrl = String(media && media.url ? media.url : "");
  const mediaKind = String(media && media.kind ? media.kind : "");
  const mediaMime = String(media && media.mime ? media.mime : "");
  if (!mediaUrl || !isAllowedMediaUrl(mediaUrl)) return res.status(400).json({ ok: false, error: "INVALID_MEDIA" });
  if (mediaKind !== "image" && mediaKind !== "video") return res.status(400).json({ ok: false, error: "INVALID_MEDIA" });
  if (!mediaMime || (!mediaMime.startsWith("image/") && !mediaMime.startsWith("video/"))) {
    return res.status(400).json({ ok: false, error: "INVALID_MEDIA" });
  }
  const story = {
    id: crypto.randomBytes(12).toString("base64url"),
    authorKey: String(viewer.userKey),
    author: String(viewer.username),
    media: { url: mediaUrl, kind: mediaKind, mime: mediaMime },
    filter: normalizeStoryFilter(req.body && req.body.filter),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    seenBy: [String(viewer.userKey)],
  };
  await createStoryRecord(story);
  await syncDataJson();
  return res.status(200).json({ ok: true, story: await toPublicStory(story, viewer) });
});

app.post("/api/stories/:id/view", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const id = String(req.params.id || "");
  const story = await findStoryById(id);
  if (!story) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  if (String(story.expiresAt || "") <= new Date().toISOString()) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
  if (!Array.isArray(story.seenBy)) story.seenBy = [];
  const viewerKey = String(viewer.userKey);
  if (!story.seenBy.includes(viewerKey)) {
    story.seenBy.push(viewerKey);
    await story.save();
    await syncDataJson();
  }
  return res.status(200).json({ ok: true, story: await toPublicStory(story, viewer) });
});

app.post("/api/stories/:id/reactions", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const id = String(req.params.id || "");
  const story = await findStoryById(id);
  if (!story) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  if (String(story.expiresAt || "") <= new Date().toISOString()) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
  const emoji = String((req.body && req.body.emoji) || "").trim().slice(0, 16);
  if (!emoji) return res.status(400).json({ ok: false, error: "INVALID_REACTION" });
  const ownerKey = String(story.authorKey || "");
  const reactorKey = String(viewer.userKey || "");
  if (ownerKey === reactorKey) return res.status(200).json({ ok: true });
  if (USE_POSTGRES) {
    await pgCreateStoryReaction({ storyId: id, reactorKey, ownerKey, emoji });
  } else {
    const data = readDataFile();
    data.storyReactions = asArray(data.storyReactions).filter((item) => !(
      String(item.storyId) === id && String(item.reactorKey) === reactorKey && String(item.emoji) === emoji
    ));
    data.storyReactions.push({ id: crypto.randomBytes(12).toString("base64url"), storyId: id, reactorKey, ownerKey, emoji, createdAt: new Date().toISOString() });
    await writeDataFile(data);
  }
  await addNotification({ userKey: ownerKey, type: "story_reaction", actorKey: reactorKey, commentId: id });
  await createDMRecord({
    id: crypto.randomBytes(12).toString("base64url"),
    from: reactorKey,
    to: ownerKey,
    text: `${emoji} reacted to your story`,
    media: [],
    createdAt: new Date().toISOString(),
    readBy: [reactorKey],
    reactions: {},
  });
  await syncDataJson();
  return res.status(200).json({ ok: true });
});

app.get("/api/stories/:id/reactions", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const id = String(req.params.id || "");
  const story = await findStoryById(id);
  if (!story) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  if (String(story.authorKey || "") !== String(viewer.userKey || "")) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  }
  const reactions = USE_POSTGRES
    ? await pgFindStoryReactions(id)
    : asArray(readDataFile().storyReactions).filter((item) => String(item.storyId) === id);
  return res.status(200).json({ ok: true, reactions });
});

app.get("/api/user/:key", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const raw = String(req.params.key || "");
  const target = await findUserByKeyOrName(raw);
  if (!target) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  const isMe = String(target.userKey) === String(viewer.userKey);
  const followsTarget = asArray(viewer.following).map(String).includes(String(target.userKey));
  if (target.isPrivate && !isMe && !followsTarget) {
    return res.status(200).json({ ok: true, profile: await toPublicProfile(target, viewer), posts: [], private: true });
  }

  const list = await findPostsByUser(String(target.userKey));

  const visible = [];
  for (const post of list) {
    if (await canViewerSeePost(post, viewer)) visible.push(post);
  }
  const posts = await Promise.all(visible.map((p) => toPublicPost(p, viewer)));
  return res.status(200).json({ ok: true, profile: await toPublicProfile(target, viewer), posts });
});

app.post("/api/follow/:key", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const raw = String(req.params.key || "");
  const target = await findUserByKeyOrName(raw);
  if (!target) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  if (String(target.userKey) === String(viewer.userKey)) return res.status(400).json({ ok: false, error: "REPORT_INVALID" });

  if (!Array.isArray(viewer.following)) viewer.following = [];
  const idx = viewer.following.indexOf(String(target.userKey));
  let following = false;
  if (idx >= 0) {
    viewer.following.splice(idx, 1);
    following = false;
  } else {
    viewer.following.push(String(target.userKey));
    following = true;
  }
  await viewer.save();
  await syncDataJson();
  if (following) {
    await addNotification({ userKey: String(target.userKey), type: "new_follower", actorKey: String(viewer.userKey) });
  }
  return res.status(200).json({
    ok: true,
    following,
    isFriend: following && asArray(target.following).map(String).includes(String(viewer.userKey)),
    followerCount: await followerCountFor(String(target.userKey)),
  });
});

app.get("/api/posts/:id", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const id = String(req.params.id || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  if (!await canViewerSeePost(post, viewer)) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
  return res.status(200).json({ ok: true, post: await toPublicPost(post, viewer) });
});

app.post("/api/posts", rateLimit("posts"), async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const body = req.body || {};
  const text = stripUnsafeText(body.text ?? body.content ?? "", 280);
  const visibility = coerceVisibility(body.visibility);

  const mediaCheck = validateMediaList(body.media);
  if (!mediaCheck.ok) return res.status(400).json({ ok: false, error: mediaCheck.error });

  const hasText = !!text.trim();
  const hasMedia = mediaCheck.media.length > 0;
  if (!hasText && !hasMedia) return res.status(400).json({ ok: false, error: "INVALID_POST" });
  if (text.length > 280) return res.status(400).json({ ok: false, error: "INVALID_POST" });

  const post = {
    id: await nextPostId(),
    authorKey: String(viewer.userKey),
    author: String(viewer.username),
    text,
    media: mediaCheck.media,
    visibility,
    createdAt: new Date().toISOString(),
    likes: [],
    bookmarks: [],
    repostOf: "",
    quoteText: "",
    isRepost: false,
    repostType: "",
    originalId: "",
    authorId: String(viewer.userKey),
    comments: [],
    views: 0,
    viewedBy: [],
  };
  await createPostRecord(post);
  await syncDataJson();
  console.log(`[post] created id=${post.id} author=${post.author} media=${post.media.length}`);
  return res.status(200).json({ ok: true, post: await toPublicPost(post, viewer) });
});

app.post("/api/posts/:id/like", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const id = String(req.params.id || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  if (!await canViewerSeePost(post, viewer)) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  if (!Array.isArray(post.likes)) post.likes = [];
  const k = String(viewer.userKey);
  const idx = post.likes.indexOf(k);
  let liked = false;
  if (idx >= 0) {
    post.likes.splice(idx, 1);
    liked = false;
  } else {
    post.likes.push(k);
    liked = true;
  }
  await post.save();
  await syncDataJson();
  if (liked) {
    await addNotification({ userKey: String(post.authorKey), type: "like", actorKey: String(viewer.userKey), postId: id });
  }
  return res.status(200).json({ ok: true, liked, likeCount: asArray(post.likes).length });
});

app.post("/api/posts/:id/bookmark", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const id = String(req.params.id || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  if (!await canViewerSeePost(post, viewer)) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  if (!Array.isArray(post.bookmarks)) post.bookmarks = [];
  const k = String(viewer.userKey);
  const idx = post.bookmarks.indexOf(k);
  let bookmarked = false;
  if (idx >= 0) {
    post.bookmarks.splice(idx, 1);
  } else {
    post.bookmarks.push(k);
    bookmarked = true;
  }
  await post.save();
  await syncDataJson();
  return res.status(200).json({ ok: true, bookmarked, bookmarkCount: asArray(post.bookmarks).length });
});

app.post("/api/posts/:id/repost", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const id = String(req.params.id || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  if (!await canViewerSeePost(post, viewer)) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  const quoteText = String((req.body && req.body.quoteText) || "").trim();
  if (quoteText.length > 280) return res.status(400).json({ ok: false, error: "INVALID_POST" });
  const requestedType = String((req.body && req.body.repostType) || "").toLowerCase();
  const inferredType = asArray(post.media).some((m) => String(m && m.kind) === "video") ? "video" : "post";
  const repostType = ["post", "video", "comment"].includes(requestedType) ? requestedType : inferredType;

  const existing = await findRepostByAuthorSimple(id, String(viewer.userKey));
  if (existing && !quoteText) {
    await deletePostById(existing.id || existing._id);
    await syncDataJson();
    const repostCount = await countReposts(id);
    return res.status(200).json({ ok: true, reposted: false, repostCount });
  }

  const repost = {
    id: await nextPostId(),
    authorKey: String(viewer.userKey),
    author: String(viewer.username),
    text: quoteText,
    media: [],
    visibility: "public",
    createdAt: new Date().toISOString(),
    likes: [],
    bookmarks: [],
    repostOf: id,
    quoteText,
    isRepost: true,
    repostType,
    originalId: id,
    authorId: String(viewer.userKey),
    comments: [],
    views: 0,
    viewedBy: [],
  };
  const created = await createPostRecord(repost);
  await syncDataJson();
  await addNotification({ userKey: String(post.authorKey), type: "repost", actorKey: String(viewer.userKey), postId: id });
  const repostCount = await countReposts(id);
  return res.status(200).json({ ok: true, reposted: true, repostCount, post: await toPublicPost(created, viewer) });
});

app.get("/api/posts/:id/comments", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const id = String(req.params.id || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  if (!await canViewerSeePost(post, viewer)) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  const limitRaw = Number.parseInt(String(req.query.limit || "50"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;
  const vk = String(viewer.userKey);
  const comments = await Promise.all(asArray(post.comments).slice(-limit).map((c) => toPublicComment(c, vk)));
  return res.status(200).json({ ok: true, comments: nestComments(comments), commentCount: asArray(post.comments).length });
});

app.post("/api/posts/:id/comments", rateLimit("comments"), async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const id = String(req.params.id || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  if (!await canViewerSeePost(post, viewer)) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  const text = stripUnsafeText((req.body && req.body.text) || "", 200);
  const filteredText = filterProfanity(text);
  const parentId = String((req.body && req.body.parentId) || "");
  if (!text || text.length > 200) return res.status(400).json({ ok: false, error: "INVALID_COMMENT" });

  if (!Array.isArray(post.comments)) post.comments = [];
  const comment = {
    id: crypto.randomBytes(12).toString("base64url"),
    authorKey: String(viewer.userKey),
    text: filteredText,
    parentId,
    createdAt: new Date().toISOString(),
  };
  post.comments.push(comment);
  await post.save();
  await syncDataJson();
  await addNotification({
    userKey: String(post.authorKey),
    type: parentId ? "comment_reply" : "comment",
    actorKey: String(viewer.userKey),
    postId: id,
    commentId: comment.id,
  });
  return res.status(200).json({ ok: true, comment: await toPublicComment(comment), commentCount: asArray(post.comments).length });
});

app.post("/api/posts/:id/comments/:commentId/replies", rateLimit("comments"), async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const id = String(req.params.id || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  if (!await canViewerSeePost(post, viewer)) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
  const text = stripUnsafeText((req.body && req.body.text) || "", 200);
  const filteredText = filterProfanity(text);
  const parentId = String(req.params.commentId || "");
  if (!text || text.length > 200 || !parentId) return res.status(400).json({ ok: false, error: "INVALID_COMMENT" });
  if (!Array.isArray(post.comments)) post.comments = [];
  const comment = {
    id: crypto.randomBytes(12).toString("base64url"),
    authorKey: String(viewer.userKey),
    text: filteredText,
    parentId,
    createdAt: new Date().toISOString(),
  };
  post.comments.push(comment);
  await post.save();
  await syncDataJson();
  await addNotification({ userKey: String(post.authorKey), type: "comment_reply", actorKey: String(viewer.userKey), postId: id, commentId: comment.id });
  return res.status(200).json({ ok: true, comment: await toPublicComment(comment), commentCount: asArray(post.comments).length });
});

app.post("/api/posts/:id/comments/:commentId/like", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const id = String(req.params.id || "");
  const commentId = String(req.params.commentId || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  if (!await canViewerSeePost(post, viewer)) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  const comment = asArray(post.comments).find((c) => String(c && c.id) === commentId);
  if (!comment) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  if (!Array.isArray(comment.likes)) comment.likes = [];
  const k = String(viewer.userKey);
  const idx = comment.likes.indexOf(k);
  let liked = false;
  if (idx >= 0) {
    comment.likes.splice(idx, 1);
    liked = false;
  } else {
    comment.likes.push(k);
    liked = true;
  }
  await post.save();
  await syncDataJson();
  return res.status(200).json({ ok: true, liked, likeCount: comment.likes.length });
});

app.delete("/api/posts/:id/comments/:commentId", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const id = String(req.params.id || "");
  const commentId = String(req.params.commentId || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  if (!await canViewerSeePost(post, viewer)) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  const viewerKey = String(viewer.userKey);
  const comments = asArray(post.comments);
  const target = comments.find((c) => String(c && c.id) === commentId);
  if (!target) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  const ownsComment = String(target.authorKey || "") === viewerKey;
  const ownsPost = String(post.authorKey || "") === viewerKey || String(post.authorId || "") === viewerKey;
  if (!ownsComment && !ownsPost) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

  post.comments = comments.filter((c) => {
    const currentId = String(c && c.id || "");
    const parentId = String(c && c.parentId || "");
    return currentId !== commentId && parentId !== commentId;
  });
  await post.save();
  await syncDataJson();
  return res.status(200).json({ ok: true, commentCount: asArray(post.comments).length });
});

app.delete("/api/posts/:id", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const id = String(req.params.id || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  const viewerKey = String(viewer.userKey);
  const ownsPost = String(post.authorKey || "") === viewerKey || String(post.authorId || "") === viewerKey;
  if (!ownsPost) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

  await deletePostById(post.id || post._id);
  await clearRepostLinks(id);
  await syncDataJson();
  return res.status(200).json({ ok: true });
});

async function handlePostView(req, res) {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const id = String(req.params.id || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  if (!await canViewerSeePost(post, viewer)) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  if (!Array.isArray(post.viewedBy)) post.viewedBy = [];
  const viewerKey = String(viewer.userKey);
  if (!post.viewedBy.includes(viewerKey)) {
    post.viewedBy.push(viewerKey);
    post.views = Number.isFinite(Number(post.views)) ? Number(post.views) + 1 : 1;
    await post.save();
    await syncDataJson();
  }
  const viewCount = Number.isFinite(Number(post.views)) ? Number(post.views) : 0;
  return res.status(200).json({ ok: true, viewCount });
}

app.post("/api/reels/:id/view", handlePostView);

app.post("/api/posts/:id/view", handlePostView);

app.post("/api/profile", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const body = req.body || {};
  const bioCheck = sanitizeBio(body.bio);
  if (!bioCheck.ok) return res.status(400).json({ ok: false, error: bioCheck.error });
  const usernameRaw = body.username === undefined ? "" : String(body.username || "").trim();
  if (usernameRaw) {
    const normalized = normalizeUsername(usernameRaw);
    if (!normalized.key) return res.status(400).json({ ok: false, error: "INVALID_USERNAME" });
    const existing = USE_POSTGRES
      ? (await pgPool.query("SELECT user_key FROM users WHERE LOWER(username) = LOWER($1) AND user_key <> $2 LIMIT 1", [normalized.display, String(viewer.userKey)])).rows[0]
      : await User.findOne({ username: { $regex: `^${escapeRegex(normalized.display)}$`, $options: "i" }, userKey: { $ne: String(viewer.userKey) } });
    if (existing) return res.status(409).json({ ok: false, error: "USERNAME_TAKEN" });
    viewer.username = normalized.display;
  }
  const email = String(body.email || viewer.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "INVALID_EMAIL" });
  }

  const avatarUrl = String(body.avatarUrl || "");
  if (avatarUrl && !isAllowedMediaUrl(avatarUrl)) return res.status(400).json({ ok: false, error: "UPLOAD_INVALID" });

  viewer.bio = bioCheck.bio;
  viewer.email = email;
  viewer.displayName = stripUnsafeText(body.displayName || body.display_name || viewer.displayName || "", 80);
  viewer.avatarUrl = avatarUrl;
  viewer.isPrivate = body.isPrivate === true || String(body.isPrivate || "").toLowerCase() === "true";
  viewer.skills = sanitizeSkills(body.skills);
  await viewer.save();
  await syncDataJson();
  return res.status(200).json({ ok: true, me: toPublicMe(viewer) });
});

app.get("/api/insights", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const posts = await findAllPostsForInsights(String(viewer.userKey));
  const views = posts.reduce((acc, p) => acc + (Number.isFinite(Number(p.views)) ? Number(p.views) : 0), 0);
  const likes = posts.reduce((acc, p) => acc + asArray(p.likes).length, 0);
  const saves = posts.reduce((acc, p) => acc + asArray(p.bookmarks).length, 0);
  return res.status(200).json({ ok: true, insights: { posts: posts.length, views, likes, saves } });
});

// Post Insights - individual post performance
app.get("/api/posts/:id/insights", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const id = String(req.params.id || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  const authorKey = String(post.authorKey || "");
  if (authorKey !== String(viewer.userKey)) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  }

  const viewCount = Number.isFinite(Number(post.views)) ? Number(post.views) : 0;
  const likeCount = asArray(post.likes).length;
  const commentCount = asArray(post.comments).length;
  const saveCount = asArray(post.bookmarks).length;
  const repostCount = await countReposts(id);

  return res.status(200).json({ 
    ok: true, 
    insights: { 
      postId: id,
      views: viewCount,
      likes: likeCount,
      comments: commentCount,
      saves: saveCount,
      reposts: repostCount,
      createdAt: post.createdAt
    } 
  });
});

app.get("/api/notifications", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  const list = USE_POSTGRES
    ? await pgFindNotificationsByUser(viewerKey)
    : asArray(readDataFile().notifications).filter((n) => String(n && n.userKey) === viewerKey).slice(0, 100);
  return res.status(200).json({ ok: true, notifications: list });
});

app.post("/api/notifications/read", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  if (USE_POSTGRES) {
    await pgPool.query("UPDATE notifications SET read = TRUE WHERE user_key = $1", [viewerKey]);
    return res.status(200).json({ ok: true });
  }
  const data = readDataFile();
  data.notifications = asArray(data.notifications).map((n) => {
    if (String(n && n.userKey) !== viewerKey) return n;
    return { ...n, read: true };
  });
  await writeDataFile(data);
  return res.status(200).json({ ok: true });
});

app.get("/api/search", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.status(200).json({ ok: true, results: [] });
  const safeQ = escapeRegex(q);

  if (q.startsWith("#")) {
    const tag = q.replace(/^#+/, "").replace(/[^a-z0-9_]/gi, "").slice(0, 30);
    if (!tag) return res.status(200).json({ ok: true, results: [] });
    const tagRe = new RegExp(`(^|\\s)#${escapeRegex(tag)}\\b`, "i");
    const posts = await visiblePostsForViewer(viewer);
    const results = (await Promise.all(posts
      .filter((p) => tagRe.test(String(p.text || "")))
      .slice(0, 20)
      .map(async (p) => {
        const author = await findUserByKey(String(p.authorKey || ""));
        return {
          type: "post",
          id: String(p.id || ""),
          hashtag: `#${tag.toLowerCase()}`,
          text: String(p.text || "").slice(0, 120),
          authorKey: String(p.authorKey || ""),
          author: String((author && author.username) || p.author || ""),
        };
      })));
    return res.status(200).json({ ok: true, results });
  }

  const users = USE_POSTGRES
    ? (await pgPool.query(
        "SELECT * FROM users WHERE user_key ILIKE $1 OR username ILIKE $1 OR display_name ILIKE $1 LIMIT 12",
        [`%${q}%`],
      )).rows.map((row) => ({
        ...row,
        userKey: row.user_key,
        avatarUrl: row.avatar_url,
        displayName: row.display_name,
        isPrivate: row.is_private,
      }))
    : await User.find({
        $or: [
          { userKey: { $regex: safeQ, $options: "i" } },
          { username: { $regex: safeQ, $options: "i" } },
        ],
      }).limit(12);

  const results = users
    .filter((u) => {
      const displayName = String(u.displayName || u.display_name || "").toLowerCase();
      return u && (
        String(u.userKey).toLowerCase().includes(q) ||
        String(u.username).toLowerCase().includes(q) ||
        displayName.includes(q)
      );
    })
    .map((u) => {
      const key = String(u.userKey);
      const isFollowing = asArray(viewer.following).map(String).includes(key);
      const isFriend = isFollowing && asArray(u.following).map(String).includes(String(viewer.userKey));
      return {
      type: "user",
      key,
      username: String(u.username),
      displayName: String(u.displayName || u.display_name || ""),
      avatarUrl: publicStoredUrl(u.avatarUrl || u.avatar_url),
      verified: !!u.verified || VERIFIED_USERS.has(String(u.userKey)) || String(u.userKey) === OWNER_USER_KEY,
      role: String(u.userKey) === OWNER_USER_KEY ? "owner" : String(u.role || ""),
      createdAt: String(u.createdAt || u.created_at || ""),
      isPrivate: !!u.isPrivate,
      isFollowing,
      isFriend,
      skills: asArray(u.skills).map(String),
    };});

  return res.status(200).json({ ok: true, results });
});

app.get("/api/friends", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  const following = asArray(viewer.following).map(String);
  if (!following.length) return res.status(200).json({ ok: true, friends: [] });
  const users = USE_POSTGRES
    ? (await pgPool.query("SELECT user_key FROM users WHERE user_key = ANY($1)", [following])).rows
    : await User.find({ userKey: { $in: following } });
  const friends = [];
  for (const item of users) {
    const user = USE_POSTGRES ? await findUserByKey(item.user_key) : item;
    if (!user || !asArray(user.following).map(String).includes(viewerKey)) continue;
    const key = String(user.userKey);
    friends.push({
      key,
      userKey: key,
      username: String(user.username || ""),
      displayName: String(user.displayName || user.display_name || ""),
      avatarUrl: publicStoredUrl(user.avatarUrl || user.avatar_url),
      verified: !!user.verified || VERIFIED_USERS.has(key) || key === OWNER_USER_KEY,
      role: key === OWNER_USER_KEY ? "owner" : String(user.role || ""),
      isFriend: true,
    });
  }
  return res.status(200).json({ ok: true, friends: friends.slice(0, 50) });
});

app.get("/api/dm/threads", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);

  const allDms = USE_POSTGRES
    ? (await pgFindAllDMs()).filter((msg) => String(msg.from) === viewerKey || String(msg.to) === viewerKey)
    : await DM.find({ $or: [{ from: viewerKey }, { to: viewerKey }] });
  if (USE_POSTGRES && process.env.DM_DEBUG === "1") console.log("[dm] loaded inbox from postgres", viewerKey, allDms.length);

  const threadMap = new Map();
  for (const msg of allDms) {
    const from = String(msg.from || "");
    const to = String(msg.to || "");
    
    const peerKey = from === viewerKey ? to : from;
    if (!peerKey) continue;
    
    const k = conversationKey(viewerKey, peerKey);
    const current = threadMap.get(k);
    if (!current || String(current.createdAt || "") < String(msg.createdAt || "")) {
      threadMap.set(k, msg);
    }
  }
  const threads = await Promise.all(Array.from(threadMap.values()).map(async (msg) => {
      const peerKey = String(msg.from) === viewerKey ? String(msg.to) : String(msg.from);
      const peer = await findUserByKey(peerKey);

      const unreadCount = USE_POSTGRES
        ? allDms.filter((item) => String(item.from) === peerKey && String(item.to) === viewerKey && !asArray(item.readBy).includes(viewerKey)).length
        : await DM.countDocuments({
            from: peerKey,
            to: viewerKey,
            readBy: { $ne: viewerKey }
          });

      return {
        peerKey,
        peerUsername: String((peer && peer.username) || peerKey),
        peerAvatar: publicStoredUrl(peer && peer.avatarUrl),
        peerVerified: !!(peer && peer.verified) || VERIFIED_USERS.has(peerKey) || peerKey === OWNER_USER_KEY,
        peerRole: peerKey === OWNER_USER_KEY ? "owner" : String((peer && peer.role) || ""),
        peerCreatedAt: String((peer && (peer.createdAt || peer.created_at)) || ""),
        lastMessage: String(msg.text || "") || (asArray(msg.media).length ? `[${String(asArray(msg.media)[0].kind || "media")}]` : ""),
        createdAt: String(msg.createdAt || ""),
        unreadCount,
      };
  }));

  threads.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return res.status(200).json({ ok: true, threads });
});

app.get("/api/dm/:key", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const peer = await findUserByKeyOrName(String(req.params.key || ""));
  if (!peer) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  
  const viewerKey = String(viewer.userKey);
  const peerKey = String(peer.userKey);

  const list = USE_POSTGRES
    ? (await pgFindAllDMs()).filter((msg) => (
        (String(msg.from) === viewerKey && String(msg.to) === peerKey) ||
        (String(msg.from) === peerKey && String(msg.to) === viewerKey)
      )).sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
    : await DM.find({
        $or: [
          { from: viewerKey, to: peerKey },
          { from: peerKey, to: viewerKey }
        ]
      }).sort({ createdAt: 1 });
  if (USE_POSTGRES && process.env.DM_DEBUG === "1") console.log("[dm] loaded thread from postgres", viewerKey, peerKey, list.length);

  const messages = list.map((m) => ({
    id: String(m.id || ""),
    from: String(m.from || ""),
    to: String(m.to || ""),
    text: String(m.text || ""),
    media: toPublicMediaList(m.media),
    createdAt: String(m.createdAt || ""),
    mine: String(m.from) === viewerKey,
    seen: String(m.from) === viewerKey ? asArray(m.readBy).includes(peerKey) : true,
    reactions: normalizeDmReactions(m.reactions),
  }));

  if (USE_POSTGRES) {
    for (const message of list) {
      if (String(message.from) !== peerKey || String(message.to) !== viewerKey) continue;
      if (asArray(message.readBy).includes(viewerKey)) continue;
      message.readBy = asArray(message.readBy).concat(viewerKey);
      await pgUpdateDmMeta(message);
    }
  } else {
    await DM.updateMany(
      { from: peerKey, to: viewerKey, readBy: { $ne: viewerKey } },
      { $push: { readBy: viewerKey } }
    );
  }
  await syncDataJson();

  return res.status(200).json({
    ok: true,
    peer: {
      key: peerKey,
      username: String(peer.username || ""),
      avatarUrl: publicStoredUrl(peer.avatarUrl),
      verified: !!peer.verified || VERIFIED_USERS.has(peerKey) || peerKey === OWNER_USER_KEY,
      role: peerKey === OWNER_USER_KEY ? "owner" : String(peer.role || ""),
      isFriend: await isFriendKeys(viewerKey, peerKey),
    },
    messages,
  });
});

app.post("/api/dm/:key", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const peer = await findUserByKeyOrName(String(req.params.key || ""));
  if (!peer) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  if (String(peer.userKey) === String(viewer.userKey)) return res.status(400).json({ ok: false, error: "INVALID_MESSAGE" });
  
  const text = String((req.body && req.body.text) || "").trim();
  if (text.length > 600) return res.status(400).json({ ok: false, error: "INVALID_MESSAGE" });
  const mediaCheck = validateDmMediaList(req.body && req.body.media);
  if (!mediaCheck.ok) return res.status(400).json({ ok: false, error: mediaCheck.error });
  if (!text && !mediaCheck.media.length) return res.status(400).json({ ok: false, error: "INVALID_MESSAGE" });
  
  const message = {
    id: crypto.randomBytes(12).toString("base64url"),
    from: String(viewer.userKey),
    to: String(peer.userKey),
    text,
    media: mediaCheck.media,
    createdAt: new Date().toISOString(),
    readBy: [String(viewer.userKey)],
    reactions: {},
  };
  if (USE_POSTGRES) await pgCreateDM(message);
  else await DM.create(message);
  await addNotification({ userKey: String(peer.userKey), type: "dm", actorKey: String(viewer.userKey) });
  await syncDataJson();
  return res.status(200).json({ ok: true, message: { ...message, mine: true } });
});

app.post("/api/dm/message/:id/reactions", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const messageId = String(req.params.id || "");
  const emoji = String(req.body && req.body.emoji || "").trim();
  if (!messageId || !emoji || emoji.length > 8) {
    return res.status(400).json({ ok: false, error: "INVALID_MESSAGE" });
  }
  const viewerKey = String(viewer.userKey);
  const message = USE_POSTGRES ? await pgFindDmById(messageId) : await DM.findOne({ id: messageId });
  if (!message) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  const participants = new Set([String(message.from || ""), String(message.to || "")]);
  if (!participants.has(viewerKey)) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  const reactions = normalizeDmReactions(message.reactions);
  const hadSameEmoji = asArray(reactions[emoji]).map(String).includes(viewerKey);
  for (const key of Object.keys(reactions)) {
    reactions[key] = asArray(reactions[key]).map(String).filter((user) => user !== viewerKey);
    if (!reactions[key].length) delete reactions[key];
  }
  if (!hadSameEmoji) {
    reactions[emoji] = Array.from(new Set(asArray(reactions[emoji]).concat(viewerKey).map(String).filter(Boolean)));
  }
  message.reactions = reactions;
  if (USE_POSTGRES) await pgUpdateDmMeta(message);
  else await message.save();
  await syncDataJson();
  return res.status(200).json({ ok: true, reactions });
});

app.post("/api/report", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const body = req.body || {};
  const type = String(body.type || "");
  const targetId = String(body.targetId || "");
  const reason = String(body.reason || "");
  const note = String(body.note || "");
  const validReasons = new Set(["spam", "abuse", "fake", "other"]);
  if (type !== "post" || !targetId || !validReasons.has(reason) || note.length > 300) {
    return res.status(400).json({ ok: false, error: "REPORT_INVALID" });
  }

  const post = await findPostById(targetId);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  const report = {
    id: crypto.randomBytes(12).toString("base64url"),
    reporter: String(viewer.userKey),
    type,
    targetId,
    reason,
    note,
    createdAt: new Date().toISOString(),
  };
  const content = `${String(post.text || "")} ${asArray(post.comments).map((c) => String(c.text || "")).join(" ")}`.toLowerCase();
  const bannedSignals = ["abuse", "hate", "kill", "spam", "scam", "nude"];
  const hit = bannedSignals.some((w) => content.includes(w));
  report.ai = {
    status: hit ? "flagged" : "clean",
    confidence: hit ? 0.86 : 0.19,
    action: hit ? "limit_visibility" : "allow",
    reviewedAt: new Date().toISOString(),
  };
  await Report.create(report);
  await syncDataJson();
  return res.status(200).json({ ok: true, report });
});

app.get("/api/moderation/reports", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const list = await Report.find().sort({ createdAt: -1 }).limit(100);
  return res.status(200).json({ ok: true, reports: list });
});

function aiSmartReply(message) {
  const orig = String(message || "").trim();
  const m = orig.toLowerCase();
  const isAr = /[\u0600-\u06FF]/.test(orig);

  // Greeting
  if (/^(hi|hello|hey|howdy|hiya|سلام|مرحبا|السلام عليكم|أهلا|هلا|مرحبًا|صباح|مساء)/.test(m)) {
    const g = isAr ? [
      "أهلاً! أنا بلوطة 🌰 مساعدك الذكي على HYSA. كيف أقدر أساعدك اليوم؟",
      "مرحباً بك! 🌟 اطلب مني كابشن، هاشتاقات، بايو، أو أي شيء تحتاجه!",
      "هلا والله! 🌰 شو نسوي اليوم؟ كابشن؟ هاشتاق؟ فكرة منشور؟",
    ] : [
      "Hey there! I'm بلوطة 🌰 your smart HYSA assistant. What can I create for you?",
      "Hello! Ready to craft some amazing content? Captions, hashtags, bio — just ask!",
    ];
    return g[Math.floor(Math.random() * g.length)];
  }

  // Caption requests
  const captionTemplates = {
    food: isAr ? [
      "الأكل مش بس رزق، هو فن 🍽️ #طعام #مطبخ #اكل_عربي",
      "اللي يكل من يده، يكل زين 🧑‍🍳✨ #طبخ #شهيوات",
      "معدتك سعيدة = أنت سعيد 😍 #فود #مطاعم",
      "كل وجبة قصة 📖 وهذي قصتي مع الطعام 🍜 #foodie #اكل",
      "الحياة أجمل بوجبة حلوة 🌮 #طعام_العرب",
    ] : [
      "Food is my love language 🍜 #foodie #yummy #instafood",
      "Life is short, eat the good stuff 🍕 #food #foodlover",
      "Good food = good mood 😍 #foodblog #delicious",
      "Eating my way through life, one bite at a time 🌮 #foodstagram",
      "They said eat less. I said eat better 🍰 #foodies",
    ],
    travel: isAr ? [
      "العالم كتاب، ومن لم يسافر قرأ صفحة واحدة 🌍 #سفر #ترحال",
      "كل مكان جديد، روح جديدة ✈️ #رحلات #adventure",
      "السفر لا يُكمَّل دون قصص تُحكى 🗺️ #مسافر #سياحة",
      "بعيد عن المألوف، قريب من الجمال 🏔️ #سفر #طبيعة",
    ] : [
      "Not all those who wander are lost 🌍 #travel #wanderlust",
      "Life is short and the world is wide ✈️ #explore #adventure",
      "Collect moments, not things 🗺️ #travelgram #wanderer",
      "Every destination has a story 🏔️ #travelblogger",
    ],
    motivation: isAr ? [
      "كل يوم فرصة جديدة للبداية 💪 #تحفيز #نجاح",
      "لا تتوقف حين تتعب، توقف حين تنجح 🏆 #motivation",
      "أصعب خطوة هي الأولى، والباقي سيأتي 🌟 #عزيمة",
      "ما تُزرعه اليوم تحصده غداً 🌱 #تطوير_الذات",
    ] : [
      "Start where you are. Use what you have. Do what you can. 💪 #motivation",
      "Dream big. Work hard. Stay humble. 🌟 #success #inspire",
      "Progress, not perfection 🏆 #growth #mindset",
      "Be the energy you want to attract ✨ #positivity",
    ],
    funny: isAr ? [
      "الحياة مش سهلة بس الوجه الحلو يساعد 😂 #يوميات #humor",
      "أنا مش كسلان، أنا موفّر طاقتي 🛋️ #كوميدي #يوميات",
      "قرأت إن الضحك علاج، والله وأنا أعالج نفسي كل يوم 😂 #humor",
    ] : [
      "I'm not lazy, I'm just energy efficient 🛋️ #relatable #funny",
      "Current mood: pretending to be a morning person ☕ #humor #relatable",
      "My therapist told me to embrace my flaws. So here I am 😅 #funny",
    ],
  };

  if (/كابشن|caption|وصف.*صورة|صورة.*وصف|اكتب.*صورة/.test(m)) {
    let cat = "motivation";
    if (/food|اكل|طعام|مطعم|طبخ|شهيوات/.test(m)) cat = "food";
    else if (/travel|سفر|رحلة|ترحال|مطار/.test(m)) cat = "travel";
    else if (/funny|مضحك|كوميدي|ظريف/.test(m)) cat = "funny";
    const list = captionTemplates[cat];
    const picks = list.slice(0, 3).join("\n\n");
    return isAr
      ? `إليك ${list.length < 4 ? "بعض" : "٣"} كابشنات لصورتك 📸:\n\n${picks}\n\nقل لي الموضوع وأعطيك المزيد! 🌰`
      : `Here are some captions for your photo 📸:\n\n${picks}\n\nTell me the vibe and I'll get more specific! 🌰`;
  }

  // Hashtag suggestions
  const hashtagDB = {
    travel: "#سفر #ترحال #رحلات #مسافر #سياحة #travel #wanderlust #explore #adventure #travelgram #instatravel #backpacking #globetrotter #travelphoto #worldtravel",
    food: "#طعام #اكل #مطبخ #شهيوات #وصفات #food #foodie #yummy #instafood #foodstagram #homecooking #delicious #foodblog #recipe #eating",
    tech: "#تقنية #تكنولوجيا #برمجة #تطوير #tech #technology #coding #programming #developer #software #ai #startup #innovation #digital",
    fitness: "#رياضة #لياقة #صحة #تمارين #fitness #gym #workout #health #motivation #fitlife #bodybuilding #exercise #training #lifestyle",
    fashion: "#موضة #ستايل #لباس #فاشن #fashion #style #ootd #outfit #trending #aesthetic #streetstyle #instafashion",
    art: "#فن #رسم #إبداع #تصميم #art #artwork #drawing #creative #design #illustration #artist #digitalart",
    general: "#hysa #تواصل_اجتماعي #محتوى #عرب #lifestyle #content #social #trending #viral #explore",
  };

  if (/هاشتاق|hashtag|وسم|هاشتاغ/.test(m)) {
    let cat = "general";
    if (/food|اكل|طعام/.test(m)) cat = "food";
    else if (/travel|سفر|رحل/.test(m)) cat = "travel";
    else if (/tech|تقني|برمج/.test(m)) cat = "tech";
    else if (/sport|رياض|gym|fitness/.test(m)) cat = "fitness";
    else if (/fashion|موضة|ستايل/.test(m)) cat = "fashion";
    else if (/art|فن|رسم/.test(m)) cat = "art";
    return isAr
      ? `إليك هاشتاقات ${cat} مناسبة لمنشورك 🏷️:\n\n${hashtagDB[cat]}\n\n💡 نصيحة: استخدم ٥-١٠ هاشتاقات للوصول الأفضل!`
      : `Here are ${cat} hashtags for your post 🏷️:\n\n${hashtagDB[cat]}\n\n💡 Tip: Use 5-10 hashtags for best reach!`;
  }

  // Bio templates
  const bioTemplates = isAr ? [
    "مهتم بـ [اهتمامك] | أشارك [محتواك] كل يوم 🌟 | DM مفتوح",
    "📍 [مدينتك] | 💼 [مجالك] | أؤمن أن الحياة أجمل مع [شغفك]",
    "مصمم حياتي بطريقتي الخاصة 🎨 | [تخصصك] بشغف | هنا لأشاركك قصتي",
    "صانع محتوى | [موضوعك] | نشر الإيجابية يومياً ☀️",
    "أحب [شغفك] وأصنع محتوى عن [موضوعك] 📲 | انضم لرحلتي!",
  ] : [
    "Living life one post at a time 📲 | [Your niche] creator | DMs open",
    "📍 [City] | Passionate about [interest] | Sharing my journey daily",
    "Content creator | [Topic] enthusiast | Spreading good vibes ☀️",
    "Just a [job/hobby] who loves to share 🌟 | [Your specialty]",
    "Building dreams, sharing stories 🚀 | [Your focus] | Join the ride!",
  ];

  if (/bio|نبذة|بايو|about me|profile.*desc/.test(m)) {
    const picks = bioTemplates.slice(0, 3).join("\n\n");
    return isAr
      ? `إليك ٣ قوالب بايو احترافية 📋:\n\n${picks}\n\n✏️ استبدل الكلمات بين [] بمعلوماتك الحقيقية!`
      : `Here are 3 professional bio templates 📋:\n\n${picks}\n\n✏️ Replace words in [] with your actual info!`;
  }

  // What is HYSA
  if (/hysa|التطبيق|about.*app/.test(m)) {
    return isAr
      ? "HYSA هي شبكة تواصل اجتماعي عربية أولاً 🌐\n\nيمكنك:\n• نشر منشورات + صور + فيديو\n• متابعة الأصدقاء\n• قصص تختفي بعد ٢٤ ساعة\n• رسائل مباشرة\n• مشاركة Reels\n• بلوطة المساعد الذكي 🌰"
      : "HYSA is an Arabic-first micro-social platform 🌐\n\nFeatures: Posts, Stories, Reels, DMs, Friends System, and me — بلوطة 🌰 your AI assistant!";
  }

  // Post idea
  if (/فكرة|idea|اقتراح|suggest|post.*idea/.test(m)) {
    const ideas = isAr ? [
      "💡 شارك لحظة جميلة من يومك مع وصف قصير — الناس تحب الأصالة!",
      "💡 اكتب ٣ أشياء تعلمتها هذا الأسبوع مع #تعلمت_اليوم",
      "💡 نشر صورة قديمة مع تعليق عن كيف تغيّرت — التحولات دائماً تحصل تفاعل كبير!",
      "💡 اسأل متابعيك سؤالاً — التفاعل يزيد الوصول!",
    ] : [
      "💡 Share a 'day in my life' moment — authenticity always wins!",
      "💡 Post a throwback with a reflection — people love growth stories!",
      "💡 Ask your followers a question — engagement boosts reach!",
      "💡 Share a tip from your expertise with #tips",
    ];
    return ideas[Math.floor(Date.now() / 1000) % ideas.length];
  }

  // How to use
  if (/كيف|how to|post|نشر|upload/.test(m)) {
    return isAr
      ? "لإنشاء منشور ✏️:\n1. اضغط زر ＋ في الأسفل\n2. اكتب نصك\n3. أضف صورة أو فيديو\n4. اضغط نشر 🚀"
      : "To create a post ✏️:\n1. Tap the + button at the bottom\n2. Write your text\n3. Add a photo or video\n4. Hit Post! 🚀";
  }

  // Default
  const defaults = isAr ? [
    "أنا بلوطة 🌰 جاهز أساعدك في:\n• كتابة كابشن صورة 📸\n• اقتراح هاشتاقات 🏷️\n• كتابة بايو احترافي\n• أفكار للمنشورات 💡\n\nماذا تريد؟",
    "هلا! 🌰 قل لي ماذا تحتاج وأنا هنا — كابشن، هاشتاق، بايو، أو أي شيء تبيه!",
  ] : [
    "I'm بلوطة 🌰 Here to help with:\n• Photo captions 📸\n• Hashtag suggestions 🏷️\n• Professional bio writing\n• Post ideas 💡\n\nWhat do you need?",
    "Hey! 🌰 Ask me for captions, hashtags, bio templates, or post ideas!",
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

function aiNotConfigured(kind, prompt) {
  const trimmed = String(prompt || "").trim();
  if (kind === "image") {
    return {
      configured: false,
      message: "لم يتم تكوين توليد الصور بعد. أضف مفتاح API على الخادم لتفعيل هذه الميزة.",
      media: null,
      prompt: trimmed,
    };
  }
  if (kind === "video") {
    return {
      configured: false,
      message: "لم يتم تكوين توليد الفيديو بعد. أضف مفتاح API على الخادم لتفعيل هذه الميزة.",
      media: null,
      prompt: trimmed,
      status: "placeholder",
    };
  }
  return {
    configured: false,
    reply: aiSmartReply(trimmed),
  };
}

app.post("/api/ai/chat", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const message = String(req.body && req.body.message || "").trim();
  if (!message || message.length > 2000) return res.status(400).json({ ok: false, error: "INVALID_MESSAGE" });

  const anthropicKey = process.env.ANTHROPIC_API_KEY ? String(process.env.ANTHROPIC_API_KEY).trim() : "";
  const openaiKey = process.env.OPENAI_API_KEY ? String(process.env.OPENAI_API_KEY).trim() : "";

  // Try Anthropic Claude first
  if (anthropicKey) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1024,
          system: "أنت بلوطة 🌰، مساعد ذكي ومرح على منصة HYSA الاجتماعية. أجب دائماً بنفس لغة المستخدم (عربي أو إنجليزي). كن مرحاً، ودوداً، وإبداعياً. تخصصك في كتابة الكابشنات والهاشتاقات والبايو للسوشيال ميديا. لا تقل أبداً أنك روبوت أو ذكاء اصطناعي — أنت بلوطة فقط.",
          messages: [{ role: "user", content: message }],
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.content && body.content[0]) {
        const reply = String(body.content[0].text || "").trim();
        if (reply) return res.status(200).json({ ok: true, configured: true, reply });
      }
    } catch (err) {
      console.error("[ai] anthropic error:", err.message);
    }
  }

  // Try OpenAI fallback
  if (openaiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          input: message,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        const reply = String(body.output_text || body.text || "").trim();
        if (reply) return res.status(200).json({ ok: true, configured: true, reply });
      }
    } catch (err) {
      console.error("[ai] openai error:", err.message);
    }
  }

  // Smart local fallback — always works
  return res.status(200).json({ ok: true, configured: false, reply: aiSmartReply(message) });
});

app.post("/api/ai/image", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const prompt = String(req.body && req.body.prompt || "").trim();
  if (!prompt || prompt.length > 1000) return res.status(400).json({ ok: false, error: "INVALID_PROMPT" });
  return res.status(200).json({ ok: true, ...aiNotConfigured("image", prompt) });
});

app.post("/api/ai/video", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const prompt = String(req.body && req.body.prompt || "").trim();
  if (!prompt || prompt.length > 1000) return res.status(400).json({ ok: false, error: "INVALID_PROMPT" });
  return res.status(200).json({ ok: true, ...aiNotConfigured("video", prompt) });
});

async function uploadToCloudinary(dataUrl, kind) {
  const result = await cloudinary.uploader.upload(dataUrl, {
    resource_type: kind === "image" ? "image" : "video",
    folder: "hysa1",
    use_filename: true,
    unique_filename: true,
  });
  return result.secure_url;
}

app.post("/api/upload", rateLimit("uploads"), async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const body = req.body || {};
  const parsed = parseDataUrl(body.dataUrl);
  if (!parsed) return res.status(400).json({ ok: false, error: "UPLOAD_INVALID" });
  const { mime, b64 } = parsed;
  const normalizedMime = String(mime || "").toLowerCase();
  if (!ALLOWED_UPLOAD_MIMES.has(normalizedMime)) {
    return res.status(400).json({ ok: false, error: "UPLOAD_INVALID" });
  }

  const ext = extForMime(normalizedMime);
  const kind = normalizedMime.startsWith("video/") ? "video" : normalizedMime.startsWith("image/") ? "image" : normalizedMime.startsWith("audio/") ? "audio" : "";
  if (!ext || !kind) return res.status(400).json({ ok: false, error: "UPLOAD_INVALID" });

  let buf;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    return res.status(400).json({ ok: false, error: "UPLOAD_INVALID" });
  }
  if (!buf || !buf.length) return res.status(400).json({ ok: false, error: "UPLOAD_INVALID" });
  if (buf.length > MAX_UPLOAD_BYTES) return res.status(413).json({ ok: false, error: "UPLOAD_TOO_LARGE" });

  let mediaUrl;
  if (USE_CLOUDINARY) {
    try {
      const result = await cloudinary.uploader.upload(body.dataUrl, {
        resource_type: kind === "image" ? "image" : "video",
        folder: "hysa1",
        use_filename: true,
        unique_filename: true,
        quality: "auto:eco",
        fetch_format: "auto",
        transformation: kind === "image"
          ? [{ width: 1080, crop: "limit", quality: "auto:eco", fetch_format: "auto" }]
          : [{ width: 720, crop: "limit", quality: "auto:eco", fetch_format: "auto" }],
      });
      mediaUrl = result.secure_url;
    } catch (err) {
      console.warn("[cloudinary] Upload failed:", err.message);
      if (NODE_ENV === "production") {
        return res.status(502).json({ ok: false, error: "UPLOAD_FAILED" });
      }
    }
  }

  if (!mediaUrl && NODE_ENV === "production") {
    return res.status(503).json({ ok: false, error: "CLOUDINARY_REQUIRED" });
  }

  if (!mediaUrl) {
    await fsp.mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${Date.now()}_${crypto.randomBytes(8).toString("base64url")}.${ext}`;
    await fsp.writeFile(path.join(UPLOADS_DIR, filename), buf);
    mediaUrl = `/uploads/${filename}`;
  }

  const media = { ...publicMediaVariants(mediaUrl, kind), url: mediaUrl, kind, mime: normalizedMime };
  return res.status(200).json({ ok: true, media });
});

// Messages API - POST /api/messages and GET /api/messages/:userId
app.post("/api/messages", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const body = req.body || {};
  const to = String(body.to || "").trim();
  const peer = await findUserByKeyOrName(to);
  if (!peer) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  if (String(peer.userKey) === String(viewer.userKey)) {
    return res.status(400).json({ ok: false, error: "INVALID_MESSAGE" });
  }

  const text = String(body.text || "").trim();
  if (text.length > 600) return res.status(400).json({ ok: false, error: "INVALID_MESSAGE" });
  const mediaCheck = validateDmMediaList(body.media);
  if (!mediaCheck.ok) return res.status(400).json({ ok: false, error: mediaCheck.error });
  if (!text && !mediaCheck.media.length) {
    return res.status(400).json({ ok: false, error: "INVALID_MESSAGE" });
  }

  const message = {
    id: crypto.randomBytes(12).toString("base64url"),
    from: String(viewer.userKey),
    to: String(peer.userKey),
    text,
    media: mediaCheck.media,
    createdAt: new Date().toISOString(),
    readBy: [String(viewer.userKey)],
    reactions: {},
  };
  if (USE_POSTGRES) await pgCreateDM(message);
  else await DM.create(message);
  await syncDataJson();
  return res.status(200).json({ ok: true, message: { ...message, mine: true } });
});

app.get("/api/messages/:userId", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const peer = await findUserByKeyOrName(String(req.params.userId || ""));
  if (!peer) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  const viewerKey = String(viewer.userKey);
  const peerKey = String(peer.userKey);

  const list = USE_POSTGRES
    ? (await pgFindAllDMs()).filter((msg) => (
        (String(msg.from) === viewerKey && String(msg.to) === peerKey) ||
        (String(msg.from) === peerKey && String(msg.to) === viewerKey)
      )).sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
    : await DM.find({
        $or: [
          { from: viewerKey, to: peerKey },
          { from: peerKey, to: viewerKey }
        ]
      }).sort({ createdAt: 1 });

  const messages = list.map((m) => ({
    id: String(m.id || ""),
    from: String(m.from || ""),
    to: String(m.to || ""),
    text: String(m.text || ""),
    media: toPublicMediaList(m.media),
    createdAt: String(m.createdAt || ""),
    mine: String(m.from) === viewerKey,
    seen: String(m.from) === viewerKey ? asArray(m.readBy).includes(peerKey) : true,
    reactions: normalizeDmReactions(m.reactions),
  }));

  // Mark incoming as read
  if (USE_POSTGRES) {
    for (const message of list) {
      if (String(message.from) !== peerKey || String(message.to) !== viewerKey) continue;
      if (asArray(message.readBy).includes(viewerKey)) continue;
      message.readBy = asArray(message.readBy).concat(viewerKey);
      await pgUpdateDmMeta(message);
    }
  } else {
    await DM.updateMany(
      { from: peerKey, to: viewerKey, readBy: { $ne: viewerKey } },
      { $push: { readBy: viewerKey } }
    );
  }
  await syncDataJson();

  return res.status(200).json({
    ok: true,
    peer: {
      key: peerKey,
      username: String(peer.username || ""),
      avatarUrl: publicStoredUrl(peer.avatarUrl),
      verified: !!peer.verified || VERIFIED_USERS.has(peerKey) || peerKey === OWNER_USER_KEY,
      role: peerKey === OWNER_USER_KEY ? "owner" : String(peer.role || ""),
      createdAt: String((peer && (peer.createdAt || peer.created_at)) || ""),
      isFriend: await isFriendKeys(viewerKey, peerKey),
    },
    messages,
  });
});

// Typing status endpoint (long polling simulation)
app.post("/api/messages/typing", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const to = String(req.body && req.body.to || "").trim();
  // In a real implementation, this would use Socket.io or similar
  // For now, we just acknowledge the typing indicator
  return res.status(200).json({ ok: true, typing: true, from: String(viewer.userKey), to });
});

// =============================================
// FEATURE 2 — NOTIFICATIONS SYSTEM (enhanced)
// =============================================

app.get("/api/notifications/unread-count", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  if (USE_POSTGRES) {
    const r = await pgPool.query("SELECT COUNT(*) FROM notifications WHERE user_key = $1 AND read = FALSE", [viewerKey]);
    return res.status(200).json({ ok: true, count: Number(r.rows[0].count) });
  }
  const count = asArray(readDataFile().notifications).filter((n) => String(n && n.userKey) === viewerKey && !n.read).length;
  return res.status(200).json({ ok: true, count });
});

app.post("/api/notifications/:id/read", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const id = String(req.params.id || "");
  const viewerKey = String(viewer.userKey);
  if (USE_POSTGRES) {
    await pgPool.query("UPDATE notifications SET read = TRUE WHERE id = $1 AND user_key = $2", [id, viewerKey]);
  } else {
    const data = readDataFile();
    data.notifications = asArray(data.notifications).map((n) =>
      String(n && n.id) === id && String(n.userKey) === viewerKey ? { ...n, read: true } : n
    );
    await writeDataFile(data);
  }
  return res.status(200).json({ ok: true });
});

app.post("/api/notifications/read-all", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  if (USE_POSTGRES) {
    await pgPool.query("UPDATE notifications SET read = TRUE WHERE user_key = $1", [viewerKey]);
  } else {
    const data = readDataFile();
    data.notifications = asArray(data.notifications).map((n) =>
      String(n && n.userKey) === viewerKey ? { ...n, read: true } : n
    );
    await writeDataFile(data);
  }
  return res.status(200).json({ ok: true });
});

app.delete("/api/notifications/:id", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const id = String(req.params.id || "");
  const viewerKey = String(viewer.userKey);
  if (USE_POSTGRES) {
    await pgPool.query("DELETE FROM notifications WHERE id = $1 AND user_key = $2", [id, viewerKey]);
  } else {
    const data = readDataFile();
    data.notifications = asArray(data.notifications).filter((n) => !(String(n && n.id) === id && String(n.userKey) === viewerKey));
    await writeDataFile(data);
  }
  return res.status(200).json({ ok: true });
});

// =============================================
// FEATURE 3 — FRIENDS SYSTEM
// =============================================

app.get("/api/users/suggested", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  const following = asArray(viewer.following).map(String);

  if (!USE_POSTGRES) return res.status(200).json({ ok: true, suggested: [] });

  const friendsOfFriends = await pgPool.query(
    `SELECT DISTINCT u.user_key, u.username, u.display_name, u.avatar_url, u.verified
     FROM users u
     JOIN users f ON u.user_key = ANY(f.following)
     WHERE f.user_key = ANY($1)
       AND u.user_key <> $2
       AND NOT (u.user_key = ANY($1))
     LIMIT 10`,
    [following.length ? following : ["__none__"], viewerKey]
  );

  const suggested = friendsOfFriends.rows.map((r) => ({
    key: r.user_key,
    userKey: r.user_key,
    username: r.username,
    displayName: r.display_name || r.username,
    avatarUrl: publicStoredUrl(r.avatar_url),
    verified: !!r.verified || VERIFIED_USERS.has(r.user_key),
  }));
  return res.status(200).json({ ok: true, suggested });
});

app.get("/api/users/follow-requests", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  if (!USE_POSTGRES) return res.status(200).json({ ok: true, requests: [] });

  const r = await pgPool.query(
    `SELECT fr.id, fr.from_id, fr.created_at, u.username, u.display_name, u.avatar_url, u.verified
     FROM follow_requests fr
     JOIN users u ON fr.from_id = u.user_key
     WHERE fr.to_id = $1 AND fr.status = 'pending'
     ORDER BY fr.created_at DESC`,
    [viewerKey]
  );
  const requests = r.rows.map((row) => ({
    id: row.id,
    fromKey: row.from_id,
    username: row.username,
    displayName: row.display_name || row.username,
    avatarUrl: publicStoredUrl(row.avatar_url),
    verified: !!row.verified || VERIFIED_USERS.has(row.from_id),
    createdAt: row.created_at,
  }));
  return res.status(200).json({ ok: true, requests });
});

app.post("/api/users/follow-requests/:id/accept", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const id = String(req.params.id || "");
  const viewerKey = String(viewer.userKey);
  if (!USE_POSTGRES) return res.status(200).json({ ok: true });

  const r = await pgPool.query("SELECT * FROM follow_requests WHERE id = $1 AND to_id = $2", [id, viewerKey]);
  if (!r.rows.length) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  const fromId = r.rows[0].from_id;
  await pgPool.query("UPDATE follow_requests SET status = 'accepted' WHERE id = $1", [id]);

  // Add to follower's following list
  await pgPool.query("UPDATE users SET following = array_append(following, $1) WHERE user_key = $2 AND NOT ($1 = ANY(following))", [viewerKey, fromId]);
  await addNotification({ userKey: fromId, type: "follow_accepted", actorKey: viewerKey });
  return res.status(200).json({ ok: true });
});

app.post("/api/users/follow-requests/:id/decline", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const id = String(req.params.id || "");
  const viewerKey = String(viewer.userKey);
  if (!USE_POSTGRES) return res.status(200).json({ ok: true });
  await pgPool.query("UPDATE follow_requests SET status = 'declined' WHERE id = $1 AND to_id = $2", [id, viewerKey]);
  return res.status(200).json({ ok: true });
});

app.get("/api/users/close-friends", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  if (!USE_POSTGRES) return res.status(200).json({ ok: true, closeFriends: [] });

  const r = await pgPool.query(
    `SELECT u.user_key, u.username, u.display_name, u.avatar_url, u.verified
     FROM close_friends cf JOIN users u ON cf.friend_id = u.user_key
     WHERE cf.user_id = $1`,
    [viewerKey]
  );
  const closeFriends = r.rows.map((row) => ({
    key: row.user_key,
    userKey: row.user_key,
    username: row.username,
    displayName: row.display_name || row.username,
    avatarUrl: publicStoredUrl(row.avatar_url),
    verified: !!row.verified || VERIFIED_USERS.has(row.user_key),
  }));
  return res.status(200).json({ ok: true, closeFriends });
});

app.post("/api/users/close-friends/:key", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  const friendKey = String(req.params.key || "");
  if (!USE_POSTGRES) return res.status(200).json({ ok: true });
  await pgPool.query(
    "INSERT INTO close_friends(user_id, friend_id) VALUES($1, $2) ON CONFLICT DO NOTHING",
    [viewerKey, friendKey]
  );
  return res.status(200).json({ ok: true, added: true });
});

app.delete("/api/users/close-friends/:key", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  const friendKey = String(req.params.key || "");
  if (!USE_POSTGRES) return res.status(200).json({ ok: true });
  await pgPool.query("DELETE FROM close_friends WHERE user_id = $1 AND friend_id = $2", [viewerKey, friendKey]);
  return res.status(200).json({ ok: true, removed: true });
});

app.patch("/api/users/privacy", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  const isPrivate = !!(req.body && req.body.isPrivate);
  if (USE_POSTGRES) {
    await pgPool.query("UPDATE users SET is_private = $1 WHERE user_key = $2", [isPrivate, viewerKey]);
  } else {
    viewer.isPrivate = isPrivate;
    await viewer.save();
  }
  return res.status(200).json({ ok: true, isPrivate });
});

// =============================================
// FEATURE 4 — SECURITY CENTER
// =============================================

app.post("/api/auth/change-password", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const oldPassword = String(req.body && req.body.oldPassword || "");
  const newPassword = String(req.body && req.body.newPassword || "");

  if (!oldPassword || !newPassword) return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
  if (newPassword.length < 8) return res.status(400).json({ ok: false, error: "PASSWORD_TOO_SHORT" });

  if (!verifyPassword(oldPassword, viewer.password)) {
    return res.status(401).json({ ok: false, error: "WRONG_PASSWORD" });
  }

  const hashed = hashPassword(newPassword);
  if (USE_POSTGRES) {
    await pgPool.query("UPDATE users SET password = $1 WHERE user_key = $2", [JSON.stringify(hashed), String(viewer.userKey)]);
  } else {
    viewer.password = hashed;
    await viewer.save();
  }
  return res.status(200).json({ ok: true });
});

app.get("/api/auth/sessions", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  if (!USE_POSTGRES) return res.status(200).json({ ok: true, sessions: [] });
  const r = await pgPool.query(
    "SELECT id, device, ip, last_active, created_at FROM sessions WHERE user_id = $1 ORDER BY last_active DESC LIMIT 20",
    [viewerKey]
  );
  return res.status(200).json({ ok: true, sessions: r.rows });
});

app.delete("/api/auth/sessions/:id", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const id = String(req.params.id || "");
  const viewerKey = String(viewer.userKey);
  if (USE_POSTGRES) {
    await pgPool.query("DELETE FROM sessions WHERE id = $1 AND user_id = $2", [id, viewerKey]);
  }
  return res.status(200).json({ ok: true });
});

app.delete("/api/auth/sessions", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  if (USE_POSTGRES) {
    await pgPool.query("DELETE FROM sessions WHERE user_id = $1", [viewerKey]);
  }
  return res.status(200).json({ ok: true });
});

app.get("/api/auth/login-history", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  if (!USE_POSTGRES) return res.status(200).json({ ok: true, history: [] });
  const r = await pgPool.query(
    "SELECT id, ip, device, status, created_at FROM login_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
    [viewerKey]
  );
  return res.status(200).json({ ok: true, history: r.rows });
});

// Record login history on each login
app.post("/api/auth/login-history/record", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  if (!USE_POSTGRES) return res.status(200).json({ ok: true });
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  const device = String(req.headers["user-agent"] || "").slice(0, 200);
  const status = String(req.body && req.body.status || "success");
  await pgPool.query(
    "INSERT INTO login_history(user_id, ip, device, status) VALUES($1, $2, $3, $4)",
    [String(viewer.userKey), ip, device, status]
  );
  return res.status(200).json({ ok: true });
});

app.post("/api/auth/2fa/enable", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  if (!USE_POSTGRES) return res.status(200).json({ ok: false, error: "POSTGRES_REQUIRED" });
  try {
    const speakeasy = require("speakeasy");
    const qrcode = require("qrcode");
    const secret = speakeasy.generateSecret({ name: `HYSA (${viewer.username})`, length: 20 });
    await pgPool.query("UPDATE users SET two_fa_secret = $1 WHERE user_key = $2", [secret.base32, String(viewer.userKey)]);
    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    return res.status(200).json({ ok: true, secret: secret.base32, qrCode: qrDataUrl });
  } catch (err) {
    return res.status(200).json({ ok: false, error: "2FA_NOT_INSTALLED", message: "Install speakeasy and qrcode packages" });
  }
});

app.post("/api/auth/2fa/verify", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const token = String(req.body && req.body.token || "").replace(/\s/g, "");
  if (!USE_POSTGRES) return res.status(200).json({ ok: false, error: "POSTGRES_REQUIRED" });
  try {
    const speakeasy = require("speakeasy");
    const row = await pgPool.query("SELECT two_fa_secret FROM users WHERE user_key = $1", [String(viewer.userKey)]);
    const secret = row.rows[0] && row.rows[0].two_fa_secret;
    if (!secret) return res.status(400).json({ ok: false, error: "2FA_NOT_SETUP" });
    const valid = speakeasy.totp.verify({ secret, encoding: "base32", token, window: 2 });
    if (valid) {
      await pgPool.query("UPDATE users SET two_fa_enabled = TRUE WHERE user_key = $1", [String(viewer.userKey)]);
    }
    return res.status(200).json({ ok: valid });
  } catch (err) {
    return res.status(200).json({ ok: false, error: "2FA_ERROR" });
  }
});

app.post("/api/auth/2fa/disable", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  if (!USE_POSTGRES) return res.status(200).json({ ok: true });
  await pgPool.query("UPDATE users SET two_fa_enabled = FALSE, two_fa_secret = '' WHERE user_key = $1", [String(viewer.userKey)]);
  return res.status(200).json({ ok: true });
});

// =============================================
// FEATURE 5 — POST ANALYTICS
// =============================================

app.get("/api/posts/:id/analytics", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const postId = String(req.params.id || "");
  const post = await findPostById(postId);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  if (String(post.authorKey) !== String(viewer.userKey)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

  const likes = asArray(post.likes).length;
  const bookmarks = asArray(post.bookmarks).length;
  const views = Number(post.views || 0);
  const comments = asArray(post.comments).length;
  const engagement = views > 0 ? Math.round(((likes + comments + bookmarks) / views) * 100) : 0;

  let analyticsRows = [];
  if (USE_POSTGRES) {
    const r = await pgPool.query(
      "SELECT date, views, saves, shares FROM post_analytics WHERE post_id = $1 ORDER BY date DESC LIMIT 30",
      [postId]
    );
    analyticsRows = r.rows;
  }

  return res.status(200).json({
    ok: true,
    analytics: {
      postId,
      views,
      likes,
      comments,
      bookmarks,
      engagement,
      history: analyticsRows,
    },
  });
});

app.get("/api/users/analytics", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);

  const posts = await findPostsByUser(viewerKey);
  const totalLikes = posts.reduce((sum, p) => sum + asArray(p.likes).length, 0);
  const totalViews = posts.reduce((sum, p) => sum + Number(p.views || 0), 0);
  const totalBookmarks = posts.reduce((sum, p) => sum + asArray(p.bookmarks).length, 0);
  const followerCount = await followerCountFor(viewerKey);
  const engagement = totalViews > 0 ? Math.round(((totalLikes + totalBookmarks) / totalViews) * 100) : 0;

  const bestPost = posts.sort((a, b) => asArray(b.likes).length - asArray(a.likes).length)[0];

  return res.status(200).json({
    ok: true,
    analytics: {
      totalPosts: posts.length,
      totalLikes,
      totalViews,
      totalBookmarks,
      followerCount,
      engagement,
      bestPost: bestPost ? {
        id: bestPost.id,
        text: String(bestPost.text || "").slice(0, 100),
        likes: asArray(bestPost.likes).length,
        views: Number(bestPost.views || 0),
      } : null,
    },
  });
});

// Track profile view
app.post("/api/users/:key/view", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const profileKey = String(req.params.key || "");
  if (profileKey === String(viewer.userKey)) return res.status(200).json({ ok: true });
  if (USE_POSTGRES) {
    await pgPool.query(
      "INSERT INTO profile_views(viewer_id, profile_id) VALUES($1, $2)",
      [String(viewer.userKey), profileKey]
    ).catch(() => {});
  }
  return res.status(200).json({ ok: true });
});

// =============================================
// FEATURE 6 — CONTENT FEATURES
// =============================================

// Story Highlights
app.get("/api/highlights/:userKey", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const userKey = String(req.params.userKey || "");
  if (!USE_POSTGRES) return res.status(200).json({ ok: true, highlights: [] });
  const r = await pgPool.query(
    "SELECT h.id, h.title, h.cover, h.created_at FROM highlights h WHERE h.user_id = $1 ORDER BY h.created_at DESC",
    [userKey]
  );
  return res.status(200).json({ ok: true, highlights: r.rows });
});

app.post("/api/highlights", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  if (!USE_POSTGRES) return res.status(200).json({ ok: false, error: "POSTGRES_REQUIRED" });
  const title = String(req.body && req.body.title || "").trim().slice(0, 50);
  const cover = String(req.body && req.body.cover || "").trim();
  if (!title) return res.status(400).json({ ok: false, error: "TITLE_REQUIRED" });
  const id = newToken().slice(0, 20);
  await pgPool.query(
    "INSERT INTO highlights(id, user_id, title, cover) VALUES($1, $2, $3, $4)",
    [id, String(viewer.userKey), title, cover]
  );
  return res.status(200).json({ ok: true, highlight: { id, title, cover } });
});

app.post("/api/highlights/:id/stories", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  if (!USE_POSTGRES) return res.status(200).json({ ok: true });
  const highlightId = String(req.params.id || "");
  const storyId = String(req.body && req.body.storyId || "");
  if (!storyId) return res.status(400).json({ ok: false, error: "STORY_ID_REQUIRED" });
  const r = await pgPool.query("SELECT id FROM highlights WHERE id = $1 AND user_id = $2", [highlightId, String(viewer.userKey)]);
  if (!r.rows.length) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  await pgPool.query(
    "INSERT INTO highlight_stories(highlight_id, story_id) VALUES($1, $2) ON CONFLICT DO NOTHING",
    [highlightId, storyId]
  );
  return res.status(200).json({ ok: true });
});

app.delete("/api/highlights/:id", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  if (!USE_POSTGRES) return res.status(200).json({ ok: true });
  const id = String(req.params.id || "");
  await pgPool.query("DELETE FROM highlights WHERE id = $1 AND user_id = $2", [id, String(viewer.userKey)]);
  return res.status(200).json({ ok: true });
});

// Polls
app.post("/api/posts/:id/poll", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const postId = String(req.params.id || "");
  const question = String(req.body && req.body.question || "").trim();
  const options = Array.isArray(req.body && req.body.options) ? req.body.options.map(String).filter(Boolean).slice(0, 4) : [];
  if (!question || options.length < 2) return res.status(400).json({ ok: false, error: "INVALID_POLL" });
  if (!USE_POSTGRES) return res.status(200).json({ ok: false, error: "POSTGRES_REQUIRED" });

  const post = await findPostById(postId);
  if (!post || String(post.authorKey) !== String(viewer.userKey)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

  const pollId = newToken().slice(0, 20);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await pgPool.query(
    "INSERT INTO post_polls(id, post_id, question, options, expires_at) VALUES($1, $2, $3, $4, $5)",
    [pollId, postId, question, JSON.stringify(options), expiresAt]
  );
  return res.status(200).json({ ok: true, poll: { id: pollId, question, options, votes: {} } });
});

app.get("/api/posts/:id/poll", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const postId = String(req.params.id || "");
  if (!USE_POSTGRES) return res.status(200).json({ ok: true, poll: null });
  const r = await pgPool.query("SELECT * FROM post_polls WHERE post_id = $1 ORDER BY created_at DESC LIMIT 1", [postId]);
  if (!r.rows.length) return res.status(200).json({ ok: true, poll: null });
  const poll = r.rows[0];
  const expired = poll.expires_at && new Date(poll.expires_at) < new Date();
  return res.status(200).json({ ok: true, poll: { ...poll, expired } });
});

app.post("/api/posts/:id/poll/vote", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const postId = String(req.params.id || "");
  const optionIndex = Number(req.body && req.body.option);
  const viewerKey = String(viewer.userKey);
  if (!USE_POSTGRES) return res.status(200).json({ ok: false, error: "POSTGRES_REQUIRED" });

  const r = await pgPool.query("SELECT * FROM post_polls WHERE post_id = $1 ORDER BY created_at DESC LIMIT 1", [postId]);
  if (!r.rows.length) return res.status(404).json({ ok: false, error: "NO_POLL" });

  const poll = r.rows[0];
  if (poll.expires_at && new Date(poll.expires_at) < new Date()) return res.status(400).json({ ok: false, error: "POLL_EXPIRED" });

  const votes = poll.votes || {};
  if (votes[viewerKey] !== undefined) return res.status(400).json({ ok: false, error: "ALREADY_VOTED" });

  votes[viewerKey] = optionIndex;
  await pgPool.query("UPDATE post_polls SET votes = $1 WHERE id = $2", [JSON.stringify(votes), poll.id]);
  return res.status(200).json({ ok: true, votes });
});


// Saved posts page
app.get("/api/users/saved", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const viewerKey = String(viewer.userKey);
  if (!USE_POSTGRES) return res.status(200).json({ ok: true, posts: [] });
  const r = await pgPool.query(
    `SELECT p.* FROM posts p
     WHERE $1 = ANY(p.bookmarks)
     ORDER BY p.created_at DESC LIMIT 30`,
    [viewerKey]
  );
  const posts = [];
  for (const row of r.rows) {
    posts.push(formatPostRow(row, viewer));
  }
  return res.status(200).json({ ok: true, posts });
});

function formatPostRow(row, viewer) {
  const viewerKey = viewer ? String(viewer.userKey) : "";
  return {
    id: row.id,
    authorKey: row.author_key,
    author: row.author,
    text: row.text,
    media: toPublicMediaList(Array.isArray(row.media) ? row.media : (row.media ? JSON.parse(row.media) : [])),
    likes: Array.isArray(row.likes) ? row.likes : (row.likes || []),
    bookmarks: Array.isArray(row.bookmarks) ? row.bookmarks : (row.bookmarks || []),
    likeCount: (Array.isArray(row.likes) ? row.likes : []).length,
    bookmarkCount: (Array.isArray(row.bookmarks) ? row.bookmarks : []).length,
    likedByMe: viewerKey ? (Array.isArray(row.likes) ? row.likes : []).includes(viewerKey) : false,
    bookmarkedByMe: viewerKey ? (Array.isArray(row.bookmarks) ? row.bookmarks : []).includes(viewerKey) : false,
    createdAt: row.created_at,
    scheduledAt: row.scheduled_at,
    views: row.views || 0,
    comments: Array.isArray(row.comments) ? row.comments : (row.comments ? JSON.parse(row.comments) : []),
  };
}

// -----------------------------
// Explore - popular posts
// -----------------------------
app.get("/api/explore", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  try {
    if (USE_POSTGRES) {
      const r = await pgPool.query(`
        SELECT p.*,
               COALESCE(array_length(p.likes, 1), 0) * 3
             + COALESCE(p.views, 0)
             + jsonb_array_length(p.comments) * 2 AS explore_score
        FROM posts p
        WHERE (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
          AND p.visibility = 'public'
        ORDER BY explore_score DESC, p.created_at DESC
        LIMIT 40
      `);
      return res.status(200).json({ ok: true, posts: r.rows.map((row) => formatPostRow(row, viewer)) });
    }
    const posts = await visiblePostsForViewer(viewer);
    const sorted = posts.slice().sort((a, b) => {
      const sA = (a.likeCount || 0) * 3 + (a.views || 0) + (Array.isArray(a.comments) ? a.comments.length : 0) * 2;
      const sB = (b.likeCount || 0) * 3 + (b.views || 0) + (Array.isArray(b.comments) ? b.comments.length : 0) * 2;
      return sB - sA;
    }).slice(0, 40);
    return res.status(200).json({ ok: true, posts: await Promise.all(sorted.map((p) => toPublicPost(p, viewer))) });
  } catch (err) {
    console.error("/api/explore error", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// Block user
app.post("/api/users/block/:key", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const targetKey = String(req.params.key || "").toLowerCase();
  if (!targetKey || targetKey === String(viewer.userKey)) {
    return res.status(400).json({ ok: false, error: "INVALID" });
  }
  try {
    if (USE_POSTGRES) {
      await pgPool.query(
        `INSERT INTO blocked_users (blocker_key, blocked_key) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [String(viewer.userKey), targetKey]
      );
    }
    return res.status(200).json({ ok: true, blocked: true });
  } catch (err) {
    console.error("/api/users/block error", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// Unblock user
app.delete("/api/users/block/:key", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const targetKey = String(req.params.key || "").toLowerCase();
  try {
    if (USE_POSTGRES) {
      await pgPool.query(
        `DELETE FROM blocked_users WHERE blocker_key = $1 AND blocked_key = $2`,
        [String(viewer.userKey), targetKey]
      );
    }
    return res.status(200).json({ ok: true, blocked: false });
  } catch (err) {
    console.error("/api/users/unblock error", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// Get blocked users list
app.get("/api/users/blocked", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  try {
    if (USE_POSTGRES) {
      const r = await pgPool.query(
        `SELECT bu.blocked_key, u.username, u.avatar_url, u.display_name
           FROM blocked_users bu
           JOIN users u ON u.user_key = bu.blocked_key
          WHERE bu.blocker_key = $1
          ORDER BY bu.created_at DESC`,
        [String(viewer.userKey)]
      );
      return res.status(200).json({ ok: true, blocked: r.rows });
    }
    return res.status(200).json({ ok: true, blocked: [] });
  } catch (err) {
    console.error("/api/users/blocked error", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// -----------------------------
// Static files
// -----------------------------

function sendIndexHtml(req, res) {
  if (!isFile(INDEX_HTML)) {
    return res
      .status(500)
      .type("text/plain")
      .send(
        [
          "public/index.html is missing.",
          `INDEX_HTML=${INDEX_HTML}`,
          `PUBLIC_DIR=${PUBLIC_DIR}`,
          `CWD=${process.cwd()}`,
          "If you're on Render and using Root Directory (monorepo), ensure the selected Root Directory includes the public/ folder.",
        ].join("\n"),
      );
  }
  const nonce = String(res.locals.cspNonce || "");
  const html = fs.readFileSync(INDEX_HTML, "utf8").replace(/__CSP_NONCE__/g, nonce);
  return res.status(200).type("html").send(html);
}

app.get(["/", "/index.html"], (req, res) => sendIndexHtml(req, res));

app.use(express.static(path.resolve(PUBLIC_DIR), { index: false }));
if (NODE_ENV !== "production") {
  app.use("/uploads", express.static(path.resolve(UPLOADS_DIR), {
    maxAge: "7d",
    immutable: true,
    fallthrough: true,
  }));
} else {
  app.use("/uploads", (_req, res) => {
    res.status(410).json({ ok: false, error: "CLOUDINARY_REQUIRED" });
  });
}

// Health Check route
app.get('/healthz', (req, res) => res.sendStatus(200));

// SPA fallback (works in Express 4 and 5 without wildcard syntax)
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (String(req.path || "").startsWith("/api/")) return next();
  if (path.extname(String(req.path || ""))) return next();
  return sendIndexHtml(req, res);
});

// Error handler (JSON for API)
app.use((err, req, res, next) => {
  if (!err) return next();
  const isApi = String(req.path || "").startsWith("/api/");
  const status = Number(err.status || err.statusCode || 500);

  if (isApi) {
    // body-parser / raw-body errors
    if (status === 413 || err.type === "entity.too.large") {
      return res.status(413).json({ ok: false, error: "UPLOAD_TOO_LARGE" });
    }
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ ok: false, error: "BAD_JSON" });
    }
    console.error("[api] error:", NODE_ENV === "production" ? (err && err.message) : err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }

  console.error("[server] error:", NODE_ENV === "production" ? (err && err.message) : err);
  return res.status(500).send("Server error");
});

async function start() {
  const storageMode = USE_CLOUDINARY ? "cloudinary" : "local";

  console.log("========================================");
  console.log("HYSA1 Backend Starting");
  console.log("========================================");
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`DATABASE_URL present: ${!!DATABASE_URL}`);
  console.log(`Data mode: ${USE_POSTGRES ? "postgres" : "data.json"}`);
  console.log(`Storage mode: ${storageMode}`);
  console.log(`Data file path: ${DATA_FILE}`);
  console.log(`Uploads path: ${UPLOADS_DIR}`);
  console.log("----------------------------------------");

  if (USE_POSTGRES) {
    try {
      await initPostgresSchema();
    } catch (err) {
      console.warn(`[postgres] Unavailable; falling back to data.json (${err && err.code ? err.code : err.message})`);
      USE_POSTGRES = false;
      pgPool = null;
      await connectDataFile();
    }
  } else {
    await connectDataFile();
  }

  try {
    const pubOk = fs.existsSync(PUBLIC_DIR);
    const idxOk = fs.existsSync(INDEX_HTML);
    if (!pubOk) console.error(`[startup] public folder not found. Checked: ${PUBLIC_DIR}`);
    if (pubOk && !idxOk) console.error(`[startup] index.html not found at: ${INDEX_HTML}`);
  } catch (err) {
    console.error("[startup] path check failed:", err);
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`[server] listening on http://${HOST}:${PORT}`);
    console.log("[peerjs] signaling mounted at /peerjs");
    console.log("========================================");
    console.log("Server is ready!");
    console.log("========================================");
  });
  httpServer.on("error", (err) => {
    console.error("[server] failed to start:", err);
    process.exit(1);
  });
}

process.on("unhandledRejection", (err) => console.error("[server] unhandledRejection:", err));
process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException:", err);
  process.exit(1);
});

start();
