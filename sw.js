const CACHE_NAME = 'magnum-gym-v5';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/lucide.min.js',
  './vendor/qrcode.min.js',
  './vendor/xlsx.full.min.js',
  './images/exercises/banco_scott.jpg',
  './images/exercises/camilla_isquios.jpg',
  './images/exercises/curl_barra.jpg',
  './images/exercises/dorsalera_polea.jpg',
  './images/exercises/extension_polea.jpg',
  './images/exercises/gemelos_parado.jpg',
  './images/exercises/hack.jpg',
  './images/exercises/martillo.jpg',
  './images/exercises/peck_deck.jpg',
  './images/exercises/prensa_45.jpg',
  './images/exercises/press_hammer.jpg',
  './images/exercises/press_maquina.jpg',
  './images/exercises/press_plano.jpg',
  './images/exercises/remo_polea_baja.jpg',
  './images/exercises/sillon_cuadriceps.jpg',
  './images/exercises/tirones_cerrado.jpg',
  './images/exercises/vuelos_laterales.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        STATIC_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response && response.ok) {
              await cache.put(url, response);
            }
          } catch (err) {
            console.warn('Pre-cache failed for:', url);
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

async function getCachedDocument(request) {
  const cache = await caches.open(CACHE_NAME);
  return (
    (await cache.match(request, { ignoreSearch: true })) ||
    (await cache.match('./index.html')) ||
    (await cache.match('./'))
  );
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation / index.html: Cache-First + Background Revalidate (instant even with 0 bars or flaky gym 4G)
  const isNavigation =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html');

  if (isNavigation) {
    event.respondWith(
      (async () => {
        const cached = await getCachedDocument(event.request);
        const updatePromise = fetch('./index.html', { cache: 'no-cache' })
          .then(async (networkResponse) => {
            if (
              networkResponse &&
              networkResponse.ok &&
              (networkResponse.headers.get('content-type') || '').includes('text/html')
            ) {
              const cache = await caches.open(CACHE_NAME);
              await cache.put('./index.html', networkResponse.clone());
              await cache.put('./', networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(updatePromise);
          return cached;
        }

        const fresh = await updatePromise;
        if (fresh) return fresh;
        return new Response('Sin conexión. Abre la app una vez con Wi-Fi para guardarla.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })()
    );
    return;
  }

  // Static assets (CSS, JS, images, icons): Cache-First
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.ok) {
          await cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        return new Response('', { status: 404 });
      }
    })
  );
});
