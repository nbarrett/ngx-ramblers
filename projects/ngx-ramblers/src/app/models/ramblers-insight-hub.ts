import { Member, RamblersMember, WriteDataRule, WriteDataType } from "./member.model";
import { DateUtilsService } from "../services/date-utils.service";
import { RamblersInsightHubDateFormat } from "./date-format.model";

export { RamblersInsightHubDateFormat as InsightHubDateFormat } from "./date-format.model";
type InsightHubDateFormat = RamblersInsightHubDateFormat;

export interface AuditField {
  fieldName: keyof Member;
  writeDataIf: WriteDataRule;
  type: WriteDataType;
  dateFormat?: InsightHubDateFormat;
  memberDerivedValue?: (member: Member, dateUtils?: DateUtilsService) => any;
  ramblersDerivedValue?: (member: RamblersMember, dateUtils?: DateUtilsService) => any;
}

export const NO_CHANGES_OR_DIFFERENCES = "No changes or differences found";

export const AUDIT_FIELDS: AuditField[] = [
  {
    fieldName: "membershipExpiryDate",
    writeDataIf: WriteDataRule.CHANGED,
    type: WriteDataType.DATE,
    dateFormat: RamblersInsightHubDateFormat.TWO_DIGIT_YEAR
  },
  {fieldName: "membershipNumber", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.STRING},
  {fieldName: "memberStatus", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.STRING},
  {fieldName: "memberTerm", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.STRING},
  {fieldName: "mobileNumber", writeDataIf: WriteDataRule.NO_OLD_VALUE, type: WriteDataType.STRING},
  {fieldName: "email", writeDataIf: WriteDataRule.NO_OLD_VALUE, type: WriteDataType.STRING},
  {
    fieldName: "firstName",
    writeDataIf: WriteDataRule.NO_OLD_VALUE,
    type: WriteDataType.STRING,
    ramblersDerivedValue: (member: RamblersMember) => member?.firstName || member?.title || "No First Name"
  },
  {fieldName: "lastName", writeDataIf: WriteDataRule.NO_OLD_VALUE, type: WriteDataType.STRING},
  {fieldName: "postcode", writeDataIf: WriteDataRule.NO_OLD_VALUE, type: WriteDataType.STRING},
  {
    fieldName: "groupMember",
    writeDataIf: WriteDataRule.TRANSITION_TO_TRUE_NEW_VALUE,
    type: WriteDataType.BOOLEAN,
    memberDerivedValue: (member: Member, dateUtils: DateUtilsService) => !member?.membershipExpiryDate || member.membershipExpiryDate >= dateUtils.dateTimeNowNoTime().toMillis()
  },
  {fieldName: "jointWith", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.STRING},
  {fieldName: "title", writeDataIf: WriteDataRule.NO_OLD_VALUE, type: WriteDataType.STRING},
  {fieldName: "landlineTelephone", writeDataIf: WriteDataRule.NO_OLD_VALUE, type: WriteDataType.STRING},
  {fieldName: "emailMarketingConsent", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {
    fieldName: "emailPermissionLastUpdated",
    writeDataIf: WriteDataRule.CHANGED,
    type: WriteDataType.DATE,
    dateFormat: RamblersInsightHubDateFormat.FOUR_DIGIT_YEAR
  },
  {fieldName: "salesforceTeamStatus", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.STRING},
  {
    fieldName: "salesforceTeamRelationshipFrom",
    writeDataIf: WriteDataRule.CHANGED,
    type: WriteDataType.DATE,
    dateFormat: RamblersInsightHubDateFormat.FOUR_DIGIT_YEAR
  },
  {
    fieldName: "membershipJoinDate",
    writeDataIf: WriteDataRule.CHANGED,
    type: WriteDataType.DATE,
    dateFormat: RamblersInsightHubDateFormat.FOUR_DIGIT_YEAR
  },
  {
    fieldName: "membershipEndDate",
    writeDataIf: WriteDataRule.CHANGED,
    type: WriteDataType.DATE,
    dateFormat: RamblersInsightHubDateFormat.FOUR_DIGIT_YEAR
  },
  {fieldName: "volunteerRoles", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.STRING},
  {fieldName: "wellbeingWalker", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {fieldName: "walkLeader", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {fieldName: "canEmailVolunteers", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {fieldName: "canEmailMembers", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {fieldName: "canEmailWellbeingWalkers", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {fieldName: "canViewMemberData", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {fieldName: "doNotEmail", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {fieldName: "noWalkProgram", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {fieldName: "noCampaigning", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {fieldName: "noSurveys", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {fieldName: "postConsent", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {
    fieldName: "postConsentLastUpdated",
    writeDataIf: WriteDataRule.CHANGED,
    type: WriteDataType.DATE,
    dateFormat: RamblersInsightHubDateFormat.FOUR_DIGIT_YEAR
  },
  {fieldName: "phoneConsent", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {
    fieldName: "phoneConsentLastUpdated",
    writeDataIf: WriteDataRule.CHANGED,
    type: WriteDataType.DATE,
    dateFormat: RamblersInsightHubDateFormat.FOUR_DIGIT_YEAR
  },
  {fieldName: "emailConsentWellbeingWalks", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
];
