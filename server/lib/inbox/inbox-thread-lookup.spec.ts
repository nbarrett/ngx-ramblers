import expect from "expect";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import { InboxThread, InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxThread as threads } from "../mongo/models/inbox-thread";
import { inboxThreadByIdOrSlug } from "./inbox-thread-lookup";

describe("inbox thread lookup", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("filters duplicate slugs to permitted mailboxes before choosing a thread", async () => {
    const copies = [{id: "private-copy", roleType: "webmaster"}, {id: "permitted-copy", roleType: "support"}];
    const find = sandbox.stub(threads, "findOne").callsFake(((filter: any) => ({sort: () => ({lean: async () => copies.find(copy => filter.roleType.$in.includes(copy.roleType))})})) as any);
    const result = await inboxThreadByIdOrSlug("default", "same-subject", ["support"], false);
    expect(result?.id).toBe("permitted-copy");
    expect(find.firstCall.args[0]).toEqual({tenantSlug: "default", roleType: {$in: ["support"]}, slug: "same-subject"});
  });

  it("respects the selected mailbox when two copies are permitted", async () => {
    const copy = {id: "support-copy", roleType: "support"} as InboxThread;
    const find = sandbox.stub(threads, "findOne").returns({sort: () => ({lean: async () => copy})} as any);
    expect(await inboxThreadByIdOrSlug("default", "same-subject", ["webmaster", "support"], false, "support")).toEqual(copy);
    expect(find.firstCall.args[0]).toEqual({tenantSlug: "default", roleType: {$in: ["support"]}, slug: "same-subject"});
  });

  it("does not grant access when an unavailable mailbox is requested", async () => {
    const find = sandbox.stub(threads, "findOne").returns({sort: () => ({lean: async () => null})} as any);
    expect(await inboxThreadByIdOrSlug("default", "same-subject", ["support"], false, "webmaster")).toBe(null);
    expect(find.firstCall.args[0]).toEqual({tenantSlug: "default", roleType: {$in: []}, slug: "same-subject"});
  });

  it("allows junk lookup only when junk access was granted", async () => {
    const find = sandbox.stub(threads, "findOne").returns({sort: () => ({lean: async () => null})} as any);
    await inboxThreadByIdOrSlug("default", "same-subject", ["support"], true);
    expect(find.firstCall.args[0]).toEqual({tenantSlug: "default", $or: [{roleType: {$in: ["support"]}}, {folder: InboxThreadFolder.JUNK}], slug: "same-subject"});
  });

  it("keeps unique ID lookup independent of duplicate subject slugs", async () => {
    const id = "0123456789abcdef01234567";
    const copy = {id, roleType: "support"} as InboxThread;
    const find = sandbox.stub(threads, "findOne").returns({lean: async () => copy} as any);
    expect(await inboxThreadByIdOrSlug("default", id, ["support"], false)).toEqual(copy);
    expect(find.firstCall.args[0]).toEqual({_id: id, tenantSlug: "default"});
    expect(find.calledOnce).toBe(true);
  });
});
