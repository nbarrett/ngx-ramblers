import debug from "debug";
import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { envConfig } from "../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("navigate-with-dom-loaded"));
debugLog.enabled = true;

// Serenity's Navigate.to uses Playwright's default waitUntil: "load", which requires every
// subresource (iframes, analytics, fonts) to finish. On fly's egress, one slow third-party can
// stall the whole navigation past the test-level timeout. This variant returns once the DOM is
// parsed; any downstream Wait.until(element, isVisible()) still guards on the elements we need.
export class NavigateWithDomLoaded extends Interaction {

  static to(url: string): NavigateWithDomLoaded {
    return new NavigateWithDomLoaded(url);
  }

  constructor(private readonly url: string) {
    super(`#actor navigates to ${ url } (waiting for DOMContentLoaded only)`);
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    debugLog("navigating to", this.url);
    await native.goto(this.url, { waitUntil: "domcontentloaded" });
  }

}
