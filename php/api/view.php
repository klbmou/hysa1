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

$pdo->beginTransaction();
try {
  $stmt = $pdo->prepare("SELECT author_id, visibility, view_count FROM posts WHERE id = :pid LIMIT 1 FOR UPDATE");
  $stmt->execute([":pid" => $postId]);
  $meta = $stmt->fetch();
  if (!is_array($meta)) {
    $pdo->rollBack();
    fail(404, "NOT_FOUND");
  }

  $authorId = (int)$meta["author_id"];
  $visibility = (string)$meta["visibility"];
  if (!post_visible($visibility, $authorId, $uid)) {
    $pdo->rollBack();
    fail(404, "NOT_FOUND");
  }

  $viewCount = (int)$meta["view_count"];
  if ($authorId === $uid) {
    $pdo->commit();
    json_response(200, ["ok" => true, "viewCount" => $viewCount]);
  }

  $stmt = $pdo->prepare(
    "INSERT IGNORE INTO post_views (post_id, viewer_id, created_at)
     VALUES (:pid, :uid, UTC_TIMESTAMP())",
  );
  $stmt->execute([":pid" => $postId, ":uid" => $uid]);
  $inserted = $stmt->rowCount() > 0;
  if ($inserted) {
    $stmt2 = $pdo->prepare("UPDATE posts SET view_count = view_count + 1 WHERE id = :pid");
    $stmt2->execute([":pid" => $postId]);
    $viewCount += 1;
  }

  $pdo->commit();
  json_response(200, ["ok" => true, "viewCount" => $viewCount]);
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  throw $e;
}

