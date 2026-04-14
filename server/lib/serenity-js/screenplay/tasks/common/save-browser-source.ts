import debug from "debug";
import { FileSystem, Path } from "@serenity-js/core/lib/io";
import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import { envConfig } from "../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("save-browser-source"));
debugLog.enabled = true;

export class SaveBrowserSource extends Interaction {

  static toFile(relativePathToFile: string) {
    return new SaveBrowserSource(relativePathToFile);
  }

  constructor(public relativePathToFile: string) {
    super(`#actor saves browser html source to '${relativePathToFile}'`);
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    let htmlSource: string;
    try {
      const currentPage = await BrowseTheWeb.as(actor).currentPage();
      htmlSource = await currentPage.executeScript(() => document.documentElement.outerHTML);
    } catch (error) {
      debugLog("failed to capture browser source for", this.relativePathToFile, "error:", (error as Error).message);
      htmlSource = `<html><body><pre>${(error as Error).message}</pre></body></html>`;
    }
    await new FileSystem(new Path("./target/browser-source"))
      .store(Path.fromSanitisedString(this.relativePathToFile), htmlSource);
  }

}
