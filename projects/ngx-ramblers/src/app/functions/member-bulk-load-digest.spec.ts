import { Member, MemberAction, MemberBulkLoadAudit, MemberUpdateAudit } from "../models/member.model";
import { EmailTemplateName, MemberSelection, NotificationConfig, WorkflowAction } from "../models/mail.model";
import {
  expiryNotificationConfigIds,
  memberBulkLoadDigest,
  memberBulkLoadDigestCountsLabel,
  memberBulkLoadDigestHtml,
  summariseFieldChanges
} from "./member-bulk-load-digest";

const elizabeth: Member = {
  id: "member-elizabeth",
  firstName: "Elizabeth",
  lastName: "Shearman",
  membershipNumber: "4003046"
} as Member;

const nicholas: Member = {
  id: "member-nicholas",
  firstName: "Nicholas",
  lastName: "Shearman",
  membershipNumber: "4003068"
} as Member;

const session: MemberBulkLoadAudit = {
  id: "session-1",
  createdDate: 1,
  files: {archive: "", data: "ExportAll (4).xlsx"},
  auditLog: [],
  members: []
};

function auditFor(overrides: Partial<MemberUpdateAudit>): MemberUpdateAudit {
  return {
    uploadSessionId: "session-1",
    updateTime: 1,
    memberMatch: MemberAction.found,
    memberAction: MemberAction.updated,
    rowNumber: 1,
    changes: 1,
    ...overrides
  };
}

describe("member bulk load digest", () => {
  it("groups created, skipped and failed members and counts updates without listing them", () => {
    const digest = memberBulkLoadDigest(
      session,
      [
        auditFor({rowNumber: 1, memberAction: MemberAction.created, memberId: "member-elizabeth", fieldChanges: []}),
        auditFor({
          rowNumber: 2,
          memberAction: MemberAction.updated,
          memberId: "member-nicholas",
          fieldChanges: [{fieldName: "email", from: "", to: "n@example.com", resolution: "Updated"}]
        }),
        auditFor({rowNumber: 3, memberAction: MemberAction.skipped, memberId: "member-elizabeth"}),
        auditFor({
          rowNumber: 4,
          memberAction: MemberAction.error,
          member: {firstName: "Pat", lastName: "Lee"} as Member,
          auditErrorMessage: {message: "ValidationError: email is required"}
        })
      ],
      [elizabeth, nicholas],
      "Tim Weston"
    );

    expect(digest.uploadedByName).toEqual("Tim Weston");
    expect(digest.dataFileName).toEqual("ExportAll (4).xlsx");
    expect(digest.created.map(member => member.name)).toEqual(["Elizabeth Shearman"]);
    expect(digest.updatedCount).toEqual(1);
    expect(digest.skippedCount).toEqual(1);
    expect(digest.errors[0].errorText).toEqual("email is required");
    expect(memberBulkLoadDigestCountsLabel(digest)).toEqual("1 created, 1 updated, 1 skipped, 1 failed, 0 sent an expiry warning, 0 sent the expiry email");
  });

  it("lists new members and expiry emails but not skipped or updated members", () => {
    expect(summariseFieldChanges([])).toContain("No changes");
    const html = memberBulkLoadDigestHtml(
      memberBulkLoadDigest(
        session,
        [
          auditFor({memberAction: MemberAction.created, memberId: "member-elizabeth"}),
          auditFor({memberAction: MemberAction.skipped, memberId: "member-nicholas"}),
          auditFor({
            memberAction: MemberAction.updated,
            memberId: "member-nicholas",
            fieldChanges: [{fieldName: "email", from: "", to: "n@example.com", resolution: "Updated"}]
          })
        ],
        [elizabeth, nicholas],
        "Tim Weston",
        {
          expiryWarnings: [{name: "Sam Warned", membershipNumber: "111", email: "sam@example.com", errorText: null}],
          expiryNotices: [{name: "Jo Expired", membershipNumber: "222", email: "jo@example.com", errorText: null}]
        }
      ),
      "Sunday, 19 April 2026, 9:55:59 am",
      "https://example.org.uk/admin/member-bulk-load"
    );
    expect(html).toContain("Elizabeth Shearman");
    expect(html).toContain("1 created, 1 updated, 1 skipped, 0 failed, 1 sent an expiry warning, 1 sent the expiry email");
    expect(html).not.toContain("Nicholas Shearman");
    expect(html).not.toContain("Email");
    expect(html).toContain("Sent an expiry warning");
    expect(html).toContain("Sam Warned (111)");
    expect(html).toContain("Sent the expiry email and removed from the site");
    expect(html).toContain("Jo Expired (222)");
    expect(html).toContain("Open upload history");
  });

  it("treats the member-removing email as the expiry email and its follow-on as the warning", () => {
    const config = (overrides: Partial<NotificationConfig>): NotificationConfig => ({
      subject: {text: ""},
      bannerId: null,
      preSendActions: [],
      postSendActions: [],
      defaultMemberSelection: MemberSelection.RECENTLY_ADDED,
      ...overrides
    } as NotificationConfig);
    const ids = expiryNotificationConfigIds([
      config({id: "welcome", templateName: "welcome-to-the-group"}),
      config({id: "expiry", templateName: "anything", postSendActions: [WorkflowAction.BULK_DELETE_GROUP_MEMBER], nextNotificationConfigId: "warning"}),
      config({id: "warning", templateName: "custom-warning"}),
      config({id: "second-warning", templateName: EmailTemplateName.MEMBERSHIP_EXPIRY_WARNING})
    ]);
    expect(ids.expiryIds).toEqual(["expiry"]);
    expect(ids.warningIds).toEqual(["warning", "second-warning"]);
  });
});
