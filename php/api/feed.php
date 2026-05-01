<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

if (strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "GET") {
  fail(405, "METHOD_NOT_ALLOWED");
}

$pdo = db();
$auth = require_auth($pdo);
$uid = $auth["user_id"];

$limit = isset($_GET["limit"]) ? (int)$_GET["limit"] : 30;
if ($limit < 1) $limit = 1;
if ($limit > 50) $limit = 50;

$cursorIso = isset($_GET["cursor"]) && !is_array($_GET["cursor"]) ? (string)$_GET["cursor"] : null;
$cursor = parse_cursor($cursorIso);

$sql =
  "SELECT
      p.id,
      p.author_id,
      au.user_key AS authorKey,
      au.username AS author,
      au.avatar_url AS authorAvatar,
      p.text,
      p.visibility,
      p.created_at,
      p.view_count AS viewCount,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likeCount,
      EXISTS(
        SELECT 1 FROM post_likes pl2
        WHERE pl2.post_id = p.id AND pl2.user_id = :viewer
      ) AS likedByMe,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount
   FROM posts p
   JOIN users au ON au.id = p.author_id
   WHERE (p.visibility = 'public' OR (p.visibility = 'private' AND p.author_id = :viewer))
   " . ($cursor ? "AND p.created_at < :cursor" : "") . "
   ORDER BY p.created_at DESC, p.id DESC
   LIMIT {$limit}";

$params = [":viewer" => $uid];
if ($cursor) $params[":cursor"] = $cursor;

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();
if (!is_array($rows)) $rows = [];

$posts = [];
foreach ($rows as $r) {
  if (!is_array($r)) continue;
  $posts[] = [
    "id" => (string)$r["id"],
    "author" => (string)$r["author"],
    "authorAvatar" => (string)($r["authorAvatar"] ?? ""),
    "authorKey" => (string)$r["authorKey"],
    "text" => (string)($r["text"] ?? ""),
    "media" => [],
    "visibility" => (string)($r["visibility"] ?? "public"),
    "createdAt" => mysql_to_iso_utc((string)$r["created_at"]),
    "likeCount" => (int)$r["likeCount"],
    "likedByMe" => ((int)$r["likedByMe"]) === 1,
    "commentCount" => (int)$r["commentCount"],
    "viewCount" => (int)$r["viewCount"],
  ];
}

$posts = attach_media($pdo, $posts);

$nextCursor = null;
if ($posts) {
  $last = $posts[count($posts) - 1];
  $nextCursor = $last["createdAt"] ?? null;
}

json_response(200, ["ok" => true, "posts" => $posts, "nextCursor" => $nextCursor]);

