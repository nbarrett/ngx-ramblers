import { DOCUMENT } from "@angular/common";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { faCircleInfo, faEye, faRemove } from "@fortawesome/free-solid-svg-icons";
import { Options } from "angular2-csv";
import find from "lodash-es/find";
import map from "lodash-es/map";
import { NgxLoggerLevel } from "ngx-logger";
import { interval, Observable, Subscription } from "rxjs";
import { switchMap } from "rxjs/operators";
import { chain } from "../../../functions/chain";
import { AlertTarget } from "../../../models/alert-target.model";
import { Member } from "../../../models/member.model";
import { RamblersUploadAudit, RamblersUploadAuditApiResponse } from "../../../models/ramblers-upload-audit.model";
import { WalkUploadRow } from "../../../models/ramblers-walks-manager";
import { Walk, WalkExport } from "../../../models/walk.model";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { RamblersUploadAuditService } from "../../../services/walks/ramblers-upload-audit.service";
import { RamblersWalksAndEventsService } from "../../../services/walks/ramblers-walks-and-events.service";
import { WalksQueryService } from "../../../services/walks/walks-query.service";
import { WalksService } from "../../../services/walks/walks.service";
import { WalkDisplayService } from "../walk-display.service";

@Component({
  selector: "app-walk-export",
  templateUrl: "./walk-export.component.html",
  styleUrls: ["./walk-export.component.sass"]
})

export class WalkExportComponent implements OnInit, OnDestroy {
  private logger: Logger;
  public ramblersUploadAuditData: RamblersUploadAudit[];
  public walksForExport: WalkExport[] = [];
  public fileName: string;
  public fileNames: string[] = [];
  public showDetail: boolean;
  private walkExportTab0Active: boolean;
  private members: Member[];
  private walkExportTab1Active: boolean;
  public walkExportTarget: AlertTarget = {};
  private walkExportNotifier: AlertInstance;
  public auditTarget: AlertTarget = {};
  private auditNotifier: AlertInstance;
  private intervalJob: Observable<any>;
  private subscription: Subscription;
  public finalStatusError: any;
  public exportInProgress = false;
  faEye = faEye;
  faRemove = faRemove;
  faCircleInfo = faCircleInfo;

  constructor(@Inject(DOCUMENT) private document: Document,
              private ramblersWalksAndEventsService: RamblersWalksAndEventsService,
              private walksService: WalksService,
              private ramblersUploadAuditService: RamblersUploadAuditService,
              private notifierService: NotifierService,
              private displayDateAndTime: DisplayDateAndTimePipe,
              private displayDate: DisplayDatePipe,
              private walksQueryService: WalksQueryService,
              public display: WalkDisplayService,
              private dateUtils: DateUtilsService,
              private urlService: UrlService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkExportComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.ramblersUploadAuditData = [];
    this.walkExportNotifier = this.notifierService.createAlertInstance(this.walkExportTarget);
    this.auditNotifier = this.notifierService.createAlertInstance(this.auditTarget);
    if (this.display.walkPopulationWalksManager()) {
      const message = {
        title: "Walks Export Initialisation",
        message: "Walks cannot be exported from this view when the walk population is set to " + this.display?.group?.walkPopulation
      };
      this.walkExportNotifier.warning(message);
      this.auditNotifier.warning(message);
    } else {
      this.showAvailableWalkExports();
      this.showAllAudits();
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  public options(): Options {
    return {
      decimalseparator: "",
      filename: "",
      showLabels: false,
      title: "",
      fieldSeparator: ",",
      quoteStrings: "\"",
      headers: this.headers(),
      keys: this.headers(),
      showTitle: false,
      useBom: false,
      removeNewLines: true
    };

  }

  private stopPolling() {
    if (this.subscription) {
      this.logger.debug("unsubscribing", this.subscription);
      this.subscription.unsubscribe();
    }
  }

  fileNameChanged() {
    this.logger.debug("filename changed to", this.fileName);
    this.refreshRamblersUploadAudit().then(() => this.walkExportNotifier.clearBusy());
  }

  startRamblersUploadAudit() {
    this.intervalJob = interval(5000).pipe(
      switchMap(() => this.refreshRamblersUploadAudit())
    );
    this.subscription = this.intervalJob.subscribe();
  }

  refreshRamblersUploadAudit() {
    this.walkExportNotifier.setBusy();
    return this.ramblersUploadAuditService.all({criteria: {fileName: this.fileName}, sort: {auditTime: -1}})
      .then((auditItems: RamblersUploadAuditApiResponse) => {
        this.ramblersUploadAuditData = auditItems.response
          .filter(auditItem => {
            return this.showDetail || ["complete", "error", "success"].includes(auditItem.status);
          })
          .map(auditItem => {
            if (auditItem.status === "complete" && this.subscription) {
              this.logger.debug("Upload complete");
              this.auditNotifier.success("Ramblers upload completed");
              this.exportInProgress = false;
              this.stopPolling();
              this.showAvailableWalkExports();
            }
            return auditItem;
          });
        this.auditNotifier.warning(`Showing ${this.ramblersUploadAuditData.length} audit items`);
        this.finalStatusError = find(this.ramblersUploadAuditData, {status: "error"});
      });
  }

  exportableWalks(): WalkExport[] {
    return this.ramblersWalksAndEventsService.selectedExportableWalks(this.walksForExport);
  }

  navigateBackToWalks() {
    this.urlService.navigateTo(["walks"]);
  }

  populateWalkExport(walksForExport: WalkExport[]) {
    this.logger.debug("populateWalkExport: found", walksForExport.length, "walks:", walksForExport);
    this.walksForExport = walksForExport;
    this.walkExportNotifier.success({
      title: "Export status", message: `Found total of ${this.walksForExport.length} walk(s), ${this.walksDownloadFileContents().length} preselected for export`
    });
    this.walkExportNotifier.clearBusy();
  }

  walksDownloadFileContents(): WalkUploadRow[] {
    const walkUploadRows = this.ramblersWalksAndEventsService.walkUploadRows(this.exportableWalks());
    this.logger.info("walksDownloadFileContents:", walkUploadRows);
    return walkUploadRows;
  }

  private headers(): string[] {
    const headers = map(this.walksDownloadFileContents()[0], (column, row) => row);
    this.logger.debug("headers:", headers);
    return headers;
  }

  showAllAudits() {
    this.walkExportNotifier.warning("Refreshing past download sessions", false, true);
    this.ramblersUploadAuditService.all({limit: 1000, sort: {auditTime: -1}})
      .then((auditItems: RamblersUploadAuditApiResponse) => {
        this.logger.debug("found total of", auditItems.response.length, "audit trail records:", auditItems.response);
        this.fileNames = chain(auditItems.response).map("fileName").unique().value();
        this.logger.debug("found total of", this.fileNames.length, "fileNames:", this.fileNames);
        this.fileName = this.fileNames[0];
        this.fileNameChanged();
        this.logger.debug("Total of", this.fileNames.length, "download sessions");
      });
  }

  showAvailableWalkExports() {
    this.walksForExport = [];
    this.walkExportNotifier.warning("Refreshing export status of future walks", false, true);
    this.walksService.all({criteria: {walkDate: {$gte: this.dateUtils.momentNowNoTime().valueOf()}}, sort: {walkDate: -1}})
      .then((walks: Walk[]) => this.walksQueryService.activeWalks(walks))
      .then((walks: Walk[]) => {
        this.ramblersWalksAndEventsService.createWalksForExportPrompt(walks)
          .then((walksForExport: WalkExport[]) => this.populateWalkExport(walksForExport))
          .catch(error => {
            this.logger.error("error->", error);
            this.walkExportNotifier.error({
              title: "Problem with Ramblers export preparation",
              continue: true,
              message: error
            });
          });
      });
  }

  changeWalkExportSelection(walkExport: WalkExport) {
    if (walkExport.validationMessages.length === 0) {
      walkExport.selected = !walkExport.selected;
      this.logWalkSelected(walkExport);
      this.walkExportNotifier.hide();
    } else {
      this.walkExportNotifier.error({
        title: `You can't export the walk for ${this.displayDate.transform(walkExport.displayedWalk.walk.walkDate)}`,
        message: walkExport.validationMessages.join(", ")
      });
    }
  }

  uploadToRamblers() {
    this.logger.debug("Refreshing audit trail for file", this.fileName, "count =", this.ramblersUploadAuditData.length);
    this.startRamblersUploadAudit();
    this.ramblersUploadAuditData = [];
    this.walkExportTab0Active = false;
    this.walkExportTab1Active = true;
    this.exportInProgress = true;
    this.ramblersWalksAndEventsService.uploadToRamblers(this.walksForExport, this.members, this.walkExportNotifier).then(fileName => {
      this.fileName = fileName;
      if (!this.fileNames.includes(this.fileName)) {
        this.fileNames.push(this.fileName);
        this.logger.debug("added", this.fileName, "to filenames of", this.fileNames.length, "audit trail records");
      }
      delete this.finalStatusError;
    });
  }

  walksDownloadFileName() {
    return this.ramblersWalksAndEventsService.exportWalksFileName(true);
  }

  logWalkSelected(walk: WalkExport) {
    this.logger.info("logWalkSelected:walkExport:", walk, "walkDeletionList:", this.ramblersWalksAndEventsService.walkDeletionList(this.walksForExport),);
  }
}
