import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { clearOsMapsInterruptions } from "./os-maps-page-cleanup";

export class DismissOsMapsOverlays extends Interaction {

  static now() {
    return new DismissOsMapsOverlays();
  }

  constructor() {
    super("#actor dismisses OS Maps overlays");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    await clearOsMapsInterruptions(native);
  }

}
