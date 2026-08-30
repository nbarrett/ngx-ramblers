import {
  classifyTransactionalOrigin,
  isSystemSubject,
  transactionalOriginLabel
} from "./transactional-email-origin";
import { TransactionalEmailOrigin } from "../models/mail.model";

describe("classifyTransactionalOrigin", () => {
  it("uses inbox outbound with inReplyTo as inbox reply", () => {
    expect(classifyTransactionalOrigin({
      subject: "Re: Testing inbox works okay",
      hasInboxOutbound: true,
      inboxInReplyTo: "<parent@example.com>",
      inboxReferences: ["<parent@example.com>"]
    })).toBe(TransactionalEmailOrigin.INBOX_REPLY);
  });

  it("uses inbox outbound without reply headers as composer send", () => {
    expect(classifyTransactionalOrigin({
      subject: "Group newsletter",
      hasInboxOutbound: true,
      inboxInReplyTo: null,
      inboxReferences: []
    })).toBe(TransactionalEmailOrigin.COMPOSER);
  });

  it("treats login and committee subjects as composer sends without inbox reply evidence", () => {
    expect(classifyTransactionalOrigin({
      subject: "Example Group - Your NGX-Ramblers Login - Member One",
      hasInboxOutbound: false
    })).toBe(TransactionalEmailOrigin.COMPOSER);
    expect(classifyTransactionalOrigin({
      subject: "Example Group - Follow on from demo & Your NGX-Ramblers Login - Member Two",
      hasInboxOutbound: false
    })).toBe(TransactionalEmailOrigin.COMPOSER);
    expect(isSystemSubject(
      "Example Group - Your NGX-Ramblers Login - Member One"
    )).toBe(false);
  });

  it("falls back to Re: subject as inbox reply when inbox row is missing", () => {
    expect(classifyTransactionalOrigin({
      subject: "Re: Hello",
      hasInboxOutbound: false
    })).toBe(TransactionalEmailOrigin.INBOX_REPLY);
  });

  it("classifies inbox digest notifications", () => {
    expect(classifyTransactionalOrigin({
      subject: "1 new inbox message for Chairman Messages",
      hasInboxOutbound: false
    })).toBe(TransactionalEmailOrigin.INBOX_DIGEST);
    expect(classifyTransactionalOrigin({
      subject: "3 new inbox messages for Membership Secretary",
      hasInboxOutbound: false
    })).toBe(TransactionalEmailOrigin.INBOX_DIGEST);
    expect(classifyTransactionalOrigin({
      subject: "1 new inbox message for Walks Co-ordinator",
      hasInboxOutbound: false
    })).toBe(TransactionalEmailOrigin.INBOX_DIGEST);
  });

  it("labels origins for the UI", () => {
    expect(transactionalOriginLabel(TransactionalEmailOrigin.INBOX_REPLY)).toBe("Inbox reply");
    expect(transactionalOriginLabel(TransactionalEmailOrigin.COMPOSER)).toBe("Composer send");
    expect(transactionalOriginLabel(TransactionalEmailOrigin.SYSTEM)).toBe("System email");
    expect(transactionalOriginLabel(TransactionalEmailOrigin.INBOX_DIGEST)).toBe("Inbox digest");
  });
});
