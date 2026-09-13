import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { isString } from "es-toolkit/compat";
import { OsMapsExportClickOutcome, osMapsRouteIdFromUrl } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { parseExportedGpx } from "../../../../os-maps/exported-gpx-parser";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";
import { rememberExportedGpx } from "../../questions/os-maps/exported-gpx-store";
import { persistExportedGpxToJobPath } from "../../../../os-maps/os-maps-exported-gpx-files";
import { waitForOsMapsSignedIn } from "./os-maps-identity";
import { clearOsMapsInterruptions } from "./os-maps-page-cleanup";

const OS_MAPS_EXPORT_BUTTON_SELECTOR = "#export_gpx_button_id";
const OS_MAPS_CONFIRM_EXPORT_SELECTOR = "button.export-button";
const OS_MAPS_INTERRUPTION_SELECTOR = "button[aria-label='Close popup']";
const EXPORT_CLICK_ATTEMPTS = 3;

export class ExportOsRouteToGpx extends Interaction {

  static asGpx() {
    return new ExportOsRouteToGpx();
  }

  constructor() {
    super("#actor exports the current OS Maps route as GPX");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    const timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds();
    await clearOsMapsInterruptions(native);
    try {
      await waitForOsMapsSignedIn(native, timeout);
    } catch {
      throw new Error("OS Maps export needs a signed-in session before Export GPX, and the signed-in header never appeared");
    }
    const exportButton = native.locator(OS_MAPS_EXPORT_BUTTON_SELECTOR);
    await exportButton.first().waitFor({state: "visible", timeout});
    const downloadPromise = native.waitForEvent("download", {timeout});
    await this.clickExportUntilDownloadStarts(native, downloadPromise, timeout, EXPORT_CLICK_ATTEMPTS);
    const download = await downloadPromise.catch(() => {
      throw new Error(`OS Maps did not start a GPX download after Export GPX was clicked on ${native.url()}`);
    });
    const fileName = download.suggestedFilename();
    const failure = await download.failure();
    if (failure) {
      throw new Error(`OS Maps GPX download failed: ${failure}`);
    } else {
      const stream = await download.createReadStream();
      if (!stream) {
        throw new Error("OS Maps GPX download did not produce a stream");
      } else {
        const chunks: string[] = [];
        for await (const chunk of stream) {
          chunks.push(isString(chunk) ? chunk : Buffer.from(chunk).toString("utf8"));
        }
        const content = chunks.join("");
        const summary = {...parseExportedGpx(content, fileName), routeId: osMapsRouteIdFromUrl(native.url())};
        rememberExportedGpx(summary);
        persistExportedGpxToJobPath(summary);
      }
    }
  }

  private async clickExportUntilDownloadStarts(native: NativePage, downloadPromise: Promise<unknown>, timeout: number, attemptsRemaining: number): Promise<void> {
    const exportButton = native.locator(OS_MAPS_EXPORT_BUTTON_SELECTOR);
    const confirmButton = native.locator(OS_MAPS_CONFIRM_EXPORT_SELECTOR);
    const interruption = native.locator(OS_MAPS_INTERRUPTION_SELECTOR);
    await exportButton.first().click({force: true});
    const outcome = await Promise.race([
      downloadPromise.then(() => OsMapsExportClickOutcome.DOWNLOAD_STARTED),
      confirmButton.first().waitFor({state: "visible", timeout}).then(() => OsMapsExportClickOutcome.CONFIRMATION_SHOWN),
      interruption.first().waitFor({state: "visible", timeout}).then(() => OsMapsExportClickOutcome.INTERRUPTED)
    ]);
    if (outcome === OsMapsExportClickOutcome.CONFIRMATION_SHOWN) {
      await confirmButton.first().click({force: true});
    } else if (outcome === OsMapsExportClickOutcome.INTERRUPTED && attemptsRemaining > 1) {
      await clearOsMapsInterruptions(native);
      await this.clickExportUntilDownloadStarts(native, downloadPromise, timeout, attemptsRemaining - 1);
    }
  }

}
