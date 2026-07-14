import expect from "expect";
import * as fs from "fs";
import { describe, it } from "mocha";
import * as path from "path";
import { MemberTerm, RamblersMember } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { membershipSecretariesInsightHubFormat, ramblersMemberFrom } from "./ramblers-member-mapper";
import { extractWorkbook } from "./workbook-reader";
import { WorkbookExtract, WorkbookRow } from "./workbook-reader.model";

function fixture(fileName: string): Buffer {
  return fs.readFileSync(path.join(__dirname, "../../test-data", fileName));
}

async function membersFrom(fileName: string): Promise<RamblersMember[]> {
  const extract: WorkbookExtract = await extractWorkbook(fixture(fileName));
  return extract.rows.filter(membershipSecretariesInsightHubFormat).map(ramblersMemberFrom);
}

describe("ramblers-member-mapper", () => {

  describe("blank cell equivalence", () => {

    it("produces an identical member whether a cell is absent or an empty string", () => {
      const absent: WorkbookRow = {"Mem No.": 1234567, "Surname": "Barrett"};
      const empty: WorkbookRow = {
        "Mem No.": 1234567, "Surname": "Barrett", "Joint With": "", "Mobile Telephone": "", "Postcode": ""
      };
      expect(ramblersMemberFrom(absent)).toEqual(ramblersMemberFrom(empty));
    });

    it("renders every absent field as an empty string rather than undefined", () => {
      const member: RamblersMember = ramblersMemberFrom({"Mem No.": 42});
      expect(member.jointWith).toBe("");
      expect(member.postcode).toBe("");
      expect(member.email).toBe("");
      expect(member.mobileNumber).toBe("");
    });
  });

  describe("member extraction from a workbook", () => {

    it("maps each populated row of the Full List sheet to a member record", async () => {
      const members: RamblersMember[] = await membersFrom("member-bulk-load-full-list.xlsx");
      expect(members.length).toBe(3);
      expect(members[0]).toEqual({
        membershipExpiryDate: "2027-03-31",
        membershipNumber: "1234567",
        mobileNumber: "07700900123",
        email: "nick@example.com",
        firstName: "Nicholas",
        lastName: "Barrett",
        postcode: "CT1 1AA",
        jointWith: "",
        title: "Mr",
        type: "Individual",
        memberStatus: "Current",
        memberTerm: MemberTerm.ANNUAL,
        landlineTelephone: "01227 700123",
        emailMarketingConsent: "Yes",
        emailPermissionLastUpdated: "2025-01-15"
      });
    });

    it("stringifies a numeric membership number and trims surrounding whitespace", async () => {
      const members: RamblersMember[] = await membersFrom("member-bulk-load-full-list.xlsx");
      expect(members[1].membershipNumber).toBe("7654321");
      expect(members[1].firstName).toBe("Jane");
      expect(members[1].lastName).toBe("Smith");
      expect(members[1].jointWith).toBe("Mr John Smith");
    });

    it("maps member term case-insensitively and yields null for an unrecognised term", async () => {
      const members: RamblersMember[] = await membersFrom("member-bulk-load-full-list.xlsx");
      expect(members[1].memberTerm).toBe(MemberTerm.LIFE);
      expect(ramblersMemberFrom({"Mem No.": 1, "Member Term": "Quarterly"}).memberTerm).toBe(null);
      expect(ramblersMemberFrom({"Mem No.": 1, "Member Term": "ANNUAL"}).memberTerm).toBe(MemberTerm.ANNUAL);
    });

    it("falls back to Initials and Last Name when Forenames and Surname are absent", () => {
      const member: RamblersMember = ramblersMemberFrom({"Mem No.": 7, "Initials": "A", "Last Name": "Turing"});
      expect(member.firstName).toBe("A");
      expect(member.lastName).toBe("Turing");
    });

    it("keeps an auto-hyperlinked email address usable rather than an object", async () => {
      const members: RamblersMember[] = await membersFrom("member-bulk-load-cell-types.xlsx");
      expect(members[0].email).toBe("nick@example.com");
      expect(members[0].lastName).toBe("Barrett");
      expect(members[2].lastName).toBe("Turing");
      expect(members[1].type).toBe("Joint");
    });

    it("rejects a row with no membership number as an unrecognised record", () => {
      expect(membershipSecretariesInsightHubFormat({"Surname": "Barrett"})).toBe(false);
      expect(membershipSecretariesInsightHubFormat({"Mem No.": 1234567})).toBe(true);
    });
  });
});
