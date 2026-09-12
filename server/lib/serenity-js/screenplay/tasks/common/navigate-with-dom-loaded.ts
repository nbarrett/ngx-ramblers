import debug from "debug";
import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { envConfig } from "../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("navigate-with-dom-loaded"));
debugLog.enabled = true;

export class NavigateWithDomLoaded extends Interaction {

  static to(url: string, timeoutMs: number | null = null): NavigateWithDomLoaded {
    return new NavigateWithDomLoaded(url, timeoutMs);
  }

  constructor(private readonly url: string, private readonly timeoutMs: number | null = null) {
    super(`#actor navigates to ${ url } (waiting for DOMContentLoaded only)`);
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    const current = new URL(native.url());
    const target = new URL(this.url, native.url());
    if (current.origin === target.origin && current.pathname === target.pathname) {
      debugLog("already at", this.url);
    } else {
      debugLog("navigating to", this.url);
      const options = this.timeoutMs === null
        ? {waitUntil: "domcontentloaded" as const}
        : {waitUntil: "domcontentloaded" as const, timeout: this.timeoutMs};
      try {
        await native.goto(this.url, options);
      } catch (error) {
        const message = (error as Error).message || "";
        if (message.includes("ERR_ABORTED") || message.includes("frame was detached")) {
          debugLog("retrying navigation after abort", this.url);
          await native.goto(this.url, options);
        } else {
          throw error;
        }
      }
    }
  }

}
