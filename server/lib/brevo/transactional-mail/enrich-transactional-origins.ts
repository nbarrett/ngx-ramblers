import { inboxMessage } from "../../mongo/models/inbox-message";
import {
  BrevoTransactionalEmailSummary,
  TransactionalEmailOrigin
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import {
  classifyTransactionalOrigin,
  transactionalOriginLabel
} from "../../../../projects/ngx-ramblers/src/app/functions/transactional-email-origin";
import { InboxMessageDirection } from "../../../../projects/ngx-ramblers/src/app/models/inbox.model";

function messageIdVariants(messageId: string): string[] {
  const trimmed = (messageId || "").trim();
  if (!trimmed) {
    return [];
  } else {
    const bare = trimmed.replace(/^<|>$/g, "");
    return [...new Set([trimmed, bare, `<${bare}>`].filter(Boolean))];
  }
}

function normalisedMessageId(messageId: string): string {
  return (messageId || "").trim().replace(/^<|>$/g, "");
}

export async function enrichTransactionalEmailOrigins(
  emails: BrevoTransactionalEmailSummary[]
): Promise<BrevoTransactionalEmailSummary[]> {
  const lookupIds = [...new Set(emails.flatMap(email => messageIdVariants(email.messageId)))];
  if (lookupIds.length === 0) {
    return emails.map(email => withOrigin(email, classifyTransactionalOrigin({subject: email.subject})));
  } else {
    const inboxRows = await inboxMessage.find({
      messageId: {$in: lookupIds},
      direction: InboxMessageDirection.OUTBOUND
    }).select("messageId inReplyTo references threadId direction").lean();
    const byNormalisedId = new Map(
      inboxRows.map(row => [normalisedMessageId(row.messageId), row])
    );
    return emails.map(email => {
      const inbox = byNormalisedId.get(normalisedMessageId(email.messageId));
      const origin = classifyTransactionalOrigin({
        subject: email.subject,
        inboxInReplyTo: inbox?.inReplyTo ?? null,
        inboxReferences: inbox?.references ?? null,
        hasInboxOutbound: Boolean(inbox)
      });
      return withOrigin(email, origin, inbox?.threadId ?? null);
    });
  }
}

function withOrigin(
  email: BrevoTransactionalEmailSummary,
  origin: TransactionalEmailOrigin,
  threadId: string | null = null
): BrevoTransactionalEmailSummary {
  return {
    ...email,
    origin,
    originLabel: transactionalOriginLabel(origin),
    threadId
  };
}
