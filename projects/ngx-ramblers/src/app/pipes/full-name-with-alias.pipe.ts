import { inject, Pipe, PipeTransform } from "@angular/core";
import { Member } from "../models/member.model";
import { FullNamePipe } from "./full-name.pipe";

@Pipe({ name: "fullNameWithAlias" })
export class FullNameWithAliasPipe implements PipeTransform {

  private fullNamePipe = inject(FullNamePipe);

  transform(member: Member, defaultValue?: string) {
    return member ? this.fullNamePipe.transform(member, defaultValue) + (member.nameAlias ? " (" + member.nameAlias + ")" : "") : defaultValue;
  }
}
