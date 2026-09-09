import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { FileSystem, Path } from "@serenity-js/core/lib/io";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage, Request, Response } from "playwright-core";
import { dateTimeNow } from "../../../../shared/dates";
import { NetworkActivityEntry, NetworkActivityEntryType } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";


let capturedEntries: NetworkActivityEntry[] = [];

export class StartCapturingOsMapsNetworkActivity extends Interaction {

  static now(): StartCapturingOsMapsNetworkActivity {
    return new StartCapturingOsMapsNetworkActivity();
  }

  constructor() {
    super("#actor starts capturing OS Maps network activity");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    capturedEntries = [];
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    const context = native.context();
    context.on("request", (request: Request) => {
      capturedEntries.push({
        timestamp: dateTimeNow().toISO(),
        type: NetworkActivityEntryType.REQUEST,
        method: request.method(),
        url: request.url()
      });
    });
    context.on("response", (response: Response) => {
      capturedEntries.push({
        timestamp: dateTimeNow().toISO(),
        type: NetworkActivityEntryType.RESPONSE,
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    });
    context.on("requestfailed", (request: Request) => {
      capturedEntries.push({
        timestamp: dateTimeNow().toISO(),
        type: NetworkActivityEntryType.REQUEST_FAILED,
        method: request.method(),
        url: request.url(),
        failureReason: request.failure()?.errorText
      });
    });
  }

}

export class SaveOsMapsNetworkActivity extends Interaction {

  static toFile(relativePathToFile: string): SaveOsMapsNetworkActivity {
    return new SaveOsMapsNetworkActivity(relativePathToFile);
  }

  constructor(private readonly relativePathToFile: string) {
    super(`#actor saves OS Maps network activity to '${relativePathToFile}'`);
  }

  async performAs(): Promise<void> {
    await new FileSystem(new Path("./target/browser-source"))
      .store(Path.fromSanitisedString(this.relativePathToFile), JSON.stringify(capturedEntries, null, 2));
  }

}
