import { Duration, Task, Wait } from "@serenity-js/core";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { RequestParameterExtractor } from "../common/request-parameter-extractor";
import { Enter, isVisible } from "@serenity-js/web";
import { pluraliseWithCount } from "../../../../../shared/string-utils";
import { ClickWhenReady } from "../../common/click-when-ready";
import { Log } from "../common/log";

export class UploadWalks {

  static fileWithNameAndCount(fileName: string, walkCount: number) {
    return UploadWalksSpecifiedWalks.withFile(fileName, walkCount);
  }

  static requested() {
    const walkParameters = RequestParameterExtractor.extract();
    return UploadWalksSpecifiedWalks.withFile(walkParameters.fileName, walkParameters.walkCount);
  }

}

export class UploadWalksSpecifiedWalks {

  static withFile(fileName: string, walkCount: number) {
    return Task.where(`#actor uploads file ${fileName} containing ${pluraliseWithCount(walkCount, "walk")}`,
      Log.message(`Uploading file ${fileName} containing ${pluraliseWithCount(walkCount, "walk")}`),
      ClickWhenReady.on(WalksPageElements.createDropdown),
      ClickWhenReady.on(WalksPageElements.uploadAWalksCSV),
      Enter.theValue(fileName).into(WalksPageElements.chooseFilesButton),
      ClickWhenReady.on(WalksPageElements.uploadWalksButton),
      Wait.upTo(Duration.ofSeconds(20)).until(WalksPageElements.progressIndicator, isVisible())
    );
  }
}
