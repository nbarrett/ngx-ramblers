import { Check, Log, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import * as path from "path";
import { ramblersUploadAudit } from "../../../../../mongo/models/ramblers-upload-audit";
import * as mongooseClient from "../../../../../mongo/mongoose-client";
import { UploadError } from "../../../questions/ramblers/upload-error";
import { RequestParameterExtractor } from "../common/request-parameter-extractor";
import { pluraliseWithCount } from "../../../../../shared/string-utils";
import { CountOfErrors } from "../../../questions/ramblers/count-of-errors";
import { isGreaterThan } from "@serenity-js/assertions";
import { momentNowAsValue } from "../../../../../shared/dates";

export class SaveAuditRecord extends Task {

  constructor(private errors: UploadError[]) {
    super(`#actor saves ${pluraliseWithCount(errors.length, "error")} following upload`);
  }

  static followingUpload = (errors: UploadError[]) => new SaveAuditRecord(errors);

  performAs(actor: PerformsActivities & UsesAbilities): Promise<any> {
    actor.attemptsTo(Check.whether(CountOfErrors.displayed(this.errors.length), isGreaterThan(0)).andIfSo(Log.the(this.errors)));
    return mongooseClient.create(ramblersUploadAudit, this.auditRecord());
  }

  auditRecord() {
    const fileName = path.basename(RequestParameterExtractor.extract().fileName);
    const auditTime = momentNowAsValue();
    const happy = {
      auditTime,
      record: 1000,
      fileName,
      type: "step",
      status: "success",
      message: "No errors were found following upload",
    };
    const sad = {
      auditTime,
      record: 1000,
      fileName,
      type: "step",
      status: "error",
      message: `Found ${pluraliseWithCount(this.errors.length, "error")} following upload`,
      errorResponse: this.errors,
    };
    return this.errors.length === 0 ? happy : sad;
  }
}
