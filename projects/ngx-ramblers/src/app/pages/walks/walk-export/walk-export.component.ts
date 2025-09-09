import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faCheckCircle, faEnvelope, faExclamationCircle, faRemove } from "@fortawesome/free-solid-svg-icons";
import map from "lodash-es/map";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import {
  AuditType,
  FileUploadSummary,
  RamblersUploadAudit,
  RamblersUploadAuditApiResponse,
  Status
} from "../../../models/ramblers-upload-audit.model";
import { RamblersEventType, RamblersWalksUploadRequest, WalkUploadRow } from "../../../models/ramblers-walks-manager";
import { GroupEventField, WalkExport } from "../../../models/walk.model";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { RamblersUploadAuditService } from "../../../services/walks/ramblers-upload-audit.service";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { ExtendedGroupEventQueryService } from "../../../services/walks-and-events/extended-group-event-query.service";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { WalkDisplayService } from "../walk-display.service";
import { CsvExportComponent, CsvOptions } from "../../../csv-export/csv-export";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfig } from "../../../models/system.model";
import { PageComponent } from "../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { RelatedLinkComponent } from "../../../modules/common/related-links/related-link";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgOptionComponent, NgSelectComponent } from "@ng-select/ng-select";
import { ValueOrDefaultPipe } from "../../../pipes/value-or-default.pipe";
import { sortBy } from "../../../functions/arrays";
import { DisplayTimeWithSecondsPipe } from "../../../pipes/display-time.pipe-with-seconds";
import { EventType, MessageType, RamblersUploadAuditProgressResponse } from "../../../models/websocket.model";
import { ApiResponse } from "../../../models/api-response.model";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { StatusIconComponent } from "../../admin/status-icon";
import last from "lodash-es/last";
import { ExtendedGroupEvent, InputSource } from "../../../models/group-event.model";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { EventDatesAndTimesPipe } from "../../../pipes/event-times-and-dates.pipe";

@Component({
  selector: "app-walk-export",
  template: `
    <app-page>
      <tabset class="custom-tabset">
        <tab active="true" heading="Walk upload selection">
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
                         value="Upload {{stringUtils.pluraliseWithCount(walksDownloadFileContents.length, 'walk')}} to Ramblers"
                         (click)="uploadToRamblers()"
                         [disabled]="newActionsDisabled()"
                         class="btn btn-primary w-100"/>
                </div>
                <div class="col mb-2">
                  <input type="submit"
                         (click)="csvComponent.generateCsv();"
                         value="Export {{stringUtils.pluraliseWithCount(walksDownloadFileContents.length, 'walk')}} file to CSV"
                         [disabled]="newActionsDisabled()"
                         class="btn btn-primary w-100"/>
                </div>
              }
              <div class="col mb-2">
                <input type="submit" value="Back To Walks Admin" (click)="navigateBackToWalksAdmin()"
                       title="Back to walks"
                       class="btn btn-primary w-100"/>
              </div>
              <div class="col-lg-6 d-sm-none"></div>
            </div>
            <div class="row">
              @for (walkExport of walksForExport; track walkExport.displayedWalk?.walk?.id) {
                <div class="py-2 col-lg-4 col-md-6 col-sm-12 d-flex flex-column">
                  <div class="card mb-0 h-100 pointer">
                    <div class="card-body shadow">
                      <dl (click)="toggleWalkExportSelection(walkExport)" class="d-flex pointer checkbox-toggle my-2">
                        <dt class="font-weight-bold me-2 flex-nowrap checkbox-toggle">Publish this walk:</dt>
                        <div class="form-check">
                          <input [ngModel]="walkExport.selected"
                                 type="checkbox" class="form-check-input"/>
                          <label class="form-check-label"></label>
                        </div>
                      </dl>
                      <h3 class="card-title">
                        <a tooltip="View this walk in another tab" placement="auto"
                           [href]="walkExport.displayedWalk?.walkLink" class="rams-text-decoration-pink active"
                           target="_blank">{{ walkExport.displayedWalk?.walk?.groupEvent?.title || walkExport.displayedWalk?.latestEventType.description }}</a>
                      </h3>
                      <div (click)="ignoreClicks($event)" [ngClass]="{'card-disabled': !walkExport.selected}">
                        <dl class="d-flex">
                          <dt class="font-weight-bold me-2">Date and Time:</dt>
                          <time>
                            <div>{{ walkExport.displayedWalk?.walk.groupEvent | eventDatesAndTimes : {noTimes: true} }}</div>
                            <div>{{ walkExport.displayedWalk?.walk.groupEvent | eventDatesAndTimes : {noDates: true} }}</div>
                          </time>
                        </dl>
                        @if (walkExport.displayedWalk?.walk?.groupEvent?.distance_miles) {
                          <dl class="d-flex mb-1">
                            <dt class="font-weight-bold me-2">Distance:</dt>
                            <dd>{{ distanceValidationService.walkDistances(walkExport.displayedWalk.walk) }}</dd>
                          </dl>
                        }
                        <dl class="d-flex">
                          <dt class="font-weight-bold me-2">Leader:</dt>
                          <dd>
                            <div class="row g-0">
                              <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                                   class="col-sm-6 nowrap">
                                <fa-icon title
                                         tooltip="contact walk leader {{walkExport.displayedWalk?.walk?.fields?.contactDetails?.displayName}}"
                                         [icon]="faEnvelope"
                                         class="fa-icon me-1"/>
                                <a content
                                   [href]="'mailto:' + walkExport.displayedWalk?.walk?.fields?.contactDetails?.email">{{ walkExport.displayedWalk?.walk?.fields?.contactDetails?.displayName || "Contact Via Ramblers" }}</a>
                              </div>
                            </div>
                          </dd>
                        </dl>
                        @if (walkExport.validationMessages.length > 0) {
                          <dl class="d-flex">
                            <dt class="font-weight-bold me-2">Problems:</dt>
                          </dl>
                        }
                        <div>{{ walkExport.validationMessages.join(", ") }}</div>
                      </div>
                      <dl class="d-flex">
                        <dt class="font-weight-bold me-2 nowrap">Publish status:</dt>
                        @if (walkExport.displayedWalk.walk?.groupEvent?.id) {
                          <dd>
                            <a [href]="display.ramblersLink(walkExport.displayedWalk.walk)"
                               target="_blank"
                               class="ms-2"
                               tooltip="Click to view on Ramblers Walks and Events Manager">
                              <img class="related-links-ramblers-image" src="favicon.ico"
                                   alt="Click to view on Ramblers Walks and Events Manager"/></a>
                          </dd>
                        }
                      </dl>
                      <div>
                        <fa-icon class="me-1"
                                 [ngClass]="walkExport.publishStatus.actionRequired? 'yellow-icon':'green-icon'"
                                 [icon]="walkExport.publishStatus.actionRequired?faExclamationCircle:faCheckCircle"/>
                        {{ walkExport.publishStatus.messages.join(", ") }}
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </tab>
        <tab heading="Walk upload audit">
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
                <div class="col-auto">
                  <div class="d-inline-flex align-items-center flex-wrap">
                    <div class="form-group">
                      <label for="fileName" class="inline-label">Upload: </label>
                      @if (showSelect) {
                        <ng-select
                          [disabled]="exportInProgress"
                          [clearable]="false"
                          name="fileName"
                          [(ngModel)]="fileName"
                          (ngModelChange)="refreshAuditForCurrentSession()"
                          class="filename-select rounded"
                          [appendTo]="'body'"
                          [dropdownPosition]="'auto'">
                          @for (fileName of fileNames; track fileName.fileName) {
                            <ng-option [value]="fileName">
                              <div class="d-inline-flex align-items-center flex-wrap">
                                <app-status-icon noLabel [status]="fileName.status"/>
                                {{ fileName.fileName }}
                              </div>
                            </ng-option>
                          }
                        </ng-select>
                      } @else {
                        <app-status-icon noLabel [status]="Status.ACTIVE"/>
                        <div class="ms-1">Finding sessions...</div>
                      }
                    </div>
                    <div class="form-group">
                      <div class="form-check">
                        <input [(ngModel)]="showDetail"
                               (ngModelChange)="applyFilter()"
                               name="showDetail" type="checkbox" class="form-check-input"
                               id="show-detailed-audit-messages"/>
                        <label class="form-check-label"
                               for="show-detailed-audit-messages">Show details
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="col">
                  <div class="form-group">
                    <input type="submit" value="Last Import Report" (click)="navigateToLastReport($event)"
                           title="Back to walks"
                           class="btn btn-primary w-100"/>
                  </div>
                </div>
                <div class="col">
                  <div class="form-group">
                    <input type="submit" value="Back To Walks Admin" (click)="navigateBackToWalksAdmin()"
                           title="Back to walks"
                           class="btn btn-primary w-100"/>
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
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Audit Message</th>
                  </tr>
                  </thead>
                  <tbody>
                    @for (audit of filteredAudits; track audit.id) {
                      <tr>
                        <td class="nowrap">{{ audit.auditTime | displayTimeWithSeconds }}</td>
                        <td class="nowrap">{{ timing(audit) }}</td>
                        <td>
                          <app-status-icon noLabel [status]="audit.status"/>
                        </td>
                        <td>{{ audit.message }}@if (audit.errorResponse) {
                          <div>: {{ audit.errorResponse | valueOrDefault }}</div>
                        }</td>
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
      width: 350px

    .card-disabled
      opacity: 0.5
      pointer-events: none

    dl
      margin-bottom: 0
  `],
  styleUrls: ["./walk-export.component.sass"],
  imports: [PageComponent, TabsetComponent, TabDirective, CsvExportComponent, FontAwesomeModule, FormsModule, NgClass, RelatedLinkComponent, TooltipDirective, NgSelectComponent, NgOptionComponent, DisplayTimeWithSecondsPipe, ValueOrDefaultPipe, StatusIconComponent, EventDatesAndTimesPipe]
})

export class WalkExportComponent implements OnInit, OnDestroy {
  faExclamationCircle = faExclamationCircle;
  faCheckCircle = faCheckCircle;
  private logger: Logger = inject(LoggerFactory).createLogger("WalkExportComponent", NgxLoggerLevel.ERROR);
  private webSocketClientService: WebSocketClientService = inject(WebSocketClientService);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private walksAndEventsService: WalksAndEventsService = inject(WalksAndEventsService);
  private ramblersUploadAuditService: RamblersUploadAuditService = inject(RamblersUploadAuditService);
  private notifierService: NotifierService = inject(NotifierService);
  private displayDate: DisplayDatePipe = inject(DisplayDatePipe);
  private systemConfigService: SystemConfigService = inject(SystemConfigService);
  private extendedGroupEventQueryService: ExtendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  public display: WalkDisplayService = inject(WalkDisplayService);
  private dateUtils: DateUtilsService = inject(DateUtilsService);
  protected stringUtils: StringUtilsService = inject(StringUtilsService);
  private urlService: UrlService = inject(UrlService);
  public distanceValidationService = inject(DistanceValidationService);
  public audits: RamblersUploadAudit[];
  public filteredAudits: RamblersUploadAudit[];
  public walksForExport: WalkExport[] = [];
  public fileName: FileUploadSummary;
  public fileNames: FileUploadSummary[] = [];
  public showDetail: boolean;
  public walkExportTarget: AlertTarget = {};
  private walkExportNotifier: AlertInstance;
  public auditTarget: AlertTarget = {};
  private auditNotifier: AlertInstance;
  public exportInProgress = false;
  faRemove = faRemove;
  public walksDownloadFileContents: WalkUploadRow[] = [];
  protected readonly faEnvelope = faEnvelope;
  private subscriptions: Subscription[] = [];
  showSelect = false;
  protected readonly Status = Status;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.audits = [];
    this.walkExportNotifier = this.notifierService.createAlertInstance(this.walkExportTarget);
    this.auditNotifier = this.notifierService.createAlertInstance(this.auditTarget);
    this.systemConfigService.events().subscribe(async (_unused: SystemConfig) => {
      if (this.display.walkPopulationWalksManager()) {
        const message = {
          title: "Walks Export Initialisation",
          message: `Walks cannot be exported from this view when the walk population is set to ${this.stringUtils.asTitle(this.display?.group?.walkPopulation)}`
        };
        this.walkExportNotifier.warning(message);
        this.auditNotifier.warning(message);
      } else {
        await this.renderInitialView();
      }
    });
    this.subscriptions.push(this.webSocketClientService.receiveMessages<RamblersUploadAuditProgressResponse>(MessageType.PROGRESS).subscribe((progressResponse: RamblersUploadAuditProgressResponse) => {
      this.logger.info("Progress response received:", progressResponse);
      if (progressResponse?.audits?.length > 0) {
        this.logger.info("Progress response received:", progressResponse.audits);
        this.audits = (this.audits.concat(progressResponse?.audits)).sort(sortBy("-auditTime", "-record"));
        this.applyFilter();
        this.auditNotifier.warning(`Total of ${this.stringUtils.pluraliseWithCount(this.audits.length, "audit item")} - ${this.stringUtils.pluraliseWithCount(progressResponse.audits.length, "audit record")} just received`);
      }
    }));
    this.subscriptions.push(this.webSocketClientService.receiveMessages(MessageType.ERROR).subscribe(error => {
        this.logger.error(`Error:`, error);
        this.exportInProgress = false;
        this.auditNotifier.error({title: "Error", message: error});
        this.fileName.status = Status.ERROR;
        this.renderInitialView();
      })
    );
    this.subscriptions.push(this.webSocketClientService.receiveMessages(MessageType.COMPLETE).subscribe(async (message: ApiResponse) => {
        this.exportInProgress = false;
      this.fileName.status = this.audits.find(item => item.status === Status.ERROR) ? Status.ERROR : Status.SUCCESS;
        this.logger.info(`Task completed:`, message, "set file status:", this.fileName);
        this.renderInitialView();
      })
    );
  }

  private async renderInitialView() {
    await this.showAvailableWalkExports();
    this.populateWalksDownloadFileContents();
    await this.showAllAudits();
    this.walkExportNotifier.success({
      title: "Walks Export Initialisation",
      message: `${this.stringUtils.pluraliseWithCount(this.walksDownloadFileContents.length, "walk")} ${this.stringUtils.pluralise(this.walksDownloadFileContents.length, "was", "were")} preselected for export`
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  async uploadToRamblers() {
    this.logger.debug("Refreshing audit trail for file", this.fileName, "count =", this.audits.length);
    this.audits = [];
    this.exportInProgress = true;
    const ramblersWalksUploadRequest: RamblersWalksUploadRequest = await this.ramblersWalksAndEventsService.createWalksUploadRequest(this.walksForExport);
    this.webSocketClientService.connect().then(() => {
      this.webSocketClientService.sendMessage(EventType.RAMBLERS_WALKS_UPLOAD, ramblersWalksUploadRequest);
      this.fileName = {fileName: ramblersWalksUploadRequest.fileName, status: Status.ACTIVE};
      if (!this.fileNames.find(item => item.fileName === this?.fileName?.fileName)) {
        this.fileNames = [this.fileName].concat(this.fileNames);
        this.logger.info("added", this.fileName, "to filenames of", this.fileNames.length, "audit trail records");
      }
      this.ramblersWalksAndEventsService.notifyWalkUploadStarted(this.walkExportNotifier, ramblersWalksUploadRequest);
    });
  }

  public newActionsDisabled(): boolean {
    return (this.walksDownloadFileContents.length === 0) || this.exportInProgress;
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

  refreshAuditForCurrentSession() {
    this.logger.info("filename changed to", this.fileName);
    this.walkExportNotifier.setBusy();
    return this.ramblersUploadAuditService.all({
      criteria: {fileName: this.fileName?.fileName},
      sort: {auditTime: -1, record: -1}
    }).then((auditItems: RamblersUploadAuditApiResponse) => {
      this.audits = auditItems.response;
      this.applyFilter();
      this.walkExportNotifier.clearBusy();
    });
  }

  protected applyFilter(): void {
    this.filteredAudits = this.audits.filter(auditItem => {
      return this.showDetail || [Status.COMPLETE, Status.ERROR, Status.SUCCESS].includes(auditItem.status);
    });
    if (this.filteredAudits.length === this.audits.length) {
      this.auditNotifier.warning(`Showing ${this.stringUtils.pluraliseWithCount(this.audits.length, "audit item")}`);
    } else {
      this.auditNotifier.warning(`Showing ${this.filteredAudits.length} of ${this.stringUtils.pluraliseWithCount(this.audits.length, "audit item")}`);
    }
    this.logger.off("applyFilter:filtered:", this.filteredAudits.length, "unfiltered:", this.audits.length);
  }

  exportableWalks(): WalkExport[] {
    return this.ramblersWalksAndEventsService.selectedExportableWalks(this.walksForExport);
  }

  navigateBackToWalksAdmin() {
    this.urlService.navigateTo(["walks", "admin"]);
  }

  navigateToLastReport(event) {
    this.urlService.navigateToUrl("reports/target/site/serenity/index.html", event);
  }

  populateWalkExport(walksForExport: WalkExport[]): WalkExport[] {
    this.logger.info("populateWalkExport: found", this.stringUtils.pluraliseWithCount(walksForExport.length, "exportable walk"), "walks:", walksForExport);
    this.walksForExport = walksForExport;
    this.sortWalksForExport();
    this.walkExportNotifier.success({
      title: "Export status",
      message: `Found total of ${this.stringUtils.pluraliseWithCount(this.walksForExport.length, "walk")}, ${this.walksDownloadFileContents.length} preselected for export`
    });
    this.walkExportNotifier.clearBusy();
    return walksForExport;
  }

  async createWalksDownloadFileContents(): Promise<WalkUploadRow[]> {
    const walkUploadRows = await this.ramblersWalksAndEventsService.walkUploadRows(this.exportableWalks());
    this.logger.info("createWalksDownloadFileContents:", walkUploadRows);
    return walkUploadRows;
  }

  private headers(): string[] {
    const headers = map(this.walksDownloadFileContents[0], (column, row) => row);
    this.logger.debug("headers:", headers);
    return headers;
  }

  async showAllAudits() {
    this.showSelect = false;
    this.walkExportNotifier.warning("Refreshing past download sessions", false, true);
    this.fileNames = await this.ramblersUploadAuditService.uniqueUploadSessions();
    this.fileName = this.fileNames?.[0];
    this.logger.info("Total of", this.fileNames.length, "download sessions - current session:", this.fileName);
    await this.refreshAuditForCurrentSession();
    this.showSelect = true;
  }

  async showAvailableWalkExports(): Promise<any> {
    try {
      this.walksForExport = [];
      this.walkExportNotifier.warning("Refreshing export status of future walks", false, true);
      const all: ExtendedGroupEvent[] = await this.walksAndEventsService.all({
        inputSource: this.display.walkPopulationWalksManager() ? InputSource.WALKS_MANAGER_IMPORT : InputSource.MANUALLY_CREATED,
        suppressEventLinking: true,
        types: [RamblersEventType.GROUP_WALK],
        dataQueryOptions: {
          criteria: {[GroupEventField.START_DATE]: {$gte: this.dateUtils.isoDateTimeNow()}},
          sort: {[GroupEventField.START_DATE]: -1}
        }
      });
      const active: ExtendedGroupEvent[] = this.extendedGroupEventQueryService.activeEvents(all);
      this.logger.info("showAvailableWalkExports:all:", all, "active:", active);
      const exports: WalkExport[] = await this.ramblersWalksAndEventsService.createWalksForExportPrompt(active);
      this.logger.info("showAvailableWalkExports:activeEvents:exports:", exports);
      return this.populateWalkExport(exports);
    } catch (error) {
            this.logger.error("error->", error);
            this.walkExportNotifier.error({
              title: "Problem with Ramblers export preparation",
              continue: true,
              message: error
            });
    }
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
        title: `You can't export the walk for ${this.displayDate.transform(walkExport.displayedWalk.walk?.groupEvent?.start_date_time)}`,
        message: walkExport.validationMessages.join(", ")
      });
    }
  }

  private async populateWalksDownloadFileContents() {
    this.walksDownloadFileContents = await this.createWalksDownloadFileContents();
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
    const sorted = this.walksForExport.sort(sortBy("-selected", "displayedWalk.walk.groupEvent.start_date_time"));
    this.logger.info("walksForExportSorted:", this.walksForExport, "sorted:", sorted);
    this.walksForExport = sorted;
  }

  timing(audit: RamblersUploadAudit): string {
    const summary = audit.type === AuditType.SUMMARY;
    const currentIndex = this.filteredAudits.findIndex(item => item.id === audit.id);
    if (summary) {
      return this.dateUtils.formatDuration(last(this?.audits)?.auditTime, audit?.auditTime);
    } else {
      const previousAudit = this.filteredAudits?.[currentIndex + 1];
      return this.dateUtils.formatDuration(previousAudit?.auditTime, audit?.auditTime);
    }
  }
}
