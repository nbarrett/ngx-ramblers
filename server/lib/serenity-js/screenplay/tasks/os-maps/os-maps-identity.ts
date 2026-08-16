import type { Locator, Page as NativePage } from "playwright-core";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";
import { clearOsMapsInterruptions } from "./os-maps-page-cleanup";

export function osMapsIdentityHost(url: string): boolean {
  const hostname = new URL(url).hostname;
  return hostname.includes("b2clogin") || hostname.includes("microsoftonline") || hostname.includes("osinfra");
}

export function osMapsEmailField(page: NativePage): Locator {
  return page.locator("#signInName")
    .or(page.getByRole("textbox", {name: /email address/i}))
    .or(page.getByLabel(/email address/i));
}

export function osMapsPasswordField(page: NativePage): Locator {
  return page.locator("#password")
    .or(page.locator("input[type='password']:visible"))
    .or(page.getByLabel(/^password$/i));
}

export function osMapsLoginSubmit(page: NativePage): Locator {
  return page.locator("#next")
    .or(page.locator("form button[type='submit']"))
    .or(page.getByRole("button", {name: /^log in$/i}));
}

export async function osMapsIdentityErrorText(page: NativePage): Promise<string> {
  const locator = page.locator(".error.pageLevel p, .error.pageLevel, #claimVerificationServerError, .error.itemLevel p, .error.itemLevel, #password-error, #signInName-error");
  const texts = await locator.allInnerTexts().catch(() => [] as string[]);
  return texts.map(text => text.trim()).filter(text => text.length > 0).join("; ");
}

export async function pageShowingOsMapsIdentity(native: NativePage): Promise<NativePage | null> {
  const matches = await Promise.all(native.context().pages().map(async page => {
    const onIdentityHost = osMapsIdentityHost(page.url());
    const formVisible = await osMapsEmailField(page).first().isVisible().catch(() => false);
    if (onIdentityHost || formVisible) {
      return page;
    } else {
      return null;
    }
  }));
  return matches.find(page => !!page) || null;
}

export async function waitForOsMapsApplicationReady(native: NativePage, timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds()): Promise<void> {
  await native.locator(".header__right button").first().waitFor({state: "attached", timeout}).catch(() => null);
  await native.locator(".header__right .loading-indicator").waitFor({state: "hidden", timeout}).catch(() => null);
  await native.locator(".side-panel .loading-indicator").waitFor({state: "hidden", timeout}).catch(() => null);
}

export function osMapsSignedInHeader(page: NativePage): Locator {
  return page.locator(".header__right button[aria-label='Go to my account']")
    .or(page.locator(".header__right button[aria-label='Log Out']"))
    .or(page.locator(".header__right button[aria-label='My Account']"));
}

export async function osMapsSessionIsSignedIn(native: NativePage): Promise<boolean> {
  if (await native.locator(".header__right .loading-indicator").isVisible().catch(() => false)) {
    return false;
  } else if (await osMapsSignedInHeader(native).first().isVisible().catch(() => false)) {
    return true;
  } else {
    const signedOut = native.locator(".header__right button[aria-label='Log in']");
    return !(await signedOut.isVisible().catch(() => false));
  }
}

export async function waitForOsMapsIdentityForm(page: NativePage, timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds()): Promise<void> {
  await clearOsMapsInterruptions(page);
  await osMapsEmailField(page).first().waitFor({state: "visible", timeout});
  await osMapsPasswordField(page).first().waitFor({state: "visible", timeout});
  await osMapsLoginSubmit(page).first().waitFor({state: "visible", timeout});
  await clearOsMapsInterruptions(page);
}

export async function fillOsMapsIdentityField(page: NativePage, field: Locator, value: string, timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds()): Promise<void> {
  const target = field.first();
  await target.waitFor({state: "visible", timeout});
  await target.scrollIntoViewIfNeeded();
  await target.click({force: true});
  await target.fill("");
  await target.fill(value);
  const afterFill = await target.inputValue();
  if (afterFill !== value) {
    await target.click({force: true});
    await target.press("ControlOrMeta+A");
    await target.pressSequentially(value, {delay: 15});
  }
  const afterType = await target.inputValue();
  if (afterType !== value) {
    await target.evaluate((el: HTMLInputElement, nextValue: string) => {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      if (proto && proto.set) {
        proto.set.call(el, nextValue);
      } else {
        el.value = nextValue;
      }
      el.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertText", data: nextValue}));
      el.dispatchEvent(new Event("change", {bubbles: true}));
    }, value);
  }
  const confirmed = await target.inputValue();
  if (confirmed !== value) {
    throw new Error(`OS Maps identity field did not keep the entered value (length ${confirmed.length} vs ${value.length})`);
  }
}

export async function waitForOsMapsSignedIn(native: NativePage, timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds()): Promise<void> {
  await waitForOsMapsApplicationReady(native, timeout);
  await osMapsSignedInHeader(native).first().waitFor({state: "visible", timeout});
}

export async function submitOsMapsIdentityForm(page: NativePage, timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds()): Promise<void> {
  await clearOsMapsInterruptions(page);
  const emailValue = await osMapsEmailField(page).first().inputValue().catch(() => "");
  const passwordLength = await osMapsPasswordField(page).first().inputValue().then(value => value.length).catch(() => 0);
  const exploreWait = Math.min(30000, timeout);
  await osMapsPasswordField(page).first().press("Enter");
  const leftIdentity = await page.waitForURL(url => url.hostname === "explore.osmaps.com", {timeout: exploreWait}).then(() => true).catch(() => false);
  if (!leftIdentity) {
    const rejected = await osMapsIdentityErrorText(page);
    if (rejected) {
      throw new Error(`OS Maps login was rejected: ${rejected}`);
    } else {
      await clearOsMapsInterruptions(page);
      await osMapsLoginSubmit(page).first().click();
      const leftAfterClick = await page.waitForURL(url => url.hostname === "explore.osmaps.com", {timeout: exploreWait}).then(() => true).catch(() => false);
      if (!leftAfterClick) {
        const rejectedAgain = await osMapsIdentityErrorText(page);
        if (rejectedAgain) {
          throw new Error(`OS Maps login was rejected: ${rejectedAgain}`);
        } else {
          throw new Error(`OS Maps login did not leave the identity page (still at ${page.url()}, email length ${emailValue.length}, password length ${passwordLength})`);
        }
      }
    }
  }
}

export async function clickOsMapsExploreLogin(native: NativePage, timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds()): Promise<void> {
  await clearOsMapsInterruptions(native);
  const headerLogin = native.locator(".header__right button[aria-label='Log in']");
  if (await headerLogin.isVisible({timeout: 5000}).catch(() => false)) {
    await headerLogin.click({force: true});
  } else {
    const roleLogin = native.getByRole("button", {name: /^log in$/i});
    await roleLogin.waitFor({state: "visible", timeout});
    await roleLogin.click({force: true});
  }
}
