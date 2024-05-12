import { Injectable } from "@angular/core";
import first from "lodash-es/first";
import { NgxLoggerLevel } from "ngx-logger";
import { HasFirstAndLastName, Member, RamblersMember } from "../../models/member.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { StringUtilsService } from "../string-utils.service";

@Injectable({
  providedIn: "root"
})
export class MemberNamingService {
  private logger: Logger;

  constructor(private stringUtils: StringUtilsService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MemberNamingService, NgxLoggerLevel.OFF);
  }

  createDisplayNameFromContactName(contactName: string): string {
    if (contactName) {
      const contactNames: string[] = contactName.split(" ");
      const firstName = first(contactNames);
      const lastName = contactNames.length > 1 ? contactNames[1] : "";
      return this.createDisplayName(firstName, lastName);
    } else {
      return null;
    }
  }

  createUniqueUserName(member: RamblersMember | Member, members: Member[]) {
    return this.createUniqueValueFrom(this.createUserName(member), "userName", members);
  }

  createUniqueDisplayName(member: HasFirstAndLastName, members: Member[]) {
    return this.createUniqueValueFrom(this.createDisplayNameFromMember(member), "displayName", members);
  }

  createUniqueValueFrom(value: string, field: string, members: Member[]) {
    let attempts = 0;
    while (true) {
      const createdName = value + (attempts === 0 ? "" : attempts);
      if (!this.memberFieldExists(field, createdName, members)) {
        return createdName;
      } else {
        attempts++;
      }
    }
  }

  memberFieldExists(field: string, value: string, members: Member[]) {
    const member = members.find(member => member[field] === value);
    const returnValue = member && member[field];
    this.logger.debug("field", field, "matching", value, member, "->", returnValue);
    return returnValue;
  }

  private createUserName(member: RamblersMember | Member): string {
    return member?.firstName && member?.lastName ? this.stringUtils.replaceAll(" ", "", (`${member.firstName}.${member.lastName}`).toLowerCase()) as string : "";
  }

  private createDisplayNameFromMember(member: Member): string {
    const lastName = member.lastName;
    const firstName = member.firstName;
    return this.createDisplayName(firstName, lastName);
  }

  private createDisplayName(firstName: string, lastName: string): string {
    return (`${(firstName || "").trim()} ${(lastName || "").trim().substring(0, 1).toUpperCase()}`).trim();
  }

}
