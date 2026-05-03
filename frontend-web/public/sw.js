/* HYSA Service Worker - bandwidth-aware app shell cache */
const CACHE = "hysa-v2";
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
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
  return new Response("Offline", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

function failedAssetResponse() {
  return new Response("", { status: 504, statusText: "Gateway Timeout" });
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
      fetch(event.request).catch(() => offlineResponse("json"))
    );
    return;
  }

  if (url.hostname.includes("cloudinary.com")) {
    const isVideoRequest = (event.request.destination === "video" || /\/video\/upload\//i.test(url.pathname)) && !/f_jpg/i.test(url.pathname);
    const isImageRequest = !isVideoRequest && (event.request.destination === "image" || /\/image\/upload\//i.test(url.pathname) || /f_jpg/i.test(url.pathname));
    if (!isImageRequest) {
      event.respondWith(fetch(event.request, { cache: "no-store" }).catch(() => failedAssetResponse()));
      return;
    }
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        caches.match(event.request).then((cached) => {
          const fetched = fetch(event.request, { cache: "force-cache" }).then((response) => {
            if (response && response.ok) cache.put(event.request, response.clone()).catch(() => {});
            return response;
          }).catch(() => cached || failedAssetResponse());
          return cached || fetched;
        })
      )
    );
    return;
  }

  if (url.pathname.startsWith("/uploads/")) {
    event.respondWith(
      fetch(event.request, { cache: "force-cache" })
        .catch(() => caches.match(event.request).then((cached) => cached || failedAssetResponse()))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((response) => {
          if (response && response.ok && url.origin === location.origin && SHELL.includes(url.pathname || "/")) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached || offlineResponse());
      return cached || fetched;
    })
  );
});
