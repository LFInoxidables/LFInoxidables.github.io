// Catálogo LF Inoxidables: abre sin internet con lo último que se vio.
// Fotos: se guardan la primera vez que se ven (su nombre nunca cambia). Página: la guardada al instante y se renueva atrás.
// catalogo.json: primero la red; sin internet, la guardada.
const V = 'lfcat-1';
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(V)
      .then((c) => c.addAll(['./', 'index.html', 'logo.webp', 'manifest.webmanifest']).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (/\/catalogo\.json$/.test(u.pathname)) {
    e.respondWith(
      fetch(r)
        .then((res) => {
          if (res.ok) {
            const c = res.clone();
            caches.open(V).then((ca) => ca.put(new Request(u.pathname), c));
          }
          return res;
        })
        .catch(() => caches.match(new Request(u.pathname))),
    );
    return;
  }
  if (/\/fotos\//.test(u.pathname)) {
    e.respondWith(
      caches.match(r).then(
        (hit) =>
          hit ||
          fetch(r).then((res) => {
            if (res.ok) {
              const c = res.clone();
              caches.open(V).then((ca) => ca.put(r, c));
            }
            return res;
          }),
      ),
    );
    return;
  }
  // página, logo y lo demás: lo guardado al instante y se actualiza por detrás
  const key = r.mode === 'navigate' ? new Request(u.pathname.endsWith('/') ? u.pathname : u.pathname) : r;
  e.respondWith(
    caches.open(V).then((ca) =>
      ca.match(key, { ignoreSearch: true }).then((hit) => {
        const net = fetch(r)
          .then((res) => {
            if (res.ok && res.type === 'basic') ca.put(key, res.clone());
            return res;
          })
          .catch(() => hit || ca.match('index.html'));
        return hit || net;
      }),
    ),
  );
});
