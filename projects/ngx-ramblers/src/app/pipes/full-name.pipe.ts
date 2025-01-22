import { Pipe, PipeTransform } from "@angular/core";
import { Member } from "../models/member.model";

@Pipe({
  name: "fullName",
  standalone: false
})
export class FullNamePipe implements PipeTransform {
  transform(member: Member, defaultValue?: string) {
    return member ? (`${member.firstName || member.title} ${member.lastName}`).trim() : defaultValue || "(deleted member)";
  }
}
