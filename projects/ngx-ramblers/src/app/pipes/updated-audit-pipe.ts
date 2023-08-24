import { Pipe, PipeTransform } from "@angular/core";
import { StringUtilsService } from "../services/string-utils.service";
import { FormatAuditPipe } from "./format-audit-pipe";

@Pipe({name: "updatedAudit"})
export class UpdatedAuditPipe implements PipeTransform {

  constructor(
    private stringUtils: StringUtilsService,
    private formatAuditPipe: FormatAuditPipe) {
  }

  transform(resource, members) {
    return this.formatAuditPipe.transform(resource.updatedBy, resource.updatedDate, members);
  }
}
