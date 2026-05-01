<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

if (strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "POST") {
  fail(405, "METHOD_NOT_ALLOWED");
}

$pdo = db();
$auth = require_auth($pdo);
$uid = $auth["user_id"];

$postId = isset($_GET["id"]) && !is_array($_GET["id"]) ? (int)$_GET["id"] : 0;
if ($postId <= 0) fail(404, "NOT_FOUND");

$stmt = $pdo->prepare("SELECT author_id, visibility FROM posts WHERE id = :pid LIMIT 1");
$stmt->execute([":pid" => $postId]);
$meta = $stmt->fetch();
if (!is_array($meta)) fail(404, "NOT_FOUND");
if (!post_visible((string)$meta["visibility"], (int)$meta["author_id"], $uid)) fail(404, "NOT_FOUND");

$stmt = $pdo->prepare("SELECT 1 FROM post_likes WHERE post_id = :pid AND user_id = :uid LIMIT 1");
$stmt->execute([":pid" => $postId, ":uid" => $uid]);
$exists = (bool)$stmt->fetch();

if ($exists) {
  $stmt = $pdo->prepare("DELETE FROM post_likes WHERE post_id = :pid AND user_id = :uid");
  $stmt->execute([":pid" => $postId, ":uid" => $uid]);
  $liked = false;
} else {
  $stmt = $pdo->prepare("INSERT INTO post_likes (post_id, user_id, created_at) VALUES (:pid, :uid, UTC_TIMESTAMP())");
  $stmt->execute([":pid" => $postId, ":uid" => $uid]);
  $liked = true;
}

$stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM post_likes WHERE post_id = :pid");
$stmt->execute([":pid" => $postId]);
$row = $stmt->fetch();
$likeCount = is_array($row) ? (int)$row["c"] : 0;

json_response(200, ["ok" => true, "liked" => $liked, "likeCount" => $likeCount]);

