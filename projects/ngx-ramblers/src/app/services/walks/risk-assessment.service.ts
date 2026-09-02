import { inject, Injectable } from "@angular/core";
import { RiskAssessmentRecord } from "../../models/walk.model";
import { AlertMessage } from "../../models/alert-target.model";
import { StringUtilsService } from "../string-utils.service";
import { LoggerFactory } from "../logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DEFAULT_WALK_RISK_ASSESSMENT_SECTIONS, WalkRiskAssessmentSection } from "../../models/walks-config.model";
import { isArray } from "es-toolkit/compat";

@Injectable({
  providedIn: "root"
})
export class RiskAssessmentService {

  private stringUtilsService: StringUtilsService = inject(StringUtilsService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger(RiskAssessmentService, NgxLoggerLevel.OFF);

  public configuredSections(sections: WalkRiskAssessmentSection[]): WalkRiskAssessmentSection[] {
    if (isArray(sections)) {
      return sections;
    } else {
      return DEFAULT_WALK_RISK_ASSESSMENT_SECTIONS;
    }
  }

  public unconfirmedSections(riskAssessment: RiskAssessmentRecord[], sections?: WalkRiskAssessmentSection[]): WalkRiskAssessmentSection[] {
    const configured = this.configuredSections(sections);
    return configured.filter(section => {
      const record = (riskAssessment || []).find(item => item.riskAssessmentKey === section.key);
      return !record?.confirmed;
    });
  }

  public unconfirmedRiskAssessments(riskAssessment: RiskAssessmentRecord[], sections?: WalkRiskAssessmentSection[]): RiskAssessmentRecord[] {
    return this.unconfirmedSections(riskAssessment, sections).map(section => {
      const record = (riskAssessment || []).find(item => item.riskAssessmentKey === section.key);
      return record || {
        memberId: null,
        confirmed: false,
        confirmationDate: null,
        riskAssessmentSection: section.title,
        riskAssessmentKey: section.key
      };
    });
  }

  public unconfirmedRiskAssessmentsExist(riskAssessment: RiskAssessmentRecord[], sections?: WalkRiskAssessmentSection[]): boolean {
    return this.unconfirmedSections(riskAssessment, sections).length > 0;
  }

  public warningMessage(riskAssessment: RiskAssessmentRecord[], sections?: WalkRiskAssessmentSection[]): AlertMessage {
    const unconfirmed = this.unconfirmedSections(riskAssessment, sections);
    this.logger.off("unconfirmedSections:", unconfirmed);
    return {
      title: "Risk Assessment not yet complete",
      message: `Please complete the following ${this.stringUtilsService.pluraliseWithCount(unconfirmed.length, "section")}: ${unconfirmed.map(section => section.title).join(", ")}`
    };
  }

  public successMessage(riskAssessment: RiskAssessmentRecord[], sections?: WalkRiskAssessmentSection[]): AlertMessage {
    const configured = this.configuredSections(sections);
    return {
      title: "Risk Assessment complete",
      message: `All ${this.stringUtilsService.pluraliseWithCount(configured.length, "section")} have been confirmed`
    };
  }

}
