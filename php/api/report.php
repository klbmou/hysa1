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
$type = (string)($body["type"] ?? "");
$targetId = (int)($body["targetId"] ?? 0);
$reason = (string)($body["reason"] ?? "");
$note = trim((string)($body["note"] ?? ""));

$reasons = ["spam" => true, "abuse" => true, "fake" => true, "other" => true];
if ($type !== "post" || $targetId <= 0 || !isset($reasons[$reason]) || mb_len($note) > 300) {
  fail(400, "REPORT_INVALID");
}

$stmt = $pdo->prepare("SELECT author_id, visibility FROM posts WHERE id = :pid LIMIT 1");
$stmt->execute([":pid" => $targetId]);
$meta = $stmt->fetch();
if (!is_array($meta)) fail(404, "NOT_FOUND");
if (!post_visible((string)$meta["visibility"], (int)$meta["author_id"], $uid)) fail(404, "NOT_FOUND");

$stmt = $pdo->prepare(
  "INSERT INTO reports (reporter_id, post_id, reason, note, created_at)
   VALUES (:r, :pid, :reason, :note, UTC_TIMESTAMP())",
);
$stmt->execute([":r" => $uid, ":pid" => $targetId, ":reason" => $reason, ":note" => $note]);

json_response(200, ["ok" => true]);
