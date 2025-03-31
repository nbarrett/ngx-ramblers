import { isPresent } from "@serenity-js/assertions";
import { AnswersQuestions, Check, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { WaitFor } from "../common/wait-for";
import { pluralise, pluraliseWithCount } from "../../../../../shared/string-utils";
import { RequestParameterExtractor } from "../common/request-parameter-extractor";
import { WalkRequestParameters } from "../../../../models/walk-request-parameters";
import { ReportOn } from "./report-on-upload";

const debugLog = debug(envConfig.logNamespace("report-upload-errors"));
debugLog.enabled = false;

export class CheckAndReportOn extends Task {
  private walkParameters: WalkRequestParameters;
  static uploadErrors = () => new CheckAndReportOn();

  protected constructor() {
    super("#actor reports on upload");
    this.walkParameters = RequestParameterExtractor.extract();
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    const message = `${pluraliseWithCount(this.walkParameters.walkCount, "walk")} ${pluralise(this.walkParameters.walkCount, "has", "have")} been created`;
    return actor.attemptsTo(
      Check.whether(WalksPageElements.errorAlert, isPresent())
        .andIfSo(ReportOn.uploadErrors())
        .otherwise(WaitFor.successAlertToEventuallyContain(message)));
  }
}
