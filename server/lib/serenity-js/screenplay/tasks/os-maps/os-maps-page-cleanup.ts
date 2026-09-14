import debug from "debug";
import type { Page as NativePage } from "playwright-core";
import { OsMapsSweepSelectors } from "../../../../models/os-maps-identity.model";
import { envConfig } from "../../../../env-config/env-config";
import { pluraliseWithCount } from "../../../../shared/string-utils";

const debugLog = debug(envConfig.logNamespace("os-maps-page-cleanup"));
debugLog.enabled = true;

const SWEEP: OsMapsSweepSelectors = {
  cookieAccept: "#ccc-notify-accept",
  marketingDismissPattern: "not right now|no thanks|maybe later|close popup",
  overlayIds: ["ccc-overlay", "ccc", "global-spinner-container"],
  overlaySelectors: ".QSIWebResponsive, [class*='QSIWebResponsive']",
  suppressionStyleId: "ngx-os-maps-overlay-suppress",
  suppressionStyle: "#ccc,#ccc-overlay,#global-spinner-container,.QSIWebResponsive,[class*='QSIWebResponsive']{display:none!important;visibility:hidden!important;pointer-events:none!important;}"
};

export async function removeOsMapsBlockingOverlays(native: NativePage): Promise<void> {
  await native.evaluate((selectors: OsMapsSweepSelectors) => {
    selectors.overlayIds.forEach(id => document.getElementById(id)?.remove());
    document.querySelectorAll(selectors.overlaySelectors).forEach(node => node.remove());
    if (!document.getElementById(selectors.suppressionStyleId)) {
      const style = document.createElement("style");
      style.id = selectors.suppressionStyleId;
      style.textContent = selectors.suppressionStyle;
      document.head.appendChild(style);
    }
  }, SWEEP);
}

export async function clearOsMapsInterruptions(native: NativePage): Promise<number> {
  const dismissed = await sweepOsMapsInterruptions(native);
  if (dismissed === 0) {
    return dismissed;
  } else {
    const stacked = await sweepOsMapsInterruptions(native);
    debugLog(`dismissed ${pluraliseWithCount(dismissed, "interruption")}, and ${stacked} more stacked behind them`);
    return dismissed + stacked;
  }
}

function sweepOsMapsInterruptions(native: NativePage): Promise<number> {
  return native.evaluate((selectors: OsMapsSweepSelectors) => {
    const visible = (element: HTMLElement) => !!element.offsetParent;
    const cookieAccept = document.querySelector<HTMLElement>(selectors.cookieAccept)
      || Array.from(document.querySelectorAll<HTMLElement>("button, [role='button']"))
        .find(element => (element.textContent || "").trim().toLowerCase() === "accept" && visible(element));
    const marketing = new RegExp(selectors.marketingDismissPattern, "i");
    const marketingDismissals = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], a"))
      .filter(element => marketing.test(`${element.textContent || ""} ${element.getAttribute("aria-label") || ""}`.trim()) && visible(element));
    cookieAccept?.click();
    marketingDismissals.forEach(element => element.click());
    selectors.overlayIds.forEach(id => document.getElementById(id)?.remove());
    document.querySelectorAll(selectors.overlaySelectors).forEach(node => node.remove());
    if (!document.getElementById(selectors.suppressionStyleId)) {
      const style = document.createElement("style");
      style.id = selectors.suppressionStyleId;
      style.textContent = selectors.suppressionStyle;
      document.head.appendChild(style);
    }
    return (cookieAccept ? 1 : 0) + marketingDismissals.length;
  }, SWEEP);
}
