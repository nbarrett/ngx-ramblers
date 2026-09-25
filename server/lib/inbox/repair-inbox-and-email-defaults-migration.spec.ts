import expect from "expect";
import { describe, it } from "mocha";
import { InboxMessage, InboxMessageDirection, InboxReaderProvider } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { misclassifiedInboundMessage } from "../mongo/migrations/database/20260925190000-repair-inbox-and-email-defaults";

describe("repair inbox and email defaults migration", () => {
  const internalEmails = new Set(["internal.sender@shared-provider.example", "role@group.example"]);

  function message(from: string, to: string): InboxMessage {
    return {
      direction: InboxMessageDirection.OUTBOUND,
      externalSource: InboxReaderProvider.CLOUDFLARE_INGRESS,
      externalId: "external-message-id",
      from: {name: null, email: from},
      to: [{name: null, email: to}],
      cc: []
    } as InboxMessage;
  }

  it("restores an external sender whose recipient is internal", () => {
    expect(misclassifiedInboundMessage(
      message("external.sender@shared-provider.example", "role@group.example"),
      internalEmails
    )).toBe(true);
  });

  it("restores an external sender after the internal recipient was removed", () => {
    expect(misclassifiedInboundMessage(
      message("external.sender@shared-provider.example", "other.recipient@another-group.example"),
      internalEmails
    )).toBe(true);
  });

  it("leaves a genuine sent message alone", () => {
    expect(misclassifiedInboundMessage(
      message("role@group.example", "external.sender@shared-provider.example"),
      internalEmails
    )).toBe(false);
  });

  it("leaves an NGX composer message alone", () => {
    const composition = {
      ...message("external.sender@shared-provider.example", "recipient@another-group.example"),
      externalSource: InboxReaderProvider.EMAIL_COMPOSER
    };
    expect(misclassifiedInboundMessage(composition, internalEmails)).toBe(false);
  });
});
