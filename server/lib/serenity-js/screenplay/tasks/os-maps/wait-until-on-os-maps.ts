import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";
import { osMapsIdentityErrorText, osMapsIdentityHost, waitForOsMapsSignedIn } from "./os-maps-identity";

export class WaitUntilOnOsMaps extends Interaction {

  static site() {
    return new WaitUntilOnOsMaps();
  }

  constructor() {
    super("#actor waits until the OS Maps site has loaded");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    const timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds();
    try {
      await native.waitForURL(url => url.hostname === "explore.osmaps.com", {timeout});
    } catch (error) {
      const rejected = osMapsIdentityHost(native.url()) ? await osMapsIdentityErrorText(native) : "";
      if (rejected) {
        throw new Error(`OS Maps login was rejected: ${rejected}`);
      } else {
        throw new Error(`OS Maps login did not return to explore.osmaps.com (still at ${native.url()}): ${(error as Error).message}`);
      }
    }
    await waitForOsMapsSignedIn(native, timeout);
  }

}
