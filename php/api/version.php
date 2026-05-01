<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

json_response(200, [
  "ok" => true,
  "version" => "2026-03-20-php",
  "features" => ["globalFeed" => true, "postVisibility" => true, "uploads" => true, "postViews" => true],
]);

