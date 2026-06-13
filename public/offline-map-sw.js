const TILE_CACHE_NAME = "routemax-offline-map-tiles-v1";
const TILE_HOST = "basemaps.cartocdn.com";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.hostname.endsWith(TILE_HOST)) return;

  event.respondWith(
    caches.open(TILE_CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request.url);

      try {
        const response = await fetch(event.request);
        if (response && (response.ok || response.type === "opaque")) {
          cache.put(event.request.url, response.clone());
        }
        return response;
      } catch {
        if (cached) return cached;
        throw new Error("Map tile is unavailable offline.");
      }
    })
  );
});
