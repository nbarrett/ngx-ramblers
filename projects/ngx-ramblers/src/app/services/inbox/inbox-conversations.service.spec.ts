import {describe, expect, it} from "vitest";
import {InboxConversationsService} from "./inbox-conversations.service";
import {InboxGroupingMode, InboxThread, InboxThreadFolder} from "../../models/inbox.model";

describe("inbox conversation grouping", () => {
  const first = {id: "thread-1", conversationKey: "conversation", lastSeenAt: 1, roleType: "chair", folder: InboxThreadFolder.INBOX, unread: true} as InboxThread;
  const latest = {...first, id: "thread-2", lastSeenAt: 2, roleType: "support"};

  it("keeps every mailbox copy in Messages and groups the newest copy in Conversations", () => {
    const service = new InboxConversationsService();
    const threads = [first, latest];
    const snapshot = threads.map(thread => ({...thread}));
    service.index(threads);
    expect(service.conversationRepresentatives(threads, InboxGroupingMode.MESSAGES, false)).toEqual(threads);
    expect(service.conversationRepresentatives(threads, InboxGroupingMode.CONVERSATIONS, false)).toEqual([latest]);
    expect(service.siblingConversationThreads(latest)).toEqual(threads);
    expect(threads).toEqual(snapshot);
  });

  it("clears old sibling mappings when the mailbox changes", () => {
    const service = new InboxConversationsService();
    service.index([first, latest]);
    service.index([first]);
    expect(service.siblingConversationThreads(first)).toEqual([first]);
  });

  it("preserves Sent grouping by subject when no provider conversation key exists", () => {
    const service = new InboxConversationsService();
    const threads = [{...first, conversationKey: null, normalisedSubject: "welcome"}, {...latest, conversationKey: null, normalisedSubject: "welcome"}];
    service.index(threads);
    expect(service.conversationRepresentatives(threads, InboxGroupingMode.CONVERSATIONS, true)).toEqual([threads[0]]);
    expect(service.conversationRepresentatives(threads, InboxGroupingMode.CONVERSATIONS, false)).toEqual(threads);
  });
});
