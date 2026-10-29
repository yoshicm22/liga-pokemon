// Service worker: acelera la carga con el wifi del cole y permite instalar la app.
// NUNCA guarda respuestas de /api (datos privados de alumnos).
const CACHE = "liga-kanto-v7";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon-192.png"])));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put("/", cp)); } return r; })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Sprites de Pokémon y entrenadores: se guardan para que los mapas y la ruleta
  // del cofre se vean aunque el wifi del cole falle.
  const SPRITE_HOSTS = ["raw.githubusercontent.com", "play.pokemonshowdown.com"];
  const cacheable = url.origin === location.origin || SPRITE_HOSTS.includes(url.hostname);
  if (!cacheable) return;
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((r) => {
        if (r && (r.ok || r.type === "opaque")) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
        return r;
      })
    )
  );
});
