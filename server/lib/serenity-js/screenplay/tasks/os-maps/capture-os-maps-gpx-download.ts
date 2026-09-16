import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { isString } from "es-toolkit/compat";
import { osMapsRouteIdFromUrl } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { parseExportedGpx } from "../../../../os-maps/exported-gpx-parser";
import { persistExportedGpxToJobPath } from "../../../../os-maps/os-maps-exported-gpx-files";
import { rememberExportedGpx } from "../../questions/os-maps/exported-gpx-store";
import { OS_MAPS_DOWNLOAD_TIMEOUT } from "../../../config/serenity-timeouts";
import { clearPendingOsMapsDownload, pendingOsMapsDownload } from "./os-maps-download-store";

export class CaptureOsMapsGpxDownload extends Interaction {

  static now() {
    return new CaptureOsMapsGpxDownload();
  }

  constructor() {
    super("#actor captures the exported GPX file");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    const routeName = osMapsRouteIdFromUrl(native.url()) || native.url();
    const download = await pendingOsMapsDownload().catch(() => {
      throw new Error(`OS Maps did not start a GPX download for route ${routeName} within ${OS_MAPS_DOWNLOAD_TIMEOUT.inMilliseconds() / 1000} seconds of Export GPX being clicked`);
    });
    clearPendingOsMapsDownload();
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

}
