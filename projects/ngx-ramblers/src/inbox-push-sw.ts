/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

interface InboxPushPayload {
  title?: string;
  body?: string;
  threadId?: string;
  url?: string;
}

const FOLLOW_SHELL = "follow-shell-v2";
const FOLLOW_TILES = "follow-tiles-v2";

sw.addEventListener("install", () => {
  void sw.skipWaiting();
});

sw.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keep = [FOLLOW_SHELL, FOLLOW_TILES];
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("follow-") && !keep.includes(key))
      .map(key => caches.delete(key)));
    await sw.clients.claim();
  })());
});

sw.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method === "GET") {
    const url = new URL(request.url);
    if (request.mode === "navigate" && (url.pathname === "/app" || url.pathname.startsWith("/app/"))) {
      event.respondWith(networkThenShell(request));
    } else if (isFollowTile(url)) {
      event.respondWith(cacheFirst(request, FOLLOW_TILES));
    } else if (url.origin === sw.location.origin && isFollowAsset(url.pathname)) {
      event.respondWith(cacheFirst(request, FOLLOW_SHELL));
    }
  }
});

function isFollowTile(url: URL): boolean {
  return url.pathname.startsWith("/api/os-maps/tiles/") || url.hostname.endsWith("tile.openstreetmap.org");
}

function isFollowAsset(pathname: string): boolean {
  return pathname === "/manifest.webmanifest"
    || pathname === "/favicon.svg"
    || pathname === "/favicon.ico"
    || pathname.startsWith("/assets/images/local/pwa-")
    || pathname === "/assets/images/local/apple-touch-icon.png";
}

async function networkThenShell(request: Request): Promise<Response> {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(FOLLOW_SHELL);
    await cache.put("/app", fresh.clone());
    return fresh;
  } catch {
    const cache = await caches.open(FOLLOW_SHELL);
    const cached = await cache.match("/app") || await cache.match("/") || await cache.match(request);
    return cached || new Response("This walking app is not available offline yet. Open it once while connected, then try again.", {
      status: 503,
      headers: {"Content-Type": "text/plain; charset=utf-8"}
    });
  }
}

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  } else {
    const fresh = await fetch(request);
    if (fresh.ok) {
      await cache.put(request, fresh.clone());
    }
    return fresh;
  }
}

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
  const url = data.url || (data.threadId ? "/admin/inbox?thread=" + encodeURIComponent(data.threadId) : "/admin/inbox");
  const focusMatch = data.url ? data.url.split("?")[0] : "/admin/inbox";
  event.waitUntil((async () => {
    const windowClients = await sw.clients.matchAll({type: "window", includeUncontrolled: true});
    const focusable = windowClients.find(client => client.url.includes(focusMatch));
    if (focusable) {
      await focusable.focus();
      await focusable.navigate(url);
      return;
    }
    await sw.clients.openWindow(url);
  })());
});
