import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faAdd, faClose, faPlay } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget, ALERT_SUCCESS, ALERT_ERROR } from "../../../../models/alert-target.model";
import { MigrationConfig, SiteMigrationConfig, ParentPageConfig } from "../../../../models/migration-config.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UrlService } from "../../../../services/url.service";
import { MigrationConfigService } from "../../../../services/migration/migration-config.service";
import { Subscription } from "rxjs";
import { PageComponent } from "../../../../page/page.component";
import { MarkdownEditorComponent } from "../../../../markdown-editor/markdown-editor.component";
import { BadgeButtonComponent } from "../../../../modules/common/badge-button/badge-button";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { NotifierService, AlertInstance } from "../../../../services/notifier.service";
import { ActivatedRoute, Router } from "@angular/router";
import { WebSocketClientService } from "../../../../services/websockets/websocket-client.service";
import { MessageType, EventType } from "../../../../models/websocket.model";
import { DisplayTimeWithSecondsPipe } from "../../../../pipes/display-time.pipe-with-seconds";
import { StatusIconComponent } from "../../../admin/status-icon";
import { sortBy } from "../../../../functions/arrays";

@Component({
  selector: "app-migration-settings",
  template: `
    <app-page autoTitle>
      <tabset class="custom-tabset">
        <tab [active]="activeTabId === MigrationTab.SETTINGS" (selectTab)="selectTab(MigrationTab.SETTINGS)" heading="Settings">
          <div class="row">
            <div class="col-sm-12">
              @if (migrationConfig) {
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="col-sm-12 mt-2 mb-2">
                    <app-markdown-editor category="admin" name="migration-settings-help" description="Migration settings help"></app-markdown-editor>
                  </div>
                  <div class="col-sm-12">
                    <app-badge-button [icon]="faAdd" (click)="addSite()" caption="Add new site"/>
                  </div>
                  <div class="col-sm-12">
                    @for (site of migrationConfig.sites; track site.name; let siteIndex = $index) {
                      <div class="row thumbnail-heading-frame">
                        <div class="thumbnail-heading">Site Configuration ({{ migrationConfig.sites.indexOf(site) + 1 }} of {{ migrationConfig.sites?.length || 0 }})
                          <div class="badge-button" (click)="deleteSite(site)" delay=500 tooltip="Delete site configuration">
                            <fa-icon [icon]="faClose"></fa-icon>
                          </div>
                        </div>
                        <div class="row">
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label [for]="stringUtils.kebabCase('site-name', siteIndex)">Site Name</label>
                              <input [id]="stringUtils.kebabCase('site-name', siteIndex)" type="text" class="form-control input-sm" placeholder="Enter site name" [(ngModel)]="site.name">
                            </div>
                          </div>
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label [for]="stringUtils.kebabCase('site-identifier', siteIndex)">Site Identifier</label>
                              <input [id]="stringUtils.kebabCase('site-identifier', siteIndex)" type="text" class="form-control input-sm" placeholder="Enter site identifier" [(ngModel)]="site.siteIdentifier">
                            </div>
                          </div>
                        </div>
                        <div class="row">
                          <div class="col-sm-12">
                            <div class="form-group">
                              <label [for]="stringUtils.kebabCase('base-url', siteIndex)">Base URL</label>
                              <input [id]="stringUtils.kebabCase('base-url', siteIndex)" type="text" class="form-control input-sm" placeholder="Enter base URL (e.g., https://www.example.com)" [(ngModel)]="site.baseUrl">
                            </div>
                          </div>
                        </div>
                        <div class="row">
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label [for]="stringUtils.kebabCase('menu-selector', siteIndex)">Menu Selector</label>
                              <input [id]="stringUtils.kebabCase('menu-selector', siteIndex)" type="text" class="form-control input-sm" placeholder="CSS selector for menu (e.g., .BMenu a)" [(ngModel)]="site.menuSelector">
                            </div>
                          </div>
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label [for]="stringUtils.kebabCase('content-selector', siteIndex)">Content Selector</label>
                              <input [id]="stringUtils.kebabCase('content-selector', siteIndex)" type="text" class="form-control input-sm" placeholder="CSS selector for content (e.g., table[width='1015px'] td)" [(ngModel)]="site.contentSelector">
                            </div>
                          </div>
                        </div>
                        <div class="row">
                          <div class="col-sm-12">
                            <div class="form-group">
                              <label [for]="stringUtils.kebabCase('gallery-path', siteIndex)">Gallery Path</label>
                              <input [id]="stringUtils.kebabCase('gallery-path', siteIndex)" type="text" class="form-control input-sm" placeholder="Path to gallery index (optional)" [(ngModel)]="site.galleryPath">
                            </div>
                          </div>
                        </div>
                        <div class="row">
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label [for]="stringUtils.kebabCase('exclude-selectors', siteIndex)">Exclude Selectors (optional)</label>
                              <textarea rows="3" class="form-control form-control-sm"
                                        [id]="stringUtils.kebabCase('exclude-selectors', siteIndex)"
                                        placeholder="Comma or newline separated CSS selectors"
                                        [(ngModel)]="site.excludeSelectors"></textarea>
                            </div>
                          </div>
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label [for]="stringUtils.kebabCase('exclude-patterns', siteIndex)">Exclude Text Patterns (regex)</label>
                              <textarea rows="3" class="form-control form-control-sm"
                                        [id]="stringUtils.kebabCase('exclude-patterns', siteIndex)"
                                        placeholder="One regex per line; matched blocks are removed from content"
                                        [(ngModel)]="site.excludeTextPatterns"></textarea>
                            </div>
                          </div>
                        </div>
                        <div class="row">
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label [for]="stringUtils.kebabCase('exclude-markdown-blocks', siteIndex)">Exclude Markdown Blocks</label>
                              <textarea rows="6" class="form-control form-control-sm"
                                        [id]="stringUtils.kebabCase('exclude-markdown-blocks', siteIndex)"
                                        placeholder="Paste exact markdown blocks from output to remove. Separate multiple blocks with a line containing three dashes (---)."
                                        [(ngModel)]="site.excludeMarkdownBlocks"></textarea>
                            </div>
                          </div>
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label [for]="stringUtils.kebabCase('exclude-image-urls', siteIndex)">Exclude Image URLs</label>
                              <textarea rows="4" class="form-control form-control-sm"
                                        [id]="stringUtils.kebabCase('exclude-image-urls', siteIndex)"
                                        placeholder="One URL per line; excluded images will not be used for action buttons"
                                        [(ngModel)]="site.excludeImageUrls"></textarea>
                            </div>
                          </div>
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label [for]="stringUtils.kebabCase('gallery-selector', siteIndex)">Gallery Selector</label>
                              <input [id]="stringUtils.kebabCase('gallery-selector', siteIndex)" type="text" class="form-control input-sm" placeholder="CSS selector for gallery links (optional)" [(ngModel)]="site.gallerySelector">
                            </div>
                          </div>
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label [for]="stringUtils.kebabCase('gallery-image-path', siteIndex)">Gallery Image Path</label>
                              <input [id]="stringUtils.kebabCase('gallery-image-path', siteIndex)" type="text" class="form-control input-sm" placeholder="Path segment for gallery images (optional)" [(ngModel)]="site.galleryImagePath">
                            </div>
                          </div>
                        </div>
                        <div class="row">
                          <div class="col-sm-12">
                            <div class="d-flex align-items-center">
                              <span>Specific Albums</span>
                              <div class="badge-button ms-2" (click)="addSpecificAlbum(site)" delay=500 tooltip="Add specific album">
                                <fa-icon [icon]="faAdd"></fa-icon>
                              </div>
                            </div>
                            @if (site.specificAlbums?.length) {
                              <div class="ms-3">
                                @for (album of site.specificAlbums; track album.path; let albumIndex = $index) {
                                  <div class="thumbnail-heading-frame mb-2">
                                    <div class="thumbnail-heading d-flex justify-content-between align-items-center">
                                      <span>Album {{ albumIndex + 1 }}</span>
                                      <div class="badge-button" (click)="deleteSpecificAlbum(site, album)" delay=500 tooltip="Delete specific album">
                                        <fa-icon [icon]="faClose"></fa-icon>
                                      </div>
                                    </div>
                                    <div class="row p-3">
                                      <div class="col-sm-6">
                                        <div class="form-group">
                                          <label [for]="stringUtils.kebabCase('album-path', siteIndex, albumIndex)">Album URL</label>
                                          <input [id]="stringUtils.kebabCase('album-path', siteIndex, albumIndex)" type="text" class="form-control form-control-sm" placeholder="Full URL to album" [(ngModel)]="album.path">
                                        </div>
                                      </div>
                                      <div class="col-sm-6">
                                        <div class="form-group">
                                          <label [for]="stringUtils.kebabCase('album-title', siteIndex, albumIndex)">Album Title</label>
                                          <input [id]="stringUtils.kebabCase('album-title', siteIndex, albumIndex)" type="text" class="form-control form-control-sm" placeholder="Title to use for album" [(ngModel)]="album.title">
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                }
                              </div>
                            }
                          </div>
                        </div>
                        <div class="row">
                          <div class="col-sm-12">
                            <div class="d-flex align-items-center">
                              <span>Parent Pages</span>
                              <div class="badge-button ms-2" (click)="addParentPage(site)" delay=500 tooltip="Add parent page">
                                <fa-icon [icon]="faAdd"></fa-icon>
                              </div>
                            </div>
                            @if (site.parentPages?.length) {
                              <div class="ms-3">
                                @for (parentPage of site.parentPages; track parentPage.url; let parentIndex = $index) {
                                  <div class="thumbnail-heading-frame mb-2">
                                    <div class="thumbnail-heading d-flex justify-content-between align-items-center">
                                      <span>Parent Page {{ parentIndex + 1 }}</span>
                                      <div class="badge-button" (click)="deleteParentPage(site, parentPage)" delay=500 tooltip="Delete parent page">
                                        <fa-icon [icon]="faClose"></fa-icon>
                                      </div>
                                    </div>
                                    <div class="row p-3">
                                      <div class="col-sm-6">
                                        <div class="form-group">
                                          <label [for]="stringUtils.kebabCase('parent-url', siteIndex, parentIndex)">Parent Page URL</label>
                                          <input [id]="stringUtils.kebabCase('parent-url', siteIndex, parentIndex)" type="text" class="form-control form-control-sm" placeholder="e.g., KentWalks/index.htm" [(ngModel)]="parentPage.url">
                                        </div>
                                      </div>
                                      <div class="col-sm-6">
                                        <div class="form-group">
                                          <label [for]="stringUtils.kebabCase('path-prefix', siteIndex, parentIndex)">Path Prefix</label>
                                          <input [id]="stringUtils.kebabCase('path-prefix', siteIndex, parentIndex)" type="text" class="form-control form-control-sm" placeholder="e.g., kent-walks" [(ngModel)]="parentPage.pathPrefix">
                                        </div>
                                      </div>
                                    </div>
                                    <div class="row p-3">
                                      <div class="col-sm-6">
                                        <div class="form-group">
                                          <label [for]="stringUtils.kebabCase('link-selector', siteIndex, parentIndex)">Link Selector (optional)</label>
                                          <input [id]="stringUtils.kebabCase('link-selector', siteIndex, parentIndex)" type="text" class="form-control form-control-sm" placeholder="Leave empty to use content area" [(ngModel)]="parentPage.linkSelector">
                                        </div>
                                      </div>
                                      <div class="col-sm-6">
                                        <div class="form-group">
                                          <label [for]="stringUtils.kebabCase('migrate-parent-mode', siteIndex, parentIndex)">Migrate parent page</label>
                                          <select class="form-select form-select-sm"
                                                  [id]="stringUtils.kebabCase('migrate-parent-mode', siteIndex, parentIndex)"
                                                  [(ngModel)]="parentPage.parentPageMode">
                                            <option [ngValue]="undefined">Not migrated</option>
                                            <option [ngValue]="'as-is'">As-is</option>
                                            <option [ngValue]="'action-buttons'">With Links as Action Buttons Row</option>
                                          </select>
                                        </div>
                                      </div>
                                    </div>
                                    <div class="row p-3">
                                      <div class="col-sm-6">
                                        <div class="form-group">
                                          <label [for]="stringUtils.kebabCase('max-children', siteIndex, parentIndex)">Max child pages (optional)</label>
                                          <input [id]="stringUtils.kebabCase('max-children', siteIndex, parentIndex)" type="number" min="0" class="form-control form-control-sm" placeholder="e.g., 5" [(ngModel)]="parentPage.maxChildren">
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                }
                              </div>
                            }
                          </div>
                        </div>
                        <div class="row p-3">
                          <div class="col-sm-3">
                            <div class="form-group">
                              <div class="form-check">
                                <input [(ngModel)]="site.useNestedRows" type="checkbox" class="form-check-input" [id]="stringUtils.kebabCase('use-nested-rows', siteIndex)">
                                <label class="form-check-label" [for]="stringUtils.kebabCase('use-nested-rows', siteIndex)">Use Nested Rows</label>
                              </div>
                            </div>
                          </div>
                          <div class="col-sm-3">
                            <div class="form-group">
                              <div class="form-check">
                                <input [(ngModel)]="site.persistData" type="checkbox" class="form-check-input" [id]="stringUtils.kebabCase('persist-data', siteIndex)">
                                <label class="form-check-label" [for]="stringUtils.kebabCase('persist-data', siteIndex)">Save to Database</label>
                              </div>
                            </div>
                          </div>
                          <div class="col-sm-3">
                            <div class="form-group">
                              <div class="form-check">
                                <input [(ngModel)]="site.uploadTos3" type="checkbox" class="form-check-input" [id]="stringUtils.kebabCase('upload-to-s3', siteIndex)">
                                <label class="form-check-label" [for]="stringUtils.kebabCase('upload-to-s3', siteIndex)">Upload Images to S3</label>
                              </div>
                            </div>
                          </div>
                          <div class="col-sm-3">
                            <div class="form-group">
                              <div class="form-check">
                                <input [(ngModel)]="site.enabled" type="checkbox" class="form-check-input" [id]="stringUtils.kebabCase('enabled', siteIndex)">
                                <label class="form-check-label" [for]="stringUtils.kebabCase('enabled', siteIndex)">Enabled</label>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div class="row p-3">
                          <div class="col-sm-12">
                            <app-badge-button [icon]="faPlay" (click)="runMigration(site)" [disabled]="!site.enabled" caption="Run Migration"/>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
              <div class="row">
                <div class="col-sm-12">
                  <input type="submit" value="Save settings and exit" (click)="saveAndExit()" [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-success me-2'" [disabled]="notReady()">
                  <input type="submit" value="Save" (click)="save()" [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-success me-2'" [disabled]="notReady()">
                  <input type="submit" value="Undo Changes" (click)="undoChanges()" [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-primary me-2'" [disabled]="notReady()">
                  <input type="submit" value="Exit Without Saving" (click)="cancel()" [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-primary me-2'" [disabled]="notReady()">
                </div>
              </div>
            </div>
          </div>
        </tab>
        <tab [active]="activeTabId === MigrationTab.ACTIVITY" (selectTab)="selectTab(MigrationTab.ACTIVITY)" heading="Activity">
          <div class="img-thumbnail thumbnail-admin-edit">
            @if (activityTarget.showAlert) {
              <div class="row p-3">
                <div class="col-sm-12">
                    <div class="alert {{activityTarget.alert.class}}">
                      <fa-icon [icon]="activityTarget.alert.icon"></fa-icon>
                      @if (activityTarget.alertTitle) {
                        <strong>{{ activityTarget.alertTitle }}: </strong>
                      } {{ activityTarget.alertMessage }}
                    </div>
                </div>
              </div>
            }
            <div class="row p-3">
              <div class="col-sm-12">
                <div class="d-none d-md-block">
                  <div class="audit-table-scroll">
                    <table class="round styled-table table-striped table-hover table-sm table-pointer">
                      <thead>
                      <tr>
                        <th (click)="sortLogsBy('status')"><span class="nowrap">Status @if (logSortField === 'status') {<span class="sorting-header">{{ logSortDirection === 'DESC' ? '▼' : '▲' }}</span>}</span></th>
                        <th (click)="sortLogsBy('time')"><span class="nowrap">Time @if (logSortField === 'time') {<span class="sorting-header">{{ logSortDirection === 'DESC' ? '▼' : '▲' }}</span>}</span></th>
                        <th (click)="sortLogsBy('message')"><span class="nowrap">Message @if (logSortField === 'message') {<span class="sorting-header">{{ logSortDirection === 'DESC' ? '▼' : '▲' }}</span>}</span></th>
                      </tr>
                      </thead>
                      <tbody>
                      @for (log of filteredLogs; track log.id) {
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
                <div class="d-md-none">
                  @for (log of filteredLogs; track log.id) {
                    <div class="border rounded p-2 mb-2">
                      <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                        <app-status-icon noLabel [status]="log.status"/>
                        <span class="fw-semibold">{{ log.time | displayTimeWithSeconds }}</span>
                      </div>
                      <div class="text-break">{{ log.message }}</div>
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
  `],
  imports: [PageComponent, MarkdownEditorComponent, BadgeButtonComponent, TooltipDirective, FontAwesomeModule, FormsModule, NgClass, TabsetComponent, TabDirective, DisplayTimeWithSecondsPipe, StatusIconComponent]
})
export class MigrationSettingsComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("MigrationSettingsComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  private urlService = inject(UrlService);
  private migrationConfigService = inject(MigrationConfigService);
  private notifierService = inject(NotifierService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private subscription: Subscription;
  private subscriptions: Subscription[] = [];
  public notifyTarget: AlertTarget = {};
  public activityTarget: AlertTarget = {};
  public migrationConfig: MigrationConfig;
  protected readonly faClose = faClose;
  protected readonly faAdd = faAdd;
  protected readonly faPlay = faPlay;
  public activityMessages: string[] = [];
  public activityNotifier: AlertInstance;
  public MigrationTab = { SETTINGS: "settings", ACTIVITY: "activity" } as const;
  public activeTabId: string = this.MigrationTab.SETTINGS;
  private webSocketClientService: WebSocketClientService = inject(WebSocketClientService);
  public logs: { id: string; status: string; time: number; message: string }[] = [];
  public filteredLogs: { id: string; status: string; time: number; message: string }[] = [];
  public logSortField: string = "time";
  public logReverseSort: boolean = true;
  public logSortDirection: string = "DESC";

  ngOnInit() {
    this.subscription = this.migrationConfigService.migrationConfigEvents().subscribe(migrationConfig => {
      this.migrationConfig = migrationConfig;
      this.logger.info("retrieved migrationConfig", migrationConfig);
    });
    this.activityNotifier = this.notifierService.createAlertInstance(this.activityTarget);
    this.route.queryParams.subscribe(params => {
      const tab = params["tab"];
      this.activeTabId = tab && Object.values(this.MigrationTab).includes(tab) ? tab : this.MigrationTab.SETTINGS;
    });
    this.webSocketClientService.connect().then(() => {
      this.subscriptions.push(this.webSocketClientService.receiveMessages<any>(MessageType.PROGRESS).subscribe((data: any) => {
        const message = data?.message || data?.response || JSON.stringify(data);
        if (message) {
          this.activityMessages.push(message);
          this.activityNotifier.warning(message);
          this.addLog("info", message);
        }
      }));
      this.subscriptions.push(this.webSocketClientService.receiveMessages(MessageType.ERROR).subscribe((error: any) => {
        const message = error?.message || JSON.stringify(error);
        this.activityNotifier.error({ title: "Migration Failed", message });
        this.activityMessages.push(message);
        this.addLog("error", message);
      }));
      this.subscriptions.push(this.webSocketClientService.receiveMessages(MessageType.COMPLETE).subscribe((message: any) => {
        const text = message?.response || JSON.stringify(message);
        this.activityNotifier.success({ title: "Migration Complete", message: text });
        this.activityMessages.push(text);
        this.addLog("complete", text);
      }));
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  saveAndExit() {
    this.save()
      .then(() => this.urlService.navigateTo(["admin"]))
      .catch((error) => this.logger.error(error));
  }

  save() {
    this.logger.info("saving config", this.migrationConfig);
    return this.migrationConfigService.saveConfig(this.migrationConfig);
  }

  cancel() {
    this.undoChanges();
    this.urlService.navigateTo(["admin"]);
  }

  notReady() {
    return !this.migrationConfig;
  }

  deleteSite(site: SiteMigrationConfig) {
    this.migrationConfig.sites = this.migrationConfig.sites.filter(item => item !== site);
  }

  addSite() {
    this.migrationConfig.sites.push(this.migrationConfigService.emptySiteMigrationConfig());
  }

  addParentPage(site: SiteMigrationConfig) {
    if (!site.parentPages) {
      site.parentPages = [];
    }
    site.parentPages.push({
      url: "",
      pathPrefix: "",
      linkSelector: "",
      migrateParent: false,
      maxChildren: undefined
    });
  }

  deleteParentPage(site: SiteMigrationConfig, parentPage: ParentPageConfig) {
    if (site.parentPages) {
      site.parentPages = site.parentPages.filter(item => item !== parentPage);
    }
  }

  addSpecificAlbum(site: SiteMigrationConfig) {
    if (!site.specificAlbums) {
      site.specificAlbums = [];
    }
    site.specificAlbums.push({ path: "", title: "" });
  }

  deleteSpecificAlbum(site: SiteMigrationConfig, album: { path: string; title: string }) {
    if (site.specificAlbums) {
      site.specificAlbums = site.specificAlbums.filter(item => item !== album);
    }
  }

  undoChanges() {
    this.migrationConfigService.refreshConfig();
  }

  runMigration(site: SiteMigrationConfig) {
    if (!site.enabled) {
      this.logger.warn("Site is disabled:", site.name);
      return;
    }

    const siteName = encodeURIComponent(site.name);
    const persistData = site.persistData || false;
    const uploadTos3 = site.uploadTos3 || false;
    this.activityMessages = [];
    this.selectTab(this.MigrationTab.ACTIVITY);
    this.activityNotifier.warning({ title: "Migration", message: `Starting migration for ${site.name}` }, false, true);
    this.activityMessages.push(`Started migration for ${site.name}`);
    this.logs = [];
    this.filteredLogs = [];
    this.addLog("info", `Starting migration for ${site.name}`);
    this.webSocketClientService.connect().then(() => {
      this.webSocketClientService.sendMessage(EventType.SITE_MIGRATION, { siteName, persistData, uploadTos3, siteConfig: site });
    });
  }

  selectTab(tab: string): void {
    this.activeTabId = tab;
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: this.activeTabId }, queryParamsHandling: "merge" });
  }

  private addLog(status: string, message: string): void {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, status, time: Date.now(), message };
    this.logs = [entry, ...this.logs];
    this.applyLogSorting();
  }

  sortLogsBy(field: string): void {
    if (this.logSortField === field) {
      this.logReverseSort = !this.logReverseSort;
    } else {
      this.logReverseSort = true;
    }
    this.logSortField = field;
    this.logSortDirection = this.logReverseSort ? "DESC" : "ASC";
    this.applyLogSorting();
  }

  private applyLogSorting(): void {
    const prefix = this.logReverseSort ? "-" : "";
    this.filteredLogs = this.logs.slice().sort(sortBy(`${prefix}${this.logSortField}`));
  }
}
