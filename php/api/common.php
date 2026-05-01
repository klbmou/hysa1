<?php
declare(strict_types=1);

// CORS (helps when the frontend is hosted on a different origin, including file://).
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Reply to CORS preflight early (otherwise endpoints return 405).
if (strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET")) === "OPTIONS") {
  http_response_code(204);
  exit;
}

// Always JSON for API endpoints.
header("Content-Type: application/json");
header("Cache-Control: no-store");

// Prevent PHP warnings/notices from breaking JSON on shared hosting.
error_reporting(E_ALL);
@ini_set("display_errors", "0");

final class ApiException extends Exception
{
  public int $status;
  public string $code;
  /** @var array<string, mixed> */
  public array $extra;

  /** @param array<string, mixed> $extra */
  public function __construct(int $status, string $code, array $extra = [])
  {
    parent::__construct($code);
    $this->status = $status;
    $this->code = $code;
    $this->extra = $extra;
  }
}

/** @param array<string, mixed> $payload */
function json_response(int $status, array $payload): void
{
  http_response_code($status);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

/** @param array<string, mixed> $extra */
function fail(int $status, string $code, array $extra = []): void
{
  json_response($status, array_merge(["success" => false, "ok" => false, "error" => $code], $extra));
}

/** @return array<string, mixed> */
function read_json(int $maxBytes = 1048576): array
{
  $len = isset($_SERVER["CONTENT_LENGTH"]) ? (int)$_SERVER["CONTENT_LENGTH"] : 0;
  if ($len > $maxBytes) throw new ApiException(413, "BODY_TOO_LARGE");

  $raw = file_get_contents("php://input", false, null, 0, $maxBytes + 1);
  if ($raw === false) $raw = "";
  if (strlen($raw) > $maxBytes) throw new ApiException(413, "BODY_TOO_LARGE");
  if ($raw === "") return [];

  $data = json_decode($raw, true);
  if (!is_array($data)) throw new ApiException(400, "INVALID_JSON");
  /** @var array<string, mixed> $data */
  return $data;
}

/** @return array<string, mixed> */
function read_request_data(int $maxBytes = 1048576): array
{
  // FormData / x-www-form-urlencoded are available in $_POST.
  if (!empty($_POST)) {
    /** @var array<string, mixed> */
    $out = [];
    foreach ($_POST as $k => $v) {
      if (!is_string($k)) continue;
      $out[$k] = $v;
    }
    return $out;
  }

  // Fallback to JSON payloads.
  return read_json($maxBytes);
}

function base64url_encode_bytes(string $bytes): string
{
  return rtrim(strtr(base64_encode($bytes), "+/", "-_"), "=");
}

function now_iso_utc(): string
{
  return gmdate("Y-m-d\\TH:i:s\\Z");
}

function mysql_to_iso_utc(string $mysqlDateTime): string
{
  try {
    $dt = new DateTimeImmutable($mysqlDateTime, new DateTimeZone("UTC"));
    return $dt->setTimezone(new DateTimeZone("UTC"))->format("Y-m-d\\TH:i:s\\Z");
  } catch (Throwable $e) {
    return now_iso_utc();
  }
}

function mb_len(string $s): int
{
  return function_exists("mb_strlen") ? (int)mb_strlen($s, "UTF-8") : strlen($s);
}

/** @return array{display:string,key:string} */
function normalize_username(mixed $input): array
{
  $display = trim((string)($input ?? ""));
  $key = function_exists("mb_strtolower") ? mb_strtolower($display, "UTF-8") : strtolower($display);
  return ["display" => $display, "key" => $key];
}

function validate_username(string $display): ?string
{
  $len = mb_len($display);
  if ($len < 3 || $len > 20) return "INVALID_USERNAME";
  if (!preg_match('/^[\\p{L}\\p{N}_]+$/u', $display)) return "INVALID_USERNAME";
  return null;
}

function validate_password(string $password): ?string
{
  $len = mb_len($password);
  if ($len < 6 || $len > 200) return "INVALID_PASSWORD";
  return null;
}

function validate_post_text(string $text): ?string
{
  if (mb_len(trim($text)) > 280) return "INVALID_POST";
  return null;
}

function validate_comment_text(string $text): ?string
{
  $t = trim($text);
  $len = mb_len($t);
  if ($len < 1 || $len > 200) return "INVALID_COMMENT";
  return null;
}

/** @return array<int, array{url:string, kind:string, mime?:string}> */
function normalize_media_list(mixed $input): array
{
  if (!is_array($input)) return [];
  $out = [];
  foreach ($input as $item) {
    if (!is_array($item)) continue;
    $url = (string)($item["url"] ?? "");
    $kind = (string)($item["kind"] ?? "");
    $mime = isset($item["mime"]) ? (string)$item["mime"] : "";
    if ($url === "" || substr($url, 0, 9) !== "/uploads/") continue;
    if ($kind !== "image" && $kind !== "video") continue;
    $entry = ["url" => $url, "kind" => $kind];
    if ($mime !== "") $entry["mime"] = $mime;
    $out[] = $entry;
    if (count($out) >= 4) break;
  }
  return $out;
}

function normalize_visibility(mixed $v): string
{
  $s = strtolower((string)($v ?? ""));
  return $s === "private" ? "private" : "public";
}

function parse_cursor(?string $cursorIso): ?string
{
  if (!$cursorIso) return null;
  try {
    $dt = new DateTimeImmutable($cursorIso);
    return $dt->setTimezone(new DateTimeZone("UTC"))->format("Y-m-d H:i:s");
  } catch (Throwable $e) {
    return null;
  }
}

// --- Robust JSON errors even on fatal errors ---

set_exception_handler(function (Throwable $e): void {
  if ($e instanceof ApiException) {
    $extra = $e->extra;
    // Ensure frontend can still map by error code.
    if (!isset($extra["message"])) $extra["message"] = $e->code;
    fail($e->status, $e->code, $extra);
  }
  if ($e instanceof PDOException) {
    fail(500, "DB_CONNECT_FAILED", ["message" => "DB_CONNECT_FAILED", "detail" => $e->getMessage()]);
  }
  fail(500, "SERVER_ERROR");
});

register_shutdown_function(function (): void {
  $err = error_get_last();
  if (!$err) return;
  $fatal = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR];
  if (!in_array((int)$err["type"], $fatal, true)) return;
  if (headers_sent()) return;
  header("Content-Type: application/json");
  http_response_code(500);
  echo json_encode(["ok" => false, "error" => "SERVER_ERROR"], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
});

// Include DB last (case-sensitive Linux: keep file name lowercase).
require_once __DIR__ . "/db.php";

// --- Auth helpers ---

function auth_header(): string
{
  if (isset($_SERVER["HTTP_AUTHORIZATION"])) return (string)$_SERVER["HTTP_AUTHORIZATION"];
  if (isset($_SERVER["REDIRECT_HTTP_AUTHORIZATION"])) return (string)$_SERVER["REDIRECT_HTTP_AUTHORIZATION"];
  if (function_exists("getallheaders")) {
    $h = getallheaders();
    if (is_array($h)) {
      foreach ($h as $k => $v) {
        if (strtolower((string)$k) === "authorization") return (string)$v;
      }
    }
  }
  return "";
}

function get_token(): ?string
{
  $auth = trim(auth_header());
  if (stripos($auth, "Bearer ") === 0) {
    $t = trim(substr($auth, 7));
    if ($t !== "") return $t;
  }
  // Shared hosting sometimes strips Authorization: allow fallback.
  $q = $_GET["token"] ?? "";
  if (!is_array($q) && trim((string)$q) !== "") return trim((string)$q);
  $c = $_COOKIE["hysa_token"] ?? "";
  if (!is_array($c) && trim((string)$c) !== "") return trim((string)$c);
  return null;
}

/** @return array{token:string,user_id:int,user_key:string} */
function require_auth(PDO $pdo): array
{
  $token = get_token();
  if (!$token) throw new ApiException(401, "UNAUTHENTICATED");

  $stmt = $pdo->prepare(
    "SELECT s.token, u.id AS user_id, u.user_key
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = :t AND s.expires_at > UTC_TIMESTAMP()
     LIMIT 1",
  );
  $stmt->execute([":t" => $token]);
  $row = $stmt->fetch();
  if (!is_array($row)) throw new ApiException(401, "UNAUTHENTICATED");
  return ["token" => (string)$row["token"], "user_id" => (int)$row["user_id"], "user_key" => (string)$row["user_key"]];
}

function create_session(PDO $pdo, int $userId, int $ttlDays = 7): string
{
  $token = base64url_encode_bytes(random_bytes(24));
  $exp = (new DateTimeImmutable("now", new DateTimeZone("UTC")))->modify("+" . $ttlDays . " days")->format("Y-m-d H:i:s");
  $stmt = $pdo->prepare(
    "INSERT INTO sessions (token, user_id, expires_at, created_at)
     VALUES (:t, :uid, :exp, UTC_TIMESTAMP())",
  );
  $stmt->execute([":t" => $token, ":uid" => $userId, ":exp" => $exp]);
  return $token;
}

function public_profile(PDO $pdo, int $viewerId, int $userId): array
{
  $stmt = $pdo->prepare(
    "SELECT
        u.username,
        u.bio,
        u.avatar_url,
        u.created_at,
        (SELECT COUNT(*) FROM follows f WHERE f.followed_id = u.id) AS followerCount,
        (SELECT COUNT(*) FROM follows f2 WHERE f2.follower_id = u.id) AS followingCount,
        EXISTS(
          SELECT 1 FROM follows f3
          WHERE f3.follower_id = :viewer AND f3.followed_id = u.id
        ) AS isFollowing
     FROM users u
     WHERE u.id = :uid
     LIMIT 1",
  );
  $stmt->execute([":viewer" => $viewerId, ":uid" => $userId]);
  $row = $stmt->fetch();
  if (!is_array($row)) throw new ApiException(404, "NOT_FOUND");
  return [
    "username" => (string)$row["username"],
    "bio" => (string)($row["bio"] ?? ""),
    "avatarUrl" => (string)($row["avatar_url"] ?? ""),
    "createdAt" => mysql_to_iso_utc((string)$row["created_at"]),
    "followerCount" => (int)$row["followerCount"],
    "followingCount" => (int)$row["followingCount"],
    "isFollowing" => ((int)$row["isFollowing"]) === 1,
  ];
}

function post_visible(string $visibility, int $authorId, int $viewerId): bool
{
  return $visibility === "public" || $authorId === $viewerId;
}

/**
 * @param array<int, array<string, mixed>> $posts
 * @return array<int, array<string, mixed>>
 */
function attach_media(PDO $pdo, array $posts): array
{
  $ids = [];
  foreach ($posts as $p) {
    $ids[] = (int)($p["id"] ?? 0);
  }
  $ids = array_values(array_filter($ids, fn($x) => $x > 0));
  if (!$ids) {
    foreach ($posts as &$p) $p["media"] = [];
    return $posts;
  }

  $ph = implode(",", array_fill(0, count($ids), "?"));
  $stmt = $pdo->prepare(
    "SELECT post_id, url, kind, mime
     FROM post_media
     WHERE post_id IN ($ph)
     ORDER BY post_id ASC, position ASC, id ASC",
  );
  $stmt->execute($ids);

  $map = [];
  while ($m = $stmt->fetch()) {
    if (!is_array($m)) continue;
    $pid = (int)$m["post_id"];
    if (!isset($map[$pid])) $map[$pid] = [];
    if (count($map[$pid]) >= 4) continue;
    $entry = ["url" => (string)$m["url"], "kind" => (string)$m["kind"]];
    $mime = (string)($m["mime"] ?? "");
    if ($mime !== "") $entry["mime"] = $mime;
    $map[$pid][] = $entry;
  }

  foreach ($posts as &$p) {
    $pid = (int)($p["id"] ?? 0);
    $p["media"] = $map[$pid] ?? [];
  }
  return $posts;
}

/** @return array<string, mixed> */
function fetch_post_view(PDO $pdo, int $viewerId, int $postId): array
{
  $stmt = $pdo->prepare(
    "SELECT
        p.id,
        p.author_id,
        au.user_key AS authorKey,
        au.username AS author,
        au.avatar_url AS authorAvatar,
        p.text,
        p.visibility,
        p.created_at,
        p.view_count AS viewCount,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likeCount,
        EXISTS(
          SELECT 1 FROM post_likes pl2
          WHERE pl2.post_id = p.id AND pl2.user_id = :viewer
        ) AS likedByMe,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount
     FROM posts p
     JOIN users au ON au.id = p.author_id
     WHERE p.id = :pid
     LIMIT 1",
  );
  $stmt->execute([":viewer" => $viewerId, ":pid" => $postId]);
  $r = $stmt->fetch();
  if (!is_array($r)) throw new ApiException(404, "NOT_FOUND");

  $post = [
    "id" => (string)$r["id"],
    "author" => (string)$r["author"],
    "authorAvatar" => (string)($r["authorAvatar"] ?? ""),
    "authorKey" => (string)$r["authorKey"],
    "text" => (string)($r["text"] ?? ""),
    "media" => [],
    "visibility" => (string)($r["visibility"] ?? "public"),
    "createdAt" => mysql_to_iso_utc((string)$r["created_at"]),
    "likeCount" => (int)$r["likeCount"],
    "likedByMe" => ((int)$r["likedByMe"]) === 1,
    "commentCount" => (int)$r["commentCount"],
    "viewCount" => (int)$r["viewCount"],
  ];

  $withMedia = attach_media($pdo, [$post]);
  return $withMedia[0];
}
