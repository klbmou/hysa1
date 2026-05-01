<?php
declare(strict_types=1);

header("Content-Type: application/json");

// Simple MySQL connection for InfinityFree.
$DB_HOST = "sql312.infinityfree.com";
$DB_NAME = "if0_41377900_social_db";
$DB_USER = "if0_41377900";
$DB_PASS = "dIpkftGHhTy";

// Optional (usually keep as-is).
$DB_CHARSET = "utf8mb4";

/**
 * Returns a PDO connection.
 * On shared hosting, keep it simple and fail with a JSON-friendly error code.
 */
function db(): PDO
{
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;

  global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS, $DB_CHARSET;

  $host = trim((string)$DB_HOST);
  $name = trim((string)$DB_NAME);
  $user = trim((string)$DB_USER);
  $pass = (string)$DB_PASS;
  $charset = trim((string)$DB_CHARSET) ?: "utf8mb4";

  if (
    $host === "" ||
    $name === "" ||
    $user === "" ||
    strpos($host, "CHANGE_ME_") === 0 ||
    strpos($name, "CHANGE_ME_") === 0
  ) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "DB_NOT_CONFIGURED"]);
    exit;
  }

  try {
    $dsn = "mysql:host={$host};dbname={$name};charset={$charset}";
    $pdo = new PDO($dsn, $user, $pass, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES => false,
    ]);
  } catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "DB_CONNECT_FAILED", "detail" => $e->getMessage()]);
    exit;
  }

  try {
    $pdo->exec("SET time_zone = '+00:00'");
  } catch (Throwable $e) {
    // ignore
  }

  return $pdo;
}
