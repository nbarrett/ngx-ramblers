import { FileSystem, Path } from "@serenity-js/core/lib/io";
import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { protractor } from "protractor";

export class SaveBrowserSource implements Interaction {

  static toFile(relativePathToFile: string) {
    return new SaveBrowserSource(relativePathToFile);
  }

  constructor(public relativePathToFile: string) {
  }

  performAs(actor: UsesAbilities): Promise<void> {
    return protractor.browser.getPageSource()
      .then((htmlSource: string) => {
        new FileSystem(new Path("./target/site/serenity"))
          .store(Path.fromSanitisedString(this.relativePathToFile), htmlSource);
      }) as Promise<void>;
  }

}
