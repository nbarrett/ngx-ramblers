import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { isString } from "es-toolkit/compat";
import { parseExportedGpx } from "../../../../os-maps/exported-gpx-parser";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";
import { rememberExportedGpx } from "../../questions/os-maps/exported-gpx-store";
import { persistExportedGpxToJobPath } from "../../../../os-maps/os-maps-exported-gpx-files";
import { osMapsSessionIsSignedIn, waitForOsMapsApplicationReady } from "./os-maps-identity";
import { clearOsMapsInterruptions } from "./os-maps-page-cleanup";

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
    await waitForOsMapsApplicationReady(native, timeout);
    if (!await osMapsSessionIsSignedIn(native)) {
      throw new Error("OS Maps export needs a signed-in session before Export GPX");
    } else {
      const exportButton = native.locator("#export_gpx_button_id")
        .or(native.getByRole("button", {name: /^export gpx$/i}));
      await exportButton.first().waitFor({state: "visible", timeout});
      const downloadPromise = native.waitForEvent("download", {timeout});
      await exportButton.first().click({force: true});
      await clearOsMapsInterruptions(native);
      const confirm = native.getByRole("button", {name: /export gpx file/i})
        .or(native.locator("button.export-button"));
      if (await confirm.first().isVisible({timeout: 8000}).catch(() => false)) {
        await confirm.first().click({force: true});
      } else if (await native.locator("#signInName").or(native.getByLabel(/email address/i)).first().isVisible().catch(() => false)) {
        throw new Error("OS Maps asked for login again when exporting GPX");
      }
      const download = await downloadPromise;
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
          const summary = parseExportedGpx(content, fileName);
          rememberExportedGpx(summary);
          persistExportedGpxToJobPath(summary);
        }
      }
    }
  }

}
