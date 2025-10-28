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
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { WalkRiskAssessmentSectionComponent } from "./section/walk-risk-assessment-section.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ExtendedGroupEvent } from "../../../models/group-event.model";

@Component({
    selector: "app-walk-risk-assessment",
    template: `
      <div class="img-thumbnail thumbnail-admin-edit">
        <app-markdown-editor standalone [category]="'risk-assessments'" [name]="'risk-assessments-heading'"
                             [description]="'Risk Assessments Heading'"/>
        <app-walk-risk-assessment-section [displayedWalk]="displayedWalk"
                                          [riskAssessmentSection]="'Traffic'">

        </app-walk-risk-assessment-section>
        <app-walk-risk-assessment-section [displayedWalk]="displayedWalk"
                                          [riskAssessmentSection]="'Path surface and obstacles'">

        </app-walk-risk-assessment-section>
        <app-walk-risk-assessment-section [displayedWalk]="displayedWalk"
                                          [riskAssessmentSection]="'Animals'">

        </app-walk-risk-assessment-section>
        <app-walk-risk-assessment-section [displayedWalk]="displayedWalk"
                                          [riskAssessmentSection]="'Communications'">

        </app-walk-risk-assessment-section>
        <app-walk-risk-assessment-section [displayedWalk]="displayedWalk"
                                          [riskAssessmentSection]="'Other'">
        </app-walk-risk-assessment-section>
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
    imports: [MarkdownEditorComponent, WalkRiskAssessmentSectionComponent, FontAwesomeModule]
})
export class WalkRiskAssessmentComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkRiskAssessmentComponent", NgxLoggerLevel.ERROR);
  display = inject(WalkDisplayService);
  private riskAssessmentService = inject(RiskAssessmentService);
  private notifierService = inject(NotifierService);
  private walkChangesService = inject(WalkChangesService);
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance;
  private subscriptions: Subscription[] = [];

  @Input()
  public displayedWalk: DisplayedWalk;

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.walkChangesService.notifications().subscribe(walk => this.updateCompletionStatus(walk)));
    this.updateCompletionStatus(this.displayedWalk.walk);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private updateCompletionStatus(walk: ExtendedGroupEvent) {
    this.logger.debug("updateCompletionStatus:walk:", walk);
    if (this.riskAssessmentService.unconfirmedRiskAssessmentsExist(walk.fields.riskAssessment)) {
      this.notify.warning(this.riskAssessmentService.warningMessage(walk.fields.riskAssessment));
    } else {
      this.notify.success(this.riskAssessmentService.successMessage(walk.fields.riskAssessment));
    }
  };
}
