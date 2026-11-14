// Service Worker — offline support for the stopwatch app.
// Strategy: NETWORK FIRST (always the latest version when online),
// falling back to the cache only when offline.
// Bump CACHE_VERSION to force every installed copy to refresh.
var CACHE_VERSION = "stopwatch-v2";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function (cache) {
        // bypass the HTTP cache so we store the freshest files
        return Promise.all(ASSETS.map(function (url) {
          return fetch(url, { cache: "no-store" }).then(function (res) {
            if (res.ok) return cache.put(url, res);
          }).catch(function () {});
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    })
    .then(function () { return self.clients.claim(); })
    // reload any page that was opened with an older version
    .then(function () { return self.clients.matchAll({ type: "window" }); })
    .then(function (clients) {
      clients.forEach(function (c) { try { c.navigate(c.url); } catch (err) {} });
    })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req, { cache: "no-store" }).then(function (res) {
      if (res && res.ok && res.type === "basic") {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      // offline: serve from cache (ignore ?query so ?v=... still works)
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match("./index.html");
      });
    })
  );
});
