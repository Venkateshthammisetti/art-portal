// Art Portal Service Worker
// Handles background push notifications from the server.

const APP_ORIGIN = 'https://art-portal.netlify.app';

self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();

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
          return appTab.focus();
        }

        // Otherwise open a fresh tab pointing at the app
        return clients.openWindow(targetUrl);
      })
  );
});
