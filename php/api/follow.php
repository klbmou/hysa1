<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

if (strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "POST") {
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

if ($targetId === $uid) fail(400, "CANNOT_FOLLOW_SELF");

$stmt = $pdo->prepare("SELECT 1 FROM follows WHERE follower_id = :f AND followed_id = :t LIMIT 1");
$stmt->execute([":f" => $uid, ":t" => $targetId]);
$exists = (bool)$stmt->fetch();

if ($exists) {
  $stmt = $pdo->prepare("DELETE FROM follows WHERE follower_id = :f AND followed_id = :t");
  $stmt->execute([":f" => $uid, ":t" => $targetId]);
  $following = false;
} else {
  $stmt = $pdo->prepare("INSERT INTO follows (follower_id, followed_id, created_at) VALUES (:f, :t, UTC_TIMESTAMP())");
  $stmt->execute([":f" => $uid, ":t" => $targetId]);
  $following = true;
}

$stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM follows WHERE followed_id = :t");
$stmt->execute([":t" => $targetId]);
$row = $stmt->fetch();
$followerCount = is_array($row) ? (int)$row["c"] : 0;

json_response(200, ["ok" => true, "following" => $following, "followerCount" => $followerCount]);

