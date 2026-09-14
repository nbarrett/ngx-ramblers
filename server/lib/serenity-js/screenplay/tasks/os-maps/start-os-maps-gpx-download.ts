import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Download, Page as NativePage } from "playwright-core";
import { OsMapsExportClickOutcome } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";
import { rememberPendingOsMapsDownload } from "./os-maps-download-store";
import { clickWithoutWaitingForNavigation } from "./os-maps-clicks";
import { clearOsMapsInterruptions } from "./os-maps-page-cleanup";

const OS_MAPS_EXPORT_BUTTON_SELECTOR = "#export_gpx_button_id";
const OS_MAPS_CONFIRM_EXPORT_SELECTOR = "button.export-button";
const OS_MAPS_INTERRUPTION_SELECTOR = "button[aria-label='Close popup']";
const EXPORT_CLICK_ATTEMPTS = 3;
const DIALOG_APPEARANCE_WINDOW_MS = 2000;

export class StartOsMapsGpxDownload extends Interaction {

  static now() {
    return new StartOsMapsGpxDownload();
  }

  constructor() {
    super("#actor clicks Export GPX");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    const timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds();
    const exportButton = native.locator(OS_MAPS_EXPORT_BUTTON_SELECTOR);
    await exportButton.first().waitFor({state: "visible", timeout});
    const downloadPromise = native.waitForEvent("download", {timeout});
    rememberPendingOsMapsDownload(downloadPromise as Promise<Download>);
    await this.clickUntilDownloadStarts(native, downloadPromise, timeout, EXPORT_CLICK_ATTEMPTS);
  }

  private appears(locator: ReturnType<NativePage["locator"]>, outcome: OsMapsExportClickOutcome): Promise<OsMapsExportClickOutcome> {
    return locator.first().waitFor({state: "visible", timeout: DIALOG_APPEARANCE_WINDOW_MS})
      .then(() => outcome)
      .catch(() => OsMapsExportClickOutcome.NO_DIALOG_APPEARED);
  }

  private async clickUntilDownloadStarts(native: NativePage, downloadPromise: Promise<unknown>, timeout: number, attemptsRemaining: number): Promise<void> {
    const exportButton = native.locator(OS_MAPS_EXPORT_BUTTON_SELECTOR);
    const confirmButton = native.locator(OS_MAPS_CONFIRM_EXPORT_SELECTOR);
    const interruption = native.locator(OS_MAPS_INTERRUPTION_SELECTOR);
    await clickWithoutWaitingForNavigation(exportButton.first());
    const outcome = await Promise.race([
      downloadPromise.then(() => OsMapsExportClickOutcome.DOWNLOAD_STARTED),
      this.appears(confirmButton, OsMapsExportClickOutcome.CONFIRMATION_SHOWN),
      this.appears(interruption, OsMapsExportClickOutcome.INTERRUPTED)
    ]);
    if (outcome === OsMapsExportClickOutcome.CONFIRMATION_SHOWN) {
      await clickWithoutWaitingForNavigation(confirmButton.first());
    } else if (outcome === OsMapsExportClickOutcome.INTERRUPTED && attemptsRemaining > 1) {
      await clearOsMapsInterruptions(native);
      await this.clickUntilDownloadStarts(native, downloadPromise, timeout, attemptsRemaining - 1);
    }
  }

}
