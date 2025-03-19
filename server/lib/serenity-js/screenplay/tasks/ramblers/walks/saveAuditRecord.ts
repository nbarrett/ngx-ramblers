import { PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import moment from "moment-timezone";
import * as path from "path";
import { ramblersUploadAudit } from "../../../../../mongo/models/ramblers-upload-audit";
import * as mongooseClient from "../../../../../mongo/mongoose-client";
import { UploadError } from "../../../questions/ramblers/uploadError";
import { RequestParameterExtractor } from "../common/requestParameterExtractor";
import { pluraliseWithCount } from "../../../../../shared/string-utils";

export class SaveAuditRecord extends Task {

  constructor(private errors: UploadError[]) {
    super("#actor saves audit of upload");
  }

  static followingUpload = (errors: UploadError[]) => new SaveAuditRecord(errors);

  performAs(actor: PerformsActivities & UsesAbilities): Promise<any> {
    return Promise.resolve(mongooseClient.create(ramblersUploadAudit, this.auditRecord()));
  }

  auditRecord() {
    const fileName = path.basename(RequestParameterExtractor.extract().fileName);
    const auditTime = moment().tz("Europe/London").valueOf();
    const happy = {
      auditTime,
      fileName,
      type: "step",
      status: "success",
      message: "No errors were found following upload",
    };
    const sad = {
      auditTime,
      fileName,
      type: "step",
      status: "error",
      message: `Found ${pluraliseWithCount(this.errors.length, "error")} following upload`,
      errorResponse: this.errors,
    };
    return this.errors.length === 0 ? happy : sad;
  }
}
