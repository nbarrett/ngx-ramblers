import { Ensure, equals } from "@serenity-js/assertions";
import { AnswersQuestions, Log, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { CountOfErrors } from "../../../questions/ramblers/count-of-errors";
import { UploadErrors } from "../../../questions/ramblers/upload-errors";
import { SaveAuditRecord } from "./save-audit-record";
import { UploadError } from "../../../questions/ramblers/upload-error";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("report-upload-errors"));
debugLog.enabled = false;

export class ReportOn extends Task {

  static uploadErrors = () => new ReportOn();

  protected constructor() {
    super("#actor reports on upload");
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    const errors: UploadError[] = await actor.answer(UploadErrors.displayed());
    debugLog("Upload errors contains:", errors);
    return actor.attemptsTo(
      SaveAuditRecord.followingUpload(errors),
      Log.the("Upload errors contains:", errors),
      Ensure.that(CountOfErrors.displayed(errors.length), equals(0)));
  }
}
