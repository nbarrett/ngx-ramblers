import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faCheckCircle, faCircleInfo, faEnvelope, faExclamationCircle, faEye, faRemove } from "@fortawesome/free-solid-svg-icons";
import find from "lodash-es/find";
import map from "lodash-es/map";
import { NgxLoggerLevel } from "ngx-logger";
import { interval, Observable, Subscription } from "rxjs";
import { switchMap } from "rxjs/operators";
import { AlertTarget } from "../../../models/alert-target.model";
import { Member } from "../../../models/member.model";
import { RamblersUploadAudit, RamblersUploadAuditApiResponse } from "../../../models/ramblers-upload-audit.model";
import { WalkUploadRow } from "../../../models/ramblers-walks-manager";
import { FileUploadSummary, Walk, WalkExport } from "../../../models/walk.model";
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
import { CsvExportComponent, CsvOptions } from "../../../csv-export/csv-export";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import groupBy from "lodash-es/groupBy";
import { SystemConfig } from "../../../models/system.model";
import { PageComponent } from "../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { RelatedLinkComponent } from "../../../modules/common/related-link/related-link.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgOptionComponent, NgSelectComponent } from "@ng-select/ng-select";
import { DisplayTimePipe } from "../../../pipes/display-time.pipe";
import { ValueOrDefaultPipe } from "../../../pipes/value-or-default.pipe";
import { sortBy } from "../../../functions/arrays";

@Component({
    selector: "app-walk-export",
    template: `
      <app-page>
        <tabset class="custom-tabset">
          <tab active="true" [heading]="'Walk upload selection'">
            <app-csv-export hidden #csvComponent
                            [data]="walksDownloadFileContents"
                            [filename]="walksDownloadFileName()"
                            [options]="options()">
            </app-csv-export>
            <div class="img-thumbnail thumbnail-admin-edit">
              <div class="form-group">
                @if (walkExportTarget.showAlert) {
                  <div class="alert {{walkExportTarget.alertClass}}">
                    <fa-icon [icon]="walkExportTarget.alert.icon"></fa-icon>
                    @if (walkExportTarget.alertTitle) {
                      <strong>
                        {{ walkExportTarget.alertTitle }}: </strong>
                    } {{ walkExportTarget.alertMessage }}
                  </div>
                }
              </div>
              <div class="row">
                @if (!display.walkPopulationWalksManager()) {
                  <div class="col mb-2">
                    <input type="submit"
                           value="Upload {{stringUtils.pluraliseWithCount(walksDownloadFileContents.length, 'walk')}} directly to Ramblers"
                           (click)="uploadToRamblers()"
                           [disabled]="(walksDownloadFileContents.length === 0) || exportInProgress"
                           class="btn btn-primary w-100"/>
                  </div>
                  <div class="col mb-2">
                    <input type="submit"
                           (click)="csvComponent.generateCsv();"
                           value="Export {{stringUtils.pluraliseWithCount(walksDownloadFileContents.length, 'walk')}} file as CSV format"
                           [disabled]="walksDownloadFileContents.length === 0 || exportInProgress"
                           class="btn btn-primary w-100"/>
                  </div>
                }
                <div class="col mb-2">
                  <input type="submit" value="Back To Walks Admin" (click)="navigatebackToWalksAdmin()"
                         title="Back to walks"
                         class="btn btn-primary w-100"/>
                </div>
                <div class="col-lg-6 d-sm-none"></div>
              </div>
              <div class="row">
                @for (walkExport of walksForExport; track walkExport.displayedWalk.walk.id) {
                  <div class="py-2 col-lg-4 col-md-6 col-sm-12 d-flex flex-column">
                    <div class="card mb-0 h-100 pointer">
                      <div class="card-body shadow">
                        <dl (click)="toggleWalkExportSelection(walkExport)" class="d-flex pointer checkbox-toggle my-2">
                          <dt class="font-weight-bold mr-2 flex-nowrap checkbox-toggle">Publish this walk:</dt>
                          <div class="custom-control custom-checkbox">
                            <input [ngModel]="walkExport.selected"
                                   type="checkbox" class="custom-control-input"/>
                            <label class="custom-control-label"></label>
                          </div>
                        </dl>
                        <h3 class="card-title">
                          <a tooltip="View this walk in another tab" placement="auto"
                             [href]="walkExport.displayedWalk.walkLink" class="rams-text-decoration-pink active"
                             target="_blank">{{ walkExport.displayedWalk.walk.briefDescriptionAndStartPoint || walkExport.displayedWalk.latestEventType.description }}</a>
                        </h3>
                        <div (click)="ignoreClicks($event)" [ngClass]="{'card-disabled': !walkExport.selected}">
                          <dl class="d-flex">
                            <dt class="font-weight-bold mr-2">Date and time:</dt>
                            <time>{{ walkExport.displayedWalk.walk.walkDate | displayDate }} {{ walkExport.displayedWalk.walk.startTime }}</time>
                          </dl>
                          @if (walkExport.displayedWalk.walk?.distance) {
                            <dl class="d-flex mb-1">
                              <dt class="font-weight-bold mr-2">Distance:</dt>
                              <dd>{{ walkExport.displayedWalk.walk.distance }}</dd>
                            </dl>
                          }
                          <dl class="d-flex">
                            <dt class="font-weight-bold mr-2">Leader:</dt>
                            <dd>
                              <div class="row no-gutters">
                                <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                                     class="col-sm-6 nowrap">
                                  <fa-icon title
                                           tooltip="contact walk leader {{walkExport.displayedWalk?.walk?.displayName}}"
                                           [icon]="faEnvelope"
                                           class="fa-icon mr-1"/>
                                  <a content
                                     [href]="'mailto:' + walkExport.displayedWalk?.walk?.contactEmail">{{ walkExport.displayedWalk?.walk?.displayName || "Contact Via Ramblers" }}</a>
                                </div>
                              </div>
                            </dd>
                          </dl>
                          @if (walkExport.validationMessages.length > 0) {
                            <dl class="d-flex">
                              <dt class="font-weight-bold mr-2">Problems:</dt>
                            </dl>
                          }
                          <div>{{ walkExport.validationMessages.join(", ") }}</div>
                          <dl class="d-flex">
                            <dt class="font-weight-bold mr-2 nowrap">Publish status:</dt>
                            @if (walkExport.displayedWalk.walk.ramblersWalkId) {
                              <dd>
                                <a target="_blank"
                                   class="ml-2"
                                   tooltip="Click to view on Ramblers Walks and Events Manager"
                                   [href]="display.ramblersLink(walkExport.displayedWalk.walk)">
                                  <img class="related-links-ramblers-image" src="favicon.ico"
                                       alt="Click to view on Ramblers Walks and Events Manager"/></a>
                              </dd>
                            }
                          </dl>
                          <div>
                            <fa-icon class="mr-1"
                                     [ngClass]="walkExport.publishStatus.actionRequired? 'yellow-icon':'green-icon'"
                                     [icon]="walkExport.publishStatus.actionRequired?faExclamationCircle:faCheckCircle"/>
                            {{ walkExport.publishStatus.messages.join(", ") }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </tab>
          <tab [heading]="'Walk upload audit'">
            <div class="img-thumbnail thumbnail-admin-edit">
              <div class="form-group">
                @if (auditTarget.showAlert) {
                  <div class="alert {{auditTarget.alertClass}}">
                    <fa-icon [icon]="auditTarget.alert.icon"></fa-icon>
                    @if (auditTarget.alertTitle) {
                      <strong>
                        {{ auditTarget.alertTitle }}: </strong>
                    } {{ auditTarget.alertMessage }}
                  </div>
                }
              </div>
              @if (!display.walkPopulationWalksManager()) {
                <div class="row">
                  <div class="col-sm-12">
                    <div class="button-group">
                      <form class="form-inline">
                        <div class="form-group">
                          <label for="fileName" class="inline-label">Show upload session: </label>
                          <ng-select [clearable]="false" name="fileName" [(ngModel)]="fileName"
                                     (change)="fileNameChanged()"
                                     class="filename-select rounded">
                            @for (fileName of fileNames; track fileName) {
                              <ng-option [value]="fileName">
                                <div class="form-inline">
                                  <fa-icon [icon]="fileName.error ? faRemove : faCircleInfo"
                                           [ngClass]="fileName.error ? 'red-icon' : 'green-icon'"></fa-icon>
                                  {{ fileName.fileName }}
                                </div>
                              </ng-option>
                            }
                          </ng-select>
                        </div>
                        <div class="form-group">
                          <div class="custom-control custom-checkbox">
                            <input [(ngModel)]="showDetail"
                                   name="showDetail" type="checkbox" class="custom-control-input"
                                   id="show-detailed-audit-messages"/>
                            <label class="custom-control-label"
                                   (click)="fileNameChanged()"
                                   for="show-detailed-audit-messages">Show details
                            </label>
                          </div>
                        </div>
                        <div class="form-group">
                          <input type="submit" value="Back To Walks Admin" (click)="navigatebackToWalksAdmin()"
                                 title="Back to walks"
                                 class="btn btn-primary"/>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              }
              <div class="row">
                <div class="col col-sm-12">
                  <table class="round styled-table table-striped table-hover table-sm table-pointer">
                    <thead>
                    <tr>
                      <th>Time</th>
                      <th>Status</th>
                      <th>Audit Message</th>
                    </tr>
                    </thead>
                    <tbody>
                      @for (audit of ramblersUploadAuditData; track audit) {
                        <tr>
                          <td class="nowrap">{{ audit.auditTime | displayTime }}</td>
                          <td>
                            @if (audit.status === 'complete') {
                              <fa-icon
                                [icon]="finalStatusError ? faRemove : faCircleInfo"
                                [ngClass]="finalStatusError ? 'red-icon' : 'green-icon'"></fa-icon>
                            }
                            @if (audit.status === 'success') {
                              <fa-icon
                                [icon]="faEye"
                                class="green-icon"></fa-icon>
                            }
                            @if (audit.status === 'info') {
                              <fa-icon
                                [icon]="faCircleInfo"
                                class="blue-icon"></fa-icon>
                            }
                            @if (audit.status === 'error') {
                              <fa-icon
                                [icon]="faRemove"
                                class="red-icon"></fa-icon>
                            }
                          </td>
                          <td>
                            {{ audit.message }}@if (audit.errorResponse) {
                            <div>: {{ audit.errorResponse | valueOrDefault }}</div>
                          }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </tab>
        </tabset>
      </app-page>`,
    styles: [`
    .filename-select
      width: 400px

    .card-disabled
      opacity: 0.5
      pointer-events: none

    dl
      margin-bottom: 0
  `],
    styleUrls: ["./walk-export.component.sass"],
  imports: [PageComponent, TabsetComponent, TabDirective, CsvExportComponent, FontAwesomeModule, FormsModule, NgClass, RelatedLinkComponent, TooltipDirective, NgSelectComponent, NgOptionComponent, DisplayTimePipe, DisplayDatePipe, ValueOrDefaultPipe]
})

export class WalkExportComponent implements OnInit, OnDestroy {
  faExclamationCircle = faExclamationCircle;
  faCheckCircle = faCheckCircle;
  private logger: Logger = inject(LoggerFactory).createLogger("WalkExportComponent", NgxLoggerLevel.ERROR);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private walksService: WalksService = inject(WalksService);
  private ramblersUploadAuditService: RamblersUploadAuditService = inject(RamblersUploadAuditService);
  private notifierService: NotifierService = inject(NotifierService);
  private displayDate: DisplayDatePipe = inject(DisplayDatePipe);
  private systemConfigService: SystemConfigService = inject(SystemConfigService);
  private walksQueryService: WalksQueryService = inject(WalksQueryService);
  public display: WalkDisplayService = inject(WalkDisplayService);
  private dateUtils: DateUtilsService = inject(DateUtilsService);
  protected stringUtils: StringUtilsService = inject(StringUtilsService);
  private urlService: UrlService = inject(UrlService);
  public ramblersUploadAuditData: RamblersUploadAudit[];
  public walksForExport: WalkExport[] = [];
  public fileName: FileUploadSummary;
  public fileNames: FileUploadSummary[] = [];
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
  public walksDownloadFileContents: WalkUploadRow[] = [];
  protected readonly faEnvelope = faEnvelope;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.ramblersUploadAuditData = [];
    this.walkExportNotifier = this.notifierService.createAlertInstance(this.walkExportTarget);
    this.auditNotifier = this.notifierService.createAlertInstance(this.auditTarget);
    this.systemConfigService.events().subscribe(async (item: SystemConfig) => {
      if (this.display.walkPopulationWalksManager()) {
        const message = {
          title: "Walks Export Initialisation",
          message: `Walks cannot be exported from this view when the walk population is set to ${this.stringUtils.asTitle(this.display?.group?.walkPopulation)}`
        };
        this.walkExportNotifier.warning(message);
        this.auditNotifier.warning(message);
      } else {
        await this.showAvailableWalkExports();
        this.populateWalksDownloadFileContents()
        await this.showAllAudits();
        this.walkExportNotifier.success({
          title: "Walks Export Initialisation",
          message: `${this.stringUtils.pluraliseWithCount(this.walksDownloadFileContents.length, "walk")} ${this.stringUtils.pluralise(this.walksDownloadFileContents.length, "was", "were")} preselected for export`
        });

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
    this.logger.info("filename changed to", this.fileName);
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
    return this.ramblersUploadAuditService.all({criteria: {fileName: this.fileName.fileName}, sort: {auditTime: -1}})
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

  groupByFileName(response: RamblersUploadAudit[]): FileUploadSummary[] {
    const groupedData = groupBy(response, "fileName");
    return Object.keys(groupedData).map(fileName => {
      const hasError = groupedData[fileName].some(audit => audit.status === "error");
      return {fileName, error: hasError};
    });
  }

  exportableWalks(): WalkExport[] {
    return this.ramblersWalksAndEventsService.selectedExportableWalks(this.walksForExport);
  }

  navigatebackToWalksAdmin() {
    this.urlService.navigateTo(["walks", "admin"]);
  }

  populateWalkExport(walksForExport: WalkExport[]): WalkExport[] {
    this.logger.info("populateWalkExport: found", walksForExport.length, "walks:", walksForExport);
    this.walksForExport = walksForExport;
    this.sortWalksForExport();
    this.walkExportNotifier.success({
      title: "Export status", message: `Found total of ${this.stringUtils.pluraliseWithCount(this.walksForExport.length,"walk")}, ${this.walksDownloadFileContents.length} preselected for export`
    });
    this.walkExportNotifier.clearBusy();
    return walksForExport;
  }

  createWalksDownloadFileContents(): WalkUploadRow[] {
    const walkUploadRows = this.ramblersWalksAndEventsService.walkUploadRows(this.exportableWalks());
    this.logger.info("createWalksDownloadFileContents:", walkUploadRows);
    return walkUploadRows;
  }

  private headers(): string[] {
    const headers = map(this.walksDownloadFileContents[0], (column, row) => row);
    this.logger.debug("headers:", headers);
    return headers;
  }

  showAllAudits() {
    this.walkExportNotifier.warning("Refreshing past download sessions", false, true);
    this.ramblersUploadAuditService.all({limit: 1000, sort: {auditTime: -1}})
      .then((auditItems: RamblersUploadAuditApiResponse) => {
        this.logger.info("found total of", auditItems.response.length, "audit trail records:", auditItems.response);
        this.fileNames = this.groupByFileName(auditItems.response);
        this.logger.info("found total of", this.fileNames.length, "fileNames:", this.fileNames);
        this.fileName = this.fileNames[0];
        this.fileNameChanged();
        this.logger.debug("Total of", this.fileNames.length, "download sessions");
      });
  }

  showAvailableWalkExports() {
    this.walksForExport = [];
    this.walkExportNotifier.warning("Refreshing export status of future walks", false, true);
    return this.walksService.all({criteria: {walkDate: {$gte: this.dateUtils.momentNowNoTime().valueOf()}}, sort: {walkDate: -1}})
      .then((walks: Walk[]) => this.walksQueryService.activeWalks(walks))
      .then((walks: Walk[]) => {
        return this.ramblersWalksAndEventsService.createWalksForExportPrompt(walks)
          .then((walksForExport: WalkExport[]) => this.populateWalkExport(walksForExport))
          .catch(error => {
            this.logger.error("error->", error);
            this.walkExportNotifier.error({
              title: "Problem with Ramblers export preparation",
              continue: true,
              message: error
            });
            return false
          });
      });
  }

  toggleWalkExportSelection(walkExport: WalkExport) {
    if (walkExport.validationMessages.length === 0) {
      walkExport.selected = !walkExport.selected;
      this.logWalkSelected(walkExport);
      this.sortWalksForExport();
      this.populateWalksDownloadFileContents();
      this.walkExportNotifier.hide();
    } else {
      this.walkExportNotifier.error({
        title: `You can't export the walk for ${this.displayDate.transform(walkExport.displayedWalk.walk.walkDate)}`,
        message: walkExport.validationMessages.join(", ")
      });
    }
  }

  private populateWalksDownloadFileContents() {
    this.walksDownloadFileContents = this.createWalksDownloadFileContents();
  }

  uploadToRamblers() {
    this.logger.debug("Refreshing audit trail for file", this.fileName, "count =", this.ramblersUploadAuditData.length);
    this.startRamblersUploadAudit();
    this.ramblersUploadAuditData = [];
    this.exportInProgress = true;
    this.ramblersWalksAndEventsService.uploadToRamblers(this.walksForExport, this.members, this.walkExportNotifier).then(fileName => {
      this.fileName = fileName;
      if (!this.fileNames.find(item => item.fileName ===this?.fileName?.fileName)) {
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

  ignoreClicks($event: MouseEvent) {
    $event.stopPropagation();
  }

  sortWalksForExport(): void {
    const sorted = this.walksForExport.sort(sortBy("-selected", "displayedWalk.walk.walkDate"));
    this.logger.info("walksForExportSorted:", this.walksForExport, "sorted:", sorted);
    this.walksForExport = sorted;
  }
}
