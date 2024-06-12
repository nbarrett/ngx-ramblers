import { DOCUMENT } from "@angular/common";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { faCircleInfo, faEye, faRemove } from "@fortawesome/free-solid-svg-icons";
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
import { CsvOptions } from "../../../csv-export/csv-export";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
  selector: "app-walk-export",
  template: `
    <app-page>
      <tabset class="custom-tabset">
        <tab active="true" [heading]="'Walk upload selection'">
          <app-csv-export hidden #csvComponent
                          [data]="walksDownloadFileContents()"
                          [filename]="walksDownloadFileName()"
                          [options]="options()">
          </app-csv-export>
          <div class="img-thumbnail thumbnail-admin-edit">
            <div class="form-group">
              <div *ngIf="walkExportTarget.showAlert" class="alert {{walkExportTarget.alertClass}}">
                <fa-icon [icon]="walkExportTarget.alert.icon"></fa-icon>
                <strong *ngIf="walkExportTarget.alertTitle">
                  {{ walkExportTarget.alertTitle }}: </strong> {{ walkExportTarget.alertMessage }}
              </div>
            </div>
            <div *ngIf="!display.walkPopulationWalksManager()" class="row mb-2">
              <div class="col-sm-12 form-inline">
                <input *ngIf="walksDownloadFileContents().length > 0" type="submit"
                       value="Upload {{walksDownloadFileContents().length}} walk(s) directly to Ramblers"
                       (click)="uploadToRamblers()"
                       [ngClass]="exportInProgress ? 'disabled-button-form button-form-left': 'button-form button-form-left'">
                <input *ngIf="walksDownloadFileContents().length > 0" type="submit"
                       (click)="csvComponent.generateCsv();"
                       value="Export {{walksDownloadFileContents().length}} walk(s) file as CSV format"
                       [ngClass]="exportInProgress ? 'disabled-button-form button-form-left': 'button-form button-form-left'">
                <input type="submit" value="Back to walks" (click)="navigateBackToWalks()"
                       title="Back to walks"
                       class="button-form button-form-left">
              </div>
            </div>
            <div class="row">
              <div class="col-sm-12">
                <table class="round styled-table table-striped table-hover table-sm table-pointer">
                  <thead>
                  <tr>
                    <th>Click to Export</th>
                    <th>Already Published</th>
                    <th>Walk Date</th>
                    <th>Leader</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th>Problems</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr *ngFor="let walkExport of walksForExport">
                    <td (click)="changeWalkExportSelection(walkExport)"
                        [ngClass]="walkExport.selected ? 'yes' : 'no'">
                      <div class="custom-control custom-checkbox">
                        <input [ngModel]="walkExport.selected"
                               type="checkbox" class="custom-control-input">
                        <label class="custom-control-label"></label></div>
                    </td>
                    <td>{{ walkExport.publishedOnRamblers }}</td>
                    <td class="nowrap">{{ walkExport.displayedWalk.walk.walkDate | displayDate }}</td>
                    <td class="nowrap">{{ walkExport.displayedWalk.walk.displayName }}</td>
                    <td>{{ walkExport.displayedWalk.latestEventType.description }}</td>
                    <td>{{ walkExport.displayedWalk.walk.briefDescriptionAndStartPoint }}</td>
                    <td>{{ walkExport.validationMessages.join(", ") }}</td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </tab>
        <tab [heading]="'Walk upload audit'">
          <div class="img-thumbnail thumbnail-admin-edit">
            <div class="form-group">
              <div *ngIf="auditTarget.showAlert" class="alert {{auditTarget.alertClass}}">
                <fa-icon [icon]="auditTarget.alert.icon"></fa-icon>
                <strong *ngIf="auditTarget.alertTitle">
                  {{ auditTarget.alertTitle }}: </strong> {{ auditTarget.alertMessage }}
              </div>
            </div>
            <div *ngIf="!display.walkPopulationWalksManager()" class="row">
              <div class="col-sm-12">
                <div class="button-group">
                  <form class="form-inline">
                    <div class="form-group">
                      <label for="fileName" class="inline-label">Show upload session: </label>
                      <select class="form-control input-sm"
                              id="fileName"
                              name="filename"
                              (change)="fileNameChanged()"
                              [(ngModel)]="fileName"
                              class="form-control input-sm" id="fileNames">
                        <option *ngFor="let fileName of fileNames"
                                [ngValue]="fileName"
                                [textContent]="fileName">
                        </option>
                      </select>
                    </div>
                    <div class="form-group">
                      <div class="custom-control custom-checkbox">
                        <input [(ngModel)]="showDetail"
                               name="showDetail" type="checkbox" class="custom-control-input"
                               id="show-detailed-audit-messages">
                        <label class="custom-control-label"
                               (click)="fileNameChanged()"
                               for="show-detailed-audit-messages">Show details
                        </label>
                      </div>
                    </div>
                    <div class="form-group">
                      <input type="submit" value="Back to walks" (click)="navigateBackToWalks()"
                             title="Back to walks"
                             class="button-form button-form-left">
                    </div>
                  </form>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="col col-sm-12">
                <table class="round styled-table table-striped table-hover table-sm table-pointer">
                  <thead>
                  <tr>
                    <th>Date/Time</th>
                    <th>Status</th>
                    <th>Audit Message</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr *ngFor="let audit of ramblersUploadAuditData">
                    <td class="nowrap">{{ audit.auditTime | displayDateAndTime }}</td>
                    <td *ngIf="audit.status==='complete'">
                      <fa-icon [icon]="finalStatusError ? faRemove : faCircleInfo" [ngClass]="finalStatusError ? 'red-icon':
                            'green-icon'"></fa-icon>
                    <td *ngIf="audit.status==='success'">
                      <fa-icon [icon]="faEye" class="green-icon"></fa-icon>
                    <td *ngIf="audit.status==='info'">
                      <fa-icon [icon]="faCircleInfo" class="blue-icon"></fa-icon>
                    <td *ngIf="audit.status==='error'">
                      <fa-icon [icon]="faRemove" class="red-icon"></fa-icon>
                    <td>{{ audit.message }}<span
                      *ngIf="audit.errorResponse">: {{ audit.errorResponse | valueOrDefault }}</span></td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </tab>
      </tabset>
    </app-page>`,
  styleUrls: ["./walk-export.component.sass"]
})

export class WalkExportComponent implements OnInit, OnDestroy {
  private logger: Logger;
  public ramblersUploadAuditData: RamblersUploadAudit[];
  public walksForExport: WalkExport[] = [];
  public fileName: string;
  public fileNames: string[] = [];
  public showDetail: boolean;
  private members: Member[];
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
              private displayDate: DisplayDatePipe,
              private systemConfigService: SystemConfigService,
              private walksQueryService: WalksQueryService,
              public display: WalkDisplayService,
              private dateUtils: DateUtilsService,
              private stringUtils: StringUtilsService,
              private urlService: UrlService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkExportComponent, NgxLoggerLevel.ERROR);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.ramblersUploadAuditData = [];
    this.walkExportNotifier = this.notifierService.createAlertInstance(this.walkExportTarget);
    this.auditNotifier = this.notifierService.createAlertInstance(this.auditTarget);
    this.systemConfigService.events().subscribe(item => {
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
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  public options(): CsvOptions {
    return {
      decimalSeparator: "",
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
      title: "Export status", message: `Found total of ${this.stringUtils.pluraliseWithCount(this.walksForExport.length,"walk")}, ${this.walksDownloadFileContents().length} preselected for export`
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
