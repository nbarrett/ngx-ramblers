import { inject, Pipe, PipeTransform } from "@angular/core";
import { FormatAuditPipe } from "./format-audit-pipe";

@Pipe({ name: "updatedAudit" })
export class UpdatedAuditPipe implements PipeTransform {

  private formatAuditPipe = inject(FormatAuditPipe);


  transform(resource, members) {
    return this.formatAuditPipe.transform(resource.updatedBy, resource.updatedDate, members);
  }
}
