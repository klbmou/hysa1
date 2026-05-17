"use strict";

const CANDIDATE_POOL_MAX = 300;
const DIVERSITY_WINDOW = 10;
const DIVERSITY_MAX_PER_AUTHOR = 2;

function asArray(x) {
  if (Array.isArray(x)) return x;
  if (!x) return [];
  if (typeof x === "object" && x.constructor === Object) return Object.values(x);
  return [];
}

function recencyScore(createdAt) {
  const ts = new Date(String(createdAt || "")).getTime();
  if (!Number.isFinite(ts)) return 0;
  const ageMs = Date.now() - ts;
  if (ageMs < 0) return 600;
  if (ageMs < 2 * 60 * 60 * 1000) return 500;
  if (ageMs < 24 * 60 * 60 * 1000) return 200;
  if (ageMs < 7 * 24 * 60 * 60 * 1000) return 50;
  return 0;
}

function engagementScore(post) {
  const likes = asArray(post && post.likes).length;
  const comments = asArray(post && post.comments).length;
  const bookmarks = asArray(post && post.bookmarks).length;
  const views = Number.isFinite(Number(post && post.views)) ? Number(post.views) : 0;

  const likeScore = Math.log1p(likes) * 2;
  const commentScore = Math.log1p(comments) * 4;
  const bookmarkScore = Math.log1p(bookmarks) * 4;
  const viewScore = Math.log1p(views) * 0.5;

  return likeScore + commentScore + bookmarkScore + viewScore;
}

function computeScore(post, viewer, ctx) {
  const viewerKey = String(viewer && viewer.userKey || "");
  const postAuthor = String(post && (post.authorKey || post.author || "") || "");

  const recency = recencyScore(post && (post.createdAt || post.created_at));
  const engagement = engagementScore(post);
  let relationship = 0;
  let repetitionPenalty = 0;
  let seenPenalty = 0;

  if (postAuthor && viewerKey) {
    if (postAuthor === viewerKey) {
      relationship += 100;
    } else if (ctx.followingSet.has(postAuthor)) {
      relationship += 80;
    } else if (ctx.interactedAuthors.has(postAuthor)) {
      relationship += 40;
    }
  }

  const hasMedia = asArray(post && post.media).length > 0;
  const mediaBoost = hasMedia ? 15 : 0;

  const discoveryBoost = relationship === 0 && postAuthor !== viewerKey ? 5 : 0;

  const total = recency + engagement + relationship + mediaBoost + discoveryBoost + repetitionPenalty + seenPenalty;
  return { total, recency, engagement, relationship, mediaBoost, discoveryBoost, seenPenalty, repetitionPenalty };
}

function hydrateViewerContext(viewer) {
  const viewerKey = String(viewer && viewer.userKey || "");
  const following = asArray(viewer && viewer.following).map(String);
  const followingSet = new Set(following);

  return {
    viewerKey,
    following,
    followingSet,
    interactedAuthors: new Set(),
  };
}

function applyFilters(posts, viewer, ctx, options) {
  const viewerKey = ctx.viewerKey;
  const blockedSet = options.blockedSet || new Set();
  const seenSet = options.seenSet || new Set();
  const seenEnabled = options.seenEnabled || false;

  return posts.filter((post) => {
    if (!post || !post.id) return false;
    const authorKey = String(post.authorKey || normalizeUsername(post.author).key || "");
    if (!authorKey) return false;
    if (blockedSet.has(authorKey)) return false;
    if (seenEnabled && seenSet.has(post.id)) return false;
    return true;
  });
}

function normalizeUsername(input) {
  const raw = String(input || "").toLowerCase().trim();
  const key = raw.replace(/[^a-z0-9_]/g, "");
  const display = raw.replace(/[^a-zA-Z0-9_ ]/g, "").trim() || key;
  return { key, display };
}

function sortChronological(posts) {
  return posts.slice().sort((a, b) => {
    const aTime = new Date(String(a && (a.createdAt || a.created_at) || "")).getTime() || 0;
    const bTime = new Date(String(b && (b.createdAt || b.created_at) || "")).getTime() || 0;
    return bTime - aTime;
  });
}

function sortChronologicalDesc(a, b) {
  const aTime = new Date(String(a && (a.createdAt || a.created_at) || "")).getTime() || 0;
  const bTime = new Date(String(b && (b.createdAt || b.created_at) || "")).getTime() || 0;
  return bTime - aTime;
}

function sortForYou(posts, viewer, ctx, options) {
  const scored = posts.map((post) => {
    const score = computeScore(post, viewer, ctx);
    return { post, score };
  });

  scored.sort((a, b) => {
    if (a.score.total !== b.score.total) return b.score.total - a.score.total;
    return sortChronologicalDesc(a.post, b.post);
  });

  return scored.map((s) => s.post);
}

function sortFollowing(posts, viewer, ctx) {
  const viewerKey = ctx.viewerKey;

  const grouped = { followed: [], own: [], other: [] };
  for (const post of posts) {
    const author = String(post && (post.authorKey || normalizeUsername(post.author).key) || "");
    if (author === viewerKey) {
      grouped.own.push(post);
    } else if (ctx.followingSet.has(author)) {
      grouped.followed.push(post);
    } else {
      grouped.other.push(post);
    }
  }

  const result = [];
  result.push(...sortChronological(grouped.own));
  result.push(...sortChronological(grouped.followed));
  result.push(...sortChronological(grouped.other));
  return result;
}

function applyDiversity(posts, ctx) {
  if (!posts.length) return posts;
  const result = [];
  const authorCount = new Map();

  for (const post of posts) {
    const author = String(post && (post.authorKey || normalizeUsername(post.author).key) || "");
    const currentCount = authorCount.get(author) || 0;
    const windowLength = Math.min(result.length, DIVERSITY_WINDOW);

    if (windowLength >= DIVERSITY_WINDOW) {
      result.push(post);
      continue;
    }

    if (currentCount >= DIVERSITY_MAX_PER_AUTHOR) {
      continue;
    }

    result.push(post);
    authorCount.set(author, currentCount + 1);
  }

  return result;
}

async function rankFeedPosts(candidates, viewer, options = {}) {
  const start = Date.now();
  const mode = options.mode || 'forYou';

  try {
    const ctx = hydrateViewerContext(viewer);
    const pool = candidates.slice(0, CANDIDATE_POOL_MAX);

    const filtered = applyFilters(pool, viewer, ctx, options);

    let ranked;
    if (mode === 'latest') {
      ranked = sortChronological(filtered);
    } else if (mode === 'following') {
      ranked = sortFollowing(filtered, viewer, ctx);
    } else {
      ranked = sortForYou(filtered, viewer, ctx, options);
    }

    const diversified = applyDiversity(ranked, ctx);

    if (options.debug) {
      const elapsed = Date.now() - start;
      console.log(`[recommendation] feed mode=${mode} candidates=${candidates.length} filtered=${filtered.length} ranked=${ranked.length} diversified=${diversified.length} elapsed=${elapsed}ms`);
    }

    return diversified;
  } catch (err) {
    console.error('[recommendation] feed fallback to chronological:', err.message);
    return sortChronological(candidates);
  }
}

async function rankReelPosts(candidates, viewer, options = {}) {
  const start = Date.now();

  try {
    const reels = candidates.filter((p) =>
      asArray(p && p.media).some((m) => String(m && m.kind) === "video")
    );

    if (!reels.length) return [];

    const ctx = hydrateViewerContext(viewer);
    const pool = reels.slice(0, CANDIDATE_POOL_MAX);

    const filtered = applyFilters(pool, viewer, ctx, options);

    const scored = filtered.map((post) => {
      const score = computeScore(post, viewer, ctx);
      return { post, score };
    });

    scored.sort((a, b) => {
      if (a.score.total !== b.score.total) return b.score.total - a.score.total;
      return sortChronologicalDesc(a.post, b.post);
    });

    const ranked = scored.map((s) => s.post);
    const diversified = applyDiversity(ranked, ctx);

    if (options.debug) {
      const elapsed = Date.now() - start;
      console.log(`[recommendation] reels candidates=${candidates.length} filtered=${filtered.length} ranked=${ranked.length} diversified=${diversified.length} elapsed=${elapsed}ms`);
    }

    return diversified;
  } catch (err) {
    console.error('[recommendation] reels fallback to chronological:', err.message);
    return sortChronological(candidates.filter((p) =>
      asArray(p && p.media).some((m) => String(m && m.kind) === "video")
    ));
  }
}

module.exports = { rankFeedPosts, rankReelPosts, applyDiversity, sortChronological, sortForYou, sortFollowing, recencyScore, engagementScore, computeScore, hydrateViewerContext, applyFilters };
