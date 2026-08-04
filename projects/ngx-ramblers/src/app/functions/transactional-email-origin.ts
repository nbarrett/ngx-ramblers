import {
  BrevoTransactionalEmailSummary,
  TransactionalEmailOrigin
} from "../models/mail.model";

export function subjectStemFromTransactional(subject: string): string {
  const parts = (subject || "").split(" - ").map(part => part.trim()).filter(part => part.length > 0);
  return parts.length >= 3 ? parts.slice(0, -1).join(" - ") : (subject || "").trim();
}

export function transactionalOriginLabel(origin: TransactionalEmailOrigin): string {
  if (origin === TransactionalEmailOrigin.INBOX_REPLY) {
    return "Inbox reply";
  } else if (origin === TransactionalEmailOrigin.COMPOSER) {
    return "Composer send";
  } else if (origin === TransactionalEmailOrigin.SYSTEM) {
    return "System email";
  } else if (origin === TransactionalEmailOrigin.INBOX_DIGEST) {
    return "Inbox digest";
  } else {
    return "Outbound";
  }
}

export function classifyTransactionalOrigin(input: {
  subject: string;
  inboxInReplyTo?: string | null;
  inboxReferences?: string[] | null;
  hasInboxOutbound?: boolean;
}): TransactionalEmailOrigin {
  const replyHeadersPresent = Boolean(input.inboxInReplyTo)
    || (input.inboxReferences?.length ?? 0) > 0;
  if (isInboxDigestSubject(input.subject)) {
    return TransactionalEmailOrigin.INBOX_DIGEST;
  } else if (input.hasInboxOutbound && replyHeadersPresent) {
    return TransactionalEmailOrigin.INBOX_REPLY;
  } else if (input.hasInboxOutbound) {
    return TransactionalEmailOrigin.COMPOSER;
  } else if (isReplySubject(input.subject)) {
    return TransactionalEmailOrigin.INBOX_REPLY;
  } else {
    return TransactionalEmailOrigin.COMPOSER;
  }
}

export function groupOriginFromRecipients(recipients: BrevoTransactionalEmailSummary[]): TransactionalEmailOrigin {
  const origins = recipients.map(recipient => recipient.origin || TransactionalEmailOrigin.OUTBOUND);
  if (origins.includes(TransactionalEmailOrigin.INBOX_DIGEST)) {
    return TransactionalEmailOrigin.INBOX_DIGEST;
  } else if (origins.includes(TransactionalEmailOrigin.INBOX_REPLY)) {
    return TransactionalEmailOrigin.INBOX_REPLY;
  } else if (origins.every(origin => origin === TransactionalEmailOrigin.SYSTEM)) {
    return TransactionalEmailOrigin.SYSTEM;
  } else if (origins.includes(TransactionalEmailOrigin.COMPOSER)) {
    return TransactionalEmailOrigin.COMPOSER;
  } else if (origins.includes(TransactionalEmailOrigin.SYSTEM)) {
    return TransactionalEmailOrigin.SYSTEM;
  } else {
    return TransactionalEmailOrigin.OUTBOUND;
  }
}

export function isReplySubject(subject: string): boolean {
  return /^\s*(re|fwd?|aw)\s*:/i.test(subject || "");
}

export function isInboxDigestSubject(subject: string): boolean {
  const text = subject || "";
  return /\d+\s+new inbox messages?\s+for\s+/i.test(text)
    || /^new inbox mail in\s+/i.test(text.trim());
}

export function isSystemSubject(_subject: string): boolean {
  return false;
}
