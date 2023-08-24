import { Pipe, PipeTransform } from "@angular/core";
import { Member, MemberCookie } from "../models/member.model";

@Pipe({name: "fullName"})
export class FullNamePipe implements PipeTransform {
  transform(member: Member | MemberCookie, defaultValue?: string) {
    return member === undefined ? defaultValue || "(deleted member)" : (member.firstName + " " + member.lastName).trim();
  }
}
