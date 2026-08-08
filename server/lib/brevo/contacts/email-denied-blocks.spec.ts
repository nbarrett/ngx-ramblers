import expect from "expect";
import { describe, it } from "mocha";
import {
  applyDenialHintToBlockedContact,
  blockedAtWithinRange,
  blockedContactFromDeniedBrevoContact,
  denialHintFromContactStatistics,
  denialHintFromTransactionalEvents,
  mergeBlockedContactLists,
  preferredDenialHint
} from "./email-denied-blocks";
import { BlockedContactReasonCode } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

describe("email-denied-blocks", () => {

  it("maps a Brevo-denied contact to a Blocks row", () => {
    const mapped = blockedContactFromDeniedBrevoContact({
      email: "lisa@example.com",
      id: 244,
      listIds: [1, 2],
      emailBlacklisted: true,
      createdAt: "2024-12-06T19:47:41.000Z",
      modifiedAt: "2026-08-08T08:40:00.000Z"
    });
    expect(mapped).toEqual({
      email: "lisa@example.com",
      senderEmail: "",
      reason: {
        code: BlockedContactReasonCode.EMAIL_DENIED,
        message: "Global email denied on the Brevo contact"
      },
      blockedAt: "2026-08-08T08:40:00.000Z",
      listIds: [1, 2],
      emailBlocked: true,
      brevoContactId: 244
    });
  });

  it("ignores contacts that are not email-denied", () => {
    expect(blockedContactFromDeniedBrevoContact({
      email: "ok@example.com",
      emailBlacklisted: false,
      modifiedAt: "2026-08-08T08:40:00.000Z"
    })).toBeNull();
  });

  it("applies date range filters on blockedAt", () => {
    expect(blockedAtWithinRange("2026-05-23T20:05:00.000Z", "2026-05-01", "2026-05-31")).toBe(true);
    expect(blockedAtWithinRange("2026-05-23T20:05:00.000Z", "2026-06-01", "2026-06-30")).toBe(false);
    expect(blockedAtWithinRange("2026-05-23T20:05:00.000Z", undefined, undefined)).toBe(true);
  });

  it("merges lists without duplicating emails", () => {
    const merged = mergeBlockedContactLists(
      [{email: "a@example.com", senderEmail: "", reason: {}, blockedAt: "2026-01-01"}],
      [
        {email: "a@example.com", senderEmail: "", reason: {}, blockedAt: "2026-02-01"},
        {email: "b@example.com", senderEmail: "", reason: {}, blockedAt: "2026-03-01"}
      ]
    );
    expect(merged.map(contact => contact.email)).toEqual(["a@example.com", "b@example.com"]);
  });

  it("prefers spam complaint over a near-simultaneous unsubscribe", () => {
    const hint = denialHintFromContactStatistics({
      complaints: [{campaignId: 9, eventTime: "2026-05-23T20:05:57.000Z"}],
      hardBounces: [{campaignId: 3, eventTime: "2026-05-01T10:00:00.000Z"}],
      unsubscriptions: {
        userUnsubscription: [{campaignId: 9, eventTime: "2026-05-23T20:05:58.000Z"}]
      }
    });
    expect(hint).toEqual({
      reasonCode: BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM,
      eventTime: "2026-05-23T20:05:57.000Z",
      campaignId: 9
    });
    const enriched = applyDenialHintToBlockedContact(
      {
        email: "lisa@example.com",
        senderEmail: "",
        reason: {code: BlockedContactReasonCode.EMAIL_DENIED, message: "Global email denied"},
        blockedAt: "2026-08-08T09:40:00.000Z"
      },
      hint,
      {
        subject: "Please consider being a walk leader for Canterbury Ramblers",
        senderEmail: "chairman@example.com"
      }
    );
    expect(enriched.reason?.code).toBe(BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM);
    expect(enriched.reason?.message).toBe("Please consider being a walk leader for Canterbury Ramblers");
    expect(enriched.senderEmail).toBe("chairman@example.com");
    expect(enriched.blockedAt).toBe("2026-05-23T20:05:57.000Z");
  });

  it("uses transactional hard-bounce event time rather than contact modifiedAt", () => {
    const transactional = denialHintFromTransactionalEvents([
      {event: "requests", date: "2026-08-01T19:14:13.000Z", subject: "Your Login Details", from: "chair@example.com"},
      {event: "hardBounces", date: "2026-08-01T19:14:14.000Z", subject: "Your Login Details", from: "chair@example.com"},
      {event: "unsubscribed", date: "2026-08-01T19:14:15.000Z", subject: "Your Login Details", from: "chair@example.com"}
    ]);
    const preferred = preferredDenialHint(transactional, null);
    expect(preferred?.reasonCode).toBe(BlockedContactReasonCode.HARD_BOUNCE);
    expect(preferred?.eventTime).toBe("2026-08-01T19:14:14.000Z");
    const enriched = applyDenialHintToBlockedContact(
      {
        email: "denise@example.com",
        senderEmail: "",
        reason: {code: BlockedContactReasonCode.EMAIL_DENIED},
        blockedAt: "2026-08-08T09:40:00.000Z"
      },
      preferred,
      {subject: "Your Login Details", senderEmail: "chair@example.com"}
    );
    expect(enriched.blockedAt).toBe("2026-08-01T19:14:14.000Z");
    expect(enriched.reason?.message).toBe("Your Login Details");
  });
});
