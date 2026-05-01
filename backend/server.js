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
const VERIFIED_USERS = new Set(
  String(process.env.VERIFIED_USERS || "hysa,admin,psx")
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

const USE_POSTGRES = !!process.env.DATABASE_URL;
const USE_CLOUDINARY = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

// Enforce production behavior
if (NODE_ENV === "production") {
  if (!USE_POSTGRES) {
    console.error("[FATAL] Production requires DATABASE_URL to be set");
    process.exit(1);
  }
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
    isPrivate: row.is_private,
    isPendingVerification: row.is_pending_verification,
    verificationRequestAt: row.verification_request_at,
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
        token = $11
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

async function pgCreateUser(user) {
  await pgPool.query(
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
      skills = EXCLUDED.skills,
      following = EXCLUDED.following,
      token = EXCLUDED.token`,
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

function sanitizeBio(input) {
  const b = String(input ?? "");
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

function getBearerToken(req) {
  const raw = String(req.headers.authorization || "");
  if (raw.toLowerCase().startsWith("bearer ")) return raw.slice("bearer ".length).trim();
  return "";
}

async function authUserFromReq(req) {
  const token = getBearerToken(req);
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

async function findUserByKey(key) {
  const k = String(key || "");
  
  if (USE_POSTGRES) {
    return await pgFindUserByKey(k);
  }
  
  return await User.findOne({ userKey: k });
}

async function findUserByKeyOrName(input) {
  const { key } = normalizeUsername(input);
  return await findUserByKey(key);
}

async function followerCountFor(userKey) {
  if (USE_POSTGRES) {
    return await pgCountFollowers(userKey);
  }
  
  return await User.countDocuments({ following: userKey });
}

function toPublicMe(u) {
  const key = String(u && u.userKey ? u.userKey : normalizeUsername(u && u.username).key);
  return {
    key,
    userKey: key,
    username: String(u && u.username ? u.username : ""),
    bio: String((u && u.bio) || ""),
    avatarUrl: publicStoredUrl(u && u.avatarUrl),
    isPrivate: !!(u && u.isPrivate),
    skills: asArray(u && u.skills).map(String),
    verified: VERIFIED_USERS.has(key),
  };
}

async function toPublicProfile(target, viewer) {
  const key = String(target.userKey);
  const isFollowing = viewer ? asArray(viewer.following).includes(key) : false;
  return {
    key,
    userKey: key,
    username: String(target.username || ""),
    bio: String(target.bio || ""),
    avatarUrl: publicStoredUrl(target.avatarUrl),
    isPrivate: !!target.isPrivate,
    skills: asArray(target.skills).map(String),
    verified: VERIFIED_USERS.has(key),
    followerCount: await followerCountFor(key),
    followingCount: asArray(target.following).length,
    isFollowing,
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
    media,
    filter: normalizeStoryFilter(s.filter),
    createdAt: String(s.createdAt || ""),
    expiresAt: String(s.expiresAt || ""),
    seen: !!(viewerKey && seenBy.includes(viewerKey)),
  };
}

async function toPublicComment(c) {
  const authorKey = String((c && c.authorKey) || normalizeUsername(c && c.author).key || "");
  const authorUser = await findUserByKey(authorKey);
  return {
    id: String((c && c.id) || ""),
    authorKey,
    author: String((authorUser && authorUser.username) || (c && c.author) || ""),
    authorAvatar: publicStoredUrl(authorUser && authorUser.avatarUrl),
    text: String((c && c.text) || ""),
    parentId: String((c && c.parentId) || ""),
    createdAt: String((c && c.createdAt) || new Date().toISOString()),
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
  const likes = asArray(p.likes).map(String);
  const bookmarks = asArray(p.bookmarks).map(String);
  const viewerKey = viewer ? String(viewer.userKey) : "";
  const likedByMe = !!(viewerKey && likes.includes(viewerKey));
  const bookmarkedByMe = !!(viewerKey && bookmarks.includes(viewerKey));
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
        verified: VERIFIED_USERS.has(originalAuthorKey),
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
    verified: VERIFIED_USERS.has(authorKey),
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
    repostCount,
    bookmarkCount: bookmarks.length,
    likedByMe,
    bookmarkedByMe,
    repostedByMe,
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

function toPublicMediaList(media) {
  return asArray(media)
    .map((m) => ({
      url: String(m && m.url ? m.url : ""),
      kind: String(m && m.kind ? m.kind : ""),
      mime: String(m && m.mime ? m.mime : ""),
    }))
    .filter((m) => m.kind && m.mime)
    .map((m) => (m.url && uploadUrlExists(m.url) ? m : { ...m, url: "", missing: true }));
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
  return { ok: true, media: list.map((m) => ({ url: String(m.url), kind: String(m.kind), mime: String(m.mime) })) };
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
  const data = readDataFile();
  data.notifications = asArray(data.notifications);
  data.notifications.unshift({
    id: crypto.randomBytes(12).toString("base64url"),
    userKey: target,
    type: String(type || ""),
    actorKey: String(actorKey || ""),
    postId: String(postId || ""),
    commentId: String(commentId || ""),
    read: false,
    createdAt: new Date().toISOString(),
  });
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

// (Optional) CORS for debugging / split deployments.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
});

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

  if (await findUserByKey(key)) return res.status(409).json({ ok: false, error: "USERNAME_TAKEN" });

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
  
  return res.status(200).json({ ok: true, token: createdUser.token, me: toPublicMe(createdUser) });
}

app.post("/api/register", handleRegister);
app.post("/api/signup", handleRegister);

app.post("/api/login", async (req, res) => {
  const body = req.body || {};
  const { key } = normalizeUsername(body.username);
  const password = String(body.password ?? "");

  const u = await findUserByKey(key);
  if (!u || !verifyPassword(password, u.password)) {
    return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
  }

  u.token = newToken();
  await u.save();
  if (!USE_POSTGRES) {
    await syncDataJson();
  }
  return res.status(200).json({ ok: true, token: u.token, me: toPublicMe(u) });
});

app.post("/api/logout", async (req, res) => {
  const u = await requireAuth(req, res);
  if (!u) return;
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
  return res.status(200).json({ ok: true, me: toPublicMe(u) });
});

app.get("/api/feed", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const limitRaw = Number.parseInt(String(req.query.limit || "20"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 20;
  const cursorRaw = Number.parseInt(String(req.query.cursor || "0"), 10);
  const cursor = Number.isFinite(cursorRaw) && cursorRaw >= 0 ? cursorRaw : 0;

  const posts = await visiblePostsForViewer(viewer);
  const slice = await Promise.all(posts.slice(cursor, cursor + limit).map((p) => toPublicPost(p, viewer)));
  const nextCursor = cursor + slice.length < posts.length ? String(cursor + slice.length) : null;
  return res.status(200).json({ ok: true, posts: slice, nextCursor });
});

app.get("/api/reels", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const limitRaw = Number.parseInt(String(req.query.limit || "15"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(40, limitRaw)) : 15;
  const all = await visiblePostsForViewer(viewer);
  const reels = await Promise.all(all
    .filter((p) => asArray(p.media).some((m) => String(m.kind) === "video"))
    .slice(0, limit)
    .map((p) => toPublicPost(p, viewer)));
  return res.status(200).json({ ok: true, reels });
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
    verified: VERIFIED_USERS.has(String(viewer.userKey)),
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
  return res.status(200).json({ ok: true, following, followerCount: await followerCountFor(String(target.userKey)) });
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

app.post("/api/posts", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const body = req.body || {};
  const text = String(body.text ?? body.content ?? "").trim();
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
  const comments = await Promise.all(asArray(post.comments).slice(-limit).map(toPublicComment));
  return res.status(200).json({ ok: true, comments: nestComments(comments), commentCount: asArray(post.comments).length });
});

app.post("/api/posts/:id/comments", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const id = String(req.params.id || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  if (!await canViewerSeePost(post, viewer)) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  const text = String((req.body && req.body.text) || "").trim();
  const filteredText = filterProfanity(text);
  const parentId = String((req.body && req.body.parentId) || "");
  if (!text || text.length > 200) return res.status(400).json({ ok: false, error: "INVALID_COMMENT" });

  if (!Array.isArray(post.comments)) post.comments = [];
  const comment = {
    id: crypto.randomBytes(12).toString("base64url"),
    authorKey: String(viewer.userKey),
    text,
    parentId,
    createdAt: new Date().toISOString(),
  };
  post.comments.push(comment);
  await post.save();
  await syncDataJson();
  return res.status(200).json({ ok: true, comment: await toPublicComment(comment), commentCount: asArray(post.comments).length });
});

app.post("/api/posts/:id/comments/:commentId/replies", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const id = String(req.params.id || "");
  const post = await findPostById(id);
  if (!post) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  if (!await canViewerSeePost(post, viewer)) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
  const text = String((req.body && req.body.text) || "").trim();
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
  return res.status(200).json({ ok: true, comment: await toPublicComment(comment), commentCount: asArray(post.comments).length });
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

app.post("/api/posts/:id/view", async (req, res) => {
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
});

app.post("/api/profile", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const body = req.body || {};
  const bioCheck = sanitizeBio(body.bio);
  if (!bioCheck.ok) return res.status(400).json({ ok: false, error: bioCheck.error });

  const avatarUrl = String(body.avatarUrl || "");
  if (avatarUrl && !isAllowedMediaUrl(avatarUrl)) return res.status(400).json({ ok: false, error: "UPLOAD_INVALID" });

  viewer.bio = bioCheck.bio;
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
  const data = readDataFile();
  const viewerKey = String(viewer.userKey);
  const list = asArray(data.notifications)
    .filter((n) => String(n && n.userKey) === viewerKey)
    .slice(0, 100);
  return res.status(200).json({ ok: true, notifications: list });
});

app.post("/api/notifications/read", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;
  const data = readDataFile();
  const viewerKey = String(viewer.userKey);
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

  const users = await User.find({
    $or: [
      { userKey: { $regex: safeQ, $options: "i" } },
      { username: { $regex: safeQ, $options: "i" } },
    ],
  }).limit(12);

  const results = users
    .filter((u) => u && (String(u.userKey).includes(q) || String(u.username).toLowerCase().includes(q)))
    .map((u) => ({
      type: "user",
      key: String(u.userKey),
      username: String(u.username),
      verified: VERIFIED_USERS.has(String(u.userKey)),
      isPrivate: !!u.isPrivate,
      skills: asArray(u.skills).map(String),
    }));

  return res.status(200).json({ ok: true, results });
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
    peer: { key: peerKey, username: String(peer.username || ""), avatarUrl: publicStoredUrl(peer.avatarUrl) },
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
  const m = String(message || "").trim().toLowerCase();

  // Greetings
  if (/^(hi|hello|hey|howdy|hiya|سلام|مرحبا|السلام عليكم|أهلا|هلا|مرحبًا|bonjour|salut)/.test(m)) {
    const greetings = [
      "مرحباً! 👋 أنا مساعد HYSA. كيف يمكنني مساعدتك اليوم؟",
      "أهلاً وسهلاً! 😊 يسعدني مساعدتك. هل تريد كتابة منشور؟ أو لديك سؤال؟",
      "Hello! 👋 I'm the HYSA assistant. How can I help you today?",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Help with posts (Arabic)
  if (/منشور|نشر|اكتب لي|كتابة/.test(m)) {
    return "يمكنني مساعدتك في كتابة منشور! 📝 أخبرني:\n• ما الموضوع الذي تريد الكتابة عنه؟\n• ما الشعور الذي تريد نقله؟\n• هل تريد إضافة هاشتاقات؟";
  }

  // Hashtag suggestions
  if (/هاشتاق|hashtag|وسم/.test(m)) {
    return "إليك بعض الهاشتاقات الشائعة على HYSA 🏷️:\n#تقنية #ترفيه #رياضة #أخبار #صور #فيديو #حياة #ثقافة #سفر #طعام\n\nأخبرني بموضوع منشورك وسأقترح هاشتاقات مناسبة!";
  }

  // Help with bio
  if (/bio|نبذة|بايو|profile|بروفايل/.test(m)) {
    return "لكتابة نبذة احترافية على ملفك الشخصي 📋، اتبع هذه النصيحة:\n1. اذكر اهتماماتك الرئيسية\n2. أضف مجالك أو تخصصك\n3. اكتب جملة مميزة تعبر عنك\n\nمثال: \"مهتم بالتقنية والتصميم | أشارك يومياتي وأفكاري 🌟\"";
  }

  // What is HYSA
  if (/what is hysa|ما هو hysa|ما هي hysa|عن التطبيق|about/.test(m)) {
    return "HYSA هي شبكة تواصل اجتماعي مصغّرة 🌐\n\nيمكنك:\n• نشر منشورات نصية وصور ومقاطع فيديو\n• متابعة الأصدقاء\n• الإعجاب والتعليق وإعادة النشر\n• مشاركة القصص\n• إرسال رسائل مباشرة\n• البحث عن مستخدمين";
  }

  // How to post
  if (/كيف|how to|post|upload/.test(m)) {
    return "لإنشاء منشور جديد ✏️:\n1. اضغط على زر ＋ في الأسفل\n2. اكتب نصك (حتى 280 حرف)\n3. يمكنك إضافة صورة أو فيديو\n4. اختر الخصوصية (عام أو خاص)\n5. اضغط \"نشر\"!\n\nمنشورك سيظهر في الصفحة الرئيسية فور نشره 🚀";
  }

  // Generate post idea
  if (/فكرة|idea|اقتراح|suggest/.test(m)) {
    const ideas = [
      "💡 فكرة منشور: شارك شيئاً تعلمته اليوم مع هاشتاق #تعلمت_اليوم",
      "💡 فكرة منشور: ما هو أفضل شيء حدث معك هذا الأسبوع؟ شاركه مع متابعيك!",
      "💡 فكرة منشور: ضع صورة من يومك مع وصف قصير — الناس تحب التفاصيل البسيطة!",
      "💡 Post idea: Share a tip from your field of expertise with #tips hashtag",
    ];
    return ideas[Math.floor(Date.now() / 1000) % ideas.length];
  }

  // Default helpful response
  const defaults = [
    "يمكنني مساعدتك في:\n• كتابة منشورات\n• اقتراح هاشتاقات\n• كتابة نبذة للملف الشخصي\n• الإجابة على أسئلة عن HYSA\n\nماذا تحتاج؟ 😊",
    "أنا هنا للمساعدة! 🤖 يمكنني مساعدتك في كتابة المحتوى واقتراح الأفكار والإجابة على أسئلتك عن التطبيق.",
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

  const apiKey = process.env.OPENAI_API_KEY ? String(process.env.OPENAI_API_KEY).trim() : "";
  if (!apiKey) return res.status(200).json({ ok: true, ...aiNotConfigured("chat", message) });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        input: message,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[ai] chat provider error:", body && (body.error || body));
      return res.status(200).json({ ok: true, ...aiNotConfigured("chat", message) });
    }
    const reply = String(body.output_text || body.text || "").trim() || "I am ready.";
    return res.status(200).json({ ok: true, configured: true, reply });
  } catch (err) {
    console.error("[ai] chat failed:", err.message);
    return res.status(200).json({ ok: true, ...aiNotConfigured("chat", message) });
  }
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
    resource_type: kind === "video" ? "video" : "image",
    folder: "hysa1",
    use_filename: true,
    unique_filename: true,
  });
  return result.secure_url;
}

app.post("/api/upload", async (req, res) => {
  const viewer = await requireAuth(req, res);
  if (!viewer) return;

  const body = req.body || {};
  const parsed = parseDataUrl(body.dataUrl);
  if (!parsed) return res.status(400).json({ ok: false, error: "UPLOAD_INVALID" });
  const { mime, b64 } = parsed;

  const ext = extForMime(mime);
  const kind = mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "audio" : "";
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
        resource_type: kind === "video" ? "video" : "image",
        folder: "hysa1",
        use_filename: true,
        unique_filename: true,
      });
      mediaUrl = result.secure_url;
    } catch (err) {
      console.warn("[cloudinary] Upload failed, falling back to local:", err.message);
      USE_CLOUDINARY = false;
    }
  }

  if (!mediaUrl) {
    await fsp.mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${Date.now()}_${crypto.randomBytes(8).toString("base64url")}.${ext}`;
    await fsp.writeFile(path.join(UPLOADS_DIR, filename), buf);
    mediaUrl = `/uploads/${filename}`;
  }

  const media = { url: mediaUrl, kind, mime };
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
    peer: { key: peerKey, username: String(peer.username || ""), avatarUrl: publicStoredUrl(peer.avatarUrl) },
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

// -----------------------------
// Static files
// -----------------------------

app.use(express.static(path.resolve(PUBLIC_DIR)));
app.use("/uploads", express.static(path.resolve(UPLOADS_DIR)));

// Health Check route
app.get('/healthz', (req, res) => res.sendStatus(200));

// SPA fallback (works in Express 4 and 5 without wildcard syntax)
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (String(req.path || "").startsWith("/api/")) return next();
  if (path.extname(String(req.path || ""))) return next();
  if (isFile(INDEX_HTML)) return res.sendFile(INDEX_HTML);
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
    console.error("[api] error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }

  console.error("[server] error:", err);
  return res.status(500).send("Server error");
});

async function start() {
  const dataMode = USE_POSTGRES ? "postgres" : "data.json";
  const storageMode = USE_CLOUDINARY ? "cloudinary" : "local";

  console.log("========================================");
  console.log("HYSA1 Backend Starting");
  console.log("========================================");
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`DATABASE_URL present: ${!!DATABASE_URL}`);
  console.log(`Data mode: ${dataMode}`);
  console.log(`Storage mode: ${storageMode}`);
  console.log(`Data file path: ${DATA_FILE}`);
  console.log(`Uploads path: ${UPLOADS_DIR}`);
  console.log("----------------------------------------");

  if (USE_POSTGRES) {
    await initPostgresSchema();
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
