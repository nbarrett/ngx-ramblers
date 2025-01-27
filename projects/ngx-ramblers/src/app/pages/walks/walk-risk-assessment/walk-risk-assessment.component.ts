import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DisplayedWalk, Walk } from "../../../models/walk.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { WalkChangesService } from "../../../services/walks/walk-changes.service";
import { WalkDisplayService } from "../walk-display.service";
import { RiskAssessmentService } from "../../../services/walks/risk-assessment.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { WalkRiskAssessmentSectionComponent } from "./section/walk-risk-assessment-section.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-walk-risk-assessment",
    templateUrl: "./walk-risk-assessment.component.html",
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

  private updateCompletionStatus(walk: Walk) {
    this.logger.debug("updateCompletionStatus:walk:", walk);
    if (this.riskAssessmentService.unconfirmedRiskAssessmentsExist(walk.riskAssessment)) {
      this.notify.warning(this.riskAssessmentService.warningMessage(walk.riskAssessment));
    } else {
      this.notify.success(this.riskAssessmentService.successMessage(walk.riskAssessment));
    }
  };
}
