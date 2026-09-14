import debug from "debug";
import type { Page as NativePage } from "playwright-core";
import { UK_CENTRE_GEOLOCATION } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { envConfig } from "../../../../env-config/env-config";
import { dateTimeNowAsValue } from "../../../../shared/dates";

const debugLog = debug(envConfig.logNamespace("os-maps-page-cleanup"));
debugLog.enabled = true;

const SLOW_SWEEP_MILLIS = 3000;

export async function timedPhase<T>(name: string, action: () => Promise<T>): Promise<T> {
  return timed(name, action);
}

async function timed<T>(name: string, action: () => Promise<T>): Promise<T> {
  const startedAt = dateTimeNowAsValue();
  const outcome = await action();
  debugLog(`${name} took ${dateTimeNowAsValue() - startedAt}ms`);
  return outcome;
}

const MARKETING_DISMISS_BUTTON_PATTERN = "not right now|no thanks|maybe later|close popup";
const COOKIE_ACCEPT_SELECTOR = "#ccc-notify-accept";

export async function allowOsMapsGeolocation(native: NativePage): Promise<void> {
  await native.context().grantPermissions(["geolocation"]);
  await native.context().setGeolocation(UK_CENTRE_GEOLOCATION);
}

export async function acceptOsMapsCookieBanner(native: NativePage): Promise<boolean> {
  return await native.evaluate((selector: string) => {
    const byId = document.querySelector(selector) as HTMLElement;
    const accept = byId || (Array.from(document.querySelectorAll("button, [role='button']")) as HTMLElement[])
      .find(element => (element.textContent || "").trim().toLowerCase() === "accept" && !!element.offsetParent);
    if (accept) {
      accept.click();
      return true;
    } else {
      return false;
    }
  }, COOKIE_ACCEPT_SELECTOR).catch(() => false);
}

export async function dismissOsMapsMarketingPopups(native: NativePage): Promise<boolean> {
  return await native.evaluate((pattern: string) => {
    const matcher = new RegExp(pattern, "i");
    const clickable = Array.from(document.querySelectorAll("button, [role='button'], a")) as HTMLElement[];
    const dismissals = clickable.filter(element => {
      const label = `${element.textContent || ""} ${element.getAttribute("aria-label") || ""}`.trim();
      return matcher.test(label) && !!element.offsetParent;
    });
    dismissals.forEach(element => element.click());
    return dismissals.length > 0;
  }, MARKETING_DISMISS_BUTTON_PATTERN).catch(() => false);
}

export async function removeOsMapsBlockingOverlays(native: NativePage): Promise<void> {
  await native.evaluate(() => {
    ["ccc-overlay", "ccc", "global-spinner-container"].forEach(id => {
      const node = document.getElementById(id);
      if (node) {
        node.remove();
      }
    });
    document.querySelectorAll(".QSIWebResponsive, [class*='QSIWebResponsive']").forEach(node => node.remove());
    const styleId = "ngx-os-maps-overlay-suppress";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = "#ccc,#ccc-overlay,#global-spinner-container,.QSIWebResponsive,[class*='QSIWebResponsive']{display:none!important;visibility:hidden!important;pointer-events:none!important;}";
      document.head.appendChild(style);
    }
  });
}

export async function clearOsMapsInterruptions(native: NativePage): Promise<void> {
  const startedAt = dateTimeNowAsValue();
  await timed("geolocation permission", () => allowOsMapsGeolocation(native));
  const cookieBannerFound = await timed("cookie banner", () => acceptOsMapsCookieBanner(native));
  const popupsFound = await timed("marketing popups", () => dismissOsMapsMarketingPopups(native));
  await timed("overlay removal", () => removeOsMapsBlockingOverlays(native));
  if (cookieBannerFound || popupsFound) {
    debugLog("something was dismissed on the first pass, sweeping again");
    await timed("cookie banner (second pass)", () => acceptOsMapsCookieBanner(native));
    await timed("marketing popups (second pass)", () => dismissOsMapsMarketingPopups(native));
    await timed("overlay removal (second pass)", () => removeOsMapsBlockingOverlays(native));
  }
  const elapsed = dateTimeNowAsValue() - startedAt;
  debugLog(`clearOsMapsInterruptions took ${elapsed}ms`);
  if (elapsed > SLOW_SWEEP_MILLIS) {
    await reportOsMapsPageCost(native);
  }
}

export async function reportOsMapsPageCost(native: NativePage): Promise<void> {
  const cost = await native.evaluate(() => {
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const timing = performance.timing;
    return {
      readyState: document.readyState,
      domNodes: document.getElementsByTagName("*").length,
      requests: resources.length,
      transferredKb: Math.round(resources.reduce((total, resource) => total + (resource.transferSize || 0), 0) / 1024),
      slowestRequests: resources
        .slice()
        .sort((first, second) => second.duration - first.duration)
        .slice(0, 5)
        .map(resource => `${Math.round(resource.duration)}ms ${new URL(resource.name).host}${new URL(resource.name).pathname.slice(0, 40)}`),
      domContentLoadedMs: timing.domContentLoadedEventEnd ? timing.domContentLoadedEventEnd - timing.navigationStart : null,
      loadEventMs: timing.loadEventEnd ? timing.loadEventEnd - timing.navigationStart : null
    };
  }).catch(() => null);
  if (cost) {
    debugLog(`page cost: ${JSON.stringify(cost)}`);
  }
}
