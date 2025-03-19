import { Ensure, equals } from "@serenity-js/assertions";
import { AnswersQuestions, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { CountOfErrors } from "../../../questions/ramblers/countOfErrors";
import { UploadErrors } from "../../../questions/ramblers/uploadErrors";
import { SaveAuditRecord } from "./saveAuditRecord";

export class ReportOn extends Task {

  static uploadErrors = () => new ReportOn();

  protected constructor() {
    super("#actor reports on upload");
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    const errors = await actor.answer(UploadErrors.displayed());
    actor.attemptsTo(
        SaveAuditRecord.followingUpload(errors),
      Ensure.that(CountOfErrors.displayed(errors.length), equals(0)));
  }
}
