import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { OS_MAPS_EXPORT_BUTTON_SELECTOR } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";

export class WaitForOsMapsExportButton extends Interaction {

  static now() {
    return new WaitForOsMapsExportButton();
  }

  constructor() {
    super("#actor waits for the route to offer its Export GPX button");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    await native.locator(OS_MAPS_EXPORT_BUTTON_SELECTOR).first()
      .waitFor({state: "visible", timeout: DEFAULT_WAIT_TIMEOUT.inMilliseconds()})
      .catch(() => {
        throw new Error(`OS Maps never offered an Export GPX button on ${native.url()}, so the route had not finished loading`);
      });
  }

}
