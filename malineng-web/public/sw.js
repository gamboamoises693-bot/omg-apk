/* Barangay Malineng service worker.
 * 1. Lets the phone offer "Install app" (browsers require a service worker with a fetch handler).
 * 2. Shows notifications (Android Chrome requires a service worker for that).
 * It does NOT cache anything: the fetch handler does nothing, so every page is always fresh after a deploy. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Required for installability. No respondWith(): the browser handles every request normally.
self.addEventListener("fetch", () => {});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/admin/#ambulansya";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
