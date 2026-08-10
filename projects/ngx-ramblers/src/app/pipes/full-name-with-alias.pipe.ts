import { inject, Pipe, PipeTransform } from "@angular/core";
import { Member } from "../models/member.model";
import { FullNamePipe } from "./full-name.pipe";
import { meaningfulAlias } from "../functions/member-names";

@Pipe({ name: "fullNameWithAlias" })
export class FullNameWithAliasPipe implements PipeTransform {

  private fullNamePipe = inject(FullNamePipe);

  transform(member: Member, defaultValue?: string) {
    return member ? this.fullNamePipe.transform(member, defaultValue) + (meaningfulAlias(member.nameAlias) ? " (" + member.nameAlias + ")" : "") : defaultValue;
  }
}
