import expect from "expect";
import { describe, it } from "mocha";
import { InboxMessage, InboxReaderProvider } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { withEnvelopeRecipient } from "../cloudflare/inbound-inbox-handler";
import { cloudflareIngressAliasesFromMessage, messageRecipientEmails } from "./inbox-aliases";
import { parseGmailMessage } from "./gmail-inbox-reader";
import { isOwnSentCopy } from "./inbox-message-import";
import { deliveredToFromMessage } from "../../../projects/ngx-ramblers/src/app/functions/inbox-thread";

function forwardedNewsletter(): InboxMessage {
  return parseGmailMessage({id: "newsletter", internalDate: "1000", payload: {headers: [
    {name: "From", value: "Newsletter <newsletter@example.com>"},
    {name: "To", value: "Alex Reed <alex@example.com>"},
    {name: "Delivered-To", value: "committee@example.com"},
    {name: "X-Forwarded-For", value: "membership@group.example.org.uk committee@example.com"}
  ]}});
}

function aliasesForMessage(message: InboxMessage) {
  return cloudflareIngressAliasesFromMessage(message, {id: "connection-1", provider: InboxReaderProvider.CLOUDFLARE_INGRESS} as any,
    [{type: "membership", email: "membership@group.example.org.uk", additionalEmails: []} as CommitteeMember], "default");
}

describe("inbox delivery addresses", () => {
  it("routes a Gmail-forwarded newsletter to Membership while preserving the visible To", () => {
    const message = forwardedNewsletter();
    expect(message.to).toEqual([{name: "Alex Reed", email: "alex@example.com"}]);
    expect(messageRecipientEmails(message)).toContain("membership@group.example.org.uk");
    expect(aliasesForMessage(message).map(alias => alias.roleType)).toEqual(["membership"]);
  });

  it("routes direct mail by its delivery envelope without altering the original headers", () => {
    const original = {...forwardedNewsletter(), deliveryRecipients: []};
    const message = withEnvelopeRecipient(original, "membership@group.example.org.uk");
    const [alias] = aliasesForMessage(message);
    expect(alias.roleType).toBe("membership");
    expect(message.from).toEqual(original.from);
    expect(message.to).toEqual(original.to);
    expect(message.cc).toEqual(original.cc);
    expect(deliveredToFromMessage(message, alias)).toEqual({name: null, email: "membership@group.example.org.uk"});
    expect(original.deliveryRecipients).toEqual([]);
  });

  it("keeps ordinary role-addressed mail working without forwarding metadata", () => {
    const message = {...forwardedNewsletter(), deliveryRecipients: [], to: [{name: "Membership", email: "membership@group.example.org.uk"}]};
    expect(aliasesForMessage(message).map(alias => alias.roleType)).toEqual(["membership"]);
  });

  it("keeps a role-delivered copy inbound even when an internal sender addressed an outside recipient", () => {
    const message = withEnvelopeRecipient({...forwardedNewsletter(), from: {name: "Sender", email: "webmaster@group.example.org.uk"}}, "membership@group.example.org.uk");
    const [alias] = aliasesForMessage(message);
    expect(isOwnSentCopy(message, new Set(["webmaster@group.example.org.uk", "membership@group.example.org.uk"]), alias)).toBe(false);
  });

  it("uses the actual direct destination when a visible recipient names another role", () => {
    const message = withEnvelopeRecipient({...forwardedNewsletter(), to: [{name: "Support", email: "support@group.example.org.uk"}]}, "membership@group.example.org.uk");
    expect(aliasesForMessage(message).map(alias => alias.roleType)).toEqual(["membership"]);
  });

  it("leaves genuinely unmatched mail in the general mailbox", () => {
    const message = {...forwardedNewsletter(), deliveryRecipients: []};
    expect(aliasesForMessage(message)[0].roleType).toBe("_general_connection-1");
  });
});
