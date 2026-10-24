import { Capacitor } from "@capacitor/core";
import { NativeWalkingWindow } from "../models/native-route.model";
import { StoredValue } from "../models/ui-actions";

export function parseHttpsOrigin(value: string): string | null {
  const trimmed = (value || "").trim();
  let origin: string | null = null;
  if (trimmed) {
    try {
      const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const site = new URL(withProtocol);
      const localHost = site.hostname === "localhost" || site.hostname === "127.0.0.1" || site.hostname === "10.0.2.2";
      const httpsOrigin = site.protocol === "https:" && !localHost && !site.username && !site.password && !site.search && !site.hash
        && (site.pathname === "/" || site.pathname === "");
      const localHttpOrigin = site.protocol === "http:" && localHost && !site.username && !site.password && !site.search && !site.hash
        && (site.pathname === "/" || site.pathname === "");
      origin = httpsOrigin || localHttpOrigin ? site.origin : null;
    } catch {
      origin = null;
    }
  }
  return origin;
}

export function nativeBuildLabel(): string | null {
  const build = (window as NativeWalkingWindow).ngxNativeBuildNumber?.trim();
  if (build) {
    return `Build ${build}`;
  } else {
    return null;
  }
}

export function isNativeLocalShell(): boolean {
  const host = window.location.hostname;
  const localHost = host === "localhost" || host === "127.0.0.1";
  return window.location.protocol === "capacitor:"
    || (localHost && window.location.port !== "4200");
}

export function nativeLocalShellUrl(): string {
  const origin = window.location.protocol === "capacitor:" || Capacitor.getPlatform() === "ios"
    ? "capacitor://localhost"
    : "https://localhost";
  return `${origin}/app`;
}

export function nativeWalkingSite(): string | null {
  const baked = parseHttpsOrigin((window as NativeWalkingWindow).ngxNativeSiteUrl || "");
  let origin: string | null = null;
  if (Capacitor.isNativePlatform()) {
    if (isNativeLocalShell()) {
      try {
        const stored = window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN);
        origin = stored === "" ? null : parseHttpsOrigin(stored || "") || baked;
      } catch {
        origin = baked;
      }
    } else {
      origin = parseHttpsOrigin(window.location.origin);
    }
  }
  return origin;
}

export function openNativeGroupApp(origin: string): void {
  window.location.assign(`${origin}/app`);
}

export function returnNativeShell(): void {
  window.location.assign(nativeLocalShellUrl());
}

export function nativeWalkingStorageKey(key: string): string {
  const site = nativeWalkingSite();
  return site ? `${key}:${site}` : key;
}

export function reloadNativeShell(): void {
  const root = `${window.location.origin}/`;
  if (window.location.pathname === "/" || window.location.pathname === "/index.html") {
    window.location.reload();
  } else {
    window.location.replace(root);
  }
}

export function saveNativeWalkingSite(origin: string | null): void {
  if (origin) {
    window.localStorage.setItem(StoredValue.APP_SITE_ORIGIN, origin);
  } else {
    window.localStorage.setItem(StoredValue.APP_SITE_ORIGIN, "");
  }

}

function apiPathFrom(url: string): string | null {
  let path: string | null = null;
  if (/^\/?api(?:\/|\?|$)/.test(url)) {
    path = url.startsWith("/") ? url : `/${url}`;
  } else {
    try {
      const parsed = new URL(url);
      if ((parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") && /^\/api(?:\/|\?|$)/.test(parsed.pathname)) {
        path = `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      path = null;
    }
  }
  return path;
}

export function nativeApiUrl(url: string, site = nativeWalkingSite()): string {
  const apiPath = apiPathFrom(url);
  const directoryRequest = !!apiPath && /^\/api\/(?:areas\/available-areas|ramblers\/walks-manager\/list-groups)$/.test(apiPath);
  const directory = Capacitor.isNativePlatform() && directoryRequest
    ? parseHttpsOrigin((window as NativeWalkingWindow).ngxNativeDirectoryUrl || "") : null;
  const origin = site || directory;
  return origin && apiPath ? `${origin}${apiPath}` : url;
}
