import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { faCheckCircle, faEnvelope, faExclamationCircle, faRemove } from "@fortawesome/free-solid-svg-icons";
import { isString, map } from "es-toolkit/compat";
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
import {
  DownloadConflictResponse,
  GroupEventField,
  ServerDownloadStatus,
  ServerDownloadStatusType,
  WalkExport
} from "../../../models/walk.model";
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
import { RelatedLinkComponent } from "../../../modules/common/related-links/related-link";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgOptionComponent, NgSelectComponent } from "@ng-select/ng-select";
import { ValueOrDefaultPipe } from "../../../pipes/value-or-default.pipe";
import { sortBy } from "../../../functions/arrays";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { DisplayTimeWithSecondsPipe } from "../../../pipes/display-time.pipe-with-seconds";
import { EventType, MessageType, RamblersUploadAuditProgressResponse } from "../../../models/websocket.model";
import { ApiResponse } from "../../../models/api-response.model";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { StatusIconComponent } from "../../admin/status-icon";
import { ExtendedGroupEvent, InputSource } from "../../../models/group-event.model";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { EventDatesAndTimesPipe } from "../../../pipes/event-times-and-dates.pipe";
import { ServerDownloadStatusService } from "../../../services/walks/download-status.service";

export enum WalkExportTab {
  WALK_UPLOAD_SELECTION = "walk-upload-selection",
  WALK_UPLOAD_AUDIT = "walk-upload-audit"
}

@Component({
  selector: "app-walk-export",
  template: `
    <app-page>
      <tabset class="custom-tabset">
        <tab [active]="activeTabId === WalkExportTab.WALK_UPLOAD_SELECTION"
             (selectTab)="selectTab(WalkExportTab.WALK_UPLOAD_SELECTION)" heading="Walk upload selection">
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
                  @if (!downloadConflict.allowed && downloadConflict.activeDownload) {
                    <div class="mt-3">
                      <div class="d-flex align-items-center justify-content-between">
                        <div>
                          @if (downloadConflict.activeDownload.canOverride) {
                            @if (!confirmOverrideRequested) {
                              <button type="button" class="btn btn-sm btn-warning"
                                      (click)="requestOverride()"
                                      title="Force terminate the current download">
                                Override Download
                              </button>
                            } @else {
                              <div class="d-inline-flex gap-2">
                                <button type="button" class="btn btn-sm btn-danger" (click)="overrideDownload()">Confirm
                                  Override
                                </button>
                                <button type="button" class="btn btn-sm btn-secondary"
                                        (click)="cancelOverrideRequest()">Cancel
                                </button>
                              </div>
                            }
                          }
                        </div>
                      </div>
                      @if (downloadConflict.activeDownload) {
                        <div class="mt-2">
                          <small class="text-muted">
                            Active download: {{ downloadConflict.activeDownload.fileName }}
                            (Started: {{ dateUtils.displayDateAndTime(downloadConflict.activeDownload.startTime) }})
                          </small>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
            <div class="row">
              @if (!display.walkPopulationWalksManager()) {
                <div class="col mb-2">
                  <input type="submit"
                         [value]="uploadButtonLabel()"
                         (click)="uploadToRamblers()"
                         [disabled]="newActionsDisabled()"
                         class="btn btn-primary w-100"/>
                </div>
                <div class="col mb-2">
                  <input type="submit"
                         (click)="csvComponent.generateCsv();"
                         value="Export {{stringUtils.pluraliseWithCount(walksDownloadFileContents.length, 'walk')}} file to CSV"
                         [disabled]="csvDisabled()"
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
            <div class="row mt-2">
              @for (walkExport of walksForExport; track walkExport.displayedWalk?.walk?.id) {
                <div class="col-lg-4 col-md-6 col-sm-12 d-flex flex-column mb-2">
                  <div class="card mb-0 h-100 pointer walk-export-card">
                    <div class="card-body shadow">
                      <dl (click)="toggleWalkExportSelection(walkExport)" class="d-flex pointer checkbox-toggle my-2">
                        <dt class="font-weight-bold me-2 flex-nowrap checkbox-toggle">Publish this walk:</dt>
                        <div class="form-check">
                          <input [ngModel]="walkExport.selected"
                                 [disabled]="!isActionable(walkExport)"
                                 type="checkbox" class="form-check-input"/>
                          <label class="form-check-label"></label>
                        </div>
                      </dl>
                      <h3 class="card-title">
                        <a tooltip="View this walk in another tab" placement="auto"
                           [href]="walkExport.displayedWalk?.walkLink" class="rams-text-decoration-pink active"
                           target="_blank">{{ walkExport.displayedWalk?.walk?.groupEvent?.title || walkExport.displayedWalk?.latestEventType.description }}</a>
                      </h3>
                      <div (click)="ignoreClicks($event)" [class.card-disabled]="!walkExport.selected">
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
                                 [class.yellow-icon]="walkExport.publishStatus.actionRequired"
                                 [class.green-icon]="!walkExport.publishStatus.actionRequired"
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
        <tab [active]="activeTabId === WalkExportTab.WALK_UPLOAD_AUDIT"
             (selectTab)="selectTab(WalkExportTab.WALK_UPLOAD_AUDIT)" heading="Walk upload audit">
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
                <div class="col-12 mb-3">
                  <div class="d-flex flex-column gap-2">
                    <div class="row g-2 g-md-3 align-items-md-center">
                      <div class="col-12 col-md-auto">
                        <label for="fileName" class="form-label mb-0 text-nowrap">Upload Session:</label>
                      </div>
                      <div class="col-12 col-md" style="min-width: 0;">
                        @if (showSelect) {
                          <ng-select
                            [disabled]="exportInProgress"
                            [clearable]="false"
                            name="fileName"
                            [(ngModel)]="fileName"
                            (ngModelChange)="onSessionChange()"
                            class="filename-select"
                            dropdownPosition="bottom"
                            [virtualScroll]="false">
                            @for (fileName of fileNames; track fileName.fileName) {
                              <ng-option [value]="fileName">
                                <div class="d-flex align-items-center">
                                  <app-status-icon noLabel [status]="fileName.status"/>
                                  <span class="ms-2 text-truncate"
                                        [title]="fileName.fileName">{{ displayForUploadSession(fileName.fileName) }}</span>
                                </div>
                              </ng-option>
                            }
                          </ng-select>
                        } @else {
                          <div class="d-flex align-items-center">
                            <app-status-icon noLabel [status]="Status.ACTIVE"/>
                            <span class="ms-2">Finding sessions...</span>
                          </div>
                        }
                      </div>
                      <div class="col-12 col-md-auto d-none d-md-block">
                        <div class="form-check">
                          <input [(ngModel)]="showDetail"
                                 (ngModelChange)="applyFilter()"
                                 name="showDetail" type="checkbox" class="form-check-input"
                                 id="show-detailed-audit-messages"/>
                          <label class="form-check-label text-nowrap"
                                 for="show-detailed-audit-messages">Show details
                          </label>
                        </div>
                      </div>
                    </div>
                    <div class="d-md-none">
                      <div class="form-check text-start">
                        <input [(ngModel)]="showDetail"
                               (ngModelChange)="applyFilter()"
                               name="showDetail" type="checkbox" class="form-check-input"
                               id="show-detailed-audit-messages-mobile"/>
                        <label class="form-check-label text-nowrap"
                               for="show-detailed-audit-messages-mobile">Show details
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="col-12">
                  <div class="row">
                    <div class="col-12 col-sm-6 mb-2">
                      <input type="submit" value="Last Import Report" (click)="navigateToLastReport($event)"
                             title="View last import report"
                             [disabled]="exportInProgress"
                             class="btn btn-primary w-100"/>
                    </div>
                    <div class="col-12 col-sm-6 mb-2">
                      <input type="submit" value="Back To Walks Admin" (click)="navigateBackToWalksAdmin()"
                             title="Return to walks admin"
                             class="btn btn-primary w-100"/>
                    </div>
                  </div>
                </div>
              </div>
            }
            <div class="row mt-2">
              <div class="col col-sm-12">
                <div class="d-none d-md-block">
                  <div class="audit-table-scroll">
                    <table class="round styled-table table-striped table-hover table-sm table-pointer">
                      <thead>
                      <tr>
                        <th (click)="sortAuditsBy('status')"><span class="nowrap">Status
                          @if (auditSortField === 'status') {
                            <span class="sorting-header">{{ auditSortDirection }}</span>
                          }</span>
                        </th>
                        <th (click)="sortAuditsBy('auditTime')"><span class="nowrap">Time
                          @if (auditSortField === 'auditTime') {
                            <span class="sorting-header">{{ auditSortDirection }}</span>
                          }</span>
                        </th>
                        <th (click)="sortAuditsBy('durationMs')"><span class="nowrap">Duration
                          @if (auditSortField === 'durationMs') {
                            <span class="sorting-header">{{ auditSortDirection }}</span>
                          }</span>
                        </th>
                        <th (click)="sortAuditsBy('message')"><span class="nowrap">Audit Message
                          @if (auditSortField === 'message') {
                            <span class="sorting-header">{{ auditSortDirection }}</span>
                          }</span>
                        </th>
                      </tr>
                      </thead>
                      <tbody>
                        @for (audit of filteredAudits; track audit.id) {
                          <tr>
                            <td>
                              <app-status-icon noLabel [status]="audit.status"/>
                            </td>
                            <td class="nowrap">{{ audit.auditTime | displayTimeWithSeconds }}</td>
                            <td class="nowrap">{{ timing(audit) }}</td>
                            <td class="text-break">{{ audit.message }}@if (audit.errorResponse) {
                              <div>: {{ audit.errorResponse | valueOrDefault }}</div>
                            }</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
                <div class="d-md-none">
                  @for (audit of filteredAudits; track audit.id) {
                    <div class="border rounded p-2 mb-2">
                      <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                        <app-status-icon noLabel [status]="audit.status"/>
                        <span class="fw-semibold">{{ audit.auditTime | displayTimeWithSeconds }}</span>
                        <span>{{ timing(audit) }}</span>
                      </div>
                      <div class="text-break">{{ audit.message }}@if (audit.errorResponse) {
                        <div>: {{ audit.errorResponse | valueOrDefault }}</div>
                      }</div>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </tab>
      </tabset>
    </app-page>`,
  styles: [`
    .filename-select
      width: 100%
      min-width: 200px
      --ng-option-height: 40px

    .card-disabled
      opacity: 0.5
      pointer-events: none

    dl
      margin-bottom: 0

    .flex-grow-1 .filename-select
      width: 100%

    .filename-select .ng-dropdown-panel
      max-height: 70vh !important
      max-width: 100% !important
      width: 100% !important

    .filename-select .ng-dropdown-panel .ng-option
      height: var(--ng-option-height)
      line-height: var(--ng-option-height)

    ::ng-deep .filename-select .ng-dropdown-panel
      max-height: 70vh !important
      max-width: 100% !important
      width: 100% !important

    ::ng-deep .filename-select .ng-dropdown-panel .ng-option
      height: var(--ng-option-height)
      line-height: var(--ng-option-height)

    ::ng-deep ng-select.filename-select .ng-dropdown-panel
      max-height: 70vh !important
      max-width: 100% !important
      width: 100% !important

    ::ng-deep ng-select.filename-select .ng-dropdown-panel .ng-option
      height: var(--ng-option-height)
      line-height: var(--ng-option-height)

    .walk-export-card .card-body
      padding: .5rem .75rem

    .checkbox-toggle dt
      margin-bottom: 0
      align-self: center

    .checkbox-toggle .form-check
      margin: 0
      display: flex
      align-items: center

    .checkbox-toggle .form-check-input
      margin-top: 0
      width: 1.1rem
      height: 1.1rem

    .audit-table-scroll
      position: relative
      max-height: 60vh
      overflow-y: auto
      overflow-x: hidden

    .audit-table-scroll table
      margin-bottom: 0

    .audit-table-scroll thead
      position: sticky
      top: 0
      z-index: 20
      background-clip: padding-box

    .audit-table-scroll thead th
      position: sticky
      top: 0
      z-index: 20
      box-shadow: 0 1px 0 rgba(0,0,0,0.05)

    @media (max-width: 576px)
      .filename-select .ng-dropdown-panel,
      ::ng-deep .filename-select .ng-dropdown-panel,
      ::ng-deep ng-select.filename-select .ng-dropdown-panel
        width: 100% !important
        max-width: 100% !important
  `],
  styleUrls: ["./walk-export.component.sass"],
  imports: [PageComponent, TabsetComponent, TabDirective, CsvExportComponent, FontAwesomeModule, FormsModule, RelatedLinkComponent, TooltipDirective, NgSelectComponent, NgOptionComponent, DisplayTimeWithSecondsPipe, ValueOrDefaultPipe, StatusIconComponent, EventDatesAndTimesPipe]
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
  public dateUtils: DateUtilsService = inject(DateUtilsService);
  protected stringUtils: StringUtilsService = inject(StringUtilsService);
  private urlService: UrlService = inject(UrlService);
  public distanceValidationService = inject(DistanceValidationService);
  private downloadStatusService = inject(ServerDownloadStatusService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public audits: RamblersUploadAudit[];
  public filteredAudits: RamblersUploadAudit[];
  private readonly maxAuditRows = 500;
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
  protected readonly WalkExportTab = WalkExportTab;
  currentDownload: ServerDownloadStatus | null = null;
  downloadConflict: DownloadConflictResponse = { allowed: true };
  activeTabId = WalkExportTab.WALK_UPLOAD_SELECTION;
  private pendingSessionParam: string | null = null;
  public auditSortField = "auditTime";
  public auditSortDirection = DESCENDING;
  private auditReverseSort = true;
  public confirmOverrideRequested = false;
  private sessionDurations: { [fileName: string]: string } = {};
  private deletionsCleared = false;
  private actionableMap: { [id: string]: boolean } = {};

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.audits = [];
    this.walkExportNotifier = this.notifierService.createAlertInstance(this.walkExportTarget);
    this.auditNotifier = this.notifierService.createAlertInstance(this.auditTarget);

    this.subscriptions.push(this.route.queryParams.subscribe(params => {
      const tabParam = params["tab"];
      if (tabParam && Object.values(WalkExportTab).includes(tabParam)) {
        this.activeTabId = tabParam as WalkExportTab;
      }
      this.pendingSessionParam = params["session"];
    }));
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
    this.subscriptions.push(this.webSocketClientService.receiveMessages<RamblersUploadAuditProgressResponse>(MessageType.PROGRESS).subscribe(async (progressResponse: RamblersUploadAuditProgressResponse) => {
      this.logger.info("Progress response received:", progressResponse);
      if (progressResponse?.audits?.length > 0) {
        this.logger.info("Progress response received:", progressResponse.audits);
        this.audits = (this.audits.concat(progressResponse?.audits)).sort(sortBy("-auditTime", "-record"));
        this.applyFilter();
        this.updateCurrentSessionDurationLabel();
        this.auditNotifier.warning(`Total of ${this.stringUtils.pluraliseWithCount(this.audits.length, "audit item")} - ${this.stringUtils.pluraliseWithCount(progressResponse.audits.length, "audit record")} just received`);
        if (!this.postActionRefreshed && this.audits.some(a => a.type === AuditType.SUMMARY && a.status === Status.SUCCESS)) {
          this.postActionRefreshed = true;
          try {
            if (!this.deletionsCleared) {
              await this.clearLocalRamblersFieldsForDeletions();
            }
            await this.showAvailableWalkExports();
            await this.populateWalksDownloadFileContents();
            this.updateExportStatusMessage();
          } catch {}
        }
      }
    }));
    this.subscriptions.push(this.webSocketClientService.receiveMessages(MessageType.ERROR).subscribe(async error => {
        this.logger.error(`Error:`, error);
        const lastSummarySuccess = this.audits?.some(a => a.type === AuditType.SUMMARY && a.status === Status.SUCCESS);
        const transient = !!(error as any)?.transient;
        this.exportInProgress = false;
        if (lastSummarySuccess || transient) {
          try {
            await this.refreshAuditForCurrentSession();
            this.applyFilter();
            this.updateCurrentSessionDurationLabel();
            if (!lastSummarySuccess) {
              this.auditNotifier.warning({title: "Connection Restored", message: "WebSocket reconnected; audit refreshed"});
            }
          } catch {}
          return;
        }
        const messageText = isString(error) ? error : ((error as any)?.message || "WebSocket error");
        this.auditNotifier.error({title: "Error", message: messageText});
        if (this.fileName) {
          this.fileName.status = Status.ERROR;
        }
        await this.renderInitialView();
      }))
    ;
    this.subscriptions.push(this.webSocketClientService.receiveMessages(MessageType.COMPLETE).subscribe(async (message: ApiResponse) => {
        this.exportInProgress = false;
      const hasCompletionErrors = this.audits.filter(item =>
        item.status === Status.ERROR &&
        item.type === AuditType.SUMMARY
      ).length > 0;
      this.fileName.status = hasCompletionErrors ? Status.ERROR : Status.SUCCESS;
        this.logger.info(`Task completed:`, message, "set file status:", this.fileName);
        if (!hasCompletionErrors && !this.deletionsCleared) {
          try {
            await this.clearLocalRamblersFieldsForDeletions();
          } catch {}
        }
        await this.renderInitialView();
      })
    );
  }

  private async renderInitialView() {
    await this.showAvailableWalkExports();
    this.populateWalksDownloadFileContents();
    await this.showAllAudits();
    await this.checkDownloadStatus();
    this.updateExportStatusMessage();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private postActionRefreshed = false;

  async uploadToRamblers() {
    const downloadCheck = await this.downloadStatusService.canStartNewDownload();
    if (!downloadCheck.allowed) {
      this.downloadConflict = downloadCheck;
      this.walkExportNotifier.error({
        title: "Download Conflict",
        message: downloadCheck.reason || "Another download is in progress"
      });
      return;
    }

    this.logger.debug("Refreshing audit trail for file", this.fileName, "count =", this.audits.length);
    this.audits = [];
    this.exportInProgress = true;
    this.deletionsCleared = false;
    this.downloadConflict = { allowed: true };

    const ramblersWalksUploadRequest: RamblersWalksUploadRequest = await this.ramblersWalksAndEventsService.createWalksUploadRequest(this.walksForExport);
    this.webSocketClientService.connect().then(() => {
      this.webSocketClientService.sendMessage(EventType.RAMBLERS_WALKS_UPLOAD, ramblersWalksUploadRequest);
      this.fileName = {fileName: ramblersWalksUploadRequest.fileName, status: Status.ACTIVE};
      if (!this.fileNames.find(item => item.fileName === this?.fileName?.fileName)) {
        this.fileNames = [this.fileName].concat(this.fileNames);
        this.logger.info("added", this.fileName, "to filenames of", this.fileNames.length, "audit trail records");
      }
      this.downloadStatusService.updateServerDownloadStatus({
        fileName: ramblersWalksUploadRequest.fileName,
        status: ServerDownloadStatusType.ACTIVE,
        startTime: Date.now(),
        canOverride: false,
        lastActivity: Date.now()
      });
      this.ramblersWalksAndEventsService.notifyWalkUploadStarted(this.walkExportNotifier, ramblersWalksUploadRequest);
      this.selectTab(WalkExportTab.WALK_UPLOAD_AUDIT);
    });
  }

  private async clearLocalRamblersFieldsForDeletions(): Promise<void> {
    const deletions = new Set(this.ramblersWalksAndEventsService.walkDeletionList(this.exportableWalks()));
    if (deletions.size === 0) {
      this.deletionsCleared = true;
      return;
    }
    const updates: Promise<any>[] = [];
    for (const walkExport of this.walksForExport || []) {
      const local = walkExport?.displayedWalk?.walk;
      const rmUrl = walkExport?.ramblersUrl;
      const localUrl = local?.groupEvent?.url ? (this.ramblersWalksAndEventsService as any)["transformUrl"](local) : null;
      const match = (localUrl && deletions.has(localUrl)) || (rmUrl && deletions.has(rmUrl));
      if (match && (local?.groupEvent?.id || local?.groupEvent?.url)) {
        local.groupEvent.id = null;
        local.groupEvent.url = null;
        updates.push(this.walksAndEventsService.createOrUpdate(local));
      }
    }
    if (updates.length > 0) {
      try {
        await Promise.all(updates);
        this.logger.info("Cleared Ramblers id/url locally for", updates.length, "walks after deletion");
      } catch (e) {
        this.logger.error("Failed to clear Ramblers fields after deletion:", e);
      }
    }
    this.deletionsCleared = true;
  }

  public newActionsDisabled(): boolean {
    const rowsCount = this.walksDownloadFileContents.length;
    const cancellationCount = this.ramblersWalksAndEventsService.walkCancellationList(this.exportableWalks()).length;
    const deletionCount = this.ramblersWalksAndEventsService.walkDeletionList(this.exportableWalks()).length;
    const uncancelCount = this.ramblersWalksAndEventsService.walkUncancellationList(this.exportableWalks()).length;
    const nothingToProcess = (rowsCount + cancellationCount + deletionCount + uncancelCount) === 0;
    return nothingToProcess || this.exportInProgress || !this.downloadConflict.allowed;
  }

  private async checkDownloadStatus(): Promise<void> {
    try {
      this.currentDownload = await this.downloadStatusService.getCurrentServerDownloadStatus();
      this.downloadConflict = await this.downloadStatusService.canStartNewDownload();

      if (this.currentDownload && this.currentDownload.status === ServerDownloadStatusType.ACTIVE) {
        this.walkExportNotifier.warning({
          title: "Active Download Detected",
          message: `Download "${this.currentDownload.fileName}" is currently in progress`
        });
      }
      this.updateExportStatusMessage();
    } catch (error) {
      this.logger.error("Failed to check download status:", error);
    }
  }

  requestOverride(): void {
    this.confirmOverrideRequested = true;
  }

  cancelOverrideRequest(): void {
    this.confirmOverrideRequested = false;
  }

  async overrideDownload(): Promise<void> {
    if (!this.downloadConflict.activeDownload) {
      return;
    }

    const fileName = this.downloadConflict.activeDownload.fileName;
    this.confirmOverrideRequested = false;
    const result = await this.downloadStatusService.overrideDownload(fileName);

    if (result.success) {
      this.walkExportNotifier.success({
        title: "Download Override Successful",
        message: result.message
      });
      await this.checkDownloadStatus();
    } else {
      this.walkExportNotifier.error({
        title: "Download Override Failed",
        message: result.message
      });
    }
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
      sort: {auditTime: -1, record: -1},
      limit: this.maxAuditRows
    }).then((auditItems: RamblersUploadAuditApiResponse) => {
      this.audits = auditItems.response;
      this.applyFilter();
      this.updateCurrentSessionDurationLabel();
      this.walkExportNotifier.clearBusy();
    }).catch(error => {
      const message = isString(error) ? error : (error?.message || "Failed to load audit history");
      this.auditNotifier.error({title: "Audit Load Error", message});
      this.walkExportNotifier.clearBusy();
    });
  }

  private updateCurrentSessionDurationLabel(): void {
    if (!this.fileName?.fileName || !this.audits?.length) {
      return;
    }
    const chronologicalAll = this.audits.slice().sort(sortBy("-auditTime", "-record"));
    const latest = chronologicalAll[0]?.auditTime;
    const earliest = chronologicalAll[chronologicalAll.length - 1]?.auditTime;
    this.sessionDurations[this.fileName.fileName] = this.dateUtils.formatDuration(earliest, latest);
  }

  protected applyFilter(): void {
    this.filteredAudits = this.audits.filter(auditItem => {
      return this.showDetail || [Status.COMPLETE, Status.ERROR, Status.SUCCESS].includes(auditItem.status);
    });
    const timeSorted = this.filteredAudits.slice().sort(sortBy("-auditTime", "-record"));
    const allChrono = this.audits.slice().sort(sortBy("-auditTime", "-record"));
    const lastAudit = allChrono[0];
    const firstAudit = allChrono[allChrono.length - 1];
    if (this.showDetail) {
      const durations = new Map<string, number>();
      timeSorted.forEach((audit, index) => {
        if (audit.type === AuditType.SUMMARY) {
          durations.set(audit.id, Math.max(0, (lastAudit?.auditTime || 0) - (firstAudit?.auditTime || 0)));
        } else {
          const previous = timeSorted[index + 1];
          durations.set(audit.id, Math.max(0, (audit?.auditTime || 0) - (previous?.auditTime || 0)));
        }
      });
      this.filteredAudits = this.filteredAudits.map(a => ({...a, durationMs: durations.get(a.id) || 0} as any));
    }
    const direction = this.auditSortDirection === ASCENDING ? "" : "-";
    const primary = `${direction}${this.auditSortField}`;
    if (this.auditSortField === "auditTime") {
      this.filteredAudits = this.filteredAudits.sort(sortBy(primary, `${direction}record`));
    } else {
      this.filteredAudits = this.filteredAudits.sort(sortBy(primary));
    }
    if (this.filteredAudits.length === this.audits.length) {
      this.auditNotifier.warning(`Showing ${this.stringUtils.pluraliseWithCount(this.audits.length, "audit item")}`);
    } else {
      this.auditNotifier.warning(`Showing ${this.filteredAudits.length} of ${this.stringUtils.pluraliseWithCount(this.audits.length, "audit item")}`);
    }
    this.logger.off("applyFilter:filtered:", this.filteredAudits.length, "unfiltered:", this.audits.length);
    this.filteredAudits = this.filteredAudits.slice(0, this.maxAuditRows);
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
    this.walkExportNotifier.clearBusy();
    this.computeActionability();
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
    try {
      this.fileNames = await this.ramblersUploadAuditService.uniqueUploadSessions(6);
    } catch (e) {
      const message = (e as any)?.message || "Failed to query upload sessions";
      this.auditNotifier.error({title: "Audit Load Error", message});
      this.showSelect = true;
      return;
    }

    this.cleanupStaleInProgressSessions();

    this.fileName = this.fileNames?.[0];

    if (this.pendingSessionParam) {
      const matchingSession = this.fileNames.find(f => this.sessionToUrlParam(f.fileName) === this.pendingSessionParam);
      if (matchingSession) {
        this.fileName = matchingSession;
      }
      this.pendingSessionParam = null;
    }

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
      const result = this.populateWalkExport(exports);
      await this.computeActionability();
      return result;
    } catch (error) {
            this.logger.error("error->", error);
            this.walkExportNotifier.error({
              title: "Problem with Ramblers export preparation",
              continue: true,
              message: error
            });
    }
  }

  async toggleWalkExportSelection(walkExport: WalkExport) {
    if (walkExport.validationMessages.length > 0) {
      this.walkExportNotifier.error({
        title: `You can't export the walk for ${this.displayDate.transform(walkExport.displayedWalk.walk?.groupEvent?.start_date_time)}`,
        message: walkExport.validationMessages.join(", ")
      });
      return;
    }
    if (!this.isActionable(walkExport)) {
      this.walkExportNotifier.warning({
        title: "No Action For This Walk",
        message: "This walk is currently set not to upload and has no Ramblers action to process. Enable publishing or select a different walk."
      });
      return;
    }

    walkExport.selected = !walkExport.selected;
    this.logWalkSelected(walkExport);
    this.sortWalksForExport();
    await this.populateWalksDownloadFileContents();
    this.updateExportStatusMessage();
  }

  private async computeActionability(): Promise<void> {
    const map: { [id: string]: boolean } = {};
    for (const w of this.walksForExport || []) {
      const key = w?.displayedWalk?.walk?.id || w?.displayedWalk?.walk?.groupEvent?.url || w?.displayedWalk?.walk?.groupEvent?.title || "";
      if (!key) { continue; }
      const selectedClone: WalkExport = { ...w, selected: true } as WalkExport;
      const single = [selectedClone];
      try {
        const uploads = await this.ramblersWalksAndEventsService.walkUploadRows(single);
        const cancels = this.ramblersWalksAndEventsService.walkCancellationList(single).length;
        const deletes = this.ramblersWalksAndEventsService.walkDeletionList(single).length;
        const uncancels = this.ramblersWalksAndEventsService.walkUncancellationList(single).length;
        map[key] = (uploads.length + cancels + deletes + uncancels) > 0;
      } catch {
        map[key] = false;
      }
    }
    this.actionableMap = map;
  }

  public isActionable(walkExport: WalkExport): boolean {
    const key = walkExport?.displayedWalk?.walk?.id || walkExport?.displayedWalk?.walk?.groupEvent?.url || walkExport?.displayedWalk?.walk?.groupEvent?.title || "";
    return !!this.actionableMap[key];
  }

  private async populateWalksDownloadFileContents() {
    this.walksDownloadFileContents = await this.createWalksDownloadFileContents();
  }

  private updateExportStatusMessage(): void {
    const rowsCount = this.walksDownloadFileContents.length;
    const cancellationCount = this.ramblersWalksAndEventsService.walkCancellationList(this.exportableWalks()).length;
    const deletionCount = this.ramblersWalksAndEventsService.walkDeletionList(this.exportableWalks()).length;
    const uncancelCount = this.ramblersWalksAndEventsService.walkUncancellationList(this.exportableWalks()).length;
    if (this.downloadConflict.allowed && rowsCount > 0) {
      this.walkExportNotifier.success({
        title: "Walks Export Initialisation",
        message: `${this.stringUtils.pluraliseWithCount(rowsCount, "walk")} ${this.stringUtils.pluralise(rowsCount, "was", "were")} preselected for export`
      });
    } else if (!this.downloadConflict.allowed) {
      this.walkExportNotifier.warning({
        title: "Upload Unavailable",
        message: `${this.downloadConflict.reason} ${this.stringUtils.pluraliseWithCount(rowsCount, "walk")} selected but cannot be uploaded until resolved.`
      });
    } else if (rowsCount === 0) {
      if (cancellationCount > 0 || deletionCount > 0 || uncancelCount > 0) {
        const parts = [] as string[];
        if (cancellationCount > 0) { parts.push(`${this.stringUtils.pluraliseWithCount(cancellationCount, "cancellation")}`); }
        if (deletionCount > 0) { parts.push(`${this.stringUtils.pluraliseWithCount(deletionCount, "deletion")}`); }
        if (uncancelCount > 0) { parts.push(`${this.stringUtils.pluraliseWithCount(uncancelCount, "uncancellation")}`); }
        this.walkExportNotifier.success({
          title: "Actions To Process",
          message: `0 walks will be uploaded; ${parts.join(" and ")} ${this.stringUtils.pluralise(cancellationCount + deletionCount, "will", "will")} be processed.`
        });
      } else {
        this.walkExportNotifier.warning({
          title: "No Walks Selected",
          message: "No walks are currently selected for export. Please select one or more walks to enable upload."
        });
      }
    }
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

  uploadButtonLabel(): string {
    const rows = this.walksDownloadFileContents.length;
    const cancels = this.ramblersWalksAndEventsService.walkCancellationList(this.exportableWalks()).length;
    const deletes = this.ramblersWalksAndEventsService.walkDeletionList(this.exportableWalks()).length;
    const uncancels = this.ramblersWalksAndEventsService.walkUncancellationList(this.exportableWalks()).length;
    if (rows > 0) {
      const extras: string[] = [];
      if (deletes > 0) { extras.push(`${this.stringUtils.pluraliseWithCount(deletes, "deletion")}`); }
      if (cancels > 0) { extras.push(`${this.stringUtils.pluraliseWithCount(cancels, "cancellation")}`); }
      if (uncancels > 0) { extras.push(`${this.stringUtils.pluraliseWithCount(uncancels, "uncancellation")}`); }
      const extraText = extras.length ? ` (+ ${extras.join(", ")})` : "";
      return `Upload ${this.stringUtils.pluraliseWithCount(rows, "walk")} to Ramblers${extraText}`;
    }
    if (cancels > 0 || deletes > 0 || uncancels > 0) {
      const parts: string[] = [];
      if (deletes > 0) { parts.push(this.stringUtils.pluraliseWithCount(deletes, "deletion")); }
      if (cancels > 0) { parts.push(this.stringUtils.pluraliseWithCount(cancels, "cancellation")); }
      if (uncancels > 0) { parts.push(this.stringUtils.pluraliseWithCount(uncancels, "uncancellation")); }
      return `Process ${parts.join(" and ")}`;
    }
    return `Upload ${this.stringUtils.pluraliseWithCount(rows, "walk")} to Ramblers`;
  }

  csvDisabled(): boolean {
    const rows = this.walksDownloadFileContents.length;
    return rows === 0 || this.exportInProgress || !this.downloadConflict.allowed;
  }


  timing(audit: RamblersUploadAudit): string {
    const summary = audit.type === AuditType.SUMMARY;
    const chronologicalAll = this.audits.slice().sort(sortBy("-auditTime", "-record"));
    const currentIndex = chronologicalAll.findIndex(item => item.id === audit.id);
    const latest = chronologicalAll[0]?.auditTime;
    const earliest = chronologicalAll[chronologicalAll.length - 1]?.auditTime;
    if (summary) {
      return this.dateUtils.formatDuration(earliest, latest);
    } else {
      const previousAudit = chronologicalAll?.[currentIndex + 1];
      return this.dateUtils.formatDuration(previousAudit?.auditTime, audit?.auditTime);
    }
  }

  selectTab(tab: WalkExportTab): void {
    this.activeTabId = tab;
    this.logger.info("setting tab to:", tab);
    this.updateUrl();
  }

  sortAuditsBy(field: string): void {
    if (this.auditSortField === field) {
      this.auditReverseSort = !this.auditReverseSort;
    } else {
      this.auditReverseSort = this.auditSortDirection === DESCENDING;
    }
    this.auditSortField = field;
    this.auditSortDirection = this.auditReverseSort ? DESCENDING : ASCENDING;
    this.applyFilter();
  }

  onSessionChange(): void {
    this.refreshAuditForCurrentSession();
    this.updateUrl();
  }

  private updateUrl(): void {
    const queryParams: any = { tab: this.activeTabId };
    if (this.fileName?.fileName) {
      queryParams.session = this.sessionToUrlParam(this.fileName.fileName);
    }
    this.logger.info("updateUrl:queryParams:", queryParams);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: "merge"
    });
  }

  private cleanupStaleInProgressSessions(): void {
    const now = Date.now();
    const staleThresholdMinutes = 15;

    this.fileNames = this.fileNames.map(session => {
      if (session.status === Status.ACTIVE) {
        const sessionTime = this.extractSessionTime(session.fileName);
        if (sessionTime) {
          const timeDifferenceMinutes = (now - sessionTime) / (1000 * 60);
          if (timeDifferenceMinutes > staleThresholdMinutes) {
            this.logger.info(`Cleaning up stale in-progress session: ${session.fileName}`);
            return { ...session, status: Status.ERROR };
          }
        }
      }
      return session;
    });
  }

  private extractSessionTime(fileName: string): number | null {
    const match = fileName.match(/walks-export-(\d{1,2})-(\w+)-(\d{4})-(\d{2})-(\d{2})\.csv$/);
    if (match) {
      const [, day, month, year, hour, minute] = match;
      const dateString = `${day} ${month} ${year} ${hour}:${minute}`;
      return this.dateUtils.parseDisplayDateWithFormat(dateString, "d MMMM yyyy HH:mm")?.toMillis() || null;
    }
    return null;
  }

  public displayForUploadSession(fileName: string): string {
    const session = this.fileNames.find(f => f.fileName === fileName);
    const ts = this.extractSessionTime(fileName);
    if (ts) {
      let duration = this.sessionDurations[fileName];
      if (!duration && session?.earliestAuditTime && session?.latestAuditTime) {
        duration = this.dateUtils.formatDuration(session.earliestAuditTime, session.latestAuditTime);
        this.sessionDurations[fileName] = duration;
      }
      const label = this.dateUtils.displayDateAndTime(ts);
      return duration ? `${label} (${duration})` : label;
    }
    return this.formatUploadSessionName(fileName);
  }

  formatUploadSessionName(fileName: string): string {
    if (!fileName) return "";

    const match = fileName.match(/walks-export-(\d{1,2})-(\w+)-(\d{4})-(\d{2})-(\d{2})\.csv$/);
    if (match) {
      const [, day, month, year, hour, minute] = match;
      const date = `${day} ${month} ${year}`;
      const time = `${hour}:${minute}`;
      return `${date} at ${time}`;
    }

    return fileName.replace(/^walks-export-/, "").replace(/\.csv$/, "").replace(/-/g, " ");
  }

  private sessionToUrlParam(fileName: string): string {
    if (!fileName) return "";

    const sessionTime = this.extractSessionTime(fileName);
    if (sessionTime) {
      return this.dateUtils.asDateTime(sessionTime).toFormat("yyyy-MM-dd'T'HHmm");
    }

    return fileName.replace(/^walks-export-/, "").replace(/\.csv$/, "").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  }
}
