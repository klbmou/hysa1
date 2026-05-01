<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

if (strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "GET") {
  fail(405, "METHOD_NOT_ALLOWED");
}

$pdo = db();
$auth = require_auth($pdo);
$uid = $auth["user_id"];

$raw = isset($_GET["u"]) && !is_array($_GET["u"]) ? (string)$_GET["u"] : "";
$u = normalize_username($raw);
$key = $u["key"];
if ($key === "") fail(404, "NOT_FOUND");

$stmt = $pdo->prepare("SELECT id FROM users WHERE user_key = :k LIMIT 1");
$stmt->execute([":k" => $key]);
$row = $stmt->fetch();
if (!is_array($row)) fail(404, "NOT_FOUND");
$targetId = (int)$row["id"];

$profile = public_profile($pdo, $uid, $targetId);

$stmt = $pdo->prepare(
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
   WHERE p.author_id = :author
     AND (p.visibility = 'public' OR (p.visibility = 'private' AND p.author_id = :viewer))
   ORDER BY p.created_at DESC, p.id DESC
   LIMIT 30",
);
$stmt->execute([":viewer" => $uid, ":author" => $targetId]);
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

json_response(200, ["ok" => true, "profile" => $profile, "posts" => $posts]);

