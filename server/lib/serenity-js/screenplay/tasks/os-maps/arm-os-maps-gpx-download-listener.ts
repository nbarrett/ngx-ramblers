import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Download, Page as NativePage } from "playwright-core";
import { OS_MAPS_DOWNLOAD_TIMEOUT } from "../../../config/serenity-timeouts";
import { rememberPendingOsMapsDownload } from "./os-maps-download-store";

export class ArmOsMapsGpxDownloadListener extends Interaction {

  static now() {
    return new ArmOsMapsGpxDownloadListener();
  }

  constructor() {
    super("#actor starts listening for the GPX download");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    const downloadPromise = native.waitForEvent("download", {timeout: OS_MAPS_DOWNLOAD_TIMEOUT.inMilliseconds()}) as Promise<Download>;
    downloadPromise.catch(() => null);
    rememberPendingOsMapsDownload(downloadPromise);
  }

}
