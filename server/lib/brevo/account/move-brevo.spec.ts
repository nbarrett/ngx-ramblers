import expect from "expect";
import { describe, it } from "mocha";
import { ObjectId } from "mongodb";
import { MailSubscription, NotificationConfig } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { MoveBrevoListPlan, MoveBrevoStatus } from "../../../../projects/ngx-ramblers/src/app/models/move-brevo.model";
import { MoveBrevoDestination, MoveBrevoMemberUpdate, MoveBrevoNotificationUpdate, MoveBrevoPersist, MoveBrevoPropagationInput } from "./move-brevo.model";
import {
  contactableMembers,
  isAlreadyExistsError,
  listPlans,
  mailSubscriptions,
  mergeListSettings,
  notificationUpdates,
  propagateDestination,
  remapSubscriptions
} from "./move-brevo";

function member(email: string, subscriptions: MailSubscription[], extra: Partial<Member> = {}): Member & { _id: ObjectId } {
  return {
    _id: new ObjectId(),
    email,
    firstName: "Pat",
    lastName: "Lee",
    mail: { subscriptions },
    ...extra
  } as Member & { _id: ObjectId };
}

function notification(defaultListId: number): NotificationConfig & { _id: ObjectId } {
  return { _id: new ObjectId(), defaultListId } as NotificationConfig & { _id: ObjectId };
}

function listSetting(id: number, name: string) {
  return { id, name, memberSubscribable: false, autoSubscribeNewMembers: false, requiresMemberEmailMarketingConsent: false };
}

function fakeDestination(overrides: Partial<MoveBrevoDestination> = {}): MoveBrevoDestination {
  const ids = { folder: 100, list: 200, contact: 300 };
  return {
    ensureDomain: async () => ({ authenticated: true, authenticationRequested: false, dnsRecords: null, message: "" }),
    createSender: async () => undefined,
    folders: async () => [],
    lists: async () => [],
    createFolder: async () => ++ids.folder,
    createList: async () => ++ids.list,
    createContact: async () => ++ids.contact,
    contactIdByEmail: async () => 999,
    addContactToLists: async () => undefined,
    webhookUrls: async () => [],
    createWebhook: async () => undefined,
    ...overrides
  };
}

function recordingPersist(overrides: Partial<MoveBrevoPersist> = {}) {
  const writes = {
    members: [] as MoveBrevoMemberUpdate[],
    notifications: [] as MoveBrevoNotificationUpdate[],
    mailConfig: [] as { apiKey: string; listIds: number[] }[]
  };
  const persist: MoveBrevoPersist = {
    updateMember: async update => {
      writes.members.push(update);
    },
    updateNotificationList: async update => {
      writes.notifications.push(update);
    },
    updateMailConfig: async (apiKey, listSettings) => {
      writes.mailConfig.push({ apiKey, listIds: listSettings.map(setting => setting.id) });
    },
    ...overrides
  };
  return { writes, persist };
}

function propagationInput(overrides: Partial<MoveBrevoPropagationInput>): MoveBrevoPropagationInput {
  return {
    destination: fakeDestination(),
    persist: recordingPersist().persist,
    destinationApiKey: "xkeysib-dest",
    domain: "",
    senders: [],
    lists: [],
    members: [],
    notifications: [],
    webhookUrl: "",
    originalListSettings: [],
    ...overrides
  };
}

describe("Move Brevo", () => {
  it("reads subscriptions from member.mail, not a top-level field", () => {
    expect(mailSubscriptions(member("a@example.com", [{ id: 3, subscribed: true }]))).toEqual([{ id: 3, subscribed: true }]);
    expect(mailSubscriptions({ email: "b@example.com" } as Member)).toEqual([]);
  });

  it("remaps list ids and leaves unmapped subscriptions unchanged", () => {
    const remapped = remapSubscriptions([{ id: 1, subscribed: true }, { id: 2, subscribed: false }], new Map([[1, 10]]));
    expect(remapped).toEqual([{ id: 10, subscribed: true }, { id: 2, subscribed: false }]);
  });

  it("merges list settings onto destination ids and keeps policy flags", () => {
    const lists: MoveBrevoListPlan[] = [{ sourceId: 1, name: "Walks", folderName: "", memberCount: 2, destinationId: 99 }];
    const merged = mergeListSettings([{ ...listSetting(1, "Walks"), memberSubscribable: true, autoSubscribeNewMembers: true }], lists);
    expect(merged[0].id).toEqual(99);
    expect(merged[0].autoSubscribeNewMembers).toEqual(true);
    expect(merged[0].memberSubscribable).toEqual(true);
  });

  it("treats HTTP 400 already-exists as a duplicate, not as success for other errors", () => {
    expect(isAlreadyExistsError(Object.assign(new Error("Sender already exists"), { statusCode: 400, body: { message: "Sender already exists" } }))).toEqual(true);
    expect(isAlreadyExistsError(new Error("unauthorized"))).toEqual(false);
  });

  it("fails the plan when two source lists resolve to the same name", () => {
    const lists = [{ id: 1, name: "Walks" }, { id: 2, name: "Walks" }, { id: 3, name: "News" }];
    expect(() => listPlans(lists, new Map(), new Map(), [], [])).toThrow(/used more than once.*Walks/);
    expect(listPlans([{ id: 1, name: "Walks" }, { id: 3, name: "News" }], new Map(), new Map(), [listSetting(3, "Newsletter")], []).map(plan => plan.name)).toEqual(["Walks", "Newsletter"]);
  });

  it("skips members flagged do not email and counts them", () => {
    const members = [
      member("a@example.com", []),
      member("b@example.com", [], { doNotEmail: true }),
      member("", [])
    ];
    const outcome = contactableMembers(members);
    expect(outcome.contactable.map(item => item.email)).toEqual(["a@example.com"]);
    expect(outcome.skippedDoNotEmail).toEqual(1);
  });

  it("remaps each notification once even when destination ids overlap later source ids", () => {
    const notifications = [notification(1), notification(2), notification(3), notification(9)];
    const updates = notificationUpdates(notifications, new Map([[1, 2], [2, 3], [3, 4]]));
    expect(updates.map(update => update.defaultListId)).toEqual([2, 3, 4]);
    expect(updates.map(update => update.notificationId)).toEqual(notifications.slice(0, 3).map(item => String(item._id)));
  });

  it("writes nothing to Mongo when createContact throws", async () => {
    const { writes, persist } = recordingPersist();
    const lists: MoveBrevoListPlan[] = [{ sourceId: 1, name: "Walks", folderName: "Main", memberCount: 1 }];
    const failed = await propagateDestination(propagationInput({
      persist,
      domain: "example.org.uk",
      senders: [{ name: "Walks", email: "walks@example.org.uk" }],
      lists,
      members: [member("walker@example.com", [{ id: 1, subscribed: true }])],
      webhookUrl: "https://example.org.uk/api/mail/webhooks/brevo-events?token=abc",
      originalListSettings: [listSetting(1, "Walks")],
      destination: fakeDestination({
        createContact: async () => {
          throw new Error("invalid api key");
        }
      })
    })).catch(error => error);
    expect(failed).toBeInstanceOf(Error);
    expect((failed as Error).message).toEqual("invalid api key");
    expect(writes.members).toEqual([]);
    expect(writes.notifications).toEqual([]);
    expect(writes.mailConfig).toEqual([]);
  });

  it("stops with the DNS records and no Mongo writes when the domain cannot be authenticated", async () => {
    const { writes, persist } = recordingPersist();
    const calls: string[] = [];
    const dnsRecords = {
      brevoCode: { type: "TXT", hostName: "brevo._domainkey", value: "code", status: false },
      dkimRecord: { type: "TXT", hostName: "mail._domainkey", value: "dkim", status: false }
    };
    const outcome = await propagateDestination(propagationInput({
      persist,
      domain: "example.org.uk",
      lists: [{ sourceId: 1, name: "Walks", folderName: "", memberCount: 1 }],
      members: [member("walker@example.com", [{ id: 1, subscribed: true }])],
      webhookUrl: "https://example.org.uk/hook",
      destination: fakeDestination({
        ensureDomain: async () => ({ authenticated: false, authenticationRequested: false, dnsRecords, message: "Cloudflare is not configured" }),
        createList: async () => {
          calls.push("createList");
          return 1;
        },
        createWebhook: async () => {
          calls.push("createWebhook");
        }
      })
    }));
    expect(outcome.status).toEqual(MoveBrevoStatus.DNS_RECORDS_REQUIRED);
    expect(outcome.dnsRecords).toEqual(dnsRecords);
    expect(outcome.message).toEqual("Cloudflare is not configured");
    expect(calls).toEqual([]);
    expect(writes.members).toEqual([]);
    expect(writes.mailConfig).toEqual([]);
  });

  it("completes all destination work first, then writes members, notifications and finally mail config", async () => {
    const order: string[] = [];
    const { writes, persist } = recordingPersist({
      updateMember: async update => {
        order.push(`member:${update.email}`);
        writes.members.push(update);
      },
      updateNotificationList: async update => {
        order.push(`notification:${update.defaultListId}`);
      },
      updateMailConfig: async (apiKey, listSettings) => {
        order.push("mailConfig");
        writes.mailConfig.push({ apiKey, listIds: listSettings.map(setting => setting.id) });
      }
    });
    const outcome = await propagateDestination(propagationInput({
      persist,
      domain: "example.org.uk",
      lists: [{ sourceId: 7, name: "News", folderName: "", memberCount: 1 }],
      members: [member("news@example.com", [{ id: 7, subscribed: true }])],
      notifications: [notification(7)],
      webhookUrl: "https://example.org.uk/hook",
      originalListSettings: [listSetting(7, "News")],
      destination: fakeDestination({
        createList: async () => {
          order.push("createList");
          return 70;
        },
        createContact: async () => {
          order.push("createContact");
          return 555;
        },
        createWebhook: async () => {
          order.push("createWebhook");
        }
      })
    }));
    expect(outcome.status).toEqual(MoveBrevoStatus.COMPLETED);
    expect(order).toEqual(["createList", "createContact", "createWebhook", "member:news@example.com", "notification:70", "mailConfig"]);
    expect(writes.members).toEqual([{ memberId: writes.members[0].memberId, email: "news@example.com", mailId: 555, subscriptions: [{ id: 70, subscribed: true }] }]);
    expect(writes.mailConfig).toEqual([{ apiKey: "xkeysib-dest", listIds: [70] }]);
    expect(outcome.lists[0].destinationId).toEqual(70);
    expect(outcome.membersUpdated).toEqual([{ memberId: writes.members[0].memberId, email: "news@example.com" }]);
  });

  it("reports exactly which members were written when a member write fails, and leaves mail config alone", async () => {
    const attempts = { count: 0 };
    const { writes, persist } = recordingPersist({
      updateMember: async update => {
        attempts.count += 1;
        if (attempts.count === 2) {
          throw new Error("connection reset");
        } else {
          writes.members.push(update);
        }
      }
    });
    const members = [member("one@example.com", []), member("two@example.com", []), member("three@example.com", [])];
    const outcome = await propagateDestination(propagationInput({ persist, members }));
    expect(outcome.status).toEqual(MoveBrevoStatus.FAILED);
    expect(outcome.error).toContain("connection reset");
    expect(outcome.error).toContain("1 of 3 members");
    expect(outcome.membersUpdated).toEqual([{ memberId: String(members[0]._id), email: "one@example.com" }]);
    expect(writes.mailConfig).toEqual([]);
  });

  it("writes mail.id as a number", async () => {
    const { writes, persist } = recordingPersist();
    await propagateDestination(propagationInput({
      persist,
      members: [member("num@example.com", [])],
      destination: fakeDestination({ createContact: async () => 42 })
    }));
    expect(writes.members[0].mailId).toEqual(42);
    expect(typeof writes.members[0].mailId).toEqual("number");
  });

  it("treats an existing contact as success by looking it up and adding it to the lists", async () => {
    const added: { contactId: number; listIds: number[] }[] = [];
    const { writes, persist } = recordingPersist();
    const shared = member("shared@example.com", [{ id: 1, subscribed: true }]);
    const twin = member("Shared@example.com", [{ id: 2, subscribed: true }]);
    const other = member("other@example.com", [{ id: 1, subscribed: true }]);
    const created: string[] = [];
    await propagateDestination(propagationInput({
      persist,
      lists: [
        { sourceId: 1, name: "Walks", folderName: "", memberCount: 2 },
        { sourceId: 2, name: "News", folderName: "", memberCount: 1 }
      ],
      members: [shared, twin, other],
      destination: fakeDestination({
        createList: async name => name === "Walks" ? 10 : 20,
        createContact: async email => {
          created.push(email);
          if (email === "other@example.com") {
            throw Object.assign(new Error("Contact already exist"), { statusCode: 400, body: { message: "Contact already exist" } });
          } else {
            return 5;
          }
        },
        contactIdByEmail: async () => 77,
        addContactToLists: async (contactId, listIds) => {
          added.push({ contactId, listIds });
        }
      })
    }));
    expect(created).toEqual(["shared@example.com", "other@example.com"]);
    expect(added).toEqual([{ contactId: 5, listIds: [20] }, { contactId: 77, listIds: [10] }]);
    expect(writes.members.map(update => update.mailId)).toEqual([5, 5, 77]);
  });

  it("reuses destination folders, lists and the webhook by name or URL on a re-run", async () => {
    const calls: string[] = [];
    const { writes, persist } = recordingPersist();
    const outcome = await propagateDestination(propagationInput({
      persist,
      lists: [
        { sourceId: 1, name: "Walks", folderName: "Main", memberCount: 0 },
        { sourceId: 2, name: "News", folderName: "Main", memberCount: 0 }
      ],
      webhookUrl: "https://example.org.uk/hook?token=secret",
      originalListSettings: [listSetting(1, "Walks"), listSetting(2, "News")],
      destination: fakeDestination({
        folders: async () => [{ id: 3, name: "Main" }],
        lists: async () => [{ id: 30, name: "Walks" }],
        createFolder: async name => {
          calls.push(`createFolder:${name}`);
          return 4;
        },
        createList: async (name, folderId) => {
          calls.push(`createList:${name}:${folderId}`);
          return 31;
        },
        webhookUrls: async () => ["https://example.org.uk/hook?token=secret"],
        createWebhook: async () => {
          calls.push("createWebhook");
        }
      })
    }));
    expect(calls).toEqual(["createList:News:3"]);
    expect(outcome.lists.map(list => [list.destinationId, list.reused])).toEqual([[30, true], [31, false]]);
    expect(outcome.webhook).toEqual({ registered: true, reused: true });
    expect(writes.mailConfig).toEqual([{ apiKey: "xkeysib-dest", listIds: [30, 31] }]);
  });
});
