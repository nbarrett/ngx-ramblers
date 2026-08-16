import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { clearOsMapsInterruptions } from "./os-maps-page-cleanup";

export class AcceptOsMapsCookies extends Interaction {

  static whenVisible() {
    return new AcceptOsMapsCookies();
  }

  constructor() {
    super("#actor accepts the OS Maps cookie banner when it is visible");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    await clearOsMapsInterruptions(native);
  }

}
