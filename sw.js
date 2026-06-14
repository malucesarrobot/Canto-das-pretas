// Canto das Pretas — Service Worker v3
const CACHE = 'cdp-v3';

const LOCAL_ASSETS = ['./', './index.html'];
const EXTERNAL_ASSETS = [
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
  'https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      await c.addAll(LOCAL_ASSETS).catch(() => {});
      await c.addAll(
        EXTERNAL_ASSETS.map(u => new Request(u, { mode: 'no-cors' }))
      ).catch(() => {});
    }).then(() => self.skipWaiting()) // assume controle imediatamente
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // 1. Apaga todos os caches antigos
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      // 2. Assume controle de todos os clientes abertos
      .then(() => self.clients.claim())
      // 3. Força reload em todos os apps instalados
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(client => client.navigate(client.url)))
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase, Anthropic: sempre rede
  if (url.includes('firebase') || url.includes('firebaseio') ||
      url.includes('anthropic') || url.includes('googleapis.com/css')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Recursos locais: stale-while-revalidate
  if (new URL(url).origin === self.location.origin) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(resp => {
          if (resp && resp.status === 200) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Externos: cache-first
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).catch(() => new Response('', { status: 408 }))
    )
  );
});
