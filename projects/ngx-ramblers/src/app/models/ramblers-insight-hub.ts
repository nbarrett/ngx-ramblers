import { Member, RamblersMember, WriteDataRule, WriteDataType } from "./member.model";
import { DateUtilsService } from "../services/date-utils.service";

export enum InsightHubDateFormat {
  JOIN_DATE = "DD/MM/YY",
  OTHER_DATES = "DD/MM/YYYY",
}

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
    dateFormat: InsightHubDateFormat.OTHER_DATES
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
    memberDerivedValue: (member: Member, dateUtils: DateUtilsService) => !member?.membershipExpiryDate || member.membershipExpiryDate >= dateUtils.momentNowNoTime().valueOf()
  },
  {fieldName: "jointWith", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.STRING},
  {fieldName: "title", writeDataIf: WriteDataRule.NO_OLD_VALUE, type: WriteDataType.STRING},
  {fieldName: "landlineTelephone", writeDataIf: WriteDataRule.NO_OLD_VALUE, type: WriteDataType.STRING},
  {fieldName: "emailMarketingConsent", writeDataIf: WriteDataRule.CHANGED, type: WriteDataType.BOOLEAN},
  {
    fieldName: "emailPermissionLastUpdated",
    writeDataIf: WriteDataRule.CHANGED,
    type: WriteDataType.DATE,
    dateFormat: InsightHubDateFormat.OTHER_DATES
  },
];
