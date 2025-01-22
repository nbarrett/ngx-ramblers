import { Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";
import { MemberIdToFullNamePipe } from "./member-id-to-full-name.pipe";

@Pipe({
  name: "formatAudit",
  standalone: false
})
export class FormatAuditPipe implements PipeTransform {

  constructor(private dateUtils: DateUtilsService,
              private memberIdToFullNamePipe: MemberIdToFullNamePipe) {
  }

  transform(who, when, members) {
    const by: string = who ? "by " + this.memberIdToFullNamePipe.transform(who, members) : "";
    return (who || when) ? by + (who && when ? " on " : "") + this.dateUtils.displayDateAndTime(when) : "(not audited)";
  }

}
