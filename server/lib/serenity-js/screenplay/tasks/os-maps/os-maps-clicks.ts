import type { Locator, Page } from "playwright-core";
import { DEFAULT_INTERACTION_TIMEOUT } from "../../../config/serenity-timeouts";

export function clickWithoutWaitingForNavigation(locator: Locator): Promise<void> {
  return locator.click({force: true, noWaitAfter: true});
}

export async function clickVisibleOsMapsElementViaScript(native: Page, selector: string): Promise<void> {
  await native.locator(selector).filter({visible: true}).first()
    .waitFor({state: "visible", timeout: DEFAULT_INTERACTION_TIMEOUT.inMilliseconds()});
  const clicked = await native.evaluate((cssSelector: string) => {
    const matches = Array.from(document.querySelectorAll<HTMLElement>(cssSelector));
    const element = matches.find(candidate => !!candidate.offsetParent);
    if (element) {
      element.click();
      return true;
    } else {
      return false;
    }
  }, selector);
  if (clicked) {
    return;
  } else {
    throw new Error(`No visible element found to click via script: ${selector}`);
  }
}
