/* service-worker.js – Hava Durumu PWA (v2)
   - HTML: network-first (güncel içerik garanti)
   - Diğer dosyalar: cache-first (hız)
   - Dış API çağrıları: sadece network (önbelleğe alınmaz)
*/
const CACHE = 'hava-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

/* ----- INSTALL ----- */
self.addEventListener('install', e => {
  console.log('[SW] install v2');
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .catch(err => console.warn('[SW] cache addAll hata:', err))
  );
  self.skipWaiting();
});

/* ----- ACTIVATE ----- */
self.addEventListener('activate', e => {
  console.log('[SW] activate v2');
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] eski cache siliniyor:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

/* ----- FETCH ----- */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Dış kaynaklar (Open-Meteo API): sadece network — başarısızsa 503
  if (url.origin !== self.location.origin){
    e.respondWith(fetch(req).catch(() => new Response('', { status: 503 })));
    return;
  }

  // HTML: network-first
  const isHTML = req.destination === 'document'
              || url.pathname.endsWith('.html')
              || url.pathname.endsWith('/');

  if (isHTML){
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
          return res;
        })
        .catch(() => caches.match(req).then(h => h || caches.match('./index.html')))
    );
    return;
  }

  // Diğerleri (manifest, ikonlar): cache-first
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});