import { Capacitor } from "@capacitor/core";
import { NativeWalkingWindow } from "../models/native-route.model";

export function nativeWalkingSite(): string | null {
  const site = (window as NativeWalkingWindow).ngxNativeSiteUrl;
  return Capacitor.isNativePlatform() && site ? site : null;
}

export function nativeApiUrl(url: string, site = nativeWalkingSite()): string {
  return site && /^\/?api(?:\/|\?|$)/.test(url) ? `${site}/${url.replace(/^\//, "")}` : url;
}
