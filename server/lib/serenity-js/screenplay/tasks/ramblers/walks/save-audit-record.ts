import { notes, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import * as path from "path";
import { UploadError } from "../../../questions/ramblers/upload-error";
import { RequestParameterExtractor } from "../common/request-parameter-extractor";
import { pluraliseWithCount } from "../../../../../shared/string-utils";
import { momentNowAsValue } from "../../../../../shared/dates";

import {
  AuditType,
  RamblersUploadAudit,
  Status
} from "../../../../../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";

export class SaveAuditRecord extends Task {
  private notesName: string;

  constructor(private errors: UploadError[]) {
    const notesName = `${pluraliseWithCount(errors.length, "error")} following upload`;
    super(`#actor records ${notesName}`);
    this.notesName = notesName;
  }

  static followingUpload = (errors: UploadError[]) => new SaveAuditRecord(errors);

  performAs(actor: PerformsActivities & UsesAbilities): Promise<any> {
    return actor.attemptsTo(
      notes().set(this.notesName, this.auditRecord()));
  }

  auditRecord(): RamblersUploadAudit {
    const fileName = path.basename(RequestParameterExtractor.extract().fileName);
    const happy = {
      fileName,
      type: AuditType.STEP,
      status: Status.SUCCESS,
      message: "No errors were found following upload",
    };
    const sad = {
      fileName,
      type: AuditType.STEP,
      status: Status.ERROR,
      message: `Found ${this.notesName}`,
      errorResponse: this.errors,
    };
    return this.errors.length === 0 ? happy : sad;
  }
}
