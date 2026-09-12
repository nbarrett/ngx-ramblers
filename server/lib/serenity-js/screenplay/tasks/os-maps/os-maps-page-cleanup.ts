import debug from "debug";
import type { Page as NativePage } from "playwright-core";
import { UK_CENTRE_GEOLOCATION } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { envConfig } from "../../../../env-config/env-config";
import { dateTimeNowAsValue } from "../../../../shared/dates";

const debugLog = debug(envConfig.logNamespace("os-maps-page-cleanup"));
debugLog.enabled = true;

const SLOW_SWEEP_MILLIS = 3000;

async function timed<T>(name: string, action: () => Promise<T>): Promise<T> {
  const startedAt = dateTimeNowAsValue();
  const outcome = await action();
  debugLog(`${name} took ${dateTimeNowAsValue() - startedAt}ms`);
  return outcome;
}

const MARKETING_DISMISS_BUTTON_NAMES = [
  /not right now/i,
  /no thanks/i,
  /maybe later/i,
  /close popup/i
];

export async function allowOsMapsGeolocation(native: NativePage): Promise<void> {
  await native.context().grantPermissions(["geolocation"]);
  await native.context().setGeolocation(UK_CENTRE_GEOLOCATION);
}

async function clickIfVisible(native: NativePage, locator: ReturnType<NativePage["getByRole"]>): Promise<boolean> {
  if (await locator.first().isVisible().catch(() => false)) {
    await locator.first().click({force: true}).catch(() => null);
    return true;
  } else {
    return false;
  }
}

export async function acceptOsMapsCookieBanner(native: NativePage): Promise<boolean> {
  const accept = native.locator("#ccc-notify-accept").or(native.getByRole("button", {name: /^accept$/i}));
  if (await timed("cookie banner visibility check", () => accept.first().isVisible({timeout: 8000}).catch(() => false))) {
    await timed("cookie banner click", () => accept.first().click({force: true}).catch(() => null));
    await timed("cookie banner hidden wait", () => native.locator("#ccc-notify, #ccc-overlay, #ccc").first()
      .waitFor({state: "hidden", timeout: 8000})
      .catch(() => null));
    return true;
  } else {
    return false;
  }
}

export async function dismissOsMapsMarketingPopups(native: NativePage): Promise<boolean> {
  const dismissed = await MARKETING_DISMISS_BUTTON_NAMES.reduce(async (previous, name) => {
    const previouslyDismissed = await previous;
    const justDismissed = await clickIfVisible(native, native.getByRole("button", {name}));
    return previouslyDismissed || justDismissed;
  }, Promise.resolve(false));
  const newMapTypeDialog = native.getByRole("dialog", {name: /new map type/i});
  if (await newMapTypeDialog.isVisible().catch(() => false)) {
    const dialogDismissed = await clickIfVisible(native, newMapTypeDialog.getByRole("button", {name: /not right now|close/i}));
    return dismissed || dialogDismissed;
  } else {
    return dismissed;
  }
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
  const cookieBannerFound = await acceptOsMapsCookieBanner(native);
  const popupsFound = await timed("marketing popups", () => dismissOsMapsMarketingPopups(native));
  await timed("overlay removal", () => removeOsMapsBlockingOverlays(native));
  if (cookieBannerFound || popupsFound) {
    debugLog("something was dismissed on the first pass, sweeping again");
    await acceptOsMapsCookieBanner(native);
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
