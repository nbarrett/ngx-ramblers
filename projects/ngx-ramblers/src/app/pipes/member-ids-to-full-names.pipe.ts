import { Pipe, PipeTransform } from "@angular/core";
import { Member } from "../models/member.model";
import { FullNameWithAliasPipe } from "./full-name-with-alias.pipe";
import { MemberIdToFullNamePipe } from "./member-id-to-full-name.pipe";

@Pipe({ name: "memberIdsToFullNames" })
export class MemberIdsToFullNamesPipe implements PipeTransform {
  constructor(private memberIdToFullNamePipe: MemberIdToFullNamePipe,
              private fullNameWithAliasPipe: FullNameWithAliasPipe) {
  }

  transform(memberIds: string[], members: Member[], defaultValue?: string) {
    return memberIds.map(memberId => this.memberIdToFullNamePipe.transform(memberId, members, defaultValue)).join(", ");
  }
}
