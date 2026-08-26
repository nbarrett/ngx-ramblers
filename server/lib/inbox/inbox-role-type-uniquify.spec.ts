import expect from "expect";
import { describe, it } from "mocha";
import { CommitteeMember, ForwardEmailTarget } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import {
  committeeRolesWithUniqueTypes,
  committeeRoleTypeChanges,
  threadMatchesRoleTypeChange
} from "./inbox-role-type-uniquify";

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

describe("inbox-role-type-uniquify", () => {

  describe("committeeRoleTypeChanges", () => {

    it("does not emit a change when every role type is already unique and a valid local part", () => {
      const changes = committeeRoleTypeChanges([
        role({type: "ngx-project-lead", email: "nick.barrett@ngx-ramblers.org.uk"}),
        role({type: "chairman", email: "chairman@ngx-ramblers.org.uk"})
      ]);
      expect(changes).toEqual([]);
    });

    it("renames every thread of a single role whose stored type is shortened", () => {
      const longType = "kent-area-representative-deputy-web-master-ramblers-group-walks-manager";
      const changes = committeeRoleTypeChanges([
        role({
          type: longType,
          description: "Kent Area Representative, Deputy Web Master & Ramblers Group Walks Manager",
          email: "bob.tolson@nwkramblers.org.uk"
        })
      ]);
      expect(changes).toEqual([{
        from: longType,
        to: "kent-area-representative",
        emails: expect.arrayContaining(["bob.tolson@nwkramblers.org.uk"]),
        remapAllThreads: true
      }]);
    });

    it("keeps the first duplicate type and remaps later roles by their mailbox addresses", () => {
      const changes = committeeRoleTypeChanges([
        role({type: "system-administrator", email: "nick.barrett@nwkramblers.org.uk", description: "System Administrator"}),
        role({type: "system-administrator", email: "system.administrator@nwkramblers.org.uk", description: "System Administrator"})
      ]);
      expect(changes).toEqual([{
        from: "system-administrator",
        to: "system-administrator-system-administrator",
        emails: expect.arrayContaining(["system.administrator@nwkramblers.org.uk"]),
        remapAllThreads: false
      }]);
    });

  });

  describe("committeeRolesWithUniqueTypes", () => {

    it("rewrites a notify-from-role pointer when that role type is shortened", () => {
      const longType = "kent-area-representative-deputy-web-master-ramblers-group-walks-manager";
      const uniqued = committeeRolesWithUniqueTypes([
        role({
          type: longType,
          description: "Kent Area Representative, Deputy Web Master & Ramblers Group Walks Manager",
          email: "bob.tolson@nwkramblers.org.uk"
        }),
        role({
          type: "walks",
          email: "walks@nwkramblers.org.uk",
          inboxRecipientsFromRoleType: longType
        })
      ]);
      expect(uniqued[0].type).toEqual("kent-area-representative");
      expect(uniqued[1].inboxRecipientsFromRoleType).toEqual("kent-area-representative");
    });

    it("leaves a notify-from-role pointer on a shared type pointing at the role that kept it", () => {
      const uniqued = committeeRolesWithUniqueTypes([
        role({type: "system-administrator", email: "nick.barrett@nwkramblers.org.uk", description: "System Administrator"}),
        role({type: "system-administrator", email: "system.administrator@nwkramblers.org.uk", description: "System Administrator"}),
        role({type: "walks", email: "walks@nwkramblers.org.uk", inboxRecipientsFromRoleType: "system-administrator"})
      ]);
      expect(uniqued.map(item => item.type)).toEqual([
        "system-administrator",
        "system-administrator-system-administrator",
        "walks"
      ]);
      expect(uniqued[2].inboxRecipientsFromRoleType).toEqual("system-administrator");
    });

  });

  describe("threadMatchesRoleTypeChange", () => {

    it("moves every thread when the role type itself was rewritten", () => {
      expect(threadMatchesRoleTypeChange(
        {roleType: "old-type"},
        [],
        {from: "old-type", to: "new-type", emails: [], remapAllThreads: true}
      )).toEqual(true);
    });

    it("moves only threads whose addresses belong to the renamed duplicate role", () => {
      const change = {
        from: "system-administrator",
        to: "system-administrator-system-administrator",
        emails: ["system.administrator@nwkramblers.org.uk"],
        remapAllThreads: false
      };
      expect(threadMatchesRoleTypeChange(
        {roleType: "system-administrator", deliveredTo: {name: null, email: "system.administrator@nwkramblers.org.uk"}},
        [],
        change
      )).toEqual(true);
      expect(threadMatchesRoleTypeChange(
        {roleType: "system-administrator", deliveredTo: {name: null, email: "nick.barrett@nwkramblers.org.uk"}},
        [],
        change
      )).toEqual(false);
      expect(threadMatchesRoleTypeChange(
        {roleType: "system-administrator"},
        ["system.administrator@nwkramblers.org.uk"],
        change
      )).toEqual(true);
    });

    it("does not move a thread that is already on another role", () => {
      expect(threadMatchesRoleTypeChange(
        {roleType: "walks"},
        ["system.administrator@nwkramblers.org.uk"],
        {from: "system-administrator", to: "system-administrator-system-administrator", emails: ["system.administrator@nwkramblers.org.uk"], remapAllThreads: false}
      )).toEqual(false);
    });

  });

});
