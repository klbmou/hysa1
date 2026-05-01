<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

if (strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "GET") {
  fail(405, "METHOD_NOT_ALLOWED");
}

$pdo = db();
$auth = require_auth($pdo);

$me = public_profile($pdo, $auth["user_id"], $auth["user_id"]);
json_response(200, ["ok" => true, "me" => $me]);

