import expect from "expect";
import { describe, it } from "mocha";
import { InboxMessage, InboxMessageDirection, InboxThread } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { sentMessageRows } from "./inbox-sent";

describe("inbox-sent", () => {

  function createThread(id: string): InboxThread {
    return {id, subject: `thread-subject-${id}`, lastDirection: InboxMessageDirection.INBOUND} as InboxThread;
  }

  function createMessage(fields: Partial<InboxMessage>): InboxMessage {
    return {direction: InboxMessageDirection.OUTBOUND, to: [{name: "Jane Member", email: "jane@example.com"}], ...fields} as InboxMessage;
  }

  describe("sentMessageRows", () => {

    it("should produce one row per sent message, newest first", () => {
      const threads = [createThread("a")];
      const messages = [
        createMessage({threadId: "a", messageId: "<m1>", subject: "first", sentAt: 100}),
        createMessage({threadId: "a", messageId: "<m2>", subject: "second", sentAt: 200})
      ];
      const {rows, totalCount} = sentMessageRows(threads, messages, 0, 50);
      expect(totalCount).toBe(2);
      expect(rows.map(row => row.subject)).toEqual(["second", "first"]);
      expect(rows.map(row => row.sentMessageId)).toEqual(["<m2>", "<m1>"]);
    });

    it("should exclude messages whose thread is not visible", () => {
      const messages = [createMessage({threadId: "hidden", messageId: "<m1>", sentAt: 100})];
      const {rows, totalCount} = sentMessageRows([createThread("a")], messages, 0, 50);
      expect(rows).toEqual([]);
      expect(totalCount).toBe(0);
    });

    it("should deduplicate copies of the same message across sibling threads", () => {
      const threads = [createThread("a"), createThread("b")];
      const messages = [
        createMessage({threadId: "a", messageId: "<m1>", sentAt: 100}),
        createMessage({threadId: "b", messageId: "<m1>", sentAt: 100})
      ];
      const {totalCount} = sentMessageRows(threads, messages, 0, 50);
      expect(totalCount).toBe(1);
    });

    it("should label the row with the first recipient and a count of the others", () => {
      const messages = [createMessage({
        threadId: "a",
        messageId: "<m1>",
        sentAt: 100,
        to: [{name: "Jane Member", email: "jane@example.com"}, {name: "John Member", email: "john@example.com"}]
      })];
      const {rows} = sentMessageRows([createThread("a")], messages, 0, 50);
      expect(rows[0].externalAddress).toEqual({name: "Jane Member +1", email: "jane@example.com"});
      expect(rows[0].lastDirection).toBe(InboxMessageDirection.OUTBOUND);
    });

    it("should apply offset and limit after ordering", () => {
      const threads = [createThread("a")];
      const messages = [
        createMessage({threadId: "a", messageId: "<m1>", sentAt: 400}),
        createMessage({threadId: "a", messageId: "<m2>", sentAt: 300}),
        createMessage({threadId: "a", messageId: "<m3>", sentAt: 200}),
        createMessage({threadId: "a", messageId: "<m4>", sentAt: 100})
      ];
      const {rows, totalCount} = sentMessageRows(threads, messages, 1, 2);
      expect(totalCount).toBe(4);
      expect(rows.map(row => row.sentMessageId)).toEqual(["<m2>", "<m3>"]);
    });
  });
});
