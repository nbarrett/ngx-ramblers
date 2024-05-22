import { Injectable } from "@angular/core";
import each from "lodash-es/each";
import isEmpty from "lodash-es/isEmpty";
import omit from "lodash-es/omit";
import { NgxLoggerLevel } from "ngx-logger";
import {
  AuditField,
  Member,
  MemberAction,
  MemberBulkLoadAudit,
  MemberBulkLoadAuditApiResponse,
  MemberUpdateAudit,
  RamblersMember
} from "../../models/member.model";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { AlertInstance } from "../notifier.service";
import { MemberBulkLoadAuditService } from "./member-bulk-load-audit.service";
import { MemberNamingService } from "./member-naming.service";
import { MemberUpdateAuditService } from "./member-update-audit.service";
import { MemberService } from "./member.service";
import { SystemConfig } from "../../models/system.model";
import { MailMessagingConfig } from "../../models/mail.model";
import { MemberDefaultsService } from "./member-defaults.service";

@Injectable({
  providedIn: "root"
})
export class MemberBulkLoadService {
  private logger: Logger;

  constructor(private memberUpdateAuditService: MemberUpdateAuditService,
              private memberBulkLoadAuditService: MemberBulkLoadAuditService,
              private memberService: MemberService,
              private memberDefaultsService: MemberDefaultsService,
              private displayDate: DisplayDatePipe,
              private memberNamingService: MemberNamingService,
              private dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MemberBulkLoadService, NgxLoggerLevel.OFF);
  }

  processResponse(mailMessagingConfig: MailMessagingConfig, systemConfig: SystemConfig, apiResponse: MemberBulkLoadAuditApiResponse, existingMembers: Member[], notify: AlertInstance): Promise<any> {
    notify.setBusy();
    const today = this.dateUtils.momentNowNoTime().valueOf();
    const memberBulkLoadResponse = apiResponse.response as MemberBulkLoadAudit;
    this.logger.info("processResponse:received", memberBulkLoadResponse);

    const processBulkLoadResponses = async (uploadSessionId: string) => {
      const updatedPromises = [];
      each(memberBulkLoadResponse.members, (ramblersMember, recordIndex) => {
        createOrUpdateMember(uploadSessionId, recordIndex, ramblersMember, updatedPromises);
      });
      await Promise.all(updatedPromises);
      this.logger.info("performed total of", updatedPromises.length, "audit or member updates");
      return updatedPromises;
    };

    const saveAndAuditMemberUpdate = (promises: Promise<any>[], uploadSessionId: string, rowNumber: number, memberAction: MemberAction, changes: number, auditMessage: any, member: Member) => {

      const audit: MemberUpdateAudit = {
        uploadSessionId,
        updateTime: this.dateUtils.nowAsValue(),
        memberAction,
        rowNumber,
        changes,
        auditMessage
      };

      const qualifier = "for membership " + member.membershipNumber;
      return this.memberService.createOrUpdate(member)
        .then(savedMember => {
          audit.memberId = savedMember.id;
          notify.success({title: "Bulk member load " + qualifier + " was successful", message: auditMessage});
          this.logger.info("saveAndAuditMemberUpdate:", audit);
          promises.push(this.memberUpdateAuditService.create(audit));
          return promises;
        }).catch(response => {
          this.logger.warn("member save error for member:", member, "response:", response);
          audit.member = member;
          audit.memberAction = MemberAction.error;
          this.logger.warn("member was not saved, so saving it to audit:", audit);
          notify.warning({title: "Bulk member load " + qualifier + " failed", message: auditMessage});
          audit.auditErrorMessage = omit(response.error, "request");
          promises.push(this.memberUpdateAuditService.create(audit));
          return promises;
        });
    };

    const convertMembershipExpiryDate = (ramblersMember: RamblersMember): number | string => {
      const dataValue = !isEmpty(ramblersMember?.membershipExpiryDate) ? this.dateUtils.asValueNoTime(ramblersMember.membershipExpiryDate, "DD/MM/YYYY") : ramblersMember.membershipExpiryDate;
      this.logger.info("ramblersMember", ramblersMember, "membershipExpiryDate", ramblersMember.membershipExpiryDate, "->", this.dateUtils.displayDate(dataValue));
      return dataValue;
    };

    const createOrUpdateMember = (uploadSessionId: string, recordIndex: number, ramblersMember: RamblersMember, promises: any[]) => {
      let memberAction: MemberAction;
      let memberMatchType: string;
      ramblersMember.membershipExpiryDate = convertMembershipExpiryDate(ramblersMember);
      ramblersMember.groupMember = !ramblersMember.membershipExpiryDate || ramblersMember.membershipExpiryDate >= today;
      let member: Member = existingMembers.find(member => {
        const membershipNumberMatch = member?.membershipNumber === ramblersMember?.membershipNumber;
        if (membershipNumberMatch) {
          memberMatchType = "membership number";
          return true;
        } else if (!isEmpty(ramblersMember.email) && !isEmpty(member.email) && ramblersMember.email === member.email && ramblersMember.lastName === member.lastName) {
          memberMatchType = "email and last name";
          return true;
        } else {
          return false;
        }
      });
      if (member) {
        this.logger.info("matched members based on:", memberMatchType,
          "ramblersMember:", ramblersMember,
          "member:", member);
        this.memberDefaultsService.resetUpdateStatusForMember(member, systemConfig);
      } else {
        memberAction = MemberAction.created;
        member = {
          firstName: null,
          lastName: null,
          groupMember: true,
          socialMember: true,
          userName: this.memberNamingService.createUniqueUserName(ramblersMember, existingMembers),
          displayName: this.memberNamingService.createUniqueDisplayName(ramblersMember, existingMembers),
          expiredPassword: true
        };
        this.logger.info("new member created:", member);
      }

      const updateAudit = {auditMessages: [], fieldsChanged: 0, fieldsSkipped: 0};
      each([
        {fieldName: "membershipExpiryDate", writeDataIf: "changed", type: "date"},
        {fieldName: "membershipNumber", writeDataIf: "changed", type: "string"},
        {fieldName: "mobileNumber", writeDataIf: "empty", type: "string"},
        {fieldName: "email", writeDataIf: "empty", type: "string"},
        {fieldName: "firstName", writeDataIf: "empty", type: "string"},
        {fieldName: "lastName", writeDataIf: "empty", type: "string"},
        {fieldName: "postcode", writeDataIf: "empty", type: "string"},
        {fieldName: "groupMember", writeDataIf: "not-revoked", type: "boolean"}], field => {
        changeAndAuditMemberField(updateAudit, member, ramblersMember, field);
        this.memberDefaultsService.applyDefaultMailSettingsToMember(member, systemConfig, mailMessagingConfig);
      });

      this.logger.info("saveAndAuditMemberUpdate -> member:", member, "updateAudit:", updateAudit);
      return saveAndAuditMemberUpdate(promises, uploadSessionId, recordIndex + 1, memberAction || (updateAudit.fieldsChanged > 0 ? MemberAction.updated : MemberAction.skipped), updateAudit.fieldsChanged, updateAudit.auditMessages.join(", "), member);

    };

    const changeAndAuditMemberField = (updateAudit: {
      fieldsChanged: number; fieldsSkipped: number;
      auditMessages: any[]
    }, member: Member, ramblersMember: RamblersMember, auditField: AuditField) => {

      const auditValueForType = (field, source) => {
        const dataValue = source[field.fieldName];
        switch (field.type) {
          case "date":
            return this.displayDate.transform(dataValue || "(none)");
          case "boolean":
            return dataValue || false;
          default:
            return dataValue || "(none)";
        }
      };

      const fieldName = auditField.fieldName;
      let performMemberUpdate = false;
      let auditQualifier = " not overwritten with ";
      let auditMessage: string;
      const oldValue = auditValueForType(auditField, member);
      const newValue = auditValueForType(auditField, ramblersMember);
      const dataDifferent: boolean = oldValue.toString() !== newValue.toString();
      if (auditField.writeDataIf === "changed") {
        performMemberUpdate = dataDifferent && ramblersMember[fieldName];
      } else if (auditField.writeDataIf === "empty") {
        performMemberUpdate = !member[fieldName];
      } else if (auditField.writeDataIf === "not-revoked") {
        performMemberUpdate = newValue && dataDifferent && !member.revoked;
      } else if (auditField.writeDataIf) {
        performMemberUpdate = !!newValue;
      }
      if (performMemberUpdate) {
        auditQualifier = " updated to ";
        member[fieldName] = ramblersMember[fieldName];
        updateAudit.fieldsChanged++;
      }
      if (dataDifferent) {
        if (!performMemberUpdate) {
          updateAudit.fieldsSkipped++;
        }
        auditMessage = fieldName + ": " + oldValue + auditQualifier + newValue;
      }
      if ((performMemberUpdate || dataDifferent) && auditMessage) {
        updateAudit.auditMessages.push(auditMessage);
      }
    };

    return this.memberBulkLoadAuditService.create(memberBulkLoadResponse)
      .then((auditResponse: MemberBulkLoadAudit) => {
        const uploadSessionId = auditResponse.id;
        return processBulkLoadResponses(uploadSessionId);
      });

  }

}
