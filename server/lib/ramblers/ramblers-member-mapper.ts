import { trim } from "es-toolkit/compat";
import { MemberTerm, RamblersMember } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { WorkbookRow, WorkbookValue } from "./workbook-reader.model";

function trimmed(value: WorkbookValue): string {
  return trim(value as unknown as string);
}

export function membershipSecretariesInsightHubFormat(dataRow: WorkbookRow): boolean {
  return !!dataRow["Mem No."];
}

export function mapMemberTerm(value: string): MemberTerm {
  const lower = value?.toLowerCase();
  if (lower === MemberTerm.LIFE) {
    return MemberTerm.LIFE;
  }
  if (lower === MemberTerm.ANNUAL) {
    return MemberTerm.ANNUAL;
  }
  return null;
}

export function ramblersMemberFrom(dataRow: WorkbookRow): RamblersMember {
  return {
    membershipExpiryDate: trimmed(dataRow["Expiry date"]),
    membershipNumber: trimmed(dataRow["Mem No."]),
    mobileNumber: trimmed(dataRow["Mobile Telephone"]),
    email: trimmed(dataRow["Email Address"]),
    firstName: trimmed(dataRow["Forenames"] || dataRow["Initials"]),
    lastName: trimmed(dataRow["Surname"] || dataRow["Last Name"]),
    postcode: trimmed(dataRow["Postcode"]),
    jointWith: trimmed(dataRow["Joint With"]),
    title: trimmed(dataRow["Title"]),
    type: trimmed(dataRow["Type"]),
    memberStatus: trimmed(dataRow["Member Status"]),
    memberTerm: mapMemberTerm(trimmed(dataRow["Member Term"])),
    landlineTelephone: trimmed(dataRow["Landline Telephone"]),
    emailMarketingConsent: trimmed(dataRow["Email Marketing Consent"]),
    emailPermissionLastUpdated: trimmed(dataRow["Email Permission Last Updated"])
  };
}
