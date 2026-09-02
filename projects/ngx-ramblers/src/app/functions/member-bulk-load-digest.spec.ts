import { Member, MemberAction, MemberBulkLoadAudit, MemberUpdateAudit } from "../models/member.model";
import {
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
  it("groups created, updated, skipped and failed members", () => {
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
    expect(digest.updated[0].changeSummary).toContain("Email");
    expect(digest.skippedCount).toEqual(1);
    expect(digest.errors[0].errorText).toEqual("email is required");
    expect(memberBulkLoadDigestCountsLabel(digest)).toEqual("1 created, 1 updated, 1 skipped, 1 failed");
  });

  it("summarises field changes without listing skipped members in the email", () => {
    expect(summariseFieldChanges([])).toContain("No changes");
    const html = memberBulkLoadDigestHtml(
      memberBulkLoadDigest(
        session,
        [
          auditFor({memberAction: MemberAction.created, memberId: "member-elizabeth"}),
          auditFor({memberAction: MemberAction.skipped, memberId: "member-nicholas"})
        ],
        [elizabeth, nicholas],
        "Tim Weston"
      ),
      "Sunday, 19 April 2026, 9:55:59 am",
      "https://example.org.uk/admin/member-bulk-load"
    );
    expect(html).toContain("Elizabeth Shearman");
    expect(html).toContain("1 created, 0 updated, 1 skipped, 0 failed");
    expect(html).not.toContain("Nicholas Shearman");
    expect(html).toContain("Open upload history");
  });
});
