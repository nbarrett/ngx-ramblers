import expect from "expect";
import {describe, it} from "mocha";
import sinon from "sinon";
import {CommitteeMember} from "../../../../../projects/ngx-ramblers/src/app/models/committee.model";
import {ConfigKey} from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import {CONFIG_COLLECTION, NOTIFICATION_CONFIG_COLLECTION} from "../shared/collection-names";
import {notificationConfigWithReplacedRoles, roleTypeReplacements, up} from "./20261006190000-remap-email-roles-renamed-from-description";

const supportRole = {type: "support-nick-barrett", description: "Support", email: "support-nick-barrett@pvramblers.org.uk"} as CommitteeMember;

describe("email roles renamed from their description", () => {
  it("maps a missing role to the one committee role whose description still uses that name", () => {
    const replacements = roleTypeReplacements([
      supportRole,
      {type: "webmaster", description: "Webmaster", email: "webmaster@pvramblers.org.uk"} as CommitteeMember
    ]);
    expect([...replacements.entries()]).toEqual([["support", "support-nick-barrett"]]);
  });

  it("leaves a role alone when two committee roles share the description", () => {
    expect(roleTypeReplacements([
      {type: "support-one", description: "Support"} as CommitteeMember,
      {type: "support-two", description: "Support"} as CommitteeMember
    ]).size).toEqual(0);
  });

  it("rewrites sender, reply-to and sign-off lists and leaves a blank reply-to", () => {
    const replacements = roleTypeReplacements([supportRole]);
    expect(notificationConfigWithReplacedRoles({
      senderRole: "support",
      replyToRole: "",
      signOffRoles: ["chair", "support"],
      bccRoles: ["webmaster"]
    }, replacements)).toEqual({
      senderRole: "support-nick-barrett",
      signOffRoles: ["chair", "support-nick-barrett"]
    });
  });

  it("updates only the email configurations that name the missing role", async () => {
    const forgotten = {_id: "forgotten", senderRole: "support", replyToRole: "support", signOffRoles: ["support"]};
    const walks = {_id: "walks", senderRole: "walks", replyToRole: "walks", signOffRoles: ["walks"]};
    const updateOne = sinon.stub().resolves({});
    const collection = sinon.stub();
    collection.withArgs(CONFIG_COLLECTION).returns({
      findOne: sinon.stub().withArgs({key: ConfigKey.COMMITTEE}).resolves({value: {roles: [supportRole, {type: "walks", description: "Walks"}]}})
    });
    collection.withArgs(NOTIFICATION_CONFIG_COLLECTION).returns({
      find: () => ({toArray: async () => [forgotten, walks]}),
      updateOne
    });
    await up({collection} as any, null);
    expect(updateOne.calledOnce).toBe(true);
    expect(updateOne.firstCall.args).toEqual([
      {_id: "forgotten"},
      {$set: {senderRole: "support-nick-barrett", replyToRole: "support-nick-barrett", signOffRoles: ["support-nick-barrett"]}}
    ]);
  });
});
