import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { allowOsMapsGeolocation } from "./os-maps-page-cleanup";

export class AllowOsMapsGeolocation extends Interaction {

  static forThisSession() {
    return new AllowOsMapsGeolocation();
  }

  constructor() {
    super("#actor allows OS Maps to see a location");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    await allowOsMapsGeolocation(native);
  }

}
