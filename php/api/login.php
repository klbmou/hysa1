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
$key = $u["key"];
$password = (string)($body["password"] ?? "");

$stmt = $pdo->prepare("SELECT id, password_hash FROM users WHERE user_key = :k LIMIT 1");
$stmt->execute([":k" => $key]);
$row = $stmt->fetch();
if (!is_array($row)) fail(401, "INVALID_CREDENTIALS");
if (!password_verify($password, (string)$row["password_hash"])) fail(401, "INVALID_CREDENTIALS");

$userId = (int)$row["id"];
$token = create_session($pdo, $userId, 7);
$user = public_profile($pdo, $userId, $userId);

json_response(200, ["success" => true, "token" => $token, "user" => $user]);
