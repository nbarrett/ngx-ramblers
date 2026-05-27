import { inject, Injectable } from "@angular/core";
import { isEmpty } from "es-toolkit/compat";
import { omit } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import {
  BulkLoadMemberAndMatch,
  Member,
  MemberAction,
  MemberBulkLoadAudit,
  MemberMatchResult,
  MemberUpdateAudit,
  NONE,
  RamblersMember,
  RamblersMemberAndContact,
  UpdateAudit,
  WriteDataRule,
  WriteDataType
} from "../../models/member.model";
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
import { StringUtilsService } from "../string-utils.service";
import { AUDIT_FIELDS, AuditField } from "../../models/ramblers-insight-hub";
import { isString } from "es-toolkit/compat";
import { isNumber } from "es-toolkit/compat";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { MemberTerm } from "../../models/member.model";

@Injectable({
  providedIn: "root"
})
export class MemberBulkLoadService {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberBulkLoadService", NgxLoggerLevel.ERROR);
  private memberUpdateAuditService = inject(MemberUpdateAuditService);
  private memberBulkLoadAuditService = inject(MemberBulkLoadAuditService);
  private memberService = inject(MemberService);
  private memberDefaultsService = inject(MemberDefaultsService);
  private memberNamingService = inject(MemberNamingService);
  private fullNamePipe = inject(FullNamePipe);
  private dateUtils = inject(DateUtilsService);
  private stringUtils = inject(StringUtilsService);
  private numberUtils = inject(NumberUtilsService);

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
    const ramblersMember = ramblersMemberAndContact.ramblersMember;
    const bulkLoadMemberAndMatch: BulkLoadMemberAndMatch = {
      memberMatch: null,
      member: null,
      memberMatchType: null,
      ramblersMember,
      contact: ramblersMemberAndContact?.contact
    };
    const existingMatch = this.existingMemberMatchFor(ramblersMemberAndContact, existingMembers);
    if (existingMatch.member) {
      bulkLoadMemberAndMatch.member = existingMatch.member;
      bulkLoadMemberAndMatch.memberMatchType = existingMatch.memberMatchType;
      bulkLoadMemberAndMatch.memberMatch = MemberAction.found;
      this.logger.info("matched ramblersMembers based on:", bulkLoadMemberAndMatch.memberMatchType,
        "contact:", !!ramblersMemberAndContact?.contact,
        "ramblersMember:", ramblersMember,
        "member:", bulkLoadMemberAndMatch.member);
      this.memberDefaultsService.resetUpdateStatusForMember(bulkLoadMemberAndMatch.member, systemConfig);
    } else {
      bulkLoadMemberAndMatch.memberMatch = MemberAction.created;
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
      if (ramblersMemberAndContact?.contact) {
        bulkLoadMemberAndMatch.member.firstName = this.memberNamingService.removeCharactersNotPartOfName(ramblersMember.firstName) || "Unknown";
        bulkLoadMemberAndMatch.member.lastName = this.memberNamingService.removeCharactersNotPartOfName(ramblersMember.lastName) || "Unknown";
        bulkLoadMemberAndMatch.member.mobileNumber = ramblersMember.mobileNumber;
      }
      const nameAlias = this.createUniqueNameAlias(ramblersMember, existingMembers);
      if (nameAlias) {
        bulkLoadMemberAndMatch.member.nameAlias = nameAlias;
      }
      existingMembers.push(bulkLoadMemberAndMatch.member);
      this.logger.info("new member created:", bulkLoadMemberAndMatch.member);
    }
    return bulkLoadMemberAndMatch;
  };

  public existingMemberMatchFor(ramblersMemberAndContact: RamblersMemberAndContact, existingMembers: Member[]): MemberMatchResult {
    const matchedMember = existingMembers.find(member => !!this.memberMatchTypeFor(ramblersMemberAndContact, member));
    return {
      member: matchedMember,
      memberMatchType: matchedMember ? this.memberMatchTypeFor(ramblersMemberAndContact, matchedMember) : null
    };
  }

  private memberMatchTypeFor(ramblersMemberAndContact: RamblersMemberAndContact, member: Member): string {
    const ramblersMember = ramblersMemberAndContact.ramblersMember;
    const contactMatchingEnabled = !!ramblersMemberAndContact?.contact;
    const importedUserName = this.importedUserName(ramblersMember);
    if (!isEmpty(ramblersMember?.membershipNumber) && member?.membershipNumber === ramblersMember?.membershipNumber) {
      return "membership number";
    }
    if (!isEmpty(ramblersMember?.membershipNumber) && !isEmpty(member?.membershipNumber)) {
      return null;
    }
    if (!isEmpty(importedUserName) && this.sameText(importedUserName, member.userName)) {
      return "user name";
    }
    if (this.uniqueNameIndexMatches(ramblersMember, member)) {
      return "name and title";
    }
    if (!isEmpty(ramblersMember.email) && !isEmpty(member.email) && this.sameText(ramblersMember.email, member.email) && this.sameText(ramblersMember.lastName, member.lastName)) {
      return "email and last name";
    }
    if (contactMatchingEnabled && !isEmpty(ramblersMember.mobileNumber) && !isEmpty(member.mobileNumber) && this.numberUtils.asNumber(ramblersMember.mobileNumber) === this.numberUtils.asNumber(member.mobileNumber)) {
      return "mobile number";
    }
    if (contactMatchingEnabled && this.memberNamingService.removeCharactersNotPartOfName(ramblersMemberAndContact.contact.name) === this.memberNamingService.removeCharactersNotPartOfName(member.displayName)) {
      return "display name";
    }
    return null;
  }

  private importedUserName(ramblersMember: RamblersMember | Member): string {
    return (ramblersMember as Member).userName || this.memberNamingService.createUserName(ramblersMember);
  }

  private uniqueNameIndexMatches(ramblersMember: RamblersMember | Member, member: Member): boolean {
    return this.nameIndexTupleMatches(ramblersMember, member, (ramblersMember as Member).nameAlias);
  }

  private nameIndexTupleMatches(ramblersMember: RamblersMember | Member, member: Member, nameAlias: string): boolean {
    const importedFirstName = ramblersMember.firstName || ramblersMember.title;
    return !isEmpty(importedFirstName)
      && !isEmpty(ramblersMember.lastName)
      && this.sameText(importedFirstName, member.firstName)
      && this.sameText(ramblersMember.lastName, member.lastName)
      && this.sameText(ramblersMember.title, member.title)
      && this.sameText(nameAlias, member.nameAlias);
  }

  private createUniqueNameAlias(ramblersMember: RamblersMember | Member, existingMembers: Member[]): string {
    const baseAlias = ((ramblersMember as Member).nameAlias || "").trim();
    const aliasForOccurrence = (occurrence: number): string => {
      if (occurrence === 1) {
        return baseAlias;
      }
      return baseAlias ? `${baseAlias} ${occurrence}` : `${occurrence}`;
    };
    const maxOccurrences = existingMembers.length + 2;
    return Array.from({length: maxOccurrences}, (_, index) => aliasForOccurrence(index + 1))
      .find(alias => !existingMembers.some(member => this.nameIndexTupleMatches(ramblersMember, member, alias)))
      ?? aliasForOccurrence(maxOccurrences + 1);
  }

  private sameText(left: string, right: string): boolean {
    return this.normalizedText(left) === this.normalizedText(right);
  }

  private normalizedText(value: string): string {
    return value ? value.trim().toLowerCase() : "";
  }

  private saveAndAuditMemberUpdate(promises: Promise<any>[], uploadSessionId: string, rowNumber: number, memberMatch: MemberAction, memberAction: MemberAction, changes: number, auditMessage: any, member: Member, notify: AlertInstance): Promise<Promise<any>[]> {

    const audit: MemberUpdateAudit = {
      uploadSessionId,
      updateTime: this.dateUtils.nowAsValue(),
      memberMatch,
      memberAction,
      rowNumber,
      changes,
      auditMessage
    };

    const qualifier = `for membership ${member.membershipNumber}`;

    return this.memberService.createOrUpdate(member)
      .then((savedMember: Member) => {
        audit.memberId = savedMember.id;
        member.id = savedMember.id;
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

  private newDataValueForField(field: AuditField, ramblersMember: RamblersMember, member: Member): any {
    const dataValue = this.readActualOrDerivedValue(field, member, ramblersMember);
    switch (field.type) {
      case WriteDataType.DATE:
        if (isString(dataValue)) {
          return this.dateUtils.asValueNoTime(dataValue, field.dateFormat);
        } else if (isNumber(dataValue)) {
          return dataValue;
        } else {
          return null;
        }
      case WriteDataType.BOOLEAN:
        return this.stringUtils.asBoolean(dataValue);
      default:
        return dataValue;
    }
  };

  private readActualOrDerivedValue(field: AuditField, member: Member, ramblersMember: RamblersMember) {
    let dataValue: any = ramblersMember[field.fieldName];
    if (this.stringUtils.noValueFor(dataValue)) {
      if (field.memberDerivedValue) {
        dataValue = field.memberDerivedValue(member, this.dateUtils);
        this.logger.info("readActualOrDerivedValue:fieldName:", field.fieldName, "memberDerivedValue:", dataValue, "member:", member);
      } else if (field.ramblersDerivedValue) {
        dataValue = field.ramblersDerivedValue(ramblersMember, this.dateUtils);
        this.logger.info("readActualOrDerivedValue:fieldName:", field.fieldName, "memberDerivedValue:", dataValue, "ramblersMember:", ramblersMember);
      } else {
        dataValue = null;
        this.logger.info("readActualOrDerivedValue:fieldName:", field.fieldName, "no actual or derived value available:", dataValue, "member:", member, "ramblersMember:", ramblersMember);
      }
    }
    return dataValue;
  }


  private oldDataValueForField(field: AuditField, source: Member): any {
    return source[field.fieldName];
  };

  private changeAndAuditMemberField(updateAudit: UpdateAudit, member: Member, ramblersMember: RamblersMember, auditField: AuditField) {
    const fieldName: string = auditField.fieldName;
    let performMemberUpdate = false;
    let auditQualifier = " not overwritten with ";
    let auditMessage: string;
    const oldDataValue = this.oldDataValueForField(auditField, member);
    const oldFormattedValue = this.formatValue(oldDataValue, auditField);
    let newDataValue = this.newDataValueForField(auditField, ramblersMember, member);
    const shouldClearExpiry = fieldName === "membershipExpiryDate" && this.shouldClearExpiryDate(ramblersMember);
    const recentlyLoaded = fieldName === "membershipExpiryDate" && this.recentlyLoaded(member);
    if (fieldName === "membershipExpiryDate" && !newDataValue && (shouldClearExpiry || recentlyLoaded)) {
      newDataValue = null;
    }
    const newFormattedValue = this.formatValue(newDataValue, auditField);
    const dataDifferent: boolean = oldFormattedValue.toString() !== newFormattedValue.toString();
    switch (auditField.writeDataIf) {
      case WriteDataRule.CHANGED:
        performMemberUpdate = !!(dataDifferent && ramblersMember[fieldName]);
        break;
      case WriteDataRule.NO_OLD_VALUE:
        performMemberUpdate = !!(newDataValue && !member[fieldName]);
        break;
      case WriteDataRule.TRANSITION_TO_TRUE_NEW_VALUE:
        performMemberUpdate = this.stringUtils.asBoolean(newDataValue) && !this.stringUtils.asBoolean(oldDataValue);
        break;
      case WriteDataRule.NOT_REVOKED:
        performMemberUpdate = !!(newFormattedValue && dataDifferent && !member.revoked);
        break;
      default:
        performMemberUpdate = !this.stringUtils.noValueFor(newDataValue);
        break;
    }
    if (fieldName === "membershipExpiryDate" && !newDataValue && (shouldClearExpiry || recentlyLoaded)) {
      performMemberUpdate = !!member.membershipExpiryDate;
    }
    if (performMemberUpdate) {
      auditQualifier = " updated to ";
      member[fieldName] = newDataValue;
      updateAudit.fieldsChanged++;
    }
    if (dataDifferent) {
      if (!performMemberUpdate) {
        updateAudit.fieldsSkipped++;
      }
      auditMessage = `${fieldName}: ${oldFormattedValue}${auditQualifier}${newFormattedValue}`;
    }
    if ((performMemberUpdate || dataDifferent) && auditMessage) {
      updateAudit.auditMessages.push(auditMessage);
    }
    this.logger.info("changeAndAuditMemberField:",
      "membershipNumber:", member.membershipNumber,
      "name:", this.fullNamePipe.transform(member, "no name available"),
      "fieldName:", fieldName,
      "auditMessage:", auditMessage,
      "performMemberUpdate:", performMemberUpdate,
      "dataDifferent:", dataDifferent,
      "oldDataValue:", oldDataValue,
      "oldFormattedValue:", oldFormattedValue,
      "newDataValue:", newDataValue,
      "newFormattedValue:", newFormattedValue,
      "auditMessage:", auditMessage);
  };

  private createOrUpdateMember(mailMessagingConfig: MailMessagingConfig, systemConfig: SystemConfig, uploadSessionId: string, recordIndex: number, ramblersMember: RamblersMember, promises: any[], existingMembers: Member[], notify: AlertInstance): Promise<any> {
    const ramblersMemberAndContactNotUsingContactMatching: RamblersMemberAndContact = {
      ramblersMember,
      contact: null
    };
    const bulkLoadMemberAndMatch: BulkLoadMemberAndMatch = this.bulkLoadMemberAndMatchFor(ramblersMemberAndContactNotUsingContactMatching, existingMembers, systemConfig);
    const updateAudit: UpdateAudit = {auditMessages: [], fieldsChanged: 0, fieldsSkipped: 0};
    AUDIT_FIELDS.forEach((field: AuditField) => {
      this.changeAndAuditMemberField(updateAudit, bulkLoadMemberAndMatch.member, ramblersMember, field);
      if (bulkLoadMemberAndMatch.memberMatch === MemberAction.created) {
        this.memberDefaultsService.applyDefaultMailSettingsToMember(bulkLoadMemberAndMatch.member, systemConfig, mailMessagingConfig);
      }
    });
    this.logger.info("saveAndAuditMemberUpdate -> member:", bulkLoadMemberAndMatch.member, "updateAudit:", updateAudit);
    const memberMatch: MemberAction = bulkLoadMemberAndMatch.memberMatch;
    const memberAction: MemberAction = this.deriveMemberAction(updateAudit, memberMatch);
    return this.saveAndAuditMemberUpdate(promises, uploadSessionId, recordIndex + 1, memberMatch, memberAction, updateAudit.fieldsChanged, updateAudit.auditMessages.join(", "), bulkLoadMemberAndMatch.member, notify);
  };

  private deriveMemberAction(updateAudit: UpdateAudit, memberMatch: MemberAction) {
    let memberAction: MemberAction = MemberAction.skipped;
    if (memberMatch === MemberAction.created) {
      memberAction = MemberAction.created;
    } else if (updateAudit.fieldsChanged > 0) {
      memberAction = MemberAction.updated;
    } else if (updateAudit.fieldsSkipped > 0) {
      memberAction = MemberAction.skipped;
    }
    return memberAction;
  }

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

  private formatValue(value: any, auditField: AuditField) {
    if (value && auditField.type === WriteDataType.DATE) {
      return this.dateUtils.displayDate(value);
    } else {
      return this.stringUtils.noValueFor(value) ? NONE : value;
    }
  }

  private shouldClearExpiryDate(ramblersMember: RamblersMember) {
    const memberTerm = ramblersMember.memberTerm;
    const memberStatus = ramblersMember.memberStatus?.toLowerCase();
    const lifeMember = memberTerm === MemberTerm.LIFE;
    const paymentPending = memberStatus === "payment pending";
    const noExpiryProvided = this.stringUtils.noValueFor(ramblersMember.membershipExpiryDate);
    return noExpiryProvided || lifeMember || paymentPending;
  }

  private recentlyLoaded(member: Member) {
    const createdDate = member.createdDate;
    if (!createdDate) {
      return false;
    }
    const threshold = this.dateUtils.dateTimeNowNoTime().minus({months: 1}).toMillis();
    return createdDate >= threshold;
  }
}
