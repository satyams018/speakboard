// Service worker: caches the app so it works with no internet connection.
// Bump VERSION whenever a cached file changes so phones pick up the new copy.

const VERSION = "v4";
const CACHE = `speakboard-${VERSION}`;
const APP_SHELL = [
  "./",
  "styles.css",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "fonts/lexend-latin-400-normal.woff2",
  "fonts/lexend-latin-600-normal.woff2",
  "fonts/lexend-latin-800-normal.woff2",
  "fonts/mukta-devanagari-500-normal.woff2",
  "fonts/mukta-devanagari-700-normal.woff2",
  "fonts/mukta-devanagari-800-normal.woff2",
  "js/app.js",
  "js/caregiver.js",
  "js/grammar.js",
  "js/i18n.js",
  "js/metrics.js",
  "js/predict.js",
  "js/recent.js",
  "js/sentence.js",
  "js/siren.js",
  "js/speech.js",
  "js/storage.js",
  "js/testmode.js",
  "js/vocab.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// Cache first, then network. Successful same-origin responses are added to the cache.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (cached) =>
        cached ??
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => (request.mode === "navigate" ? caches.match("./") : Response.error())),
    ),
  );
});
