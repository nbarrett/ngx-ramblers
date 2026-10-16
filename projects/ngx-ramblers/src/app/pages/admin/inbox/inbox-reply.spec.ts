import {describe, expect, it, vi} from "vitest";
import {InboxComponent} from "./inbox.component";
import {InboxMessageDirection} from "../../../models/inbox.model";
import {StoredValue} from "../../../models/ui-actions";

describe("replying to an earlier conversation message", () => {
  it("replies repeatedly through the original inbound thread after a sent thread becomes selected", async () => {
    const inbound = {threadId: "inbound-thread", messageId: "original-message", direction: InboxMessageDirection.INBOUND};
    const sent = {threadId: "sent-thread", messageId: "sent-reply", direction: InboxMessageDirection.OUTBOUND};
    const reply = {threadId: inbound.threadId, to: {name: "Morgan Lane", email: "morgan@example.com"}};
    const instance = Object.create(InboxComponent.prototype);
    Object.assign(instance, {
      selectedThread: {id: sent.threadId},
      selectedThreadId: sent.threadId,
      selectedMessages: [inbound, sent],
      inboxService: {composeReply: vi.fn().mockResolvedValue(reply)},
      markThreadsRead: vi.fn(),
      siblingConversationThreads: vi.fn().mockReturnValue([]),
      inboxReplyHandoff: {queue: vi.fn()},
      logger: {info: vi.fn(), error: vi.fn()},
      notify: {error: vi.fn()},
      route: {snapshot: {queryParams: {}}},
      router: {navigate: vi.fn().mockResolvedValue(true)}
    });

    await instance.prepareReply(inbound);
    await instance.prepareReply(inbound);

    expect(instance.inboxService.composeReply).toHaveBeenCalledTimes(2);
    expect(instance.inboxService.composeReply).toHaveBeenNthCalledWith(1, inbound.threadId, expect.objectContaining({threadId: inbound.threadId, messageId: inbound.messageId}));
    expect(instance.inboxService.composeReply).toHaveBeenNthCalledWith(2, inbound.threadId, expect.objectContaining({threadId: inbound.threadId, messageId: inbound.messageId}));
    expect(instance.router.navigate).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({queryParams: expect.objectContaining({[StoredValue.THREAD]: inbound.threadId, [StoredValue.MESSAGE]: inbound.messageId})}));
    expect(instance.inboxReplyHandoff.queue).toHaveBeenCalledTimes(2);
    expect(instance.notify.error).not.toHaveBeenCalled();
  });
});
