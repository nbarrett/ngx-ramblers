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
];
