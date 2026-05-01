<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

if (strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "GET") {
  fail(405, "METHOD_NOT_ALLOWED");
}

$pdo = db();
$auth = require_auth($pdo);
$uid = $auth["user_id"];

$postId = isset($_GET["id"]) && !is_array($_GET["id"]) ? (int)$_GET["id"] : 0;
if ($postId <= 0) fail(404, "NOT_FOUND");

$stmt = $pdo->prepare("SELECT author_id, visibility FROM posts WHERE id = :pid LIMIT 1");
$stmt->execute([":pid" => $postId]);
$meta = $stmt->fetch();
if (!is_array($meta)) fail(404, "NOT_FOUND");
if (!post_visible((string)$meta["visibility"], (int)$meta["author_id"], $uid)) fail(404, "NOT_FOUND");

$post = fetch_post_view($pdo, $uid, $postId);
json_response(200, ["ok" => true, "post" => $post]);

