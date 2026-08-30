import {
  groupTransactionalEmailsBySendAction,
  subjectStemFromTransactional
} from "./transactional-send-grouping";
import { BrevoTransactionalEmailSummary } from "../models/mail.model";

function email(partial: Partial<BrevoTransactionalEmailSummary> & Pick<BrevoTransactionalEmailSummary, "email" | "subject" | "date">): BrevoTransactionalEmailSummary {
  return {
    messageId: partial.messageId || partial.email + partial.date,
    uuid: partial.uuid || "",
    from: partial.from,
    tags: partial.tags,
    ...partial
  };
}

describe("subjectStemFromTransactional", () => {
  it("strips the personalised name suffix when prefix and subject are present", () => {
    expect(subjectStemFromTransactional(
      "Example Group - Follow on from demo & Your NGX-Ramblers Login - Justin Lumley"
    )).toBe("Example Group - Follow on from demo & Your NGX-Ramblers Login");
  });

  it("leaves reply and un-suffixed subjects unchanged", () => {
    expect(subjectStemFromTransactional("Re: Testing inbox works okay")).toBe("Re: Testing inbox works okay");
    expect(subjectStemFromTransactional("Example Group - Your NGX-Ramblers Login")).toBe(
      "Example Group - Your NGX-Ramblers Login"
    );
  });
});

describe("groupTransactionalEmailsBySendAction", () => {
  it("groups a personalised batch as one send action and keeps separate actions apart", () => {
    const emails = [
      email({
        email: "a@example.com",
        subject: "Group - Welcome - Alice",
        date: "2026-08-04T22:14:22.000+01:00"
      }),
      email({
        email: "b@example.com",
        subject: "Group - Welcome - Bob",
        date: "2026-08-04T22:14:23.000+01:00"
      }),
      email({
        email: "c@example.com",
        subject: "Group - Welcome - Carol",
        date: "2026-08-04T22:14:24.000+01:00"
      }),
      email({
        email: "nick@example.com",
        subject: "Re: Testing inbox works okay",
        date: "2026-08-04T23:00:34.000+01:00"
      }),
      email({
        email: "admin@example.com",
        subject: "Group - Your NGX-Ramblers Login - Admin",
        date: "2026-08-04T15:38:10.000+01:00"
      }),
      email({
        email: "nick2@example.com",
        subject: "Group - Your NGX-Ramblers Login - Nick",
        date: "2026-08-04T21:54:05.000+01:00"
      })
    ];

    const groups = groupTransactionalEmailsBySendAction(emails);
    expect(groups.length).toBe(4);

    const welcome = groups.find(group => group.subjectStem === "Group - Welcome");
    expect(welcome?.recipients.map(recipient => recipient.email)).toEqual([
      "c@example.com",
      "b@example.com",
      "a@example.com"
    ]);
    expect(welcome?.originLabel).toBeDefined();

    const reply = groups.find(group => group.subjectStem === "Re: Testing inbox works okay");
    expect(reply?.recipients.length).toBe(1);

    const loginGroups = groups.filter(group => group.subjectStem === "Group - Your NGX-Ramblers Login");
    expect(loginGroups.length).toBe(2);
  });

  it("does not merge same-stem sends outside the time window", () => {
    const emails = [
      email({
        email: "a@example.com",
        subject: "Group - Notice - Alice",
        date: "2026-08-04T10:00:00.000+01:00"
      }),
      email({
        email: "b@example.com",
        subject: "Group - Notice - Bob",
        date: "2026-08-04T12:00:00.000+01:00"
      })
    ];
    expect(groupTransactionalEmailsBySendAction(emails).length).toBe(2);
  });
});
