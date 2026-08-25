import expect from "expect";
import { describe, it } from "mocha";
import { additionalEmailsFromMailboxList, CommitteeMember, ForwardEmailTarget, committeeRoleTypeFromDescription, committeeRolesByType, notifiedRecipientsForRole, reusableNotificationRecipients, roleEmailAddresses, roleNotificationRecipients, roleRecipientMemberIds, uniqueCommitteeRoleType, uniqueCommitteeRoleTypes } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { InboxMailboxConnection, InboxMessage, InboxReaderProvider, inboxGeneralRoleTypeFor } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import {
  cloudflareIngressAliasesFromMessage,
  connectionIdentifier,
  deriveAliasesFrom,
  generalAliasFor,
  messageAddressEmails,
  roleForwardingRecipients,
  roleMatchesMessageAddresses
} from "./inbox-aliases";

function connection(overrides: Partial<InboxMailboxConnection>): InboxMailboxConnection {
  return {
    id: "conn-1",
    tenantSlug: "ekwg",
    gmailAccountEmail: "inbox@ekwg.co.uk",
    enabled: true,
    importAllMessages: false,
    ...overrides
  } as InboxMailboxConnection;
}

function role(overrides: Partial<CommitteeMember>): CommitteeMember {
  return {
    type: "chairman",
    email: "chairman@ekwg.co.uk",
    fullName: "Chair Person",
    vacant: false,
    forwardEmailTarget: ForwardEmailTarget.CATCHALL,
    ...overrides
  } as CommitteeMember;
}

function connectionsByEmail(connections: InboxMailboxConnection[]): Map<string, InboxMailboxConnection> {
  return connections.reduce((map, item) => map.set(item.gmailAccountEmail.toLowerCase(), item), new Map<string, InboxMailboxConnection>());
}

describe("inbox-aliases", () => {

  describe("roleForwardingRecipients", () => {

    it("uses the linked member email when the target is omitted", () => {
      expect(roleForwardingRecipients(role({forwardEmailTarget: undefined}), "BobTolson7@outlook.com"))
        .toEqual(["bobtolson7@outlook.com"]);
    });

    it("uses a custom forwarding address", () => {
      expect(roleForwardingRecipients(role({forwardEmailTarget: ForwardEmailTarget.CUSTOM, forwardEmailCustom: "Shared@Example.com"}), null))
        .toEqual(["shared@example.com"]);
    });

    it("uses every configured recipient for multiple forwarding", () => {
      expect(roleForwardingRecipients(role({
        forwardEmailTarget: ForwardEmailTarget.MULTIPLE,
        forwardEmailRecipients: ["First@Example.com", "second@example.com"]
      }), null)).toEqual(["first@example.com", "second@example.com"]);
    });

    it("returns an empty list when forwarding is disabled", () => {
      expect(roleForwardingRecipients(role({forwardEmailTarget: ForwardEmailTarget.NONE}), null)).toEqual([]);
    });

    it("leaves catch-all and inbox routing to their existing handlers", () => {
      expect(roleForwardingRecipients(role({forwardEmailTarget: ForwardEmailTarget.CATCHALL}), null)).toEqual(null);
      expect(roleForwardingRecipients(role({forwardEmailTarget: ForwardEmailTarget.ROLE_EMAIL}), null)).toEqual(null);
    });

  });

  describe("cloudflareIngressAliasesForMessage", () => {

    it("maps role-address mail to the matching role alias", async () => {
      const connectionRecord = connection({id: "cf1", gmailAccountEmail: null, provider: InboxReaderProvider.CLOUDFLARE_INGRESS});
      const message = {to: [{email: "secretary@ekwg.co.uk"}], cc: []} as InboxMessage;
      const result = cloudflareIngressAliasesFromMessage(message, connectionRecord, [role({type: "secretary", email: "secretary@ekwg.co.uk"})], "ekwg");
      expect(result.map(alias => alias.roleType)).toEqual(["secretary"]);
    });

    it("maps unmatched catch-all mail to the general alias", async () => {
      const connectionRecord = connection({id: "cf1", gmailAccountEmail: null, provider: InboxReaderProvider.CLOUDFLARE_INGRESS});
      const message = {to: [{email: "unknown@ekwg.co.uk"}], cc: []} as InboxMessage;
      const result = cloudflareIngressAliasesFromMessage(message, connectionRecord, [role({type: "secretary", email: "secretary@ekwg.co.uk"})], "ekwg");
      expect(result.map(alias => alias.roleType)).toEqual([inboxGeneralRoleTypeFor("cf1")]);
    });

    it("maps mail addressed to an additional role address to the same role alias", async () => {
      const connectionRecord = connection({id: "cf1", gmailAccountEmail: null, provider: InboxReaderProvider.CLOUDFLARE_INGRESS});
      const message = {to: [{email: "Tom@EKWG.co.uk"}], cc: []} as InboxMessage;
      const result = cloudflareIngressAliasesFromMessage(message, connectionRecord, [role({type: "secretary", email: "secretary@ekwg.co.uk", fullName: "", additionalEmails: ["tom@ekwg.co.uk"]})], "ekwg");
      expect(result.map(alias => alias.roleType)).toEqual(["secretary"]);
      expect(result[0].additionalEmails).toEqual(["tom@ekwg.co.uk"]);
    });

    it("maps mail only to the role whose address matches, not other roles held by the same member", async () => {
      const connectionRecord = connection({id: "cf1", gmailAccountEmail: null, provider: InboxReaderProvider.CLOUDFLARE_INGRESS});
      const message = {to: [{email: "nick.barrett@ekwg.co.uk"}], cc: []} as InboxMessage;
      const roles = [
        role({type: "membership", email: "nick.barrett@ekwg.co.uk", memberId: "member-nick"}),
        role({type: "walks", email: "walks@ekwg.co.uk", memberId: "member-nick"})
      ];
      const result = cloudflareIngressAliasesFromMessage(message, connectionRecord, roles, "ekwg");
      expect(result.map(alias => alias.roleType)).toEqual(["membership"]);
    });

  });

  describe("deriveAliasesFrom", () => {

    it("maps a CATCHALL role to the sole connection", () => {
      const connections = connectionsByEmail([connection({id: "c1"})]);
      const aliases = deriveAliasesFrom(connections, [role({type: "chairman", email: "chairman@ekwg.co.uk", forwardEmailTarget: ForwardEmailTarget.CATCHALL})], "ekwg");
      expect(aliases.length).toEqual(1);
      expect(aliases[0].roleType).toEqual("chairman");
      expect(aliases[0].roleEmail).toEqual("chairman@ekwg.co.uk");
      expect(aliases[0].mailboxConnectionId).toEqual("c1");
    });

    it("gives colliding role types distinct alias ids", () => {
      const connections = connectionsByEmail([connection({id: "c1"})]);
      const aliases = deriveAliasesFrom(connections, [
        role({type: "system-administrator", email: "nick.barrett@nwkramblers.org.uk", forwardEmailTarget: ForwardEmailTarget.CATCHALL}),
        role({type: "system-administrator", email: "system.administrator@nwkramblers.org.uk", forwardEmailTarget: ForwardEmailTarget.CATCHALL})
      ], "ekwg");
      expect(aliases.map(alias => alias.id)).toEqual([
        "system-administrator:nick.barrett@nwkramblers.org.uk",
        "system-administrator:system.administrator@nwkramblers.org.uk"
      ]);
    });

    it("excludes a CATCHALL role when there is more than one connection (no single catch-all)", () => {
      const connections = connectionsByEmail([connection({id: "c1", gmailAccountEmail: "a@ekwg.co.uk"}), connection({id: "c2", gmailAccountEmail: "b@ekwg.co.uk"})]);
      const aliases = deriveAliasesFrom(connections, [role({forwardEmailTarget: ForwardEmailTarget.CATCHALL})], "ekwg");
      expect(aliases).toEqual([]);
    });

    it("maps a CUSTOM forward email to the matching connection, normalising case", () => {
      const connections = connectionsByEmail([connection({id: "c1", gmailAccountEmail: "shared@ekwg.co.uk"})]);
      const aliases = deriveAliasesFrom(connections, [role({type: "secretary", email: "secretary@ekwg.co.uk", forwardEmailTarget: ForwardEmailTarget.CUSTOM, forwardEmailCustom: "Shared@EKWG.co.uk"})], "ekwg");
      expect(aliases.length).toEqual(1);
      expect(aliases[0].roleType).toEqual("secretary");
      expect(aliases[0].mailboxConnectionId).toEqual("c1");
    });

    it("maps a MULTIPLE role on its first recipient", () => {
      const connections = connectionsByEmail([connection({id: "c1", gmailAccountEmail: "shared@ekwg.co.uk"})]);
      const aliases = deriveAliasesFrom(connections, [role({type: "social", email: "social@ekwg.co.uk", forwardEmailTarget: ForwardEmailTarget.MULTIPLE, forwardEmailRecipients: ["shared@ekwg.co.uk", "other@x.com"]})], "ekwg");
      expect(aliases.length).toEqual(1);
      expect(aliases[0].mailboxConnectionId).toEqual("c1");
    });

    it("excludes a role whose target email matches no connection", () => {
      const connections = connectionsByEmail([connection({id: "c1", gmailAccountEmail: "shared@ekwg.co.uk"})]);
      const aliases = deriveAliasesFrom(connections, [role({forwardEmailTarget: ForwardEmailTarget.CUSTOM, forwardEmailCustom: "nobody@x.com"})], "ekwg");
      expect(aliases).toEqual([]);
    });

    it("adds a general alias for an import-all connection", () => {
      const connections = connectionsByEmail([connection({id: "c9", gmailAccountEmail: "all@ekwg.co.uk", importAllMessages: true})]);
      const aliases = deriveAliasesFrom(connections, [], "ekwg");
      expect(aliases.length).toEqual(1);
      expect(aliases[0].roleType).toEqual(inboxGeneralRoleTypeFor("c9"));
      expect(aliases[0].roleEmail).toEqual("all@ekwg.co.uk");
      expect(aliases[0].mailboxConnectionId).toEqual("c9");
    });

    it("returns role aliases and general aliases together", () => {
      const connections = connectionsByEmail([connection({id: "c1", gmailAccountEmail: "shared@ekwg.co.uk", importAllMessages: true})]);
      const aliases = deriveAliasesFrom(connections, [role({type: "chairman", email: "chairman@ekwg.co.uk", forwardEmailTarget: ForwardEmailTarget.CATCHALL})], "ekwg");
      expect(aliases.map(alias => alias.roleType)).toEqual(["chairman", inboxGeneralRoleTypeFor("c1")]);
    });

  });

  describe("generalAliasFor", () => {

    it("builds an enabled general alias keyed on the connection id", () => {
      const alias = generalAliasFor(connection({id: "c1", gmailAccountEmail: "all@ekwg.co.uk"}), "ekwg");
      expect(alias.roleType).toEqual(inboxGeneralRoleTypeFor("c1"));
      expect(alias.roleEmail).toEqual("all@ekwg.co.uk");
      expect(alias.mailboxConnectionId).toEqual("c1");
      expect(alias.enabled).toEqual(true);
    });

  });

  describe("messageAddressEmails", () => {

    it("normalises from, to and cc addresses", () => {
      const message = {from: {email: "From@X.com"}, to: [{email: "To@X.com"}], cc: [{email: "Cc@X.com"}]} as InboxMessage;
      expect(messageAddressEmails(message)).toEqual(["from@x.com", "to@x.com", "cc@x.com"]);
    });

  });

  describe("roleMatchesMessageAddresses", () => {

    const identityEmailsByType = new Map<string, Set<string>>([["chairman", new Set(["chairman@ekwg.co.uk", "chair.forward@ekwg.co.uk"])]]);

    it("matches when a message address is the role email or a forward address", () => {
      expect(roleMatchesMessageAddresses("chairman", "chairman@ekwg.co.uk", ["chair.forward@ekwg.co.uk"], identityEmailsByType)).toEqual(true);
    });

    it("does not match a personal member address that is not a role or forward address", () => {
      expect(roleMatchesMessageAddresses("chairman", "chairman@ekwg.co.uk", ["nick.barrett@ekwg.co.uk"], identityEmailsByType)).toEqual(false);
    });

    it("does not match when no message address belongs to the role", () => {
      expect(roleMatchesMessageAddresses("chairman", "chairman@ekwg.co.uk", ["someone@else.com"], identityEmailsByType)).toEqual(false);
    });

    it("falls back to the role email when the role has no identity set", () => {
      expect(roleMatchesMessageAddresses("treasurer", "treasurer@ekwg.co.uk", ["treasurer@ekwg.co.uk"], identityEmailsByType)).toEqual(true);
    });

    it("does not match an excluded Gmail inbox address", () => {
      const identities = new Map<string, Set<string>>([["chairman", new Set(["chairman@ekwg.co.uk", "walks@ekwg.co.uk"])]]);
      expect(roleMatchesMessageAddresses("chairman", "chairman@ekwg.co.uk", ["walks@ekwg.co.uk"], identities, ["walks@ekwg.co.uk"])).toEqual(false);
    });

    it("still matches a role address when the Gmail inbox address is also present", () => {
      const identities = new Map<string, Set<string>>([["chairman", new Set(["chairman@ekwg.co.uk", "walks@ekwg.co.uk"])]]);
      expect(roleMatchesMessageAddresses("chairman", "chairman@ekwg.co.uk", ["walks@ekwg.co.uk", "chairman@ekwg.co.uk"], identities, ["walks@ekwg.co.uk"])).toEqual(true);
    });

  });

  describe("roleEmailAddresses", () => {

    it("returns the primary address plus additional addresses without duplicates", () => {
      const addresses = roleEmailAddresses(role({
        type: "secretary",
        fullName: "",
        email: "secretary@ekwg.co.uk",
        additionalEmails: ["tom@ekwg.co.uk", "Secretary@EKWG.co.uk", ""]
      }));
      expect(addresses).toEqual(["secretary@ekwg.co.uk", "tom@ekwg.co.uk"]);
    });

    it("returns just the primary address when no additional addresses are configured", () => {
      expect(roleEmailAddresses(role({type: "secretary", fullName: "", email: "secretary@ekwg.co.uk"}))).toEqual(["secretary@ekwg.co.uk"]);
    });

    it("adds the generated role and full-name addresses when they differ from the primary", () => {
      expect(roleEmailAddresses(role({
        type: "system-administrator",
        fullName: "Nick Barrett",
        email: "nick.barrett@nwkramblers.org.uk"
      }))).toEqual([
        "nick.barrett@nwkramblers.org.uk",
        "system-administrator@nwkramblers.org.uk"
      ]);
    });

    it("keeps a stored sender that is not a generated address", () => {
      expect(roleEmailAddresses(role({
        type: "walks-co-ordinator",
        fullName: "Jane Doe",
        email: "walks@ekwg.co.uk"
      }))).toEqual([
        "walks@ekwg.co.uk",
        "walks-co-ordinator@ekwg.co.uk",
        "jane.doe@ekwg.co.uk"
      ]);
    });

    it("uses the first clause of a long role description as the generated address", () => {
      const type = "kent-area-representative-deputy-web-master-ramblers-group-walks-manager";
      expect(type.length).toEqual(71);
      expect(roleEmailAddresses(role({
        type,
        description: "Kent Area Representative, Deputy Web Master & Ramblers Group Walks Manager",
        fullName: "Bob Tolson",
        email: "bob.tolson@nwkramblers.org.uk"
      }))).toEqual([
        "bob.tolson@nwkramblers.org.uk",
        "kent-area-representative@nwkramblers.org.uk"
      ]);
    });

  });

  describe("committeeRoleTypeFromDescription", () => {

    it("takes the text before the first comma", () => {
      expect(committeeRoleTypeFromDescription(
        "Kent Area Representative, Deputy Web Master & Ramblers Group Walks Manager"
      )).toEqual("kent-area-representative");
    });

    it("takes the text before an ampersand when there is no comma", () => {
      expect(committeeRoleTypeFromDescription("Deputy Web Master & Ramblers Group Walks Manager"))
        .toEqual("deputy-web-master");
    });

    it("kebabs a short description unchanged", () => {
      expect(committeeRoleTypeFromDescription("Walks Secretary")).toEqual("walks-secretary");
    });

  });

  describe("additionalEmailsFromMailboxList", () => {

    it("stores every address except the default sender so the list survives a reload", () => {
      expect(additionalEmailsFromMailboxList([
        "nick.barrett@ngx-ramblers.org.uk",
        "system-administrator@ngx-ramblers.org.uk",
        "ngx-project-lead@ngx-ramblers.org.uk"
      ], "nick.barrett@ngx-ramblers.org.uk")).toEqual([
        "system-administrator@ngx-ramblers.org.uk",
        "ngx-project-lead@ngx-ramblers.org.uk"
      ]);
    });

  });

  describe("roleNotificationRecipients", () => {

    it("derives the assigned member from legacy fields when no recipients are configured", () => {
      const recipients = roleNotificationRecipients(role({memberId: "member-1", inboxMessageNotifications: true, inboxNotificationEmail: "override@x.com"}));
      expect(recipients).toEqual([{memberId: "member-1", email: "override@x.com", notify: true}]);
    });

    it("combines the legacy assigned member with configured recipients", () => {
      const recipients = roleNotificationRecipients(role({
        memberId: "member-1",
        inboxMessageNotifications: false,
        inboxRecipients: [
          {memberId: "member-2", email: null, notify: true},
          {memberId: null, email: "plain@x.com", notify: true}
        ]
      }));
      expect(recipients).toEqual([
        {memberId: "member-1", email: null, notify: false},
        {memberId: "member-2", email: null, notify: true},
        {memberId: null, email: "plain@x.com", notify: true}
      ]);
    });

    it("does not duplicate the assigned member when they are also a configured recipient", () => {
      const recipients = roleNotificationRecipients(role({
        memberId: "member-1",
        inboxRecipients: [{memberId: "member-1", email: null, notify: true}]
      }));
      expect(recipients).toEqual([{memberId: "member-1", email: null, notify: true}]);
    });

    it("lists member ids across assigned member and configured recipients", () => {
      const memberIds = roleRecipientMemberIds(role({
        memberId: "member-1",
        inboxRecipients: [
          {memberId: "member-2", email: null, notify: false},
          {memberId: null, email: "plain@x.com", notify: true}
        ]
      }));
      expect(memberIds).toEqual(["member-1", "member-2"]);
    });

  });

  describe("notifiedRecipientsForRole", () => {

    it("uses the role's own opted-in recipients when no other role is referenced", () => {
      const info = role({
        type: "info",
        memberId: null,
        inboxRecipients: [
          {memberId: "bob", email: null, notify: true},
          {memberId: "graeme", email: null, notify: false}
        ]
      });
      expect(notifiedRecipientsForRole(info, committeeRolesByType([info]))).toEqual([
        {memberId: "bob", email: null, notify: true}
      ]);
    });

    it("reuses the referenced role's extra recipients and ignores the referencing role's own list", () => {
      const info = role({
        type: "info",
        memberId: null,
        inboxRecipients: [
          {memberId: "bob", email: null, notify: true},
          {memberId: "ed", email: null, notify: true}
        ]
      });
      const contactUs = role({
        type: "contact-us",
        memberId: "secretary",
        inboxMessageNotifications: true,
        inboxRecipientsFromRoleType: "info",
        inboxRecipients: [{memberId: "leftover", email: null, notify: true}]
      });
      expect(notifiedRecipientsForRole(contactUs, committeeRolesByType([info, contactUs]))).toEqual([
        {memberId: "bob", email: null, notify: true},
        {memberId: "ed", email: null, notify: true}
      ]);
    });

    it("omits the referenced role's assigned member from the reusable list", () => {
      const treasurer = role({
        type: "treasurer",
        memberId: "michael",
        inboxMessageNotifications: true,
        inboxRecipients: [{memberId: "jack", email: null, notify: true}]
      });
      expect(reusableNotificationRecipients(treasurer)).toEqual([
        {memberId: "jack", email: null, notify: true}
      ]);
    });

  });

  describe("uniqueCommitteeRoleType", () => {

    it("keeps the preferred type when it is not already used", () => {
      expect(uniqueCommitteeRoleType("system-administrator", ["treasurer"])).toEqual("system-administrator");
    });

    it("suffixes the email local part when the preferred type is already taken", () => {
      expect(uniqueCommitteeRoleType("system-administrator", ["system-administrator"], "system.administrator@nwkramblers.org.uk"))
        .toEqual("system-administrator-system-administrator");
    });

    it("keeps the first role and suffixes later duplicates", () => {
      const uniqued = uniqueCommitteeRoleTypes([
        role({type: "system-administrator", email: "nick.barrett@nwkramblers.org.uk", description: "System Administrator"}),
        role({type: "system-administrator", email: "system.administrator@nwkramblers.org.uk", description: "System Administrator"})
      ]);
      expect(uniqued.map(item => item.type)).toEqual([
        "system-administrator",
        "system-administrator-system-administrator"
      ]);
    });

    it("rewrites a long stored type from the first clause of the description", () => {
      const uniqued = uniqueCommitteeRoleTypes([
        role({
          type: "kent-area-representative-deputy-web-master-ramblers-group-walks-manager",
          description: "Kent Area Representative, Deputy Web Master & Ramblers Group Walks Manager",
          email: "bob.tolson@nwkramblers.org.uk"
        })
      ]);
      expect(uniqued[0].type).toEqual("kent-area-representative");
    });

    it("keeps later roles unique when they share the same first clause", () => {
      const longType = "kent-area-representative-deputy-web-master-ramblers-group-walks-manager";
      const uniqued = uniqueCommitteeRoleTypes([
        role({
          type: longType,
          description: "Kent Area Representative, Deputy Web Master & Ramblers Group Walks Manager",
          email: "bob.tolson@nwkramblers.org.uk"
        }),
        role({
          type: longType,
          description: "Kent Area Representative, Social Secretary",
          email: "jane.doe@nwkramblers.org.uk"
        })
      ]);
      expect(uniqued.map(item => item.type)).toEqual([
        "kent-area-representative",
        "kent-area-representative-jane-doe"
      ]);
    });

  });

  describe("connectionIdentifier", () => {

    it("uses id when present", () => {
      expect(connectionIdentifier({id: "abc"} as InboxMailboxConnection)).toEqual("abc");
    });

    it("falls back to _id", () => {
      expect(connectionIdentifier({_id: {toString: () => "xyz"}} as unknown as InboxMailboxConnection)).toEqual("xyz");
    });

  });

});
