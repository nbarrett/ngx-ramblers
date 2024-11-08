import { Injectable } from "@angular/core";
import isEmpty from "lodash-es/isEmpty";
import omit from "lodash-es/omit";
import { NgxLoggerLevel } from "ngx-logger";
import {
  AuditField,
  BulkLoadMemberAndMatch,
  Member,
  MemberAction,
  MemberBulkLoadAudit,
  MemberUpdateAudit,
  RamblersMember,
  RamblersMemberAndContact
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
import { NumberUtilsService } from "../number-utils.service";

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
              private numberUtils: NumberUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MemberBulkLoadService, NgxLoggerLevel.ERROR);
  }

  public processResponse(mailMessagingConfig: MailMessagingConfig, systemConfig: SystemConfig, memberBulkLoadResponse: MemberBulkLoadAudit, existingMembers: Member[], notify: AlertInstance): Promise<any> {
    notify.setBusy();
    this.logger.info("processResponse:received", memberBulkLoadResponse.members.length, "ramblersMembers");
    return this.memberBulkLoadAuditService.create(memberBulkLoadResponse)
      .then((auditResponse: MemberBulkLoadAudit) => {
        const uploadSessionId = auditResponse.id;
        return this.processBulkLoadResponses(mailMessagingConfig, systemConfig, uploadSessionId, memberBulkLoadResponse.members, existingMembers, notify);
      });
  }

  public bulkLoadMemberAndMatchFor(ramblersMemberAndContact: RamblersMemberAndContact, existingMembers: Member[], systemConfig: SystemConfig): BulkLoadMemberAndMatch {
    const today = this.dateUtils.momentNowNoTime().valueOf();
    const ramblersMember = ramblersMemberAndContact.ramblersMember;
    ramblersMember.membershipExpiryDate = this.convertMembershipExpiryDate(ramblersMember);
    ramblersMember.groupMember = !ramblersMember.membershipExpiryDate || ramblersMember.membershipExpiryDate >= today;
    const contactMatchingEnabled: boolean = !!ramblersMemberAndContact?.contact;
    const bulkLoadMemberAndMatch: BulkLoadMemberAndMatch = {
      memberAction: null,
      member: null,
      memberMatchType: null,
      ramblersMember,
      contact: ramblersMemberAndContact?.contact
    };
    bulkLoadMemberAndMatch.member = existingMembers.find(member => {
      if (member?.membershipNumber === ramblersMember?.membershipNumber) {
        bulkLoadMemberAndMatch.memberMatchType = "membership number";
        bulkLoadMemberAndMatch.memberAction = MemberAction.found;
        return true;
      } else if (!isEmpty(ramblersMember.email) && !isEmpty(member.email) && ramblersMember.email === member.email && ramblersMember.lastName === member.lastName) {
        bulkLoadMemberAndMatch.memberMatchType = "email and last name";
        bulkLoadMemberAndMatch.memberAction = MemberAction.found;
        return true;
      } else if (contactMatchingEnabled && !isEmpty(ramblersMember.mobileNumber) && !isEmpty(member.mobileNumber) && this.numberUtils.asNumber(ramblersMember.mobileNumber) === this.numberUtils.asNumber(member.mobileNumber)) {
        bulkLoadMemberAndMatch.memberMatchType = "mobile number";
        bulkLoadMemberAndMatch.memberAction = MemberAction.found;
        return true;
      } else if (contactMatchingEnabled && this.memberNamingService.removeCharactersNotPartOfName(ramblersMemberAndContact.contact.name) === this.memberNamingService.removeCharactersNotPartOfName(member.displayName)) {
        bulkLoadMemberAndMatch.memberMatchType = "display name";
        bulkLoadMemberAndMatch.memberAction = MemberAction.found;
        return true;
      } else {
        return false;
      }
    });
    if (bulkLoadMemberAndMatch.member) {
      this.logger.info("matched ramblersMembers based on:", bulkLoadMemberAndMatch.memberMatchType,
        "contact:", contactMatchingEnabled,
        "ramblersMember:", ramblersMember,
        "member:", bulkLoadMemberAndMatch.member);
      this.memberDefaultsService.resetUpdateStatusForMember(bulkLoadMemberAndMatch.member, systemConfig);
    } else {
      bulkLoadMemberAndMatch.memberAction = MemberAction.created;
      const displayName = this.memberNamingService.createUniqueDisplayName(ramblersMember, existingMembers);
      bulkLoadMemberAndMatch.member = {
        firstName: null,
        lastName: null,
        groupMember: true,
        socialMember: true,
        userName: this.memberNamingService.createUniqueUserName(ramblersMember, existingMembers),
        displayName,
        contactId: displayName,
        expiredPassword: true
      };
      if (contactMatchingEnabled) {
        bulkLoadMemberAndMatch.member.firstName = this.memberNamingService.removeCharactersNotPartOfName(ramblersMember.firstName) || "Unknown";
        bulkLoadMemberAndMatch.member.lastName = this.memberNamingService.removeCharactersNotPartOfName(ramblersMember.lastName) || "Unknown";
        bulkLoadMemberAndMatch.member.mobileNumber = ramblersMember.mobileNumber;
      }
      existingMembers.push(bulkLoadMemberAndMatch.member);
      this.logger.info("new member created:", bulkLoadMemberAndMatch.member);
    }
    return bulkLoadMemberAndMatch;
  };

  private saveAndAuditMemberUpdate(promises: Promise<any>[], uploadSessionId: string, rowNumber: number, memberAction: MemberAction, changes: number, auditMessage: any, member: Member, notify: AlertInstance): Promise<Promise<any>[]> {

    const audit: MemberUpdateAudit = {
      uploadSessionId,
      updateTime: this.dateUtils.nowAsValue(),
      memberAction,
      rowNumber,
      changes,
      auditMessage
    };

    const qualifier = `for membership ${member.membershipNumber}`;

    return this.memberService.createOrUpdate(member)
      .then((savedMember: Member) => {
        audit.memberId = savedMember.id;
        notify.success({title: `Bulk member load ${qualifier} was successful`, message: auditMessage});
        this.logger.info("saveAndAuditMemberUpdate:", audit);
        promises.push(this.memberUpdateAuditService.create(audit));
        return promises;
      }).catch(response => {
        this.logger.warn("member save error for member:", member, "response:", response);
        audit.member = member;
        audit.memberAction = MemberAction.error;
        this.logger.warn("member was not saved, so saving it to audit:", audit);
        notify.warning({title: `Bulk member load ${qualifier} failed`, message: auditMessage});
        audit.auditErrorMessage = omit(response.error, "request");
        promises.push(this.memberUpdateAuditService.create(audit));
        return promises;
      });
  };

  private convertMembershipExpiryDate(ramblersMember: RamblersMember): number | string {
    const dataValue = !isEmpty(ramblersMember?.membershipExpiryDate) ? this.dateUtils.asValueNoTime(ramblersMember.membershipExpiryDate, "DD/MM/YYYY") : ramblersMember.membershipExpiryDate;
    this.logger.info("ramblersMember", ramblersMember, "membershipExpiryDate", ramblersMember.membershipExpiryDate, "->", this.dateUtils.displayDate(dataValue));
    return dataValue;
  };


  private auditValueForType(field: AuditField, source: object) {
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

  private changeAndAuditMemberField(updateAudit: {
    fieldsChanged: number;
    fieldsSkipped: number;
    auditMessages: any[]
  }, member: Member, ramblersMember: RamblersMember, auditField: AuditField) {


    const fieldName = auditField.fieldName;
    let performMemberUpdate = false;
    let auditQualifier = " not overwritten with ";
    let auditMessage: string;
    const oldValue = this.auditValueForType(auditField, member);
    const newValue = this.auditValueForType(auditField, ramblersMember);
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
      auditMessage = `${fieldName}: ${oldValue}${auditQualifier}${newValue}`;
    }
    if ((performMemberUpdate || dataDifferent) && auditMessage) {
      updateAudit.auditMessages.push(auditMessage);
    }
  };

  private createOrUpdateMember(mailMessagingConfig: MailMessagingConfig, systemConfig: SystemConfig, uploadSessionId: string, recordIndex: number, ramblersMember: RamblersMember, promises: any[], existingMembers: Member[], notify: AlertInstance): Promise<any> {
    const ramblersMemberAndContactNotUsingContactMatching: RamblersMemberAndContact = {
      ramblersMember,
      contact: null
    };
    const bulkLoadMemberAndMatch: BulkLoadMemberAndMatch = this.bulkLoadMemberAndMatchFor(ramblersMemberAndContactNotUsingContactMatching, existingMembers, systemConfig);
    const updateAudit = {auditMessages: [], fieldsChanged: 0, fieldsSkipped: 0};
    [
      {fieldName: "membershipExpiryDate", writeDataIf: "changed", type: "date"},
      {fieldName: "membershipNumber", writeDataIf: "changed", type: "string"},
      {fieldName: "mobileNumber", writeDataIf: "empty", type: "string"},
      {fieldName: "email", writeDataIf: "empty", type: "string"},
      {fieldName: "firstName", writeDataIf: "empty", type: "string"},
      {fieldName: "lastName", writeDataIf: "empty", type: "string"},
      {fieldName: "postcode", writeDataIf: "empty", type: "string"},
      {fieldName: "groupMember", writeDataIf: "not-revoked", type: "boolean"}
    ].forEach((field: AuditField) => {
      this.changeAndAuditMemberField(updateAudit, bulkLoadMemberAndMatch.member, ramblersMember, field);
      if (bulkLoadMemberAndMatch.memberAction === MemberAction.created) {
        this.memberDefaultsService.applyDefaultMailSettingsToMember(bulkLoadMemberAndMatch.member, systemConfig, mailMessagingConfig);
      }
    });
    this.logger.info("saveAndAuditMemberUpdate -> member:", bulkLoadMemberAndMatch.member, "updateAudit:", updateAudit);
    const memberAction = bulkLoadMemberAndMatch.memberAction || (updateAudit.fieldsChanged > 0 ? MemberAction.updated : MemberAction.skipped);
    return this.saveAndAuditMemberUpdate(promises, uploadSessionId, recordIndex + 1, memberAction, updateAudit.fieldsChanged, updateAudit.auditMessages.join(", "), bulkLoadMemberAndMatch.member, notify);

  };

  private async processBulkLoadResponses(mailMessagingConfig: MailMessagingConfig, systemConfig: SystemConfig, uploadSessionId: string, ramblersMembers: RamblersMember[], existingMembers: Member[], notify: AlertInstance) {
    const updatedPromises = [];
    ramblersMembers.map(ramblersMember => {
      const recordIndex = ramblersMembers.indexOf(ramblersMember);
      this.createOrUpdateMember(mailMessagingConfig, systemConfig, uploadSessionId, recordIndex, ramblersMember, updatedPromises, existingMembers, notify);
    });
    await Promise.all(updatedPromises);
    this.logger.info("performed total of", updatedPromises.length, "audit or member updates");
    return updatedPromises;
  };

}
