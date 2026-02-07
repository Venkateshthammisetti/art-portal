self.addEventListener("push", e => {
  const data = e.data.json();
  
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/new-logo1.png", // Make sure you have a logo icon in public folder
    badge: "/new-logo.png", // Small icon for status bar
    data: { url: data.url }
  });
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.openWindow(e.notification.data.url) // Opens the app
  );
});