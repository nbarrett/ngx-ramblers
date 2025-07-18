import { Pipe, PipeTransform } from "@angular/core";
import { Member } from "../models/member.model";

@Pipe({ name: "fullName" })
export class FullNamePipe implements PipeTransform {
  transform(member: Member, defaultValue?: string) {
    const firstName = member?.firstName || member?.title;
    const lastName = member?.lastName;
    return member ? (`${firstName} ${firstName === lastName ? "" : lastName}`).trim() : defaultValue || "Unknown Member";
  }
}
