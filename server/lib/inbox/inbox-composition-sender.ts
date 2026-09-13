import { BrandingMode } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";

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
  const chosenForBranding = candidates.brandingMode === BrandingMode.UNBRANDED
    ? candidates.unbrandedSenderEmail
    : candidates.brandedSenderEmail;
  const alternative = candidates.brandingMode === BrandingMode.UNBRANDED
    ? candidates.brandedSenderEmail
    : candidates.unbrandedSenderEmail;
  return [chosenForBranding, alternative, candidates.ownerEmail, candidates.aliasEmail].find(usable) ?? "";
}
