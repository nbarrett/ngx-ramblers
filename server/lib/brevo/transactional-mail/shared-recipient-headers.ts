import { SharedRecipientHeaderOptions, SharedRecipientHeaders } from "../../../../projects/ngx-ramblers/src/app/models/email-composer.model";

export function sharedRecipientHeaders(options: SharedRecipientHeaderOptions): SharedRecipientHeaders {
  if (options.memberRecipientsAsBcc) {
    return {
      to: options.externalToRecipients,
      bcc: [...options.existingBccRecipients, ...options.memberRecipients]
    };
  } else {
    return {
      to: [...options.memberRecipients, ...options.externalToRecipients],
      bcc: options.existingBccRecipients
    };
  }
}
