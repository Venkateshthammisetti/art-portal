self.addEventListener("push", e => {
  const data = e.data.json();

  const options = {
    body: data.body,
    icon: "/new-logo1.png",
    badge: "/new-logo.png",
    data: { url: data.url },
    // tag: replaces any existing notification with the same tag (prevents clutter)
    tag: data.tag || "art-portal-notif",
    // requireInteraction: keeps the notification on screen until user acts on it
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const targetUrl = e.notification.data.url || "https://art-portal.netlify.app";

  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(windowClients => {
        // If the app is already open in any tab, focus it
        for (const client of windowClients) {
          if ("focus" in client) {
            client.focus();
            return;
          }
        }
        // Otherwise open a new window
        return clients.openWindow(targetUrl);
      })
  );
});
