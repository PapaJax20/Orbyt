const CACHE_NAME = 'orbyt-v1';
const SHELL_ASSETS = [
  '/',
  '/login',
  '/dashboard',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});

// ── Push Notifications ──────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Orbyt', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      data: { route: data.data?.route || '/dashboard' },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const route = event.notification.data?.route || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(route);
          return client.focus();
        }
      }
      // Otherwise open new tab
      return clients.openWindow(route);
    })
  );
});
