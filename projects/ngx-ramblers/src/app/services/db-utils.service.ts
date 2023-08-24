import { Injectable } from "@angular/core";
import has from "lodash-es/has";
import isEmpty from "lodash-es/isEmpty";
import { NgxLoggerLevel } from "ngx-logger";
import { Auditable } from "../models/member.model";
import { DateUtilsService } from "./date-utils.service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { MemberLoginService } from "./member/member-login.service";

const AUDIT_CONFIG = {auditSave: true};

@Injectable({
  providedIn: "root"
})
export class DbUtilsService {
  private logger: Logger;

  constructor(private memberLoginService: MemberLoginService,
              private dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(DbUtilsService, NgxLoggerLevel.OFF);
  }

  performAudit<T extends Auditable>(document: T): T {
    if (AUDIT_CONFIG.auditSave) {
      if (has(document, "$id") || document.id) {
        document.updatedDate = this.dateUtils.nowAsValue();
        document.updatedBy = this.memberLoginService.loggedInMember().memberId;
        this.logger.debug("Auditing save of existing document", document);
      } else {
        document.createdDate = this.dateUtils.nowAsValue();
        document.createdBy = this.memberLoginService.loggedInMember().memberId;
        this.logger.debug("Auditing save of new document", document);
      }
    } else {
      document = this.dateUtils.convertDateFieldInObject(document, "createdDate");
      this.logger.debug("Not auditing save of", document);
    }
    return document;
  }

  duplicateErrorFields(mongoErrorMessage: string) {
    const regex = new RegExp("\{(.*)\}", "g").exec(mongoErrorMessage);
    return regex ? regex[1].split(":").map(item => item.replace(",", "").trim())
      .filter(item => !isEmpty(item)).join(", ") : "";
  }
}
