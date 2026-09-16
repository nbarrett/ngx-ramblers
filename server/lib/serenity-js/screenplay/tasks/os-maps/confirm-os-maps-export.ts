import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { OS_MAPS_CONFIRM_EXPORT_SELECTOR } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { clickWithoutWaitingForNavigation } from "./os-maps-clicks";

export class ConfirmOsMapsExport extends Interaction {

  static now() {
    return new ConfirmOsMapsExport();
  }

  constructor() {
    super("#actor confirms the OS Maps export");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    await clickWithoutWaitingForNavigation(native.locator(OS_MAPS_CONFIRM_EXPORT_SELECTOR).first());
  }

}
