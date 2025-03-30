import { Check } from "@serenity-js/assertions";
import { Duration, PerformsActivities, Task } from "@serenity-js/core";
import { Enter, isPresent, isVisible, Wait } from "@serenity-js/protractor";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { pluraliseWithCount } from "../../../util/util";
import { ClickWhenReady } from "../../common/clickWhenReady";
import { RequestParameterExtractor } from "../common/requestParameterExtractor";
import { WaitFor } from "../common/waitFor";
import { ReportOn } from "./reportOnUpload";

export class UploadWalks {

  public static createdAlertMessage() {
    return `been created`;
  }

  static fileWithNameAndCount(fileName: string, expectedWalks: number) {
    return new UploadWalksSpecifiedWalks(fileName, expectedWalks);
  }

  static requested() {
    const walkParameters = RequestParameterExtractor.extract();
    return new UploadWalksSpecifiedWalks(walkParameters.fileName, walkParameters.walkCount);
  }

}

export class UploadWalksSpecifiedWalks implements Task {

  constructor(private fileName: string, private expectedWalks: number) {
  }

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      ClickWhenReady.on(WalksTargets.createDropdown),
      ClickWhenReady.on(WalksTargets.uploadAWalksCSV),
      Enter.theValue(this.fileName).into(WalksTargets.chooseFilesButton),
      ClickWhenReady.on(WalksTargets.uploadWalksButton),
      WaitFor.ramblersToFinishProcessing(),
      Wait.upTo(Duration.ofSeconds(20)).until(WalksTargets.alertMessage, isPresent()),
      Check.whether(WalksTargets.errorAlert, isVisible())
        .andIfSo(ReportOn.uploadErrors())
        .otherwise(WaitFor.successAlertToContainMessage(UploadWalks.createdAlertMessage())));
  }

  toString() {
    return `#actor uploads file ${this.fileName} containing ${pluraliseWithCount(this.expectedWalks, "walk")}`;
  }

}
