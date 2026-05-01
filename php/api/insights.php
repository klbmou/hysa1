<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

if (strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "GET") {
  fail(405, "METHOD_NOT_ALLOWED");
}

$pdo = db();
$auth = require_auth($pdo);
$uid = $auth["user_id"];

$stmt = $pdo->prepare("SELECT COUNT(*) AS c, COALESCE(SUM(view_count), 0) AS v FROM posts WHERE author_id = :uid");
$stmt->execute([":uid" => $uid]);
$row = $stmt->fetch();
$posts = is_array($row) ? (int)$row["c"] : 0;
$views = is_array($row) ? (int)$row["v"] : 0;

$stmt = $pdo->prepare(
  "SELECT COUNT(*) AS c
   FROM post_likes pl
   JOIN posts p ON p.id = pl.post_id
   WHERE p.author_id = :uid",
);
$stmt->execute([":uid" => $uid]);
$row = $stmt->fetch();
$likes = is_array($row) ? (int)$row["c"] : 0;

json_response(200, ["ok" => true, "insights" => ["posts" => $posts, "views" => $views, "likes" => $likes]]);

