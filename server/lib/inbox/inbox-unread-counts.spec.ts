import expect from "expect";
import { describe, it } from "mocha";
import { InboxMessageDirection, InboxThread, InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { threadUnreadForMember, unreadConditionForMember, unreadConversationFilter } from "./inbox-unread-counts";

describe("inbox-unread-counts", () => {

  function createThread(fields: Partial<InboxThread>): InboxThread {
    return {unread: true, readByMemberIds: [], ...fields} as InboxThread;
  }

  describe("threadUnreadForMember", () => {

    it("should treat a thread as unread when the member has not read it", () => {
      const thread = createThread({readByMemberIds: ["someone-else"]});
      expect(threadUnreadForMember(thread, "me")).toBe(true);
    });

    it("should treat a thread as read once the member appears in readByMemberIds", () => {
      const thread = createThread({readByMemberIds: ["someone-else", "me"]});
      expect(threadUnreadForMember(thread, "me")).toBe(false);
    });

    it("should not let one member's read state mark the thread read for another", () => {
      const thread = createThread({readByMemberIds: ["me"]});
      expect(threadUnreadForMember(thread, "you")).toBe(true);
    });

    it("should fall back to the global unread flag when there is no member", () => {
      expect(threadUnreadForMember(createThread({unread: true, readByMemberIds: ["someone"]}), null)).toBe(true);
      expect(threadUnreadForMember(createThread({unread: false, readByMemberIds: []}), null)).toBe(false);
    });

    it("should tolerate a missing readByMemberIds array", () => {
      const thread = createThread({readByMemberIds: undefined});
      expect(threadUnreadForMember(thread, "me")).toBe(true);
    });

    it("should treat outbound mail we sent as read unless the unread flag is set", () => {
      expect(threadUnreadForMember(createThread({
        lastDirection: InboxMessageDirection.OUTBOUND,
        unread: false,
        readByMemberIds: []
      }), "me")).toBe(false);
      expect(threadUnreadForMember(createThread({
        lastDirection: InboxMessageDirection.OUTBOUND,
        unread: true,
        readByMemberIds: []
      }), "me")).toBe(true);
    });

  });

  describe("unreadConditionForMember", () => {

    it("should match inbound threads the member has not read, and outbound threads marked unread", () => {
      expect(unreadConditionForMember("me")).toEqual({
        $or: [
          {lastDirection: InboxMessageDirection.OUTBOUND, unread: true},
          {lastDirection: {$ne: InboxMessageDirection.OUTBOUND}, readByMemberIds: {$ne: "me"}}
        ]
      });
    });

    it("should fall back to the global unread flag when there is no member", () => {
      expect(unreadConditionForMember(null)).toEqual({unread: true});
    });

  });

  describe("unreadConversationFilter", () => {

    it("should match any of several roles and always exclude junk", () => {
      const filter = unreadConversationFilter(["secretary", "chair"], "me");
      expect(filter.roleType).toEqual({$in: ["secretary", "chair"]});
      expect(filter.folder).toEqual({$nin: [InboxThreadFolder.JUNK, InboxThreadFolder.DELETED]});
      expect(filter.$or).toEqual([
        {lastDirection: InboxMessageDirection.OUTBOUND, unread: true},
        {lastDirection: {$ne: InboxMessageDirection.OUTBOUND}, readByMemberIds: {$ne: "me"}}
      ]);
    });

    it("should match a single role directly rather than with $in", () => {
      const filter = unreadConversationFilter("secretary", "me");
      expect(filter.roleType).toEqual("secretary");
    });

    it("should exclude junk even when counting globally for a role", () => {
      const filter = unreadConversationFilter("secretary", null);
      expect(filter.folder).toEqual({$nin: [InboxThreadFolder.JUNK, InboxThreadFolder.DELETED]});
      expect(filter.unread).toBe(true);
    });

  });

});
