import {uniq} from "es-toolkit/compat";
import {BatchTransactionalSendRequest, RecipientMode} from "../../../../projects/ngx-ramblers/src/app/models/email-composer.model";
import {BrandingMode} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import {composerSelectedMembersAreCommitteeAudience} from "../../../../projects/ngx-ramblers/src/app/functions/email-composer";
import {member} from "../../mongo/models/member";

export async function unbrandedRecipientListsAllowed(request: BatchTransactionalSendRequest): Promise<boolean> {
  if (request.brandingMode !== BrandingMode.UNBRANDED) {
    return true;
  } else {
    const listIds = uniq([
      ...(request.recipientListIds ?? []),
      ...[...(request.externalRecipients ?? []), ...(request.ccRecipients ?? []), ...(request.bccRecipients ?? [])]
        .flatMap(recipient => recipient.listId == null ? [] : [recipient.listId])
    ]);
    if (request.recipientMode === RecipientMode.ENTIRE_LIST && listIds.length === 0) {
      return false;
    } else {
      const allowed = await Promise.all(listIds.map(async id => {
        const subscribers = await member.find({
          groupMember: true,
          email: {$nin: [null, ""]},
          "mail.subscriptions": {$elemMatch: {id, subscribed: true}}
        }).lean();
        return composerSelectedMembersAreCommitteeAudience(subscribers, subscribers.length);
      }));
      return allowed.every(Boolean);
    }
  }
}
