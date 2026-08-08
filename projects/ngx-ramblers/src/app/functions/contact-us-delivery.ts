import { CommitteeMember, ForwardEmailTarget } from "../models/committee.model";
import { EmailAddress } from "../models/mail.model";
import { normaliseEmail } from "./strings";

export function effectiveContactUsTarget(member: CommitteeMember): ForwardEmailTarget | undefined {
  return member?.contactUsTarget ?? member?.forwardEmailTarget;
}

export function resolveContactUsRecipientAddresses(
  member: CommitteeMember,
  options: { catchAllEmail?: string | null } = {}
): EmailAddress[] {
  let result: EmailAddress[] = [];
  if (member) {
    const label = member.contactUsLabel || member.fullName;
    const named = (email: string): EmailAddress => ({name: label, email});
    const roleEmail = (): EmailAddress[] => member.email ? [named(member.email)] : [];
    const target = effectiveContactUsTarget(member);
    const custom = member.contactUsCustom ?? member.forwardEmailCustom;
    const recipients = (member.contactUsRecipients ?? member.forwardEmailRecipients) || [];
    if (target === ForwardEmailTarget.NONE) {
      result = [];
    } else if (target === ForwardEmailTarget.CUSTOM) {
      result = custom ? [named(custom)] : roleEmail();
    } else if (target === ForwardEmailTarget.CATCHALL) {
      const catchAll = options.catchAllEmail || custom;
      result = catchAll ? [named(catchAll)] : roleEmail();
    } else if (target === ForwardEmailTarget.MULTIPLE) {
      const filtered = recipients.filter(Boolean);
      result = filtered.length > 0 ? filtered.map(named) : roleEmail();
    } else if (target === ForwardEmailTarget.ROLE_EMAIL) {
      result = roleEmail();
    } else {
      result = roleEmail();
    }
  }
  return result;
}

export function contactUsDeliveryProblem(
  member: CommitteeMember,
  senderEmail: string,
  options: { catchAllEmail?: string | null } = {}
): string | null {
  let problem: string | null = null;
  if (!member) {
    problem = "No committee role is configured for this contact link.";
  } else {
    const target = effectiveContactUsTarget(member);
    if (target === ForwardEmailTarget.NONE) {
      problem = `Contact-us submissions are disabled for the "${member.fullName || member.description || member.type}" role. Ask the site admin to choose where those messages should go.`;
    } else {
      const to = resolveContactUsRecipientAddresses(member, options);
      if (to.length === 0) {
        problem = `No contact recipient is configured for ${member.contactUsLabel || member.fullName || member.type}. Ask the site admin to set where contact-us messages for this role should go.`;
      } else {
        const from = normaliseEmail(senderEmail);
        if (from) {
          const everyToMatchesFrom = to.every(address => normaliseEmail(address.email) === from);
          if (everyToMatchesFrom
            && target !== ForwardEmailTarget.CATCHALL
            && target !== ForwardEmailTarget.ROLE_EMAIL) {
            problem = `Messages for "${member.fullName || member.description || member.type}" would be sent from and to the same address (${from}). Ask the site admin to send contact-us submissions to the role address, a catch-all, a custom address, or a list of people.`;
          }
        }
      }
    }
  }
  return problem;
}
