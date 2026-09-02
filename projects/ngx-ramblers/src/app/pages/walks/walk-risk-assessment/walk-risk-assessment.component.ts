import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DisplayedWalk } from "../../../models/walk.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { WalkChangesService } from "../../../services/walks/walk-changes.service";
import { WalkDisplayService } from "../walk-display.service";
import { RiskAssessmentService } from "../../../services/walks/risk-assessment.service";
import { ContentTextEditor } from "../../../modules/common/tiptap-editor/content-text-editor";
import { WalkRiskAssessmentSectionComponent } from "./section/walk-risk-assessment-section.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { RISK_ASSESSMENT_CONTENT_CATEGORY, RISK_ASSESSMENT_HEADING_NAME, WalkRiskAssessmentSection } from "../../../models/walks-config.model";

@Component({
    selector: "app-walk-risk-assessment",
    template: `
      <div class="img-thumbnail thumbnail-admin-edit">
        <app-content-text-editor standalone
                             [category]="RISK_ASSESSMENT_CONTENT_CATEGORY"
                             [name]="RISK_ASSESSMENT_HEADING_NAME"
                             [presentationMode]="inputDisabled"
                             [description]="'Risk Assessments Heading'"/>
        @for (section of sections; track section.key) {
          <app-walk-risk-assessment-section [displayedWalk]="displayedWalk"
                                            [riskAssessmentSection]="section.title"
                                            [riskAssessmentKey]="section.key"
                                            [inputDisabled]="inputDisabled">
          </app-walk-risk-assessment-section>
        }
        <div class="form-group">
          @if (notifyTarget.showAlert) {
            <div class="alert {{notifyTarget.alertClass}}">
              <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
              <strong> {{ notifyTarget.alertTitle }}: </strong>
              {{ notifyTarget.alertMessage }}
            </div>
          }
        </div>
      </div>
    `,
    styleUrls: ["./walk-risk-assessment.component.sass"],
    imports: [ContentTextEditor, WalkRiskAssessmentSectionComponent, FontAwesomeModule]
})
export class WalkRiskAssessmentComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkRiskAssessmentComponent", NgxLoggerLevel.ERROR);
  display = inject(WalkDisplayService);
  private riskAssessmentService = inject(RiskAssessmentService);
  private walksConfigService = inject(WalksConfigService);
  private notifierService = inject(NotifierService);
  private walkChangesService = inject(WalkChangesService);
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance;
  private subscriptions: Subscription[] = [];
  public sections: WalkRiskAssessmentSection[] = [];
  protected readonly RISK_ASSESSMENT_CONTENT_CATEGORY = RISK_ASSESSMENT_CONTENT_CATEGORY;
  protected readonly RISK_ASSESSMENT_HEADING_NAME = RISK_ASSESSMENT_HEADING_NAME;

  @Input()
  public displayedWalk: DisplayedWalk;
  public inputDisabled = false;

  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.sections = this.walksConfigService.riskAssessmentSections();
    this.subscriptions.push(this.walksConfigService.events().subscribe(() => {
      this.sections = this.walksConfigService.riskAssessmentSections();
      if (this.displayedWalk?.walk) {
        this.updateCompletionStatus(this.displayedWalk.walk);
      }
    }));
    this.subscriptions.push(this.walkChangesService.notifications().subscribe(walk => this.updateCompletionStatus(walk)));
    if (this.displayedWalk?.walk) {
      this.updateCompletionStatus(this.displayedWalk.walk);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private updateCompletionStatus(walk: ExtendedGroupEvent) {
    this.logger.debug("updateCompletionStatus:walk:", walk);
    if (walk?.fields) {
      if (this.riskAssessmentService.unconfirmedRiskAssessmentsExist(walk.fields.riskAssessment, this.sections)) {
        this.notify.warning(this.riskAssessmentService.warningMessage(walk.fields.riskAssessment, this.sections));
      } else {
        this.notify.success(this.riskAssessmentService.successMessage(walk.fields.riskAssessment, this.sections));
      }
    }
  };
}
