import { inject, Injectable } from "@angular/core";
import { Member } from "../../models/member.model";
import { MailListUpdaterService } from "./mail-list-updater.service";
import { StringUtilsService } from "../string-utils.service";

const TOOLTIP_NAME_PREVIEW_LIMIT = 30;

@Injectable({providedIn: "root"})
export class ListSubscriberService {

  private mailListUpdaterService = inject(MailListUpdaterService);
  private stringUtils = inject(StringUtilsService);

  private subscribedMembers(members: Member[], listId: number): Member[] {
    return this.mailListUpdaterService.subscribedMembers(members, listId);
  }

  subscriberCount(members: Member[], listId: number): number {
    return this.subscribedMembers(members, listId).length;
  }

  subscriberCountLabel(members: Member[], listId: number): string {
    return this.stringUtils.pluraliseWithCount(this.subscriberCount(members, listId), "subscriber");
  }

  subscriberNamesTooltip(members: Member[], listId: number): string {
    const names = this.subscribedMembers(members, listId)
      .map(member => `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim())
      .filter(name => name.length > 0)
      .sort();
    if (names.length === 0) {
      return "No members subscribed";
    }
    const preview = names.slice(0, TOOLTIP_NAME_PREVIEW_LIMIT).join(", ");
    return names.length > TOOLTIP_NAME_PREVIEW_LIMIT
      ? `${preview} and ${names.length - TOOLTIP_NAME_PREVIEW_LIMIT} more`
      : preview;
  }
}
