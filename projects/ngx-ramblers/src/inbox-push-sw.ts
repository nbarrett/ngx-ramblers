/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

interface InboxPushPayload {
  title?: string;
  body?: string;
  threadId?: string;
  url?: string;
}

const FOLLOW_SHELL = "follow-shell-v2";
const FOLLOW_TILES = "follow-tiles-v3";
const OS_TILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
    } else if (isOsTile(url)) {
      event.respondWith(osTile(request));
    } else if (isFollowTile(url)) {
      event.respondWith(cacheFirst(request, FOLLOW_TILES));
    } else if (url.origin === sw.location.origin && isFollowAsset(url.pathname)) {
      event.respondWith(cacheFirst(request, FOLLOW_SHELL));
    }
  }
});

function isOsTile(url: URL): boolean {
  return url.pathname.startsWith("/api/os-maps/tiles/");
}

function isFollowTile(url: URL): boolean {
  return url.hostname.endsWith("tile.openstreetmap.org");
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

function clockMs(): number {
  return self.performance.timeOrigin + self.performance.now();
}

function cachedAtMs(response: Response): number {
  const stamped = Number(response.headers.get("x-sw-cached-at"));
  if (stamped > 0) {
    return stamped;
  } else {
    const dateHeader = Date.parse(response.headers.get("date") || "");
    return Number.isFinite(dateHeader) ? dateHeader : 0;
  }
}

async function osTile(request: Request): Promise<Response> {
  const cache = await caches.open(FOLLOW_TILES);
  const cached = await cache.match(request);
  const now = clockMs();
  if (cached && now - cachedAtMs(cached) < OS_TILE_MAX_AGE_MS) {
    return cached;
  } else {
    try {
      const fresh = await fetch(request);
      if (fresh.ok) {
        const headers = new Headers(fresh.headers);
        headers.set("x-sw-cached-at", String(now));
        const stamped = new Response(fresh.clone().body, {status: fresh.status, statusText: fresh.statusText, headers});
        await cache.put(request, stamped);
      }
      return fresh;
    } catch {
      return cached || new Response("Map tile unavailable", {status: 504});
    }
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
