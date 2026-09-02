import { Member, MemberAction, MemberUpdateAudit, RamblersMember } from "../models/member.model";
import {
  memberBulkLoadUploadedRows,
  memberUpdateAuditRow,
  memberUpdateAuditRows
} from "./member-bulk-load-rows";

const elizabeth: RamblersMember = {
  membershipNumber: "4003046",
  mobileNumber: "07722 214651",
  email: "shearmans@btinternet.com",
  firstName: "Elizabeth",
  lastName: "Shearman",
  postcode: "CT4 6UU",
  jointWith: "",
  title: "",
  type: "",
  landlineTelephone: "",
  emailMarketingConsent: "",
  emailPermissionLastUpdated: ""
};

const nicholas: RamblersMember = {
  membershipNumber: "4003068",
  mobileNumber: "07510 919696",
  email: "",
  firstName: "Nicholas",
  lastName: "Shearman",
  postcode: "CT4 6UU",
  jointWith: "",
  title: "",
  type: "",
  landlineTelephone: "",
  emailMarketingConsent: "",
  emailPermissionLastUpdated: ""
};

const elizabethMember: Member = {
  id: "member-elizabeth",
  firstName: "Elizabeth",
  lastName: "Shearman",
  membershipNumber: "4003046",
  email: "shearmans@btinternet.com",
  nameAlias: "Liz"
} as Member;

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

describe("member bulk load rows", () => {
  it("joins uploaded members to their audit action by row number", () => {
    const rows = memberBulkLoadUploadedRows(
      [elizabeth, nicholas],
      [
        auditFor({rowNumber: 1, memberAction: MemberAction.updated, memberId: "member-elizabeth"}),
        auditFor({rowNumber: 2, memberAction: MemberAction.skipped, memberId: "member-nicholas"})
      ],
      [elizabethMember]
    );

    expect(rows.map(row => ({
      membershipNumber: row.membershipNumber,
      memberAction: row.memberAction,
      rowNumber: row.rowNumber
    }))).toEqual([
      {membershipNumber: "4003046", memberAction: MemberAction.updated, rowNumber: 1},
      {membershipNumber: "4003068", memberAction: MemberAction.skipped, rowNumber: 2}
    ]);
  });

  it("falls back to membership number when the audit has no row number", () => {
    const rows = memberBulkLoadUploadedRows(
      [elizabeth],
      [auditFor({rowNumber: 0, memberId: "member-elizabeth", memberAction: MemberAction.created})],
      [elizabethMember]
    );

    expect(rows[0].memberAction).toEqual(MemberAction.created);
  });

  it("prefers row number when membership numbers would otherwise collide", () => {
    const rows = memberBulkLoadUploadedRows(
      [elizabeth, nicholas],
      [
        auditFor({rowNumber: 1, memberAction: MemberAction.error, memberId: "member-elizabeth"}),
        auditFor({rowNumber: 2, memberAction: MemberAction.updated, member: {membershipNumber: "4003046"} as Member})
      ],
      [elizabethMember]
    );

    expect(rows[0].memberAction).toEqual(MemberAction.error);
    expect(rows[1].memberAction).toEqual(MemberAction.updated);
  });

  it("leaves member action empty when the session has no matching audit", () => {
    const rows = memberBulkLoadUploadedRows([elizabeth], [], []);

    expect(rows[0].memberAction).toBeNull();
    expect(rows[0].searchableText).toContain("Shearman");
  });

  it("includes the member action in uploaded-row search text", () => {
    const rows = memberBulkLoadUploadedRows(
      [elizabeth],
      [auditFor({memberAction: MemberAction.updated})],
      [elizabethMember]
    );

    expect(rows[0].searchableText.toLowerCase()).toContain("shearman");
    expect(rows[0].searchableText.toLowerCase()).toContain("updated");
  });

  it("makes member-action audits searchable by the member last name", () => {
    const row = memberUpdateAuditRow(
      auditFor({memberId: "member-elizabeth", memberAction: MemberAction.updated}),
      [elizabethMember]
    );

    expect(row.memberName).toEqual("Elizabeth Shearman (Liz)");
    expect(row.searchableText.toLowerCase()).toContain("shearman");
    expect(row.searchableText.toLowerCase()).toContain("updated");
  });

  it("maps a list of audits onto searchable rows", () => {
    const rows = memberUpdateAuditRows(
      [auditFor({memberId: "member-elizabeth"})],
      [elizabethMember]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].memberName).toContain("Elizabeth Shearman");
  });
});
