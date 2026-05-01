<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

if (strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "GET") {
  fail(405, "METHOD_NOT_ALLOWED");
}

$pdo = db();
require_auth($pdo);

$q = isset($_GET["q"]) && !is_array($_GET["q"]) ? trim((string)$_GET["q"]) : "";
if ($q === "") {
  json_response(200, ["ok" => true, "results" => []]);
}

$like = "%" . $q . "%";
$stmt = $pdo->prepare(
  "SELECT user_key AS `key`, username
   FROM users
   WHERE user_key LIKE :q OR username LIKE :q
   ORDER BY id DESC
   LIMIT 12",
);
$stmt->execute([":q" => $like]);
$rows = $stmt->fetchAll();
if (!is_array($rows)) $rows = [];

$results = [];
foreach ($rows as $r) {
  if (!is_array($r)) continue;
  $results[] = ["key" => (string)$r["key"], "username" => (string)$r["username"]];
}

json_response(200, ["ok" => true, "results" => $results]);

