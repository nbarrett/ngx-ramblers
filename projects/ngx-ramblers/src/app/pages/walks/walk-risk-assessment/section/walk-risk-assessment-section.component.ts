import { Component, inject, Input, OnInit } from "@angular/core";
import kebabCase from "lodash-es/kebabCase";
import { NgxLoggerLevel } from "ngx-logger";
import { DisplayedWalk, RiskAssessmentRecord } from "../../../../models/walk.model";
import { MemberIdToFullNamePipe } from "../../../../pipes/member-id-to-full-name.pipe";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MemberLoginService } from "../../../../services/member/member-login.service";
import { WalkChangesService } from "../../../../services/walks/walk-changes.service";
import { WalkDisplayService } from "../../walk-display.service";
import { MarkdownEditorComponent } from "../../../../markdown-editor/markdown-editor.component";

@Component({
    selector: "app-walk-risk-assessment-section",
    templateUrl: "./walk-risk-assessment-section.component.html",
    styleUrls: ["../walk-risk-assessment.component.sass"],
    imports: [MarkdownEditorComponent]
})
export class WalkRiskAssessmentSectionComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkRiskAssessmentSectionComponent", NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  display = inject(WalkDisplayService);
  private dateUtilsService = inject(DateUtilsService);
  private memberIdToFullNamePipe = inject(MemberIdToFullNamePipe);
  private walkChangesService = inject(WalkChangesService);

  public riskAssessmentKey: string;
  @Input()
  public displayedWalk: DisplayedWalk;
  @Input()
  public riskAssessmentSection: string;

  confirmParameter(checked: boolean) {
    this.logger.debug("checked", this.riskAssessmentKey, "as", checked);
    const riskAssessmentRecord: RiskAssessmentRecord = this.findOrCreateRiskAssessmentRecord();
    riskAssessmentRecord.confirmed = checked;
    if (checked) {
      riskAssessmentRecord.confirmationDate = this.dateUtilsService.nowAsValue();
      riskAssessmentRecord.memberId = this.memberLoginService.loggedInMember().memberId;
    }
    this.logger.debug("confirmParameter", this.riskAssessmentKey, ":", riskAssessmentRecord);
    this.walkChangesService.notifyChange(this.displayedWalk.walk);
  }

  confirmParameterText(value: string) {
    const riskAssessmentRecord: RiskAssessmentRecord = this.findOrCreateRiskAssessmentRecord();
    riskAssessmentRecord.confirmationText = value;
    this.logger.debug("confirmParameterText", this.riskAssessmentKey, ":", riskAssessmentRecord);
    this.walkChangesService.notifyChange(this.displayedWalk.walk);
  }

  private findOrCreateRiskAssessmentRecord(): RiskAssessmentRecord {

    if (!this.displayedWalk.walk?.fields?.riskAssessment) {
      this.displayedWalk.walk.fields.riskAssessment = [];
    }

    const riskAssessmentRecord: RiskAssessmentRecord = this.displayedWalk?.walk?.fields.riskAssessment
      .find(item => item.riskAssessmentKey === this.riskAssessmentKey);

    if (!riskAssessmentRecord) {
      const newRecord: RiskAssessmentRecord = {
        memberId: this.memberLoginService.loggedInMember().memberId,
        riskAssessmentKey: this.riskAssessmentKey,
        riskAssessmentSection: this.riskAssessmentSection,
        confirmed: undefined, confirmationDate: undefined
      };
      this.displayedWalk.walk.fields.riskAssessment.push(newRecord);
      return newRecord;
    } else {
      if (!riskAssessmentRecord.riskAssessmentSection) {
        riskAssessmentRecord.riskAssessmentSection = this.riskAssessmentSection;
      }
      return riskAssessmentRecord;
    }
  }

  ngOnInit() {
    this.riskAssessmentKey = kebabCase(this.riskAssessmentSection);
    this.findOrCreateRiskAssessmentRecord();
    this.walkChangesService.notifyChange(this.displayedWalk.walk);
  }

  riskAssessmentConfirmed(): boolean {
    return this.findOrCreateRiskAssessmentRecord().confirmed;
  }

  riskAssessmentConfirmationText(): string {
    return this.findOrCreateRiskAssessmentRecord().confirmationText || "";
  }

  confirmLabel() {
    const riskAssessmentRecord: RiskAssessmentRecord = this.findOrCreateRiskAssessmentRecord();
    return riskAssessmentRecord.confirmed ? `${this.riskAssessmentSection} section confirmed by ${this.memberIdToFullNamePipe.transform(riskAssessmentRecord.memberId, this.display.members)} at ${this.dateUtilsService.displayDateAndTime(riskAssessmentRecord.confirmationDate)}` : `Please confirm you have reviewed ${this.riskAssessmentSection} section above`;
  }
}
