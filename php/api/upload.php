<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

if (strtoupper((string)($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "POST") {
  fail(405, "METHOD_NOT_ALLOWED");
}

$pdo = db();
require_auth($pdo);

// Base64 dataUrl payload can be big.
$maxBytes = 45 * 1024 * 1024;
$len = isset($_SERVER["CONTENT_LENGTH"]) ? (int)$_SERVER["CONTENT_LENGTH"] : 0;
if ($len > $maxBytes) fail(413, "UPLOAD_TOO_LARGE");

$dataUrl = "";
if (isset($_POST["dataUrl"]) && !is_array($_POST["dataUrl"])) {
  $dataUrl = (string)$_POST["dataUrl"];
}

if ($dataUrl === "") {
  $ct = strtolower((string)($_SERVER["CONTENT_TYPE"] ?? ""));
  $isForm = strpos($ct, "multipart/form-data") !== false || strpos($ct, "application/x-www-form-urlencoded") !== false;
  if ($isForm) fail(400, "UPLOAD_INVALID");

  try {
    $body = read_json($maxBytes);
  } catch (ApiException $e) {
    if ($e->code === "BODY_TOO_LARGE") fail(413, "UPLOAD_TOO_LARGE");
    throw $e;
  }
  $dataUrl = (string)($body["dataUrl"] ?? "");
}

if (!preg_match('#^data:([^;]+);base64,([\\s\\S]+)$#', $dataUrl, $m)) fail(400, "UPLOAD_INVALID");
$mime = strtolower((string)$m[1]);
$base64 = preg_replace('/\\s+/', '', (string)$m[2]);

$extByMime = [
  "image/png" => "png",
  "image/jpeg" => "jpg",
  "image/jpg" => "jpg",
  "image/gif" => "gif",
  "image/webp" => "webp",
  "video/mp4" => "mp4",
  "video/webm" => "webm",
];
$ext = $extByMime[$mime] ?? null;
if (!$ext) fail(400, "UPLOAD_INVALID");

$bin = base64_decode((string)$base64, true);
if (!is_string($bin) || $bin === "") fail(400, "UPLOAD_INVALID");
if (strlen($bin) > 25 * 1024 * 1024) fail(413, "UPLOAD_TOO_LARGE");

$kind = (strpos($mime, "image/") === 0) ? "image" : "video";
$fileName = time() . "_" . base64url_encode_bytes(random_bytes(12)) . "." . $ext;

$uploadsDir = __DIR__ . "/../uploads";
if (!is_dir($uploadsDir)) {
  @mkdir($uploadsDir, 0775, true);
}
$abs = rtrim($uploadsDir, "/\\") . DIRECTORY_SEPARATOR . $fileName;
$ok = @file_put_contents($abs, $bin);
if ($ok === false) throw new ApiException(500, "UPLOAD_WRITE_FAILED");

json_response(200, [
  "ok" => true,
  "media" => ["url" => "/uploads/" . $fileName, "kind" => $kind, "mime" => $mime, "size" => strlen($bin)],
]);
