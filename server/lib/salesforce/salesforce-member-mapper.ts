import { DateTime } from "luxon";
import {
  RamblersMember,
  MemberTerm
} from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { SalesforceMember } from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";

function formatIsoDateAs(value: string | undefined, format: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = DateTime.fromISO(value, { zone: "Europe/London" });
  if (!parsed.isValid) {
    return undefined;
  }
  return parsed.toFormat(format);
}

function memberTermFor(value?: string): MemberTerm | undefined {
  if (value === MemberTerm.LIFE || value === MemberTerm.ANNUAL) {
    return value;
  }
  return undefined;
}

export interface SalesforceMapperOptions {
  enableGranularConsent?: boolean;
}

function tristateBoolean(value: boolean | undefined): string | undefined {
  if (value === true) {
    return "true";
  }
  if (value === false) {
    return "false";
  }
  return undefined;
}

export function mapSalesforceMemberToRamblersMember(salesforceMember: SalesforceMember, options: SalesforceMapperOptions = {}): RamblersMember {
  const ramblersMember: RamblersMember = {
    membershipNumber: salesforceMember.membershipNumber || salesforceMember.salesforceId,
    membershipExpiryDate: formatIsoDateAs(salesforceMember.membershipExpiryDate, "dd/MM/yy"),
    email: salesforceMember.email || null,
    firstName: salesforceMember.firstName || null,
    lastName: salesforceMember.lastName || null,
    title: salesforceMember.title || null,
    type: salesforceMember.membershipType || null,
    jointWith: salesforceMember.jointWith || null,
    postcode: salesforceMember.postcode || null,
    mobileNumber: salesforceMember.mobileNumber || null,
    landlineTelephone: salesforceMember.landlineTelephone || null,
    memberStatus: salesforceMember.memberStatus || null,
    memberTerm: memberTermFor(salesforceMember.memberTerm),
    emailMarketingConsent: salesforceMember.emailMarketingConsent ? "true" : "false",
    emailPermissionLastUpdated: formatIsoDateAs(salesforceMember.emailPermissionLastUpdated, "dd/MM/yyyy"),
  } as RamblersMember;
  if (options.enableGranularConsent) {
    const groupConsent = tristateBoolean(salesforceMember.groupMarketingConsent);
    if (groupConsent !== undefined) {
      ramblersMember.groupMarketingConsent = groupConsent;
    }
    const areaConsent = tristateBoolean(salesforceMember.areaMarketingConsent);
    if (areaConsent !== undefined) {
      ramblersMember.areaMarketingConsent = areaConsent;
    }
    const otherConsent = tristateBoolean(salesforceMember.otherMarketingConsent);
    if (otherConsent !== undefined) {
      ramblersMember.otherMarketingConsent = otherConsent;
    }
  }
  return ramblersMember;
}
