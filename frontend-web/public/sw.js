/* HYSA Service Worker - bandwidth-aware app shell cache */
const CACHE = "hysa-v6";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/favicon.svg"
];

function offlineResponse(type) {
  if (type === "json") {
    return new Response(JSON.stringify({ ok: false, message: "OFFLINE" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
  return new Response("Offline", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

function failedAssetResponse() {
  return new Response(null, { status: 204, statusText: "No Content" });
}

function fetchOnceWithRetry(request, options) {
  return fetch(request, options).catch(() => fetch(request, options));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetchOnceWithRetry(event.request, { cache: "no-store" }).catch(() => offlineResponse("json"))
    );
    return;
  }

  if (
    url.hostname.includes("cloudinary.com") ||
    url.hostname.endsWith("googleusercontent.com") ||
    url.pathname.startsWith("/uploads/") ||
    event.request.destination === "image" ||
    event.request.destination === "video" ||
    event.request.destination === "audio"
  ) {
    event.respondWith(fetchOnceWithRetry(event.request, { cache: "no-store" }).catch(() => failedAssetResponse()));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const isShell = url.origin === location.origin && SHELL.includes(url.pathname || "/");
      const fetched = fetchOnceWithRetry(event.request, { cache: isShell ? "reload" : "default" })
        .then((response) => {
          if (response && response.ok && isShell) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached || offlineResponse());
      return isShell ? fetched : (cached || fetched);
    })
  );
});
