import { Pipe, PipeTransform } from "@angular/core";
import { DisplayDatePipe } from "./display-date.pipe";
import { MemberIdToFullNamePipe } from "./member-id-to-full-name.pipe";
import { ValueOrDefaultPipe } from "./value-or-default.pipe";

@Pipe({name: "auditDeltaValue"})
export class AuditDeltaValuePipe implements PipeTransform {

  constructor(
    private  displayDatePipe: DisplayDatePipe,
    private  memberIdToFullNamePipe: MemberIdToFullNamePipe,
    private  valueOrDefaultPipe: ValueOrDefaultPipe) {
  }

  transform(value, fieldName, members, defaultValue?: string) {
    switch (fieldName) {
      case "walkDate":
        return this.displayDatePipe.transform(value);
      case "walkLeaderMemberId":
        return this.memberIdToFullNamePipe.transform(value, members, defaultValue);
      default:
        return this.valueOrDefaultPipe.transform(value, defaultValue);
    }
  }
}
