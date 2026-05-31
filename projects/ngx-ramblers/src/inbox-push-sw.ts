/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

interface InboxPushPayload {
  title?: string;
  body?: string;
  threadId?: string;
}

sw.addEventListener("install", () => {
  void sw.skipWaiting();
});

sw.addEventListener("activate", event => {
  event.waitUntil(sw.clients.claim());
});

sw.addEventListener("push", event => {
  let payload: InboxPushPayload = {};
  try {
    payload = event.data ? event.data.json() as InboxPushPayload : {};
  } catch {
    payload = {title: "New inbox message", body: event.data ? event.data.text() : ""};
  }
  const title = payload.title || "New inbox message";
  const options: NotificationOptions = {
    body: payload.body || "",
    tag: payload.threadId ? "inbox-thread-" + payload.threadId : "inbox-message",
    data: payload,
    icon: "/favicon.ico",
    badge: "/favicon.ico"
  };
  event.waitUntil(sw.registration.showNotification(title, options));
});

sw.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = (event.notification.data as InboxPushPayload | null) || {};
  const url = data.threadId ? "/admin/inbox?thread=" + encodeURIComponent(data.threadId) : "/admin/inbox";
  event.waitUntil((async () => {
    const windowClients = await sw.clients.matchAll({type: "window", includeUncontrolled: true});
    const focusable = windowClients.find(client => client.url.includes("/admin/inbox"));
    if (focusable) {
      await focusable.focus();
      await focusable.navigate(url);
      return;
    }
    await sw.clients.openWindow(url);
  })());
});
