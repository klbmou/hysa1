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
$bio = trim((string)($body["bio"] ?? ""));
if (mb_len($bio) > 160) fail(400, "BIO_TOO_LONG");

$avatarUrl = null;
if (array_key_exists("avatarUrl", $body)) {
  $avatarUrl = (string)($body["avatarUrl"] ?? "");
  if ($avatarUrl !== "") {
    $path = (string)parse_url($avatarUrl, PHP_URL_PATH);
    $okPrefix = substr($avatarUrl, 0, 9) === "/uploads/";
    $okExt = (bool)preg_match('/\\.(png|jpe?g|gif|webp)$/i', $path);
    if (!$okPrefix || !$okExt) fail(400, "UPLOAD_INVALID");
  }
}

if ($avatarUrl === null) {
  $stmt = $pdo->prepare("UPDATE users SET bio = :b WHERE id = :uid");
  $stmt->execute([":b" => $bio, ":uid" => $uid]);
} else {
  $stmt = $pdo->prepare("UPDATE users SET bio = :b, avatar_url = :a WHERE id = :uid");
  $stmt->execute([":b" => $bio, ":a" => $avatarUrl, ":uid" => $uid]);
}

$me = public_profile($pdo, $uid, $uid);
json_response(200, ["ok" => true, "me" => $me]);
