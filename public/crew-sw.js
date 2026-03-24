const CACHE_NAME = "yugo-crew-v1";
const OFFLINE_URL = "/crew/login";

const PRECACHE_URLS = ["/crew/login", "/crew/dashboard"];

function offlineFallbackResponse() {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Offline, Yugo Crew</title><style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f0f0f;color:#fafafa;padding:24px;text-align:center}p{max-width:22rem;line-height:1.5;color:#a3a3a3}</style></head><body><div><h1 style="font-size:1.25rem;margin:0 0 8px">You are offline</h1><p>Connection lost. Your screen may still show the last page. Status updates will send when you are back online.</p></div></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Install: precache shell (per-URL so one failure does not block the whole install)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {
            /* ignore individual precache failures */
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for navigations, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET for caching (but queue POST/PATCH to API)
  if (request.method !== "GET") {
    if (
      request.url.includes("/api/") &&
      (request.method === "POST" || request.method === "PATCH")
    ) {
      event.respondWith(
        fetch(request.clone()).catch(() =>
          enqueueFailedRequest(request.clone()).then(() =>
            new Response(JSON.stringify({ queued: true }), {
              status: 202,
              headers: { "Content-Type": "application/json" },
            })
          )
        )
      );
    }
    return;
  }

  // HTML navigations: network-first
  if (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html")
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request, { ignoreSearch: false })
            .then(
              (r) =>
                r ||
                caches.match(OFFLINE_URL).then(
                  (fallback) => fallback || offlineFallbackResponse()
                )
            )
        )
    );
    return;
  }

  // Static assets: cache-first (JS, CSS, images, fonts)
  if (request.url.match(/\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?)(\?|$)/i)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // API GETs: network-first with cache fallback
  if (request.url.includes("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (r) =>
              r ||
              new Response(JSON.stringify({ offline: true }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
              })
          )
        )
    );
    return;
  }

  event.respondWith(fetch(request));
});

// Offline queue for failed mutations
const DB_NAME = "yugo-offline-queue";
const STORE_NAME = "requests";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME, { autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function sanitizeReplayHeaders(raw) {
  const skip = new Set([
    "content-length",
    "connection",
    "keep-alive",
    "host",
    "transfer-encoding",
  ]);
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (!skip.has(String(k).toLowerCase())) out[k] = v;
  }
  return out;
}

async function enqueueFailedRequest(request) {
  const body = await request.text();
  const entry = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers),
    body,
    timestamp: Date.now(),
  };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function replayQueue() {
  const db = await openDB();
  const entries = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    const list = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        list.push({ key: cursor.key, value: cursor.value });
        cursor.continue();
      } else resolve(list);
    };
    req.onerror = () => reject(req.error);
  });

  for (const { key, value } of entries) {
    const { url, method, headers, body } = value;
    try {
      await fetch(url, {
        method,
        headers: sanitizeReplayHeaders(headers),
        body: body || undefined,
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      break;
    }
  }
}

// Expose for sw-tracking.js sync handler (importScripts shares global scope)
self.replayQueue = replayQueue;

try {
  importScripts("/sw-tracking.js");
} catch (e) {
  console.warn("[crew-sw] sw-tracking import failed", e);
}

self.addEventListener("sync", (event) => {
  if (event.tag === "tracking-sync") {
    event.waitUntil(replayQueue());
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "replay-queue") {
    event.waitUntil(replayQueue());
  }
});
