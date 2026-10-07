import expect from "expect";
import sinon from "sinon";
import {afterEach, describe, it} from "mocha";
import * as access from "./inbox-access";
import * as counts from "./inbox-unread-counts";
import * as imports from "./inbox-message-import";
import {inboxThread} from "../mongo/models/inbox-thread";
import {inboxMessage} from "../mongo/models/inbox-message";
import {listInboxThreads, readInboxUnreadCounts} from "./inbox-thread-list-controllers";
import {InboxMessageDirection, InboxThreadFolder, InboxUserFolderQuery} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";

describe("inbox read controllers", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("repeatedly lists the same messages without repairing their filing or read state", async () => {
    const thread = {_id: "thread-1", roleType: "general", folder: InboxThreadFolder.INBOX, lastDirection: InboxMessageDirection.INBOUND, unread: true, readByMemberIds: []};
    sandbox.stub(access, "permittedInboxRoleTypes").resolves(["general"]);
    sandbox.stub(access, "assignedInboxRoleTypesForMember").resolves(["general"]);
    sandbox.stub(counts, "conversationCount").resolves(1);
    sandbox.stub(inboxThread, "find").returns({sort: () => ({skip: () => ({limit: () => ({lean: async () => [thread]})})})} as any);
    sandbox.stub(inboxMessage, "aggregate").resolves([{_id: "thread-1", from: {email: "chair@group.example.org.uk"}, to: [{email: "alex@example.com"}]}]);
    const repair = sandbox.stub(imports, "reclassifyOwnSentInboundMessages");
    const threadUpdate = sandbox.stub(inboxThread, "updateOne");
    const messageUpdate = sandbox.stub(inboxMessage, "updateOne");
    const response = {json: sandbox.spy(), status: sandbox.stub().returnsThis()};
    const request = {query: {}, user: {memberId: "member-1"}};
    await listInboxThreads(request as any, response as any);
    await listInboxThreads(request as any, response as any);
    expect(response.json.firstCall.args[0]).toEqual(response.json.secondCall.args[0]);
    expect(response.json.firstCall.args[0].response.threads[0]).toMatchObject(thread);
    expect(repair.called).toBe(false);
    expect(threadUpdate.called).toBe(false);
    expect(messageUpdate.called).toBe(false);
  });

  it("counts unread mail without starting a repair", async () => {
    sandbox.stub(access, "permittedInboxRoleTypes").resolves(["general"]);
    sandbox.stub(access, "assignedInboxRoleTypesForMember").resolves(["general"]);
    sandbox.stub(counts, "conversationCount").resolves(2);
    sandbox.stub(counts, "conversationCountsByRole").resolves([{roleType: "general", count: 2}] as any);
    const repair = sandbox.stub(imports, "reclassifyOwnSentInboundMessages");
    const update = sandbox.stub(inboxThread, "updateOne");
    const response = {json: sandbox.spy(), status: sandbox.stub().returnsThis()};
    await readInboxUnreadCounts({query: {}, user: {memberId: "member-1"}} as any, response as any);
    expect(response.json.firstCall.args[0].response.total).toBe(2);
    expect(repair.called).toBe(false);
    expect(update.called).toBe(false);
  });

  it("lists the inbox without conversations that are filed in a user folder", async () => {
    sandbox.stub(access, "permittedInboxRoleTypes").resolves(["general"]);
    sandbox.stub(access, "assignedInboxRoleTypesForMember").resolves(["general"]);
    sandbox.stub(counts, "conversationCount").resolves(0);
    const find = sandbox.stub(inboxThread, "find").returns({sort: () => ({skip: () => ({limit: () => ({lean: async () => []})})})} as any);
    sandbox.stub(inboxMessage, "aggregate").resolves([]);
    const response = {json: sandbox.spy(), status: sandbox.stub().returnsThis()};
    await listInboxThreads({query: {}, user: {memberId: "member-1"}} as any, response as any);
    expect(find.firstCall.args[0].userFolderId).toBe(null);
  });

  it("lists a user folder by id", async () => {
    sandbox.stub(access, "permittedInboxRoleTypes").resolves(["general"]);
    sandbox.stub(access, "assignedInboxRoleTypesForMember").resolves(["general"]);
    sandbox.stub(counts, "conversationCount").resolves(0);
    const find = sandbox.stub(inboxThread, "find").returns({sort: () => ({skip: () => ({limit: () => ({lean: async () => []})})})} as any);
    sandbox.stub(inboxMessage, "aggregate").resolves([]);
    const response = {json: sandbox.spy(), status: sandbox.stub().returnsThis()};
    await listInboxThreads({query: {userFolderId: "folder-1"}, user: {memberId: "member-1"}} as any, response as any);
    expect(find.firstCall.args[0].userFolderId).toBe("folder-1");
  });

  it("lists conversations from every user folder", async () => {
    sandbox.stub(access, "permittedInboxRoleTypes").resolves(["general"]);
    sandbox.stub(access, "assignedInboxRoleTypesForMember").resolves(["general"]);
    sandbox.stub(counts, "conversationCount").resolves(0);
    const find = sandbox.stub(inboxThread, "find").returns({sort: () => ({skip: () => ({limit: () => ({lean: async () => []})})})} as any);
    sandbox.stub(inboxMessage, "aggregate").resolves([]);
    const response = {json: sandbox.spy(), status: sandbox.stub().returnsThis()};
    await listInboxThreads({query: {userFolderId: InboxUserFolderQuery.ALL}, user: {memberId: "member-1"}} as any, response as any);
    expect(find.firstCall.args[0].userFolderId).toEqual({$ne: null});
  });
});
