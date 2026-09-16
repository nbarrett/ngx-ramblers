import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";
import { waitForOsMapsSignedIn } from "./os-maps-identity";

export class WaitForOsMapsSignedInHeader extends Interaction {

  static now() {
    return new WaitForOsMapsSignedInHeader();
  }

  constructor() {
    super("#actor waits for the signed-in header");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    try {
      await waitForOsMapsSignedIn(native, DEFAULT_WAIT_TIMEOUT.inMilliseconds());
    } catch {
      throw new Error("OS Maps export needs a signed-in session before Export GPX, and the signed-in header never appeared");
    }
  }

}
