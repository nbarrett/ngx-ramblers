import { describe, expect, it, vi } from "vitest";
import { InboxComponent } from "./inbox.component";
import { InboxConversationsService } from "../../../services/inbox/inbox-conversations.service";
import { InboxGroupingMode, InboxThread } from "../../../models/inbox.model";

function inbox(groupingMode = InboxGroupingMode.CONVERSATIONS): any {
  const instance = Object.create(InboxComponent.prototype);
  const threads = [{id: "thread-1", conversationKey: "conversation-1"}, {id: "thread-2", conversationKey: "conversation-1"}];
  Object.assign(instance, {
    conversations: new InboxConversationsService(),
    threads,
    layout: {groupingMode},
    siblingConversationThreads: vi.fn().mockReturnValue(threads),
    threadIdOf: (thread: InboxThread) => thread.id
  });
  return instance;
}

describe("inbox conversation actions", () => {
  it("includes every sibling when acting on a grouped conversation", () => {
    const instance = inbox();
    expect(instance.expandThreadIdsForAction(["thread-1"])).toEqual(["thread-1", "thread-2"]);
  });

  it("keeps actions limited to the chosen thread in message mode", () => {
    const instance = inbox(InboxGroupingMode.MESSAGES);
    expect(instance.expandThreadIdsForAction(["thread-1"])).toEqual(["thread-1"]);
  });

  it("preserves supplied IDs outside the currently loaded list", () => {
    const instance = inbox();
    expect(instance.expandThreadIdsForAction(["thread-1", "unloaded-thread"])).toEqual(["thread-1", "unloaded-thread", "thread-2"]);
  });

  it("ignores modified or already handled mailbox shortcuts", () => {
    const instance = inbox();
    instance.busy = false;
    instance.selectedMailboxView = "inbox";
    const body = document.body;
    expect(instance.canHandleMailboxShortcut({key: "Backspace", ctrlKey: true, metaKey: false, altKey: false, defaultPrevented: false, target: body})).toBe(false);
    expect(instance.canHandleMailboxShortcut({key: "Backspace", ctrlKey: false, metaKey: true, altKey: false, defaultPrevented: false, target: body})).toBe(false);
    expect(instance.canHandleMailboxShortcut({key: "Delete", ctrlKey: false, metaKey: false, altKey: true, defaultPrevented: false, target: body})).toBe(false);
    expect(instance.canHandleMailboxShortcut({key: "Delete", ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: true, target: body})).toBe(false);
    expect(instance.canHandleMailboxShortcut({key: "Delete", ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false, target: body})).toBe(true);
  });

  it("refreshes after a partial grouped deletion instead of restoring deleted siblings", async () => {
    const instance = inbox();
    const threads = instance.threads;
    Object.defineProperty(instance, "filteredThreads", {get: () => threads});
    Object.assign(instance, {
      dismissPendingDelete: vi.fn(),
      currentConversationIndex: () => 0,
      conversationUnread: () => false,
      threadRowKey: (thread: InboxThread) => thread.id,
      selectedMailboxView: "inbox",
      selectedThreadIds: {delete: vi.fn()},
      clearSelectedMessages: vi.fn(),
      layout: {groupingMode: InboxGroupingMode.CONVERSATIONS, mobileShowDetail: false},
      inboxService: {
        deleteThread: vi.fn((id: string) => id === "thread-2" ? Promise.reject(new Error("mailbox failed")) : Promise.resolve())
      },
      refresh: vi.fn().mockResolvedValue(null),
      restoreRemovedThreads: vi.fn(),
      openThread: vi.fn(),
      notify: {error: vi.fn(), success: vi.fn()},
      logger: {error: vi.fn()},
      selectedThread: threads[0],
      selectedThreadId: "thread-1",
      threadListTotalCount: 1,
      threadListUnreadCount: 0,
      pendingDelete: null
    });
    await instance.scheduleConversationDelete(threads[0]);
    expect(instance.inboxService.deleteThread.mock.calls).toEqual([["thread-1"], ["thread-2"]]);
    expect(instance.restoreRemovedThreads).not.toHaveBeenCalled();
    expect(instance.refresh).toHaveBeenCalledWith(false);
    expect(instance.pendingDelete).toBeNull();
    expect(instance.notify.error).toHaveBeenCalled();
    expect(instance.notify.success).not.toHaveBeenCalled();
  });

  it("does not run a keyboard deletion without a focused conversation", async () => {
    const instance = inbox();
    instance.selectedThread = null;
    instance.inboxService = {deleteThread: vi.fn()};
    await instance.deleteFocusedThread(document.createElement("div"));
    expect(instance.inboxService.deleteThread).not.toHaveBeenCalled();
  });

  it("restores every deleted sibling when undoing a conversation deletion", async () => {
    const instance = inbox();
    const removedThreads = [...instance.threads];
    Object.assign(instance, {
      pendingDelete: {threadIds: ["thread-1", "thread-2"], removedThreads, insertionIndex: 0, selectedThread: removedThreads[0], timer: null},
      inboxService: {restoreThread: vi.fn().mockResolvedValue(null)},
      restoreRemovedThreads: vi.fn(),
      openThread: vi.fn().mockResolvedValue(null),
      notify: {error: vi.fn()},
      logger: {error: vi.fn()}
    });
    await instance.undoPendingDelete();
    expect(instance.inboxService.restoreThread.mock.calls).toEqual([["thread-1"], ["thread-2"]]);
    expect(instance.restoreRemovedThreads).toHaveBeenCalledWith(removedThreads, 0, removedThreads[0]);
    expect(instance.pendingDelete).toBeNull();
    expect(instance.notify.error).not.toHaveBeenCalled();
  });
});
