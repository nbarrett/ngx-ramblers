import {
  RamblersMember,
  MemberTerm
} from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { SalesforceMember } from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";
import { RamblersInsightHubDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { dateTimeFromIso } from "../shared/dates";

function formatIsoDateAs(value: string | undefined, format: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = dateTimeFromIso(value);
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
    salesforceId: salesforceMember.salesforceId || null,
    membershipNumber: salesforceMember.membershipNumber || null,
    membershipExpiryDate: formatIsoDateAs(salesforceMember.membershipExpiryDate, RamblersInsightHubDateFormat.TWO_DIGIT_YEAR),
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
    emailPermissionLastUpdated: formatIsoDateAs(salesforceMember.emailPermissionLastUpdated, RamblersInsightHubDateFormat.FOUR_DIGIT_YEAR),
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
