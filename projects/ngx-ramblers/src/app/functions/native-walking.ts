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
      const httpsOrigin = site.protocol === "https:" && !site.username && !site.password && !site.search && !site.hash
        && (site.pathname === "/" || site.pathname === "");
      origin = httpsOrigin ? site.origin : null;
    } catch {
      origin = null;
    }
  }
  return origin;
}

export function nativeWalkingSite(): string | null {
  const baked = parseHttpsOrigin((window as NativeWalkingWindow).ngxNativeSiteUrl || "");
  let origin: string | null = null;
  if (Capacitor.isNativePlatform()) {
    try {
      const stored = window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN);
      origin = stored === "" ? null : parseHttpsOrigin(stored || "") || baked;
    } catch {
      origin = baked;
    }
  }
  return origin;
}

export function nativeWalkingStorageKey(key: string): string {
  const site = nativeWalkingSite();
  return site ? `${key}:${site}` : key;
}

export function saveNativeWalkingSite(origin: string | null): void {
  if (origin) {
    window.localStorage.setItem(StoredValue.APP_SITE_ORIGIN, origin);
  } else {
    window.localStorage.setItem(StoredValue.APP_SITE_ORIGIN, "");
  }
}

export function nativeApiUrl(url: string, site = nativeWalkingSite()): string {
  const directoryRequest = /^\/?api\/(?:areas\/available-areas|ramblers\/walks-manager\/list-groups)$/.test(url);
  const directory = Capacitor.isNativePlatform() && directoryRequest
    ? parseHttpsOrigin((window as NativeWalkingWindow).ngxNativeDirectoryUrl || "") : null;
  const origin = site || directory;
  return origin && /^\/?api(?:\/|\?|$)/.test(url) ? `${origin}/${url.replace(/^\//, "")}` : url;
}
