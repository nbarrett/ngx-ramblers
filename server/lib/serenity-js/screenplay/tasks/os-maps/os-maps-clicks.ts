import type { Locator } from "playwright-core";

export function clickWithoutWaitingForNavigation(locator: Locator): Promise<void> {
  return locator.click({force: true, noWaitAfter: true});
}
