<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

$method = strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET"));
if ($method !== "GET" && $method !== "POST") {
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

if ($method === "GET") {
  $limit = isset($_GET["limit"]) ? (int)$_GET["limit"] : 50;
  if ($limit < 1) $limit = 1;
  if ($limit > 100) $limit = 100;

  $stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM comments WHERE post_id = :pid");
  $stmt->execute([":pid" => $postId]);
  $row = $stmt->fetch();
  $commentCount = is_array($row) ? (int)$row["c"] : 0;

  $stmt = $pdo->prepare(
    "SELECT
        c.id,
        c.text,
        c.created_at,
        au.user_key AS authorKey,
        au.username AS author,
        au.avatar_url AS authorAvatar
     FROM comments c
     JOIN users au ON au.id = c.author_id
     WHERE c.post_id = :pid
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT {$limit}",
  );
  $stmt->execute([":pid" => $postId]);
  $rows = $stmt->fetchAll();
  if (!is_array($rows)) $rows = [];
  $rows = array_reverse($rows);

  $comments = [];
  foreach ($rows as $r) {
    if (!is_array($r)) continue;
    $comments[] = [
      "id" => (string)$r["id"],
      "author" => (string)$r["author"],
      "authorAvatar" => (string)($r["authorAvatar"] ?? ""),
      "authorKey" => (string)$r["authorKey"],
      "text" => (string)$r["text"],
      "createdAt" => mysql_to_iso_utc((string)$r["created_at"]),
    ];
  }

  json_response(200, ["ok" => true, "comments" => $comments, "commentCount" => $commentCount]);
}

// POST
$body = read_request_data();
$text = trim((string)($body["text"] ?? ""));
$err = validate_comment_text($text);
if ($err) fail(400, $err);

$stmt = $pdo->prepare(
  "INSERT INTO comments (post_id, author_id, text, created_at)
   VALUES (:pid, :uid, :t, UTC_TIMESTAMP())",
);
$stmt->execute([":pid" => $postId, ":uid" => $uid, ":t" => $text]);
$commentId = (int)$pdo->lastInsertId();

$stmt = $pdo->prepare(
  "SELECT
      c.id,
      c.text,
      c.created_at,
      au.user_key AS authorKey,
      au.username AS author,
      au.avatar_url AS authorAvatar
   FROM comments c
   JOIN users au ON au.id = c.author_id
   WHERE c.id = :cid
   LIMIT 1",
);
$stmt->execute([":cid" => $commentId]);
$r = $stmt->fetch();
if (!is_array($r)) throw new ApiException(500, "SERVER_ERROR");

$comment = [
  "id" => (string)$r["id"],
  "author" => (string)$r["author"],
  "authorAvatar" => (string)($r["authorAvatar"] ?? ""),
  "authorKey" => (string)$r["authorKey"],
  "text" => (string)$r["text"],
  "createdAt" => mysql_to_iso_utc((string)$r["created_at"]),
];

$stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM comments WHERE post_id = :pid");
$stmt->execute([":pid" => $postId]);
$row = $stmt->fetch();
$commentCount = is_array($row) ? (int)$row["c"] : 0;

json_response(200, ["ok" => true, "comment" => $comment, "commentCount" => $commentCount]);
