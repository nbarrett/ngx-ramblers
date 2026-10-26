import { SortDirection } from "../models/sort.model";
import {
  BrevoEmailEvent,
  BrevoEventSource,
  BrevoEventType,
  BrevoTransactionalEmailSummary
} from "../models/mail.model";

export function transactionalSendAsRequestEvent(send: BrevoTransactionalEmailSummary): BrevoEmailEvent {
  return {
    email: send.email,
    date: send.date,
    subject: send.subject,
    messageId: send.messageId || "",
    event: BrevoEventType.REQUESTS,
    from: send.from,
    templateId: send.templateId,
    source: BrevoEventSource.TRANSACTIONAL
  };
}

export function mergeTransactionalSendsIntoEvents(
  events: BrevoEmailEvent[],
  sends: BrevoTransactionalEmailSummary[],
  sort = SortDirection.DESC
): BrevoEmailEvent[] {
  const requestIds = new Set<string>();
  const distinctEvents = events.filter(event => {
    if (event.event !== BrevoEventType.REQUESTS || !event.messageId) {
      return true;
    } else if (requestIds.has(event.messageId)) {
      return false;
    } else {
      requestIds.add(event.messageId);
      return true;
    }
  });
  const extras = sends
    .filter(send => send.messageId && !requestIds.has(send.messageId))
    .map(transactionalSendAsRequestEvent);
  const direction = sort === SortDirection.ASC ? 1 : -1;
  return [...distinctEvents, ...extras].sort((left, right) => direction * ((Date.parse(left.date) || 0) - (Date.parse(right.date) || 0)));
}
