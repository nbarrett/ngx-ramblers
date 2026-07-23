import {
  RamblersMember,
} from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { RamblersInsightHubDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { dateTimeFromIso } from "../shared/dates";
import { SalesforceMember } from "./salesforce.model";

function formatIsoDateAs(value: string | null, format: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = dateTimeFromIso(value);
  return parsed.isValid ? parsed.toFormat(format) : undefined;
}

export function mapSalesforceMemberToRamblersMember(supporter: SalesforceMember): RamblersMember {
  return {
    salesforceId: supporter.contactId || null,
    salesforceMemberRef: supporter.memberRef || null,
    membershipNumber: supporter.membershipNo || null,
    membershipExpiryDate: formatIsoDateAs(supporter.membershipExpiry, RamblersInsightHubDateFormat.TWO_DIGIT_YEAR),
    email: supporter.email || null,
    firstName: supporter.firstName || supporter.friendlyName || null,
    lastName: supporter.lastName || null,
    title: supporter.title || null,
    type: supporter.memberType || null,
    mobileNumber: supporter.mobile || null,
    landlineTelephone: supporter.landline || null,
    memberStatus: supporter.membershipStatus || null,
    emailMarketingConsent: supporter.emailConsent && !supporter.doNotEmail ? "true" : "false",
    emailPermissionLastUpdated: formatIsoDateAs(supporter.emailConsentLastUpdated, RamblersInsightHubDateFormat.FOUR_DIGIT_YEAR),
    salesforceTeamStatus: supporter.teamStatus,
    salesforceTeamRelationshipFrom: formatIsoDateAs(supporter.teamRelationshipFrom, RamblersInsightHubDateFormat.FOUR_DIGIT_YEAR),
    wellbeingWalker: supporter.wellbeingWalker,
    walkLeader: supporter.walkLeader,
    canEmailVolunteers: supporter.canEmailVolunteers,
    canEmailMembers: supporter.canEmailMembers,
    canEmailWellbeingWalkers: supporter.canEmailWellbeingWalkers,
    canViewMemberData: supporter.canViewMemberData,
    doNotEmail: supporter.doNotEmail,
    noWalkProgram: supporter.noWalkProgram,
    noCampaigning: supporter.noCampaigning,
    noSurveys: supporter.noSurveys,
    postConsent: supporter.postConsent,
    phoneConsent: supporter.phoneConsent,
    emailConsentWellbeingWalks: supporter.emailConsentWellbeingWalks,
  } as RamblersMember;
}
