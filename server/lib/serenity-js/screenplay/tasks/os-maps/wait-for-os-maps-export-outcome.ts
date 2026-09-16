import debug from "debug";
import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import {
  OS_MAPS_CONFIRM_EXPORT_SELECTOR,
  OS_MAPS_INTERRUPTION_SELECTOR,
  OsMapsExportClickOutcome
} from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { envConfig } from "../../../../env-config/env-config";
import { delay } from "../../../../shared/delay";
import { pendingOsMapsDownload } from "./os-maps-download-store";
import { rememberOsMapsExportOutcome } from "./os-maps-export-outcome-store";

const debugLog = debug(envConfig.logNamespace("wait-for-os-maps-export-outcome"));
debugLog.enabled = true;
const DIALOG_APPEARANCE_WINDOW_MS = 2000;
const DOWNLOAD_GRACE_MS = 1000;

export class WaitForOsMapsExportOutcome extends Interaction {

  static attempt(attemptNumber: number) {
    return new WaitForOsMapsExportOutcome(attemptNumber);
  }

  constructor(private readonly attemptNumber: number) {
    super(`#actor waits to see what OS Maps does after Export GPX is clicked (attempt ${attemptNumber})`);
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    const withinWindow = await Promise.race([
      this.downloadStarts(),
      this.appears(native, OS_MAPS_CONFIRM_EXPORT_SELECTOR, OsMapsExportClickOutcome.CONFIRMATION_SHOWN),
      this.appears(native, OS_MAPS_INTERRUPTION_SELECTOR, OsMapsExportClickOutcome.INTERRUPTED)
    ]);
    const outcome = withinWindow === OsMapsExportClickOutcome.NO_DIALOG_APPEARED && await this.downloadStartsWithin(DOWNLOAD_GRACE_MS)
      ? OsMapsExportClickOutcome.DOWNLOAD_STARTED
      : withinWindow;
    debugLog(`attempt ${this.attemptNumber} outcome: ${outcome}`);
    rememberOsMapsExportOutcome(outcome);
  }

  private downloadStarts(): Promise<OsMapsExportClickOutcome> {
    return pendingOsMapsDownload().then(() => OsMapsExportClickOutcome.DOWNLOAD_STARTED, () => OsMapsExportClickOutcome.NO_DIALOG_APPEARED);
  }

  private downloadStartsWithin(milliseconds: number): Promise<boolean> {
    return Promise.race([
      pendingOsMapsDownload().then(() => true, () => false),
      delay(milliseconds).then(() => false)
    ]);
  }

  private appears(native: NativePage, selector: string, outcome: OsMapsExportClickOutcome): Promise<OsMapsExportClickOutcome> {
    return native.locator(selector).first().waitFor({state: "visible", timeout: DIALOG_APPEARANCE_WINDOW_MS})
      .then(() => outcome)
      .catch(() => OsMapsExportClickOutcome.NO_DIALOG_APPEARED);
  }

}
