import {
  BrevoTransactionalEmailSummary,
  TransactionalEmailOrigin,
  TransactionalSendActionGroup
} from "../models/mail.model";
import {
  groupOriginFromRecipients,
  isInboxDigestSubject,
  subjectStemFromTransactional,
  transactionalOriginLabel
} from "./transactional-email-origin";

export { subjectStemFromTransactional } from "./transactional-email-origin";

export const TRANSACTIONAL_SEND_GROUP_WINDOW_MS = 5 * 60 * 1000;

export function groupTransactionalEmailsBySendAction(
  emails: BrevoTransactionalEmailSummary[],
  windowMs: number = TRANSACTIONAL_SEND_GROUP_WINDOW_MS
): TransactionalSendActionGroup[] {
  type WorkingGroup = Omit<TransactionalSendActionGroup, "origin" | "originLabel"> & { lastSentMs: number };
  const sorted = [...emails].sort((a, b) => eventTimeMs(a) - eventTimeMs(b));
  const groups: WorkingGroup[] = [];
  sorted.forEach((email, index) => {
    const stem = subjectStemFromTransactional(email.subject) || "(no subject)";
    const time = eventTimeMs(email);
    const openIndex = groups.findIndex(group =>
      group.subjectStem === stem && Math.abs(time - group.lastSentMs) <= windowMs
    );
    if (openIndex >= 0) {
      const open = groups[openIndex];
      groups[openIndex] = {
        ...open,
        recipients: [...open.recipients, email],
        lastSentMs: Math.max(open.lastSentMs, time),
        sentAt: time < eventTimeMs({date: open.sentAt}) ? email.date : open.sentAt,
        from: open.from || email.from
      };
    } else {
      groups.push({
        id: `${stem}-${time}-${index}`,
        subjectStem: stem,
        sentAt: email.date,
        from: email.from,
        recipients: [email],
        lastSentMs: time
      });
    }
  });

  return groups
    .map(group => {
      const recipients = [...group.recipients].sort((a, b) => eventTimeMs(b) - eventTimeMs(a));
      const fromRecipients = groupOriginFromRecipients(recipients);
      const origin = isInboxDigestSubject(group.subjectStem)
        || recipients.some(recipient => isInboxDigestSubject(recipient.subject))
        ? TransactionalEmailOrigin.INBOX_DIGEST
        : fromRecipients;
      return {
        id: group.id,
        subjectStem: group.subjectStem,
        sentAt: group.sentAt,
        from: group.from,
        origin,
        originLabel: transactionalOriginLabel(origin),
        recipients
      };
    })
    .sort((a, b) => latestRecipientMs(b) - latestRecipientMs(a));
}

function eventTimeMs(email: Pick<BrevoTransactionalEmailSummary, "date">): number {
  const parsed = Date.parse(email.date || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestRecipientMs(group: Pick<TransactionalSendActionGroup, "recipients" | "sentAt">): number {
  return group.recipients.reduce((latest, email) => Math.max(latest, eventTimeMs(email)), eventTimeMs({date: group.sentAt}));
}
