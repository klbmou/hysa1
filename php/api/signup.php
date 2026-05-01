<?php
declare(strict_types=1);

header("Content-Type: application/json");
require_once __DIR__ . "/common.php";

if (strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "POST") {
  fail(405, "METHOD_NOT_ALLOWED");
}

$pdo = db();
$body = read_request_data();

$u = normalize_username($body["username"] ?? "");
$display = $u["display"];
$key = $u["key"];

$uErr = validate_username($display);
if ($uErr) fail(400, $uErr);
$pErr = validate_password((string)($body["password"] ?? ""));
if ($pErr) fail(400, $pErr);
if ($key === "") fail(400, "INVALID_USERNAME");

$stmt = $pdo->prepare("SELECT id FROM users WHERE user_key = :k LIMIT 1");
$stmt->execute([":k" => $key]);
if ($stmt->fetch()) fail(409, "USERNAME_TAKEN");

$hash = password_hash((string)($body["password"] ?? ""), PASSWORD_DEFAULT);
if (!is_string($hash) || $hash === "") throw new ApiException(500, "SERVER_ERROR");

$stmt = $pdo->prepare(
  "INSERT INTO users (user_key, username, password_hash, bio, avatar_url, created_at)
   VALUES (:k, :u, :p, '', '', UTC_TIMESTAMP())",
);
$stmt->execute([":k" => $key, ":u" => $display, ":p" => $hash]);
$userId = (int)$pdo->lastInsertId();

$token = create_session($pdo, $userId, 7);
$user = public_profile($pdo, $userId, $userId);

json_response(200, ["success" => true, "token" => $token, "user" => $user]);
