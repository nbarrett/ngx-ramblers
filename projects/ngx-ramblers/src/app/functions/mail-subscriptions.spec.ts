import { describe, expect, it } from "vitest";
import { ListSetting, MailSubscription } from "../models/mail.model";
import { Member } from "../models/member.model";
import { ensureMemberMailSubscriptions, subscribableMailSubscriptions } from "./mail-subscriptions";

function listSetting(id: number, memberSubscribable: boolean): ListSetting {
  return {
    id,
    name: `List ${id}`,
    memberSubscribable,
    autoSubscribeNewMembers: false,
    requiresMemberEmailMarketingConsent: false
  };
}

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: "member-1",
    firstName: "Alex",
    lastName: "Reed",
    email: "alex.reed@example.com",
    ...overrides
  } as Member;
}

describe("ensureMemberMailSubscriptions", () => {
  it("creates mail.subscriptions on a member that has no mail object", () => {
    const alex = member();
    const subscriptions = ensureMemberMailSubscriptions(alex);
    expect(subscriptions).toEqual([]);
    expect(alex.mail.subscriptions).toBe(subscriptions);
    expect(alex.mail.email).toEqual("alex.reed@example.com");
  });

  it("creates the subscriptions array when mail exists without one", () => {
    const alex = member({mail: {email: "alex.reed@example.com", id: 12} as Member["mail"]});
    const subscriptions = ensureMemberMailSubscriptions(alex);
    expect(subscriptions).toEqual([]);
    expect(alex.mail.subscriptions).toBe(subscriptions);
  });
});

describe("subscribableMailSubscriptions", () => {
  const walks = listSetting(2, true);
  const committee = listSetting(8, false);
  const newsletter = listSetting(4, true);

  it("returns an empty array when there are no list settings", () => {
    expect(subscribableMailSubscriptions(member(), null)).toEqual([]);
    expect(subscribableMailSubscriptions(member(), [])).toEqual([]);
  });

  it("reuses the same subscription objects on later calls so change detection stays stable", () => {
    const alex = member({
      mail: {
        email: "alex.reed@example.com",
        id: 12,
        subscriptions: [{id: 2, subscribed: true}]
      }
    });
    const first = subscribableMailSubscriptions(alex, [walks, committee, newsletter]);
    const second = subscribableMailSubscriptions(alex, [walks, committee, newsletter]);
    expect(first.map(item => item.id)).toEqual([2, 4]);
    expect(first[0].subscribed).toEqual(true);
    expect(first[1].subscribed).toEqual(false);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
    expect(alex.mail.subscriptions).toEqual(first);
  });

  it("does not treat missing member.mail.subscriptions as a crash", () => {
    const alex = member();
    const result = subscribableMailSubscriptions(alex, [walks]);
    expect(result).toEqual([{id: 2, subscribed: false} as MailSubscription]);
  });
});
