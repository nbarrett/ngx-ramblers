import { BrandingMode, EmailAttachment } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { InboxAddress, InboxAttachment } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { EmailComposerState } from "../../../projects/ngx-ramblers/src/app/models/email-composer.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { isString } from "es-toolkit/compat";

export interface CompositionSenderCandidates {
  brandingMode?: string;
  brandedSenderEmail?: string;
  unbrandedSenderEmail?: string;
  ownerEmail?: string;
  aliasEmail?: string;
  mailboxAccountEmail?: string;
}

function filenameFromComposerAttachment(attachment: EmailAttachment): string {
  const named = isString(attachment.name) ? attachment.name.trim() : "";
  if (named) {
    return named;
  } else {
    const url = isString(attachment.url) ? attachment.url : "";
    const path = url.split("?")[0];
    const lastSegment = path.split("/").filter(Boolean).pop() ?? "";
    try {
      return decodeURIComponent(lastSegment);
    } catch {
      return lastSegment;
    }
  }
}

function s3KeyFromComposerAttachment(attachment: EmailAttachment): string {
  const url = isString(attachment.url) ? attachment.url : "";
  const marker = "api/aws/s3/";
  const index = url.indexOf(marker);
  if (index >= 0) {
    return url.slice(index + marker.length);
  } else {
    return url;
  }
}

export function inboxAttachmentsFromComposer(attachments: EmailAttachment[] | undefined): InboxAttachment[] {
  return (attachments ?? []).flatMap(attachment => {
    const filename = filenameFromComposerAttachment(attachment);
    if (!filename) {
      return [];
    } else {
      return [{
        filename,
        contentType: "application/octet-stream",
        sizeBytes: attachment.sizeBytes ?? 0,
        s3Key: s3KeyFromComposerAttachment(attachment),
        contentId: null
      }];
    }
  });
}

export function compositionSenderEmail(candidates: CompositionSenderCandidates): string {
  const mailboxAccount = candidates.mailboxAccountEmail ? normaliseEmail(candidates.mailboxAccountEmail) : null;
  const usable = (email?: string) => !!email && (!mailboxAccount || normaliseEmail(email) !== mailboxAccount);
  const sentUnbranded = candidates.brandingMode === BrandingMode.UNBRANDED;
  const ownModeAddress = sentUnbranded ? candidates.unbrandedSenderEmail : candidates.brandedSenderEmail;
  const otherModeAddress = sentUnbranded ? candidates.brandedSenderEmail : candidates.unbrandedSenderEmail;
  return [ownModeAddress, otherModeAddress, candidates.ownerEmail, candidates.aliasEmail].find(usable) ?? "";
}

export function holdsMailboxAccountAddress(address: InboxAddress | null | undefined, accountEmails: Set<string>): boolean {
  return !!address?.email && accountEmails.has(normaliseEmail(address.email));
}

export function senderOutsideMailboxAccounts(address: InboxAddress | null | undefined, accountEmails: Set<string>): InboxAddress | null {
  return address?.email && !holdsMailboxAccountAddress(address, accountEmails) ? address : null;
}

export function replacementSender(currentFrom: InboxAddress,
                                  state: Partial<Pick<EmailComposerState, "brandingMode" | "brandedSenderEmail" | "unbrandedSenderEmail">> | null | undefined,
                                  owner: Partial<Pick<Member, "email" | "firstName" | "lastName">> | null | undefined): InboxAddress | null {
  const email = compositionSenderEmail({
    brandingMode: state?.brandingMode,
    brandedSenderEmail: state?.brandedSenderEmail ?? undefined,
    unbrandedSenderEmail: state?.unbrandedSenderEmail ?? undefined,
    ownerEmail: owner?.email ?? undefined,
    mailboxAccountEmail: currentFrom.email
  });
  if (!email) {
    return null;
  } else {
    const name = currentFrom.name || [owner?.firstName, owner?.lastName].filter(Boolean).join(" ");
    return {name: name || "", email};
  }
}
