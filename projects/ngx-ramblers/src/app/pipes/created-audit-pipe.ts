import { Pipe, PipeTransform } from "@angular/core";
import { FormatAuditPipe } from "./format-audit-pipe";

@Pipe({ name: "createdAudit" })
export class CreatedAuditPipe implements PipeTransform {

  constructor(private formatAuditPipe: FormatAuditPipe) {
  }

  transform(resource, members) {
    return this.formatAuditPipe.transform(resource.createdBy, resource.createdDate, members);
  }
}
