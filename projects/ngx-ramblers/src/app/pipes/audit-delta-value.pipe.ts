import { inject, Pipe, PipeTransform } from "@angular/core";
import { DisplayDatePipe } from "./display-date.pipe";
import { MemberIdToFullNamePipe } from "./member-id-to-full-name.pipe";
import { ValueOrDefaultPipe } from "./value-or-default.pipe";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../models/member.model";

@Pipe({
  name: "auditDeltaValue",
  standalone: false
})
export class AuditDeltaValuePipe implements PipeTransform {
  logger: Logger = inject(LoggerFactory).createLogger("AuditDeltaValuePipe", NgxLoggerLevel.OFF);
  private displayDatePipe: DisplayDatePipe = inject(DisplayDatePipe);
  private memberIdToFullNamePipe: MemberIdToFullNamePipe = inject(MemberIdToFullNamePipe);
  private valueOrDefaultPipe: ValueOrDefaultPipe = inject(ValueOrDefaultPipe);

  transform(value, fieldName: string, members: Member[], defaultValue?: string) {
    this.logger.debug("transform:fieldName ->", fieldName, "value ->", value, "members ->", members, "defaultValue ->", defaultValue);
    if (value) {
      switch (fieldName) {
      case "walkDate":
        return this.displayDatePipe.transform(value);
      case "walkLeaderMemberId":
        return this.memberIdToFullNamePipe.transform(value, members, defaultValue) ||"";
      default:
        return this.valueOrDefaultPipe.transform(value, defaultValue);
      }
    } else {
      return this.valueOrDefaultPipe.transform(value, defaultValue);
    }
  }
}
