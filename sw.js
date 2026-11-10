/* Naim Baba TREADER — uygulama kabuğu önbelleği.
   Yahoo Finance ve CORS proxy istekleri bilinçli olarak önbelleğe alınmaz. */
const CACHE = 'treader-shell-v4';
const ASSETS = [
  './index.html',
  './manifest.webmanifest',
  './icons/logo.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

/* Bir dosya eksik/bozuksa önbellek kurulumunu düşürmesin: her varlık
   ayrı ayrı eklenir, hata yalnızca o varlık için yutulur. */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(ASSETS.map(asset =>
        cache.add(asset).catch(() => {})
      )))
      .then(() => self.skipWaiting())
  );
});

/* Çevrimdışıyken ağ isteği asılı kalmasın: kısa süre sonra önbelleğe dön. */
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      response => { clearTimeout(timer); resolve(response); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  /* Yalnızca kendi kaynaklarımız; Yahoo/proxy trafiğine dokunma. */
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(request, 4000)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(hit => {
      if (hit) return hit;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
