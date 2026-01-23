import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faPlay, faSpinner, faCheck, faTimes, faBan } from "@fortawesome/free-solid-svg-icons";
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
  ExternalImageReference,
  ImageMigrationActivityLog,
  ImageMigrationGroup,
  ImageMigrationProgress,
  ImageMigrationScanResult,
  ImageMigrationTab,
  RootFolder
} from "../../../../models/system.model";
import { NgSelectComponent } from "@ng-select/ng-select";
import { kebabCase, values } from "es-toolkit/compat";
import { ImageMigrationGroupComponent } from "./image-migration-group";
import { ActivatedRoute, Router } from "@angular/router";
import { StoredValue } from "../../../../models/ui-actions";
import { enumValueForKey } from "../../../../functions/enums";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { FileSizeSelectorComponent } from "../../../../carousel/edit/file-size-selector/file-size-selector";

@Component({
  selector: "app-image-migration-settings",
  template: `
    <app-page autoTitle>
      <tabset class="custom-tabset">
        <tab [active]="tabActive(ImageMigrationTab.SCAN)"
             (selectTab)="selectTab(ImageMigrationTab.SCAN)"
             heading="{{enumValueForKey(ImageMigrationTab, ImageMigrationTab.SCAN)}}">
          <div class="img-thumbnail thumbnail-admin-edit">
            <div class="row p-3">
              <div class="col-sm-12">
                <h5>Scan for External Images</h5>
                <p class="text-muted">Select a host to find images hosted externally that need to be migrated to S3.</p>
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
            </div>
            <div class="row p-3">
              <div class="col-sm-12">
                <app-badge-button [icon]="scanning ? faSpinner : faPlay"
                                  [disabled]="!hostPattern || scanning"
                                  (click)="runScan()"
                                  caption="Scan for External Images"/>
              </div>
            </div>
          </div>
        </tab>
        <tab [active]="tabActive(ImageMigrationTab.RESULTS)"
             (selectTab)="selectTab(ImageMigrationTab.RESULTS)"
             heading="{{enumValueForKey(ImageMigrationTab, ImageMigrationTab.RESULTS)}}">
          <div class="img-thumbnail thumbnail-admin-edit">
            @if (scanResult) {
              <div class="row p-3">
                <div class="col-sm-12">
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <strong>Found {{ stringUtils.pluraliseWithCount(scanResult.totalImages, "image") }}</strong> across
                      {{ stringUtils.pluraliseWithCount(scanResult.totalPages, "source") }}
                      <span class="text-muted">(scanned in {{ scanResult.scanDurationMs }}ms)</span>
                    </div>
                    <div>
                      <app-badge-button [icon]="faCheck" (click)="selectAll()" caption="Select All"/>
                      <app-badge-button [icon]="faTimes" (click)="deselectAll()" caption="Deselect All"/>
                      <app-badge-button [icon]="migrating ? faSpinner : faPlay"
                                        [disabled]="!hasSelectedImages() || migrating"
                                        (click)="runMigration()"
                                        [caption]="'Migrate ' + stringUtils.pluraliseWithCount(selectedImageCount(), 'Selected Image')"/>
                    </div>
                  </div>
                </div>
              </div>
              <div class="row p-3">
                <div class="col-sm-12">
                  <div class="migration-accordion">
                    @for (group of scanResult.groups; track group.sourcePath) {
                      <app-image-migration-group
                        [group]="group"
                        (groupChanged)="onGroupChanged($event)"/>
                    }
                  </div>
                </div>
              </div>
            } @else {
              <div class="row p-3">
                <div class="col-sm-12 text-center text-muted">
                  <p>No scan results yet. Use the Scan Configuration tab to scan for external images.</p>
                </div>
              </div>
            }
          </div>
        </tab>
        <tab [active]="tabActive(ImageMigrationTab.ACTIVITY)"
             (selectTab)="selectTab(ImageMigrationTab.ACTIVITY)"
             heading="{{enumValueForKey(ImageMigrationTab, ImageMigrationTab.ACTIVITY)}}">
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
                    {{ migrationProgress.processedImages }} / {{ migrationProgress.totalImages }} images
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
      </tabset>
    </app-page>
  `,
  styles: [`
    .migration-accordion
      border: 1px solid #dee2e6
      border-radius: 6px
      overflow: hidden

    .migration-accordion app-image-migration-group
      display: block
      border-bottom: 1px solid #dee2e6

    .migration-accordion app-image-migration-group:last-child
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
    ImageMigrationGroupComponent,
    FileSizeSelectorComponent
  ]
})
export class ImageMigrationSettingsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("ImageMigrationSettingsComponent", NgxLoggerLevel.ERROR);
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
  protected readonly ImageMigrationTab = ImageMigrationTab;
  protected readonly enumValueForKey = enumValueForKey;

  private tab: ImageMigrationTab = ImageMigrationTab.SCAN;

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

  scanning = false;
  migrating = false;
  cancelling = false;
  scanResult: ImageMigrationScanResult | null = null;
  migrationProgress: ImageMigrationProgress | null = null;

  activityTarget: AlertTarget = {};
  activityNotifier: AlertInstance;
  logs: ImageMigrationActivityLog[] = [];

  ngOnInit(): void {
    this.activityNotifier = this.notifierService.createAlertInstance(this.activityTarget);

    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      const defaultValue = kebabCase(ImageMigrationTab.SCAN);
      const tabParameter = params[StoredValue.TAB];
      const tab = tabParameter || defaultValue;
      this.logger.debug("received tab value of:", tabParameter, "defaultValue:", defaultValue, "selectTab:", tab);
      this.tab = tab as ImageMigrationTab;
    }));

    this.webSocketClientService.connect().then(() => {
      this.subscriptions.push(
        this.webSocketClientService.receiveMessages<any>(MessageType.PROGRESS).subscribe((data: any) => {
          const message = data?.message || JSON.stringify(data);
          this.addLog("info", message);

          if (data?.progress) {
            this.migrationProgress = data.progress;
            this.activityNotifier.warning({ title: "Migration Progress", message: `Currently migrating ${data.progress.currentImage}` });
          } else {
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
            this.activityNotifier.warning("Select a migration action on the Scan Configuration tab");
          } else {
            this.addLog("complete", message);
            this.activityNotifier.success({ title: "Complete", message });

            if (data?.scanResult) {
              this.scanResult = data.scanResult;
              this.scanning = false;
              this.selectTab(ImageMigrationTab.RESULTS);
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
    this.webSocketClientService.sendMessage(EventType.IMAGE_MIGRATION_SCAN_HOSTS, {});
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  selectTab(tab: ImageMigrationTab): void {
    this.tab = tab;
    this.router.navigate([], {
      queryParams: { [StoredValue.TAB]: kebabCase(tab) },
      queryParamsHandling: "merge",
      fragment: this.activatedRoute.snapshot.fragment
    });
  }

  tabActive(tab: ImageMigrationTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }

  runScan(): void {
    if (!this.hostPattern || this.scanning) {
      return;
    }

    this.scanning = true;
    this.scanResult = null;
    this.logs = [];
    this.selectTab(ImageMigrationTab.ACTIVITY);
    this.addLog("info", `Starting scan for host pattern: ${this.hostPattern}`);

    this.webSocketClientService.sendMessage(EventType.IMAGE_MIGRATION_SCAN, {
      hostPattern: this.hostPattern,
      scanAlbums: this.scanAlbums,
      scanPageContent: this.scanPageContent,
      scanGroupEvents: this.scanGroupEvents,
      scanSocialEvents: this.scanSocialEvents
    });
  }

  runMigration(): void {
    if (!this.hasSelectedImages() || this.migrating) {
      return;
    }

    this.migrating = true;
    this.migrationProgress = null;
    this.selectTab(ImageMigrationTab.ACTIVITY);
    this.addLog("info", `Starting migration of ${this.stringUtils.pluraliseWithCount(this.selectedImageCount(), "image")}`);

    const selectedImages = this.collectSelectedImages();
    this.webSocketClientService.sendMessage(EventType.IMAGE_MIGRATION_EXECUTE, {
      images: selectedImages,
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
    this.webSocketClientService.sendMessage(EventType.IMAGE_MIGRATION_CANCEL, {});
  }

  selectAll(): void {
    if (this.scanResult) {
      this.scanResult.groups.forEach(group => {
        group.selectAll = true;
        group.images.forEach(img => img.selected = true);
      });
    }
  }

  deselectAll(): void {
    if (this.scanResult) {
      this.scanResult.groups.forEach(group => {
        group.selectAll = false;
        group.images.forEach(img => img.selected = false);
      });
    }
  }

  hasSelectedImages(): boolean {
    return this.selectedImageCount() > 0;
  }

  selectedImageCount(): number {
    if (!this.scanResult) {
      return 0;
    }
    return this.scanResult.groups.reduce((sum, group) =>
      sum + group.images.filter(img => img.selected).length, 0);
  }

  collectSelectedImages(): ExternalImageReference[] {
    if (!this.scanResult) {
      return [];
    }
    return this.scanResult.groups.flatMap(group =>
      group.images.filter(img => img.selected)
    );
  }

  onGroupChanged(group: ImageMigrationGroup): void {
    this.logger.debug("Group changed:", group.sourcePath);
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
