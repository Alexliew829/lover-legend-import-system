// Lover Legend Sales PWA Service Worker V32.5
// OneSignal uses its own worker:
// /push/onesignal/OneSignalSDKWorker.js

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
