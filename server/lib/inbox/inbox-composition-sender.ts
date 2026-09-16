import { BrandingMode } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { InboxAddress } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { EmailComposerState } from "../../../projects/ngx-ramblers/src/app/models/email-composer.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";

export interface CompositionSenderCandidates {
  brandingMode?: string;
  brandedSenderEmail?: string;
  unbrandedSenderEmail?: string;
  ownerEmail?: string;
  aliasEmail?: string;
  mailboxAccountEmail?: string;
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
