import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";
import { removeOsMapsBlockingOverlays } from "./os-maps-page-cleanup";

export class SubmitOsMapsLogin extends Interaction {

  static now() {
    return new SubmitOsMapsLogin();
  }

  constructor() {
    super("#actor submits the OS Maps login form");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    await removeOsMapsBlockingOverlays(native);
    await native.locator("#next").click({force: true, timeout: DEFAULT_WAIT_TIMEOUT.inMilliseconds()});
  }

}
