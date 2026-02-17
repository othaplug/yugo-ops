/* eslint-disable no-restricted-globals */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = { title: "OPS+", body: "You have a new notification" };
  try {
    data = event.data.json();
  } catch {
    data.body = event.data.text();
  }
  const options = {
    body: data.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: data.url || "/client" },
  };
  event.waitUntil(self.registration.showNotification(data.title || "OPS+", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/client";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(self.location.origin + (url.startsWith("/") ? url : "/" + url));
    })
  );
});
