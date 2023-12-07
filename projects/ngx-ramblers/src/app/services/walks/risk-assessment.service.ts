import { inject, Injectable } from "@angular/core";
import { RiskAssessmentRecord } from "../../models/walk.model";
import { AlertMessage } from "../../models/alert-target.model";
import { StringUtilsService } from "../string-utils.service";

@Injectable({
  providedIn: "root"
})
export class RiskAssessmentService {

  private stringUtilsService: StringUtilsService = inject(StringUtilsService);

  public unconfirmedRiskAssessments(riskAssessment: RiskAssessmentRecord[]): RiskAssessmentRecord[] {
    return riskAssessment.filter(record => !record.confirmed);
  };

  public unconfirmedRiskAssessmentsExist(riskAssessment: RiskAssessmentRecord[]): boolean {
    return this.unconfirmedRiskAssessments(riskAssessment).length > 0;
  };

  public unconfirmedSections(riskAssessment: RiskAssessmentRecord[]) {
    return this.unconfirmedRiskAssessments(riskAssessment).map(item => item.riskAssessmentSection).join(", ");
  };


  public warningMessage(riskAssessment: RiskAssessmentRecord[]): AlertMessage {
    const unconfirmedRiskAssessments = this.unconfirmedRiskAssessments(riskAssessment);
    const sections = this.unconfirmedSections(riskAssessment);
    return {
      title: "Risk Assessment not yet complete",
      message: `Please complete the following ${this.stringUtilsService.pluraliseWithCount(unconfirmedRiskAssessments.length, "section")}: ${sections}`
    };
  }


  public successMessage(riskAssessment: RiskAssessmentRecord[]): AlertMessage {
    return {
      title: "Risk Assessment complete",
      message: `All ${this.stringUtilsService.pluraliseWithCount(riskAssessment.length, "section")} have been confirmed`
    };
  }

}
