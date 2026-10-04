import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import { errors, Locator, Page as NativePage } from "playwright-core";
import debug from "debug";
import { envConfig } from "../../../../env-config/env-config";
import { OS_MAPS_EXPORT_BUTTON_SELECTOR } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { clickWithoutWaitingForNavigation } from "./os-maps-clicks";

const debugLog = debug(envConfig.logNamespace("click-os-maps-export-button"));
debugLog.enabled = true;

export async function clickOsMapsExportButton(locator: Locator): Promise<void> {
  try {
    await clickWithoutWaitingForNavigation(locator);
  } catch (error) {
    if (error instanceof errors.TimeoutError) {
      debugLog("Export GPX click timed out; checking for a download or confirmation before retrying:", error.message);
    } else {
      throw error;
    }
  }
}

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
    await clickOsMapsExportButton(native.locator(OS_MAPS_EXPORT_BUTTON_SELECTOR).first());
  }

}
