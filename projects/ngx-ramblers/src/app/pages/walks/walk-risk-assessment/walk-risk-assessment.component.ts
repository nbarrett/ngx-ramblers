import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DisplayedWalk, RiskAssessmentRecord, Walk } from "../../../models/walk.model";
import { MemberIdToFullNamePipe } from "../../../pipes/member-id-to-full-name.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { WalkChangesService } from "../../../services/walks/walk-changes.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalkDisplayService } from "../walk-display.service";

@Component({
  selector: "app-walk-risk-assessment",
  templateUrl: "./walk-risk-assessment.component.html",
  styleUrls: ["./walk-risk-assessment.component.sass"]
})
export class WalkRiskAssessmentComponent implements OnInit, OnDestroy {

  @Input()
  public displayedWalk: DisplayedWalk;
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance;
  private logger: Logger;
  private subscriptions: Subscription[] = [];

  constructor(private memberLoginService: MemberLoginService,
              public display: WalkDisplayService,
              private walksReferenceService: WalksReferenceService,
              private dateUtilsService: DateUtilsService,
              private notifierService: NotifierService,
              private stringUtilsService: StringUtilsService,
              private walkChangesService: WalkChangesService,
              private memberIdToFullNamePipe: MemberIdToFullNamePipe,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkRiskAssessmentComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.walkChangesService.notifications().subscribe(walk => this.updateCompletionStatus(walk)));
    this.updateCompletionStatus(this.displayedWalk.walk);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private updateCompletionStatus(walk: Walk) {
    this.logger.debug("updateCompletionStatus:", walk);
    const unconfirmedRiskAssessments: RiskAssessmentRecord[] = walk.riskAssessment.filter(record => !record.confirmed);
    if (unconfirmedRiskAssessments.length > 0) {
      const sections = unconfirmedRiskAssessments.map(item => item.riskAssessmentSection).join(", ");
      this.notify.warning({
        title: "Risk Assessment not yet complete",
        message: `Please complete the following ${this.stringUtilsService.pluraliseWithCount(unconfirmedRiskAssessments.length, "section")}: ${sections}`
      });
    } else {
      this.notify.success({
        title: "Risk Assessment complete",
        message: `All ${this.stringUtilsService.pluraliseWithCount(walk.riskAssessment.length, "section")} have been confirmed`
      });
    }
  };
}
