import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faPlay, faSpinner, faCheck, faTimes, faBan, faCircleCheck } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { PageComponent } from "../../../../page/page.component";
import { BadgeButtonComponent } from "../../../../modules/common/badge-button/badge-button";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { AlertTarget } from "../../../../models/alert-target.model";
import { WebSocketClientService } from "../../../../services/websockets/websocket-client.service";
import { EventType, MessageType } from "../../../../models/websocket.model";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { DisplayTimeWithSecondsPipe } from "../../../../pipes/display-time.pipe-with-seconds";
import { StatusIconComponent } from "../../status-icon";
import {
  ExternalAlbumImportResult,
  ExternalContentReference,
  ContentMigrationActivityLog,
  ContentMigrationGroup,
  ContentMigrationProgress,
  ContentMigrationScanResult,
  ContentMigrationTab,
  RootFolder
} from "../../../../models/system.model";
import { NgSelectComponent } from "@ng-select/ng-select";
import { kebabCase, values } from "es-toolkit/compat";
import { ContentMigrationGroupComponent } from "./image-migration-group";
import { ExternalAlbumImportComponent } from "./external-album-import/external-album-import";
import { ActivatedRoute, Router } from "@angular/router";
import { StoredValue } from "../../../../models/ui-actions";
import { enumValueForKey } from "../../../../functions/enums";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { FileSizeSelectorComponent } from "../../../../carousel/edit/file-size-selector/file-size-selector";

@Component({
  selector: "app-content-migration-settings",
  template: `
    <app-page autoTitle>
      <tabset class="custom-tabset">
        <tab [active]="tabActive(ContentMigrationTab.SCAN)"
             (selectTab)="selectTab(ContentMigrationTab.SCAN)"
             heading="{{enumValueForKey(ContentMigrationTab, ContentMigrationTab.SCAN)}}">
          <div class="img-thumbnail thumbnail-admin-edit">
            @if (!loadingHosts) {
            @if (availableHosts.length === 0) {
              <div class="row p-3">
                <div class="col-sm-12">
                  <div class="alert alert-success d-flex align-items-center gap-2">
                    <fa-icon [icon]="faCircleCheck" size="lg"/>
                    <span><strong>All Content Hosted Locally</strong> — No external content hosts found.</span>
                  </div>
                </div>
              </div>
            } @else {
              <div class="row p-3">
                <div class="col-sm-12">
                  <h5>Scan for External Content</h5>
                  <p class="text-muted">Select a host to find images, PDFs, and other documents hosted externally that need to be migrated to S3.</p>
                </div>
              </div>
              <div class="row p-3 align-items-end">
                <div class="col-sm-4">
                  <div class="form-group mb-0">
                    <label for="host-pattern">External Host</label>
                    <ng-select id="host-pattern"
                               [items]="availableHosts"
                               [(ngModel)]="hostPattern"
                               [loading]="loadingHosts"
                               [addTag]="true"
                               [clearable]="true"
                               dropdownPosition="bottom"
                               placeholder="Select or type external host">
                    </ng-select>
                  </div>
                </div>
                <div class="col-sm-4">
                  <div class="form-group mb-0">
                    <label for="target-folder">Target S3 Folder</label>
                    <ng-select id="target-folder"
                               [items]="rootFolders"
                               [(ngModel)]="targetRootFolder"
                               [clearable]="false"
                               dropdownPosition="bottom"
                               placeholder="Select target folder">
                    </ng-select>
                  </div>
                </div>
                <div class="col-sm-4">
                  <div class="form-group mb-0">
                    <app-file-size-selector label="Auto Resize Images"
                                            [fileSize]="maxImageSize"
                                            (fileSizeChanged)="maxImageSize=$event"/>
                  </div>
                </div>
              </div>
              <div class="row p-3">
                <div class="col-sm-3">
                  <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="scan-albums"
                           [(ngModel)]="scanAlbums">
                    <label class="form-check-label" for="scan-albums">Scan Albums</label>
                  </div>
                </div>
                <div class="col-sm-3">
                  <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="scan-page-content"
                           [(ngModel)]="scanPageContent">
                    <label class="form-check-label" for="scan-page-content">Scan Page Content</label>
                  </div>
                </div>
                <div class="col-sm-3">
                  <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="scan-group-events"
                           [(ngModel)]="scanGroupEvents">
                    <label class="form-check-label" for="scan-group-events">Scan Walks</label>
                  </div>
                </div>
                <div class="col-sm-3">
                  <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="scan-social-events"
                           [(ngModel)]="scanSocialEvents">
                    <label class="form-check-label" for="scan-social-events">Scan Social Events</label>
                  </div>
                </div>
                <div class="col-sm-3">
                  <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="scan-committee-files"
                           [(ngModel)]="scanCommitteeFiles">
                    <label class="form-check-label" for="scan-committee-files">Scan Committee Files</label>
                  </div>
                </div>
              </div>
              <div class="row p-3">
                <div class="col-sm-12">
                  <app-badge-button [icon]="scanning ? faSpinner : faPlay"
                                    [disabled]="!hostPattern || scanning"
                                    (click)="runScan()"
                                    caption="Scan for External Content"/>
                </div>
              </div>
            }
            }
          </div>
        </tab>
        @if (!loadingHosts && availableHosts.length > 0) {
          <tab [active]="tabActive(ContentMigrationTab.RESULTS)"
               (selectTab)="selectTab(ContentMigrationTab.RESULTS)"
               heading="{{enumValueForKey(ContentMigrationTab, ContentMigrationTab.RESULTS)}}">
            <div class="img-thumbnail thumbnail-admin-edit">
              @if (scanResult) {
                <div class="row p-3">
                  <div class="col-sm-12">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                      <div>
                        <strong>Found {{ stringUtils.pluraliseWithCount(scanResult.totalItems, "item") }}</strong> across
                        {{ stringUtils.pluraliseWithCount(scanResult.totalPages, "source") }}
                        <span class="text-muted">(scanned in {{ scanResult.scanDurationMs }}ms)</span>
                      </div>
                      <div>
                        <app-badge-button [icon]="faCheck" (click)="selectAll()" caption="Select All"/>
                        <app-badge-button [icon]="faTimes" (click)="deselectAll()" caption="Deselect All"/>
                        <app-badge-button [icon]="migrating ? faSpinner : faPlay"
                                          [disabled]="!hasSelectedItems() || migrating"
                                          (click)="runMigration()"
                                          [caption]="'Migrate ' + stringUtils.pluraliseWithCount(selectedItemCount(), 'Selected Item')"/>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="row p-3">
                  <div class="col-sm-12">
                    <div class="migration-accordion">
                      @for (group of scanResult.groups; track group.sourcePath) {
                        <app-content-migration-group
                          [group]="group"
                          (groupChanged)="onGroupChanged($event)"/>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </tab>
          <tab [active]="tabActive(ContentMigrationTab.ACTIVITY)"
               (selectTab)="selectTab(ContentMigrationTab.ACTIVITY)"
               heading="{{enumValueForKey(ContentMigrationTab, ContentMigrationTab.ACTIVITY)}}">
            <div class="img-thumbnail thumbnail-admin-edit">
            @if (activityTarget.showAlert) {
              <div class="row px-3 pt-3">
                <div class="col-sm-12">
                  <div class="alert mb-0 {{activityTarget.alert.class}}">
                    <fa-icon [icon]="activityTarget.alert.icon"></fa-icon>
                    @if (activityTarget.alertTitle) {
                      <strong class="ms-2">{{ activityTarget.alertTitle }}: </strong>
                    } {{ activityTarget.alertMessage }}
                  </div>
                </div>
              </div>
            }
            @if (migrationProgress) {
              <div class="row px-3 pt-3">
                <div class="col-sm-12">
                  <div class="d-flex align-items-center gap-2">
                    <div class="progress flex-grow-1" style="height: 25px;">
                      <div class="progress-bar"
                           role="progressbar"
                           [attr.aria-valuenow]="migrationProgress.percent"
                           aria-valuemin="0"
                           aria-valuemax="100"
                           [style.width.%]="migrationProgress.percent">
                        {{ migrationProgress.percent }}%
                      </div>
                    </div>
                    @if (migrating && !cancelling) {
                      <app-badge-button [icon]="faBan"
                                        (click)="cancelMigration()"
                                        caption="Cancel"/>
                    }
                    @if (cancelling) {
                      <app-badge-button [icon]="faSpinner"
                                        [disabled]="true"
                                        caption="Cancelling..."/>
                    }
                  </div>
                  <div class="text-muted mt-2">
                    {{ migrationProgress.processedItems }} / {{ migrationProgress.totalItems }} items
                    ({{ migrationProgress.successCount }} succeeded, {{ migrationProgress.failureCount }} failed)
                  </div>
                </div>
              </div>
            }
            <div class="row p-3">
              <div class="col-sm-12">
                <div class="audit-table-scroll">
                  <table class="round styled-table table-striped table-hover table-sm">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Time</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (log of logs; track log.id) {
                        <tr>
                          <td><app-status-icon noLabel [status]="log.status"/></td>
                          <td class="nowrap">{{ log.time | displayTimeWithSeconds }}</td>
                          <td class="text-break">{{ log.message }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          </tab>
        }
        <tab [active]="tabActive(ContentMigrationTab.EXTERNAL_IMPORT)"
             (selectTab)="selectTab(ContentMigrationTab.EXTERNAL_IMPORT)"
             heading="{{enumValueForKey(ContentMigrationTab, ContentMigrationTab.EXTERNAL_IMPORT)}}">
          <app-external-album-import (importComplete)="onImportComplete($event)"/>
        </tab>
      </tabset>
    </app-page>
  `,
  styles: [`
    .migration-accordion
      border: 1px solid #dee2e6
      border-radius: 6px
      overflow: hidden

    .migration-accordion app-content-migration-group
      display: block
      border-bottom: 1px solid #dee2e6

    .migration-accordion app-content-migration-group:last-child
      border-bottom: none

    .audit-table-scroll
      position: relative
      max-height: 60vh
      overflow-y: auto
      overflow-x: hidden

      table
        margin-bottom: 0
        width: 100%

      thead
        position: sticky
        top: 0
        z-index: 20
        background-clip: padding-box

        th
          position: sticky
          top: 0
          z-index: 20
          box-shadow: 0 1px 0 rgba(0,0,0,0.05)
  `],
  imports: [
    PageComponent,
    BadgeButtonComponent,
    FontAwesomeModule,
    FormsModule,
    TabsetComponent,
    TabDirective,
    DisplayTimeWithSecondsPipe,
    StatusIconComponent,
    NgSelectComponent,
    ContentMigrationGroupComponent,
    FileSizeSelectorComponent,
    ExternalAlbumImportComponent
  ]
})
export class ContentMigrationSettingsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("ContentMigrationSettingsComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private webSocketClientService = inject(WebSocketClientService);
  private dateUtils = inject(DateUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  protected stringUtils = inject(StringUtilsService);
  private subscriptions: Subscription[] = [];

  protected readonly faPlay = faPlay;
  protected readonly faSpinner = faSpinner;
  protected readonly faCheck = faCheck;
  protected readonly faTimes = faTimes;
  protected readonly faBan = faBan;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly ContentMigrationTab = ContentMigrationTab;
  protected readonly enumValueForKey = enumValueForKey;

  private tab: ContentMigrationTab = ContentMigrationTab.SCAN;

  hostPattern = "";
  availableHosts: string[] = [];
  loadingHosts = false;
  targetRootFolder: RootFolder = RootFolder.siteContent;
  rootFolders: RootFolder[] = values(RootFolder);
  maxImageSize = 0;
  scanAlbums = true;
  scanPageContent = true;
  scanGroupEvents = false;
  scanSocialEvents = false;
  scanCommitteeFiles = true;

  scanning = false;
  migrating = false;
  cancelling = false;
  scanResult: ContentMigrationScanResult | null = null;
  migrationProgress: ContentMigrationProgress | null = null;

  activityTarget: AlertTarget = {};
  activityNotifier: AlertInstance;
  logs: ContentMigrationActivityLog[] = [];

  ngOnInit(): void {
    this.activityNotifier = this.notifierService.createAlertInstance(this.activityTarget);

    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      const defaultValue = kebabCase(ContentMigrationTab.SCAN);
      const tabParameter = params[StoredValue.TAB];
      const tab = tabParameter || defaultValue;
      this.logger.debug("received tab value of:", tabParameter, "defaultValue:", defaultValue, "selectTab:", tab);
      this.tab = tab as ContentMigrationTab;
    }));

    this.webSocketClientService.connect().then(() => {
      this.subscriptions.push(
        this.webSocketClientService.receiveMessages<any>(MessageType.PROGRESS).subscribe((data: any) => {
          const message = data?.message || JSON.stringify(data);

          if (data?.progress) {
            this.migrationProgress = data.progress;
            if (data.progress.errorMessage) {
              this.addLog("error", `Failed: ${data.progress.currentItem} — ${data.progress.errorMessage}`);
              this.activityNotifier.error({ title: "Migration Failed", message: data.progress.errorMessage });
            } else {
              this.addLog("info", message);
              this.activityNotifier.warning({ title: "Migration Progress", message: `Currently migrating ${data.progress.currentItem}` });
            }
          } else {
            this.addLog("info", message);
            this.activityNotifier.warning(message);
          }
        })
      );
      this.subscriptions.push(
        this.webSocketClientService.receiveMessages<any>(MessageType.ERROR).subscribe((error: any) => {
          const message = error?.message || JSON.stringify(error);
          this.addLog("error", message);
          this.activityNotifier.error({ title: "Error", message });
          this.scanning = false;
          this.migrating = false;
          this.cancelling = false;
          this.loadingHosts = false;
        })
      );
      this.subscriptions.push(
        this.webSocketClientService.receiveMessages<any>(MessageType.CANCELLED).subscribe((data: any) => {
          const message = data?.message || JSON.stringify(data);
          this.addLog("cancelled", message);
          this.activityNotifier.warning({ title: "Cancelled", message });
          this.migrating = false;
          this.cancelling = false;
          this.migrationProgress = null;
          this.scanForAvailableHosts();
        })
      );
      this.subscriptions.push(
        this.webSocketClientService.receiveMessages<any>(MessageType.COMPLETE).subscribe((data: any) => {
          const message = data?.message || JSON.stringify(data);

          if (data?.hosts) {
            this.availableHosts = data.hosts;
            this.hostPattern = this.availableHosts[0] || "";
            this.loadingHosts = false;
            this.logger.debug("Loaded", this.availableHosts.length, "available hosts, pre-selected:", this.hostPattern);
            this.activityNotifier.showContactUs(false);
            if (this.availableHosts.length === 0) {
              this.activityNotifier.success("No external content hosts found — all content is already hosted locally");
            } else {
              this.activityNotifier.warning("Select a migration action on the Scan Configuration tab");
            }
          } else {
            this.addLog("complete", message);
            this.activityNotifier.success({ title: "Complete", message });

            if (data?.scanResult) {
              this.scanResult = data.scanResult;
              this.scanning = false;
              this.selectTab(ContentMigrationTab.RESULTS);
            }

            if (data?.migrationResult) {
              this.migrating = false;
              this.cancelling = false;
              this.migrationProgress = null;
              this.scanForAvailableHosts();
            }
          }
        })
      );

      this.scanForAvailableHosts();
    });
  }

  private scanForAvailableHosts(): void {
    this.loadingHosts = true;
    this.webSocketClientService.sendMessage(EventType.CONTENT_MIGRATION_SCAN_HOSTS, {});
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  selectTab(tab: ContentMigrationTab): void {
    this.tab = tab;
    this.router.navigate([], {
      queryParams: { [StoredValue.TAB]: kebabCase(tab) },
      queryParamsHandling: "merge",
      fragment: this.activatedRoute.snapshot.fragment
    });
  }

  tabActive(tab: ContentMigrationTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }

  runScan(): void {
    if (!this.hostPattern || this.scanning) {
      return;
    }

    this.scanning = true;
    this.scanResult = null;
    this.logs = [];
    this.selectTab(ContentMigrationTab.ACTIVITY);
    this.addLog("info", `Starting scan for host pattern: ${this.hostPattern}`);

    this.webSocketClientService.sendMessage(EventType.CONTENT_MIGRATION_SCAN, {
      hostPattern: this.hostPattern,
      scanAlbums: this.scanAlbums,
      scanPageContent: this.scanPageContent,
      scanGroupEvents: this.scanGroupEvents,
      scanSocialEvents: this.scanSocialEvents,
      scanCommitteeFiles: this.scanCommitteeFiles
    });
  }

  runMigration(): void {
    if (!this.hasSelectedItems() || this.migrating) {
      return;
    }

    this.migrating = true;
    this.migrationProgress = null;
    this.selectTab(ContentMigrationTab.ACTIVITY);
    this.addLog("info", `Starting migration of ${this.stringUtils.pluraliseWithCount(this.selectedItemCount(), "item")}`);

    const selectedItems = this.collectSelectedItems();
    this.webSocketClientService.sendMessage(EventType.CONTENT_MIGRATION_EXECUTE, {
      items: selectedItems,
      targetRootFolder: this.targetRootFolder,
      maxImageSize: this.maxImageSize
    });
  }

  cancelMigration(): void {
    if (!this.migrating || this.cancelling) {
      return;
    }

    this.cancelling = true;
    this.addLog("info", "Cancellation requested...");
    this.webSocketClientService.sendMessage(EventType.CONTENT_MIGRATION_CANCEL, {});
  }

  selectAll(): void {
    if (this.scanResult) {
      this.scanResult.groups.forEach(group => {
        group.selectAll = true;
        group.items.forEach(item => item.selected = true);
      });
    }
  }

  deselectAll(): void {
    if (this.scanResult) {
      this.scanResult.groups.forEach(group => {
        group.selectAll = false;
        group.items.forEach(item => item.selected = false);
      });
    }
  }

  hasSelectedItems(): boolean {
    return this.selectedItemCount() > 0;
  }

  selectedItemCount(): number {
    if (!this.scanResult) {
      return 0;
    }
    return this.scanResult.groups.reduce((sum, group) =>
      sum + group.items.filter(item => item.selected).length, 0);
  }

  collectSelectedItems(): ExternalContentReference[] {
    if (!this.scanResult) {
      return [];
    }
    return this.scanResult.groups.flatMap(group =>
      group.items.filter(item => item.selected)
    );
  }

  onGroupChanged(group: ContentMigrationGroup): void {
    this.logger.debug("Group changed:", group.sourcePath);
  }

  onImportComplete(result: ExternalAlbumImportResult): void {
    this.logger.debug("External album import complete:", result);
    this.addLog(result.success ? "complete" : "error",
      result.success
        ? `Album "${result.albumName}" imported with ${result.photoCount} photos`
        : `Import failed: ${result.errorMessage}`);
  }

  private addLog(status: string, message: string): void {
    const now = this.dateUtils.dateTimeNowAsValue();
    this.logs = [{
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      status,
      time: now,
      message
    }, ...this.logs];
  }
}
