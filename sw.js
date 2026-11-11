// Service Worker cho Gia Phả Vũ Tộc — Thái Bình
// Chiến lược: "Network-first" cho HTML (có mạng lấy mới, timeout 3s hoặc mất mạng dùng cache); "Cache-first" cho tài nguyên tĩnh (font, icon, manifest).

const CACHE_NAME = 'gp-v-' + '9d24ffd374c5';
const PRECACHE = ["apple-touch-icon.png", "favicon-16.png", "favicon-32.png", "favicon.ico", "favicon.svg", "font-bevietnampro-400.woff2", "font-bevietnampro-500.woff2", "font-bevietnampro-600.woff2", "font-bevietnampro-700.woff2", "font-lora-italic.woff2", "font-lora-normal.woff2", "font-notoseriftc-500.woff2", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "index.html", "logo-ngang-toi.png", "logo-ngang.png", "manifest.webmanifest", "og-image.png"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('Precache failed for:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML navigation hoặc trang index -> NETWORK FIRST (timeout 3 giây dự phòng cho mạng yếu)
  const isHtml = req.mode === 'navigate' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/') ||
                 url.pathname === '';

  if (isHtml) {
    const networkFetch = fetch(req).then((resp) => {
      if (resp && resp.status === 200) {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      }
      return resp;
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout (3s)')), 3000)
    );

    event.respondWith(
      Promise.race([networkFetch, timeoutPromise]).catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const fallback = await caches.match('index.html');
        if (fallback) return fallback;
        const rootFallback = await caches.match('./');
        if (rootFallback) return rootFallback;
        const slashFallback = await caches.match('/');
        if (slashFallback) return slashFallback;
        // Nếu lần đầu mở chưa có cache: tiếp tục chờ networkFetch thật sự
        return networkFetch;
      })
    );
    return;
  }

  // Tài nguyên tĩnh (font, icon, manifest) -> CACHE FIRST
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return resp;
      });
    })
  );
});
