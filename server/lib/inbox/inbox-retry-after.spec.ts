import expect from "expect";
import {describe, it} from "mocha";
import {dateTimeFromIso} from "../shared/dates";
import {inboxRetryAfter, pollConnection} from "./inbox-poller";
import {InboxMailboxConnection} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";

describe("Gmail sync rate limit backoff", () => {
  it("reads the retry time from Gmail errors", () => {
    expect(inboxRetryAfter("User-rate limit exceeded. Retry after 2030-01-01T10:00:00.123Z")).toBe(dateTimeFromIso("2030-01-01T10:00:00.123Z").toMillis());
    expect(inboxRetryAfter(null)).toBe(0);
    expect(inboxRetryAfter("Invalid credentials")).toBe(0);
  });

  it("skips sync before a persisted retry time without accessing Gmail or MongoDB", async () => {
    const error = "User-rate limit exceeded. Retry after 2099-01-01T10:00:00.123Z";
    const result = await pollConnection({id: "fictional-mailbox", lastErrorMessage: error} as InboxMailboxConnection);
    expect(result).toEqual({mailboxConnectionId: "fictional-mailbox", importedCount: 0, error});
  });
});
