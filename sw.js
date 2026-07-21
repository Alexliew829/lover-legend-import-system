const CACHE = "lover-legend-import-cost-v2.30";
const CORE = [
  "./",
  "./index.html",
  "./css/style.css?v=2.30",
  "./js/common.js?v=2.30",
  "./js/sync.js?v=2.30",
  "./js/app.js?v=2.30",
  "./manifest.json",
  "./assets/images/logo-green.jpg",
  "./assets/images/logo-red.jpg"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
  );
});
