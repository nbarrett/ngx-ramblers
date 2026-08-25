import { describe, expect, it } from "vitest";
import { InboxNotifyModePicker } from "./inbox-notify-mode-picker";
import { InboxAliasRecipientView } from "../../models/inbox.model";

function recipient(memberEmail: string): InboxAliasRecipientView {
  return {
    memberId: "member-1",
    email: null,
    notify: true,
    memberName: "Nick Barrett",
    memberEmail
  };
}

describe("InboxNotifyModePicker", () => {

  it("hides Notify me when the member address is on the group domain", () => {
    const picker = new InboxNotifyModePicker();
    picker.groupDomain = "ngx-ramblers.org.uk";
    picker.recipient = recipient("nick.barrett@ngx-ramblers.org.uk");
    expect(picker.memberOptionVisible()).toBe(false);
  });

  it("keeps Notify me for a personal address", () => {
    const picker = new InboxNotifyModePicker();
    picker.groupDomain = "ngx-ramblers.org.uk";
    picker.recipient = recipient("nick.barrett36@me.com");
    expect(picker.memberOptionVisible()).toBe(true);
  });
});
