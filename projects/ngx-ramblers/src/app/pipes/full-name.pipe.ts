import { Pipe, PipeTransform } from "@angular/core";
import { Member, MemberCookie } from "../models/member.model";

@Pipe({name: "fullName"})
export class FullNamePipe implements PipeTransform {
  transform(member: Member, defaultValue?: string) {
    return member ? (`${member.firstName || member.title} ${member.lastName}`).trim() : defaultValue || "(deleted member)";
  }
}
