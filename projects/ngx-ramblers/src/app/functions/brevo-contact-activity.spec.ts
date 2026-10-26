import { SortDirection } from "../models/sort.model";
import { mergeTransactionalSendsIntoEvents, transactionalSendAsRequestEvent } from "./brevo-contact-activity";
import { BrevoEventSource, BrevoEventType, BrevoTransactionalEmailSummary } from "../models/mail.model";

function send(partial: Partial<BrevoTransactionalEmailSummary> & Pick<BrevoTransactionalEmailSummary, "email" | "subject" | "date" | "messageId">): BrevoTransactionalEmailSummary {
  return {
    uuid: partial.uuid || "",
    ...partial
  };
}

describe("transactionalSendAsRequestEvent", () => {
  it("maps a send log row to a requests event", () => {
    expect(transactionalSendAsRequestEvent(send({
      email: "alex.reed@example.com",
      subject: "NGX-Ramblers - Mobile Trial - Your login details",
      date: "2026-10-25T19:19:00.000Z",
      messageId: "<trial-1@example.com>",
      from: "chair@group.example.org.uk",
      templateId: 14
    }))).toEqual({
      email: "alex.reed@example.com",
      date: "2026-10-25T19:19:00.000Z",
      subject: "NGX-Ramblers - Mobile Trial - Your login details",
      messageId: "<trial-1@example.com>",
      event: BrevoEventType.REQUESTS,
      from: "chair@group.example.org.uk",
      templateId: 14,
      source: BrevoEventSource.TRANSACTIONAL
    });
  });
});

describe("mergeTransactionalSendsIntoEvents", () => {
  it("adds a send that the statistics events list omitted", () => {
    const merged = mergeTransactionalSendsIntoEvents([], [send({
      email: "alex.reed@example.com",
      subject: "Login details",
      date: "2026-10-25T19:19:00.000Z",
      messageId: "<trial-1@example.com>"
    })]);
    expect(merged.length).toBe(1);
    expect(merged[0].event).toBe(BrevoEventType.REQUESTS);
    expect(merged[0].messageId).toBe("<trial-1@example.com>");
  });

  it("does not duplicate a requests event already present for the same message", () => {
    const existing = transactionalSendAsRequestEvent(send({
      email: "alex.reed@example.com",
      subject: "Login details",
      date: "2026-10-25T19:19:00.000Z",
      messageId: "<trial-1@example.com>"
    }));
    const merged = mergeTransactionalSendsIntoEvents([existing], [send({
      email: "alex.reed@example.com",
      subject: "Login details",
      date: "2026-10-25T19:19:00.000Z",
      messageId: "<trial-1@example.com>"
    })]);
    expect(merged.length).toBe(1);
  });

  it("keeps later events first", () => {
    const merged = mergeTransactionalSendsIntoEvents([{
      email: "alex.reed@example.com",
      date: "2026-10-25T20:00:00.000Z",
      messageId: "<open-1@example.com>",
      event: BrevoEventType.OPENED
    }], [send({
      email: "alex.reed@example.com",
      subject: "Login details",
      date: "2026-10-25T19:19:00.000Z",
      messageId: "<trial-1@example.com>"
    })]);
    expect(merged.map(event => event.event)).toEqual([BrevoEventType.OPENED, BrevoEventType.REQUESTS]);
  });
});

describe("merged activity pagination", () => {
  const sent = {email: "alex.reed@example.com", subject: "Login", date: "2026-10-25T19:19:00.000Z", messageId: "one", uuid: "one"};
  it("keeps an ascending report in ascending order", () => {
    const event = {...transactionalSendAsRequestEvent(sent), messageId: "two", date: "2026-10-26T19:19:00.000Z"};
    expect(mergeTransactionalSendsIntoEvents([event], [sent], SortDirection.ASC).map(item => item.messageId)).toEqual(["one", "two"]);
  });
  it("does not duplicate a send when the statistics request arrives on a later page", () => {
    const event = transactionalSendAsRequestEvent(sent);
    expect(mergeTransactionalSendsIntoEvents([event, {...event, date: "2026-10-25T19:19:01.000Z"}], []).length).toBe(1);
  });
});
