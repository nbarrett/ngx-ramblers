import { Check, Duration, Log, Task, Wait } from "@serenity-js/core";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { ClickWhenReady } from "../../common/clickWhenReady";
import { RequestParameterExtractor } from "../common/requestParameterExtractor";
import { WaitFor } from "../common/waitFor";
import { ReportOn } from "./reportOnUpload";
import { Enter, isVisible } from "@serenity-js/web";
import { pluralise, pluraliseWithCount } from "../../../../../shared/string-utils";

export class UploadWalks {

  static fileWithNameAndCount(fileName: string, expectedWalks: number) {
    return UploadWalksSpecifiedWalks.withFile(fileName, expectedWalks);
  }

  static requested() {
    const walkParameters = RequestParameterExtractor.extract();
    return UploadWalksSpecifiedWalks.withFile(walkParameters.fileName, walkParameters.walkCount);
  }

}

export class UploadWalksSpecifiedWalks {

  static withFile(fileName: string, expectedWalks: number) {
    return Task.where(
      `#actor uploads file ${fileName} containing ${pluraliseWithCount(expectedWalks, "walk")}`,
      Log.the(`Uploading file ${fileName} containing ${pluraliseWithCount(expectedWalks, "walk")}`),
      ClickWhenReady.on(WalksTargets.createDropdown),
      ClickWhenReady.on(WalksTargets.uploadAWalksCSV),
      Enter.theValue(fileName).into(WalksTargets.chooseFilesButton),
      ClickWhenReady.on(WalksTargets.uploadWalksButton),
      Wait.upTo(Duration.ofSeconds(10)).until(WalksTargets.progressIndicator, isVisible()),
      Wait.upTo(Duration.ofSeconds(10)).until(WalksTargets.alertMessage, isVisible()),
      Check.whether(WalksTargets.errorAlert, isVisible())
        .andIfSo(ReportOn.uploadErrors())
        .otherwise(WaitFor.successAlertToContainMessage(`${pluraliseWithCount(expectedWalks, "walk")} ${pluralise(expectedWalks, "has", "have")} been created`))
    );
  }
}
