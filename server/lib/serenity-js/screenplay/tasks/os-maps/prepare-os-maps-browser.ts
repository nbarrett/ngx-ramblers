import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { blockOsMapsBackgroundTraffic } from "./os-maps-page-cleanup";

export class PrepareOsMapsBrowser extends Interaction {

  static withoutMapTiles() {
    return new PrepareOsMapsBrowser();
  }

  constructor() {
    super("#actor stops the browser fetching OS Maps map tiles, images, fonts and analytics");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    await blockOsMapsBackgroundTraffic(native);
  }

}
