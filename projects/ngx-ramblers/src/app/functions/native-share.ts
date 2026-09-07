import { isBrowser } from "es-toolkit";
import { isFunction } from "es-toolkit/compat";

export function nativeShareSupported(): boolean {
  return isBrowser() && isFunction(navigator.share);
}

function isAbort(error: unknown): boolean {
  return (error as DOMException)?.name === "AbortError";
}

export async function shareOrOpen(data: ShareData, fallbackUrl: string): Promise<void> {
  if (nativeShareSupported()) {
    try {
      await navigator.share(data);
    } catch (error) {
      if (!isAbort(error)) {
        window.open(fallbackUrl, "_blank", "noopener");
      }
    }
  } else {
    window.open(fallbackUrl, "_blank", "noopener");
  }
}
