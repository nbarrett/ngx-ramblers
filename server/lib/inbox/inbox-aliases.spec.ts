import expect from "expect";
import { describe, it } from "mocha";
import { CommitteeMember, ForwardEmailTarget } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { InboxMailboxConnection, InboxMessage, inboxGeneralRoleTypeFor } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { connectionIdentifier, deriveAliasesFrom, generalAliasFor, messageAddressEmails, roleMatchesMessageAddresses } from "./inbox-aliases";

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

  describe("deriveAliasesFrom", () => {

    it("maps a CATCHALL role to the sole connection", () => {
      const connections = connectionsByEmail([connection({id: "c1"})]);
      const aliases = deriveAliasesFrom(connections, [role({type: "chairman", email: "chairman@ekwg.co.uk", forwardEmailTarget: ForwardEmailTarget.CATCHALL})], "ekwg");
      expect(aliases.length).toEqual(1);
      expect(aliases[0].roleType).toEqual("chairman");
      expect(aliases[0].roleEmail).toEqual("chairman@ekwg.co.uk");
      expect(aliases[0].mailboxConnectionId).toEqual("c1");
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

    const identityEmailsByType = new Map<string, Set<string>>([["chairman", new Set(["chairman@ekwg.co.uk", "chair.person@gmail.com"])]]);

    it("matches when a message address is one of the role's identity emails", () => {
      expect(roleMatchesMessageAddresses("chairman", "chairman@ekwg.co.uk", ["chair.person@gmail.com"], identityEmailsByType)).toEqual(true);
    });

    it("does not match when no message address belongs to the role", () => {
      expect(roleMatchesMessageAddresses("chairman", "chairman@ekwg.co.uk", ["someone@else.com"], identityEmailsByType)).toEqual(false);
    });

    it("falls back to the role email when the role has no identity set", () => {
      expect(roleMatchesMessageAddresses("treasurer", "treasurer@ekwg.co.uk", ["treasurer@ekwg.co.uk"], identityEmailsByType)).toEqual(true);
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
