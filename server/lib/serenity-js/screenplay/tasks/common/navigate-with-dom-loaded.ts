import debug from "debug";
import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { envConfig } from "../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("navigate-with-dom-loaded"));
debugLog.enabled = true;

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
