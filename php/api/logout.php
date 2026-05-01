<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

if (strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "POST") {
  fail(405, "METHOD_NOT_ALLOWED");
}

$pdo = db();
$auth = require_auth($pdo);

$stmt = $pdo->prepare("DELETE FROM sessions WHERE token = :t");
$stmt->execute([":t" => $auth["token"]]);

json_response(200, ["ok" => true]);

