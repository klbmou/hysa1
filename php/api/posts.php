<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

if (strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "POST") {
  fail(405, "METHOD_NOT_ALLOWED");
}

$pdo = db();
$auth = require_auth($pdo);
$uid = $auth["user_id"];

$body = read_request_data();
$text = trim((string)($body["text"] ?? ""));
$mediaRaw = $body["media"] ?? [];
if (is_string($mediaRaw) && $mediaRaw !== "") {
  $decoded = json_decode($mediaRaw, true);
  if (is_array($decoded)) $mediaRaw = $decoded;
}
$media = normalize_media_list($mediaRaw);
$visibility = normalize_visibility($body["visibility"] ?? "public");

$textErr = validate_post_text($text);
if ($textErr) fail(400, $textErr);
if ($text === "" && count($media) === 0) fail(400, "INVALID_POST");

$stmt = $pdo->prepare(
  "INSERT INTO posts (author_id, text, visibility, view_count, created_at)
   VALUES (:uid, :t, :v, 0, UTC_TIMESTAMP())",
);
$stmt->execute([":uid" => $uid, ":t" => $text, ":v" => $visibility]);
$postId = (int)$pdo->lastInsertId();

if ($media) {
  $pos = 0;
  $stmt = $pdo->prepare(
    "INSERT INTO post_media (post_id, url, kind, mime, position)
     VALUES (:pid, :url, :kind, :mime, :pos)",
  );
  foreach ($media as $m) {
    $stmt->execute([
      ":pid" => $postId,
      ":url" => (string)$m["url"],
      ":kind" => (string)$m["kind"],
      ":mime" => (string)($m["mime"] ?? ""),
      ":pos" => $pos++,
    ]);
  }
}

$post = fetch_post_view($pdo, $uid, $postId);
json_response(200, ["ok" => true, "post" => $post]);
