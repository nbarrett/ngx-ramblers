import { Injectable } from "@angular/core";
import first from "lodash-es/first";
import { NgxLoggerLevel } from "ngx-logger";
import { FirstAndLastName, HasEmailFirstAndLastName, Member, RamblersMember } from "../../models/member.model";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class MemberNamingService {
  private logger: Logger;

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MemberNamingService, NgxLoggerLevel.OFF);
  }

  createDisplayNameFromContactName(contactName: string): string {
    if (contactName) {
      const {firstName, lastName} = this.firstAndLastNameFrom(contactName);
      return this.createDisplayName(firstName, lastName);
    } else {
      return null;
    }
  }

  public firstAndLastNameFrom(contactName: string): FirstAndLastName {
    if (contactName) {
      const contactNames: string[] = contactName?.split(" ");
      const firstName = first(contactNames);
      const lastName = contactNames.length > 1 ? contactNames.slice(1).join(" ") : "";
      return {firstName, lastName};
    } else {
      return null;
    }
  }

  createUniqueUserName(member: RamblersMember | Member, members: Member[]) {
    return this.createUniqueValueFrom(this.createUserName(member), "userName", members);
  }

  createUniqueDisplayName(member: HasEmailFirstAndLastName, members: Member[]) {
    return this.createUniqueValueFrom(this.createDisplayNameFromMember(member), "displayName", members);
  }

  public createUniqueValueFrom(value: string, field: string, members: Member[]) {
    let attempts = 0;
    while (true) {
      const createdName = `${value}${attempts === 0 ? "" : attempts}`;
      if (!this.memberFieldExists(field, createdName, members)) {
        return createdName;
      } else {
        attempts++;
      }
    }
  }

  public createUserName(member: RamblersMember | Member): string {
    const firstName = this.removeCharactersNotPartOfName(this.removeSpacesAndLower(member?.firstName || member.title));
    const lastName = this.removeCharactersNotPartOfName(this.removeSpacesAndLower(member?.lastName));
    if (firstName && lastName) {
      return `${firstName}.${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    } else {
      return "";
    }
  }

  public removeSpacesAndLower(value: string): string {
    return value ? value.replace(/[ ]/, "").trim().toLowerCase() : "";
  }

  public removeCharactersNotPartOfName(value: string): string {
    return value ? value.replace(/\s+$/, "").replace(/\.$/, "").trim() : "";
  }

  public createDisplayNameFromMember(member: Member): string {
    const lastName = member.lastName;
    const firstName = member.firstName;
    return this.createDisplayName(firstName, lastName);
  }

  private createDisplayName(firstName: string, lastName: string): string {
    return (`${(firstName || "").trim()} ${(lastName || "").trim().substring(0, 1).toUpperCase()}`).trim();
  }

  private memberFieldExists(field: string, value: string, members: Member[]) {
    const member = members.find(member => member[field] === value);
    const returnValue = member && member[field];
    this.logger.debug("field", field, "matching", value, member, "->", returnValue);
    return returnValue;
  }

}
