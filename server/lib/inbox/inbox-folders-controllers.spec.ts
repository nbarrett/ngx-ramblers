import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import * as access from "./inbox-access";
import * as counts from "./inbox-unread-counts";
import { inboxFolder } from "../mongo/models/inbox-folder";
import { inboxThread } from "../mongo/models/inbox-thread";
import { foldersExcludedFromInboxList, InboxFolderDeleteContents } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { createInboxFolder, deleteInboxFolder, listInboxFolders, moveThreadsToUserFolder } from "./inbox-folders-controllers";
import * as deleted from "./inbox-deleted";

describe("inbox folder controllers", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("lists folders with unread counts for the member", async () => {
    sandbox.stub(access, "permittedInboxRoleTypes").resolves(["webmaster"]);
    sandbox.stub(access, "requestingMemberId").returns("member-1");
    sandbox.stub(inboxFolder, "find").returns({sort: () => ({lean: async () => [{_id: "folder-1", name: "Walks", sortIndex: 0}]})} as any);
    sandbox.stub(counts, "conversationCount").resolves(2);
    const response = {json: sandbox.spy(), status: sandbox.stub().returnsThis()};
    await listInboxFolders({user: {memberId: "member-1"}} as any, response as any);
    expect(response.json.firstCall.args[0].response.folders).toEqual([
      {id: "folder-1", name: "Walks", slug: "walks", sortIndex: 0, unreadCount: 2}
    ]);
  });

  it("creates a folder with the next sort index", async () => {
    sandbox.stub(access, "requestingMemberId").returns("member-1");
    sandbox.stub(inboxFolder, "findOne").returns({sort: () => ({select: () => ({lean: async () => ({sortIndex: 3})})})} as any);
    sandbox.stub(inboxFolder, "find").returns({select: () => ({lean: async () => []})} as any);
    sandbox.stub(inboxFolder, "create").resolves({_id: "folder-2", name: "Minutes", slug: "minutes", sortIndex: 4, createdByMemberId: "member-1"});
    const response = {json: sandbox.spy(), status: sandbox.stub().returnsThis()};
    await createInboxFolder({body: {name: "  Minutes  "}} as any, response as any);
    expect(response.json.firstCall.args[0].response).toMatchObject({id: "folder-2", name: "Minutes", slug: "minutes", sortIndex: 4, unreadCount: 0});
  });

  it("files conversations into a folder and leaves junk and sent alone", async () => {
    sandbox.stub(access, "permittedInboxRoleTypes").resolves(["webmaster"]);
    sandbox.stub(inboxFolder, "exists").resolves(true);
    const updateMany = sandbox.stub(inboxThread, "updateMany").resolves({matchedCount: 1, modifiedCount: 1});
    const response = {json: sandbox.spy(), status: sandbox.stub().returnsThis()};
    await moveThreadsToUserFolder({
      body: {threadIds: ["thread-1"], userFolderId: "folder-1"}
    } as any, response as any);
    expect(updateMany.firstCall.args[0]._id).toEqual({$in: ["thread-1"]});
    expect(updateMany.firstCall.args[0].folder).toEqual({$nin: foldersExcludedFromInboxList()});
    expect(updateMany.firstCall.args[1]).toEqual({$set: {userFolderId: "folder-1"}});
    expect(response.json.firstCall.args[0].response).toEqual({matched: 1, modified: 1});
  });

  it("returns filed conversations to the inbox when a folder is deleted", async () => {
    sandbox.stub(inboxFolder, "findOne").returns({lean: async () => ({_id: "folder-1", name: "Walks"})} as any);
    const unfile = sandbox.stub(inboxThread, "updateMany").resolves({matchedCount: 2, modifiedCount: 2});
    const remove = sandbox.stub(inboxFolder, "deleteOne").resolves({deletedCount: 1});
    const response = {json: sandbox.spy(), status: sandbox.stub().returnsThis()};
    await deleteInboxFolder({params: {id: "folder-1"}, query: {contents: InboxFolderDeleteContents.INBOX}} as any, response as any);
    expect(unfile.firstCall.args[0]).toMatchObject({userFolderId: "folder-1"});
    expect(unfile.firstCall.args[1]).toEqual({$unset: {userFolderId: 1}});
    expect(remove.called).toBe(true);
    expect(response.json.firstCall.args[0].response).toEqual({deleted: true, contents: InboxFolderDeleteContents.INBOX});
  });

  it("moves folder conversations to Deleted when that option is chosen", async () => {
    sandbox.stub(inboxFolder, "findOne").returns({lean: async () => ({_id: "folder-1", name: "Walks"})} as any);
    const toDeleted = sandbox.stub(deleted, "moveUserFolderThreadsToDeleted").resolves();
    const remove = sandbox.stub(inboxFolder, "deleteOne").resolves({deletedCount: 1});
    const unfile = sandbox.stub(inboxThread, "updateMany");
    const response = {json: sandbox.spy(), status: sandbox.stub().returnsThis()};
    await deleteInboxFolder({params: {id: "folder-1"}, query: {contents: InboxFolderDeleteContents.DELETED}} as any, response as any);
    expect(toDeleted.calledWith("folder-1")).toBe(true);
    expect(unfile.called).toBe(false);
    expect(remove.called).toBe(true);
    expect(response.json.firstCall.args[0].response).toEqual({deleted: true, contents: InboxFolderDeleteContents.DELETED});
  });
});
