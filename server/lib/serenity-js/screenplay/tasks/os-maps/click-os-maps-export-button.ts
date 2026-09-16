import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { OS_MAPS_EXPORT_BUTTON_SELECTOR } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { clickWithoutWaitingForNavigation } from "./os-maps-clicks";

export class ClickOsMapsExportButton extends Interaction {

  static attempt(attemptNumber: number) {
    return new ClickOsMapsExportButton(attemptNumber);
  }

  constructor(attemptNumber: number) {
    super(`#actor clicks Export GPX (attempt ${attemptNumber})`);
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    await clickWithoutWaitingForNavigation(native.locator(OS_MAPS_EXPORT_BUTTON_SELECTOR).first());
  }

}
