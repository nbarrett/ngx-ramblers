import { browser } from "@wdio/globals";
import { FileSystem, Path } from "@serenity-js/core/lib/io";
import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";

export class SaveBrowserSource extends Interaction {

  static toFile(relativePathToFile: string) {
    return new SaveBrowserSource(relativePathToFile);
  }

  constructor(public relativePathToFile: string) {
    super(`#actor saves browser html source to '${relativePathToFile}'`);
  }

  performAs(actor: UsesAbilities): Promise<void> {
    return browser.getPageSource()
      .then((htmlSource: string) => {
        new FileSystem(new Path("./target/site/serenity"))
          .store(Path.fromSanitisedString(this.relativePathToFile), htmlSource);
      }) as Promise<void>;
  }

}
