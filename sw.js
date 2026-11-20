// Catálogo LF Inoxidables: abre sin internet con lo último que se vio.
// Fotos: se guardan la primera vez que se ven (su nombre nunca cambia).
// Página y catalogo.json: primero la red (para que los cambios se vean luego luego); si tarda más de 3 s o no hay internet, la guardada.
const V = 'lfcat-3';
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
  // la página (y las vistas previas p/…): primero la red, sin caché del navegador
  if (r.mode === 'navigate' || /\/(index\.html)?$/.test(u.pathname)) {
    const key = new Request(u.pathname);
    e.respondWith(
      caches.open(V).then((ca) => {
        const guardada = () => ca.match(key).then((h) => h || ca.match('index.html'));
        const red = fetch(u.href, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
          if (res.ok && res.type === 'basic') ca.put(key, res.clone());
          return res;
        });
        const lenta = new Promise((ok) => setTimeout(ok, 3000)).then(() => guardada().then((h) => h || red));
        return Promise.race([red.catch(() => guardada().then((h) => h || Response.error())), lenta]);
      }),
    );
    return;
  }
  // logo, manifest y lo demás: lo guardado al instante y se actualiza por detrás
  e.respondWith(
    caches.open(V).then((ca) =>
      ca.match(r, { ignoreSearch: true }).then((hit) => {
        const net = fetch(r)
          .then((res) => {
            if (res.ok && res.type === 'basic') ca.put(r, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    ),
  );
});
