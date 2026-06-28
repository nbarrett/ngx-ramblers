import { Pipe, PipeTransform } from "@angular/core";
import { Member } from "../models/member.model";
import { memberFullName } from "../functions/member-names";

@Pipe({ name: "fullName" })
export class FullNamePipe implements PipeTransform {
  transform(member: Member, defaultValue?: string) {
    return memberFullName(member, defaultValue || "Unknown Member");
  }
}
