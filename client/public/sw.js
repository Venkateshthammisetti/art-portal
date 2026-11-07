// Art Portal Service Worker
// Handles background push notifications from the server.

const APP_ORIGIN = 'https://art-portal.netlify.app';

// ---------------------------------------------------------------------------
// Offline support (parents): the app itself, the parent's own read-only data
// and artwork images are kept so Home, Schedule, Reports and Gallery still open
// without a connection. Everything is network-first except hashed static files
// and images, so updates and new data always win when online.
// ---------------------------------------------------------------------------
const SHELL = 'tva-shell-v1';
const DATA = 'tva-data-v1';
const IMAGES = 'tva-images-v1';
const API_HOST = 'art-portal-7n6r.onrender.com';
// GET endpoints safe to keep for offline reading (parent's own data)
const OFFLINE_API = [/\/api\/student\/[^/]+\/profile$/, /\/api\/feedback\/student\//, /\/api\/attendance\/student\//,
  /\/api\/gallery\/student\//, /\/api\/certifications\/student\//, /\/api\/class-notes\/student\//, /\/api\/spotlights$/];
const MAX_IMAGES = 150;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // the app page itself, so the next visit can open offline
  e.waitUntil(caches.open(SHELL).then((c) => c.add(new Request('/', { cache: 'reload' }))).catch(() => {}));
});

// The page lists the app files it already loaded before this worker took
// control (first visit), so they are saved for offline use too.
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache-app-files' || !Array.isArray(e.data.urls)) return;
  const urls = e.data.urls.filter((u) => { try { const x = new URL(u); return x.origin === self.location.origin && !x.pathname.startsWith('/sockjs') && !x.pathname.includes('hot-update'); } catch { return false; } }).slice(0, 60);
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all(urls.map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => {}))))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [SHELL, DATA, IMAGES];
    for (const k of await caches.keys()) if (k.startsWith('tva-') && !keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const tellPages = (msg) => self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  .then((list) => list.forEach((c) => c.postMessage(msg))).catch(() => {});

const networkFirst = async (req, cacheName, { offlineNotice = false } = {}) => {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreVary: true });
    if (hit) {
      if (offlineNotice) tellPages({ type: 'offline-data' });
      return hit;
    }
    throw err;
  }
};

const trim = async (name, max) => {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]); // oldest first
};
const trimImages = () => trim(IMAGES, MAX_IMAGES);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // never touch writes
  const url = new URL(req.url);

  // the app page: network first, saved copy when offline
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    e.respondWith(networkFirst(req, SHELL).catch(() => caches.match('/', { cacheName: SHELL })));
    return;
  }
  // built JS/CSS/fonts/images of the app (file names change each release)
  if (url.origin === self.location.origin && (url.pathname.startsWith('/static/') || /\.(png|jpg|svg|ico|webp|json)$/.test(url.pathname))) {
    e.respondWith(caches.open(SHELL).then(async (cache) => {
      const hit = await cache.match(req);
      const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()).then(() => trim(SHELL, 80)).catch(() => {}); return res; });
      return hit || fresh;
    }));
    return;
  }
  // the parent's own data
  if (url.hostname === API_HOST && OFFLINE_API.some((re) => re.test(url.pathname))) {
    e.respondWith(networkFirst(req, DATA, { offlineNotice: true }));
    return;
  }
  // artwork / poster images
  if (url.hostname === 'res.cloudinary.com' && req.destination === 'image') {
    e.respondWith(caches.open(IMAGES).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') { cache.put(req, res.clone()).then(trimImages).catch(() => {}); }
      return res;
    }));
  }
});

self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();

  // Let open tabs refresh their notification bell right away
  self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(list => list.forEach(c => c.postMessage({ type: 'push-received', tag: data.tag || '' })))
    .catch(() => {});

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:              data.body,
      icon:              '/new-logo1.png',
      badge:             '/new-logo.png',
      image:             data.image             || undefined,
      tag:               data.tag               || 'art-portal-notif',
      requireInteraction: data.requireInteraction || false,
      vibrate:           [200, 100, 200],
      data:              { url: data.url || APP_ORIGIN, spotlightId: data.spotlightId || null },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || APP_ORIGIN;

  e.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Focus an already-open tab of our app if one exists
        const appTab = windowClients.find(
          c => c.url.startsWith(APP_ORIGIN) || c.url.startsWith('http://localhost')
        );
        if (appTab) {
          // Ask the open page to show the spotlight poster it was notified about
          const spotlightId = e.notification.data?.spotlightId;
          if (spotlightId) appTab.postMessage({ type: 'open-spotlight', id: spotlightId });
          // ...or switch it to the tab the notification is about (#reports, #fees, …)
          else if (targetUrl.includes('#')) appTab.postMessage({ type: 'navigate', hash: targetUrl.split('#')[1] });
          return appTab.focus();
        }

        // Otherwise open a fresh tab pointing at the app
        return clients.openWindow(targetUrl);
      })
  );
});
