import { Actor, Cast, TakeNotes, actorCalled, configure } from "@serenity-js/core";
import { BrowseTheWebWithWebdriverIO } from "@serenity-js/webdriverio";
import { launchBrowser as sharedLaunchBrowser, deriveBaseUrl } from "./serenity-utils";

export { deriveBaseUrl };

export async function launchBrowser(): Promise<WebdriverIO.Browser> {
  return sharedLaunchBrowser();
}

class MigrationCast extends Cast {
  constructor(private browser: WebdriverIO.Browser) {
    super();
  }

  prepare(actor: Actor): Actor {
    return actor
      .whoCan(BrowseTheWebWithWebdriverIO.using(this.browser))
      .whoCan(TakeNotes.usingAnEmptyNotepad<any>());
  }
}

export async function createActor(browser: WebdriverIO.Browser, name: string = "MigrationActor"): Promise<Actor> {
  configure({
    actors: new MigrationCast(browser)
  });

  return actorCalled(name);
}