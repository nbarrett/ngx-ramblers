import type { Page as NativePage } from "playwright-core";

const MARKETING_DISMISS_BUTTON_NAMES = [
  /not right now/i,
  /no thanks/i,
  /maybe later/i,
  /close popup/i
];

const OS_MAPS_GEOLOCATION = {latitude: 51.2787, longitude: 1.0804};

export async function allowOsMapsGeolocation(native: NativePage): Promise<void> {
  await native.context().grantPermissions(["geolocation"]);
  await native.context().setGeolocation(OS_MAPS_GEOLOCATION);
}

async function clickIfVisible(native: NativePage, locator: ReturnType<NativePage["getByRole"]>): Promise<void> {
  if (await locator.first().isVisible().catch(() => false)) {
    await locator.first().click({force: true}).catch(() => null);
  }
}

export async function acceptOsMapsCookieBanner(native: NativePage): Promise<void> {
  const accept = native.locator("#ccc-notify-accept").or(native.getByRole("button", {name: /^accept$/i}));
  if (await accept.first().isVisible({timeout: 8000}).catch(() => false)) {
    await accept.first().click({force: true}).catch(() => null);
    await native.locator("#ccc-notify, #ccc-overlay, #ccc").first()
      .waitFor({state: "hidden", timeout: 8000})
      .catch(() => null);
  }
}

export async function dismissOsMapsMarketingPopups(native: NativePage): Promise<void> {
  await MARKETING_DISMISS_BUTTON_NAMES.reduce(async (previous, name) => {
    await previous;
    await clickIfVisible(native, native.getByRole("button", {name}));
  }, Promise.resolve());
  const newMapTypeDialog = native.getByRole("dialog", {name: /new map type/i});
  if (await newMapTypeDialog.isVisible().catch(() => false)) {
    await clickIfVisible(native, newMapTypeDialog.getByRole("button", {name: /not right now|close/i}));
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
  await allowOsMapsGeolocation(native);
  await acceptOsMapsCookieBanner(native);
  await dismissOsMapsMarketingPopups(native);
  await removeOsMapsBlockingOverlays(native);
  await acceptOsMapsCookieBanner(native);
  await dismissOsMapsMarketingPopups(native);
  await removeOsMapsBlockingOverlays(native);
}
