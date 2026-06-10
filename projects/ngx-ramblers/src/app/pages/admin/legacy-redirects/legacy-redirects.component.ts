import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { LegacyUrlMappingService } from "../../../services/legacy-redirect/legacy-url-mapping.service";
import { LegacyScrapeRunService } from "../../../services/legacy-redirect/legacy-scrape-run.service";
import {
  LegacyRedirectSummary,
  LegacyScrapeRun,
  LegacyUrlMapping,
  LegacyUrlMappingApiResponse,
  RedirectConfidence,
  RedirectMappingStatus,
  SortDirection
} from "../../../models/legacy-url-redirect.model";
import { ActivatedRoute, Router } from "@angular/router";
import { StoredValue } from "../../../models/ui-actions";
import { StringUtilsService } from "../../../services/string-utils.service";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { PageComponent } from "../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { NgSelectComponent } from "@ng-select/ng-select";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective, SortableTableExpandedRowDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableAlignment, SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import {
  faCheck,
  faEdit,
  faEyeSlash,
  faPlay,
  faSpinner,
  faTrash,
  faCheckDouble,
  faSearch,
  faRobot,
  faBolt,
  faExternalLinkAlt
} from "@fortawesome/free-solid-svg-icons";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { EventType, MessageType } from "../../../models/websocket.model";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { isArray, values } from "es-toolkit/compat";
import { DateUtilsService } from "../../../services/date-utils.service";

@Component({
  selector: "app-legacy-redirects",
  standalone: true,
  imports: [
    PageComponent,
    TabsetComponent,
    TabDirective,
    FontAwesomeModule,
    FormsModule,
    NgClass,
    NgSelectComponent,
    SortableTableComponent,
    SortableTableCellDirective,
    SortableTableExpandedRowDirective,
    BsDropdownDirective,
    BsDropdownMenuDirective,
    BsDropdownToggleDirective
  ],
  styleUrls: ["./legacy-redirects.component.sass"],
  template: `
    <app-page autoTitle>
      <tabset class="custom-tabset">
        <tab heading="Mappings" (selectTab)="selectTab('mappings')">
          <div class="img-thumbnail thumbnail-admin-edit mt-2">
            <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
              <div class="flex-grow-1">
                <ng-select [items]="statusOptions" bindLabel="label" bindValue="value"
                           [(ngModel)]="filterStatus" (ngModelChange)="filtersChanged()"
                           placeholder="Filter by status" [clearable]="true"></ng-select>
              </div>
              <div class="flex-grow-1">
                <ng-select [items]="confidenceOptions" bindLabel="label" bindValue="value"
                           [(ngModel)]="filterConfidence" (ngModelChange)="filtersChanged()"
                           placeholder="Filter by confidence" [clearable]="true"></ng-select>
              </div>
              <div class="flex-grow-1">
                <input type="text" class="form-control" [(ngModel)]="searchText"
                       (ngModelChange)="filtersChanged()" placeholder="Search URLs or titles..."/>
              </div>
              <div class="btn-group" dropdown container="body" placement="bottom right">
                <button class="btn btn-sm btn-primary dropdown-toggle text-nowrap" dropdownToggle type="button"
                        [disabled]="busy">
                  <fa-icon [icon]="faBolt"></fa-icon> Actions
                </button>
                <ul *dropdownMenu class="dropdown-menu dropdown-menu-end">
                  <li>
                    <a class="dropdown-item" (click)="bulkAcceptHighConfidence()">
                      <fa-icon [icon]="faCheckDouble" class="me-2"></fa-icon>Bulk Accept High
                    </a>
                  </li>
                  <li>
                    <a class="dropdown-item" [class.disabled]="!scrapeDomain" (click)="scrapeDomain && runAutoMap()">
                      <fa-icon [icon]="faRobot" class="me-2"></fa-icon>Auto-Map
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div class="d-flex flex-wrap align-items-center gap-2 mb-2 bulk-bar">
              <div class="form-check mb-0">
                <input type="checkbox" class="form-check-input" id="select-all-mappings"
                       [checked]="allFilteredSelected()" (change)="toggleSelectAll()"/>
                <label class="form-check-label" for="select-all-mappings">
                  Select all ({{ filteredMappings.length }})
                </label>
              </div>
              @if (selectedIds.size > 0) {
                <span class="text-muted small">{{ selectedIds.size }} selected</span>
                <button class="btn btn-sm btn-success" (click)="bulkApplyStatus(RedirectMappingStatus.ACCEPTED)"
                        [disabled]="busy">
                  <fa-icon [icon]="faCheck"></fa-icon> Accept Selected
                </button>
                <button class="btn btn-sm btn-secondary" (click)="bulkApplyStatus(RedirectMappingStatus.IGNORED)"
                        [disabled]="busy">
                  <fa-icon [icon]="faEyeSlash"></fa-icon> Ignore Selected
                </button>
                <button class="btn btn-sm" [ngClass]="bulkDeleteArmed ? 'btn-danger' : 'action-btn-danger'"
                        (click)="bulkDelete()" [disabled]="busy">
                  <fa-icon [icon]="faTrash"></fa-icon>
                  {{ bulkDeleteArmed ? "Confirm Delete " + selectedIds.size : "Delete Selected" }}
                </button>
                @if (bulkDeleteArmed) {
                  <button class="btn btn-sm btn-secondary" (click)="disarmBulkDelete()">Cancel</button>
                }
                <button class="btn btn-sm btn-outline-secondary" (click)="clearSelection()">Clear</button>
              }
            </div>

            <app-sortable-table
              [columns]="mappingColumns"
              [rows]="filteredMappings"
              [defaultSortKey]="sortKey"
              [defaultSortDirection]="sortDirection"
              (sortChange)="onSortChange($event)"
              [expandedWhen]="rowIsEditing"
              [maxHeight]="'calc(100vh - 420px)'"
              emptyMessage="No mappings found. Run a scrape to discover legacy URLs.">
              <ng-template appSortableTableCell="select" let-row>
                <input type="checkbox" class="form-check-input" [checked]="isSelected(row)"
                       (change)="toggleSelection(row)"/>
              </ng-template>
              <ng-template appSortableTableCell="legacyUrl" let-row>
                <a [href]="row.legacyFullUrl" target="_blank" rel="noopener noreferrer">
                  <span class="text-muted small">{{ row.legacyDomain }}</span><br/>
                  {{ row.legacyPath }}
                </a>
              </ng-template>
              <ng-template appSortableTableCell="title" let-row>{{ row.title || "-" }}</ng-template>
              <ng-template appSortableTableCell="targetUrl" let-row>
                @if (row.targetPath) {
                  <a [href]="targetHref(row)" target="_blank" rel="noopener noreferrer">{{ row.targetPath }}</a>
                } @else {
                  -
                }
              </ng-template>
              <ng-template appSortableTableCell="confidence" let-row>
                <span class="confidence-badge" [ngClass]="row.confidence">{{ row.confidence }}</span>
              </ng-template>
              <ng-template appSortableTableCell="status" let-row>
                <span class="status-badge" [ngClass]="row.status">{{ row.status }}</span>
              </ng-template>
              <ng-template appSortableTableCell="hits" let-row>{{ row.hitCount || 0 }}</ng-template>
              <ng-template appSortableTableCell="actions" let-row>
                <div class="d-flex gap-1">
                  @if (editingId === row.id) {
                    <button class="btn btn-sm action-btn btn-success" (click)="saveEdit(row)" title="Save">
                      <fa-icon [icon]="faCheck"></fa-icon>
                    </button>
                    <button class="btn btn-sm action-btn btn-secondary" (click)="cancelEdit()" title="Cancel">
                      <fa-icon [icon]="faEyeSlash"></fa-icon>
                    </button>
                  } @else {
                    <button class="btn btn-sm action-btn btn-success" (click)="acceptMapping(row)"
                            [disabled]="!row.targetPath || row.status === 'accepted'" title="Accept">
                      <fa-icon [icon]="faCheck"></fa-icon>
                    </button>
                    <button class="btn btn-sm action-btn action-btn-warning" (click)="startEdit(row)" title="Edit">
                      <fa-icon [icon]="faEdit"></fa-icon>
                    </button>
                    <button class="btn btn-sm action-btn action-btn-warning" (click)="ignoreMapping(row)"
                            [disabled]="row.status === 'ignored'" title="Ignore">
                      <fa-icon [icon]="faEyeSlash"></fa-icon>
                    </button>
                    <button class="btn btn-sm action-btn action-btn-danger" (click)="deleteMapping(row)" title="Delete">
                      <fa-icon [icon]="faTrash"></fa-icon>
                    </button>
                  }
                </div>
              </ng-template>
              <ng-template appSortableTableExpandedRow let-row>
                <div class="d-flex align-items-center gap-2">
                  <label class="form-label fw-bold mb-0 text-nowrap">Target URL</label>
                  <div class="flex-grow-1">
                    <ng-select class="target-url-select" [items]="targetUrlOptions" bindLabel="path" bindValue="path"
                               [(ngModel)]="editTargetPath"
                               [appendTo]="'body'"
                               [dropdownPosition]="'bottom'"
                               [virtualScroll]="true"
                               [addTag]="true" addTagText="Use custom path"
                               placeholder="Select or type target URL"></ng-select>
                  </div>
                </div>
              </ng-template>
            </app-sortable-table>
          </div>
        </tab>

        <tab heading="Scrape" (selectTab)="selectTab('scrape')">
          <div class="img-thumbnail thumbnail-admin-edit mt-2">
            <div class="row mb-3">
              <div class="col-sm-6">
                <label class="form-label fw-bold">Legacy Domain</label>
                <input type="text" class="form-control" [(ngModel)]="scrapeDomain"
                       placeholder="e.g. www.kentramblers.org.uk"/>
              </div>
              <div class="col-sm-3 d-flex align-items-end">
                <button class="btn btn-primary" (click)="runScrape()" [disabled]="scraping || !scrapeDomain">
                  <fa-icon [icon]="scraping ? faSpinner : faPlay"></fa-icon>
                  {{ scraping ? "Scraping..." : "Run Scrape" }}
                </button>
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-sm-3">
                <label class="form-label">Max Pages</label>
                <input type="number" class="form-control" [(ngModel)]="scrapeMaxPages" min="1" max="10000"/>
              </div>
              <div class="col-sm-3">
                <label class="form-label">Delay (ms)</label>
                <input type="number" class="form-control" [(ngModel)]="scrapeDelayMs" min="0" max="5000"/>
              </div>
              <div class="col-sm-3 d-flex align-items-end">
                <div class="form-check">
                  <input type="checkbox" class="form-check-input" [(ngModel)]="respectRobotsTxt"
                         id="respectRobots"/>
                  <label class="form-check-label" for="respectRobots">Respect robots.txt</label>
                </div>
              </div>
            </div>

            @if (scraping) {
              <div class="scrape-progress">
                <div class="progress">
                  <div class="progress-bar progress-bar-striped progress-bar-animated"
                       [style.width.%]="scrapePercent">
                    {{ scrapePercent }}%
                  </div>
                </div>
                <div class="progress-message">{{ scrapeMessage }}</div>
              </div>
            }

            @if (scrapeRuns.length > 0) {
              <h5 class="mt-4">Scrape History</h5>
              <table class="table table-striped table-sm">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Started</th>
                    <th>Status</th>
                    <th>URLs Discovered</th>
                    <th>Mapped</th>
                    <th>Unmapped</th>
                  </tr>
                </thead>
                <tbody>
                  @for (run of scrapeRuns; track run.id) {
                    <tr>
                      <td>{{ run.legacyDomain }}</td>
                      <td>{{ dateUtils.displayDateAndTime(run.startedDate) }}</td>
                      <td>
                        <span class="status-badge" [ngClass]="run.status">{{ run.status }}</span>
                      </td>
                      <td>{{ run.urlsDiscovered }}</td>
                      <td>{{ run.urlsMapped }}</td>
                      <td>{{ run.urlsUnmapped }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </tab>

        <tab heading="Summary" (selectTab)="selectTab('summary')">
          <div class="img-thumbnail thumbnail-admin-edit mt-2">
            @if (summary) {
              <div class="progress-summary">
                <div class="stat-card">
                  <div class="stat-value">{{ summary.total }}</div>
                  <div class="stat-label">Total URLs</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ mappedCount }}</div>
                  <div class="stat-label">Mapped</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ summary.byConfidence?.unmapped || 0 }}</div>
                  <div class="stat-label">Unmapped</div>
                </div>
              </div>

              @if (summary.total > 0) {
                <div class="progress mb-4" style="height: 24px">
                  <div class="progress-bar bg-success" [style.width.%]="acceptedPercent"
                       title="Accepted">
                    {{ summary.byStatus?.accepted || 0 }} accepted
                  </div>
                  <div class="progress-bar bg-warning" [style.width.%]="pendingPercent"
                       title="Pending">
                    {{ summary.byStatus?.pending || 0 }} pending
                  </div>
                  <div class="progress-bar bg-secondary" [style.width.%]="ignoredPercent"
                       title="Ignored">
                    {{ summary.byStatus?.ignored || 0 }} ignored
                  </div>
                </div>
              }

              <div class="row">
                <div class="col-sm-6">
                  <h5>By Confidence</h5>
                  <table class="table table-sm">
                    <tbody>
                      <tr>
                        <td><span class="confidence-badge high">High</span></td>
                        <td>{{ summary.byConfidence?.high || 0 }}</td>
                      </tr>
                      <tr>
                        <td><span class="confidence-badge medium">Medium</span></td>
                        <td>{{ summary.byConfidence?.medium || 0 }}</td>
                      </tr>
                      <tr>
                        <td><span class="confidence-badge low">Low</span></td>
                        <td>{{ summary.byConfidence?.low || 0 }}</td>
                      </tr>
                      <tr>
                        <td><span class="confidence-badge unmapped">Unmapped</span></td>
                        <td>{{ summary.byConfidence?.unmapped || 0 }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="col-sm-6">
                  <h5>By Status</h5>
                  <table class="table table-sm">
                    <tbody>
                      <tr>
                        <td><span class="status-badge accepted">Accepted</span></td>
                        <td>{{ summary.byStatus?.accepted || 0 }}</td>
                      </tr>
                      <tr>
                        <td><span class="status-badge pending">Pending</span></td>
                        <td>{{ summary.byStatus?.pending || 0 }}</td>
                      </tr>
                      <tr>
                        <td><span class="status-badge ignored">Ignored</span></td>
                        <td>{{ summary.byStatus?.ignored || 0 }}</td>
                      </tr>
                      <tr>
                        <td><span class="status-badge rejected">Rejected</span></td>
                        <td>{{ summary.byStatus?.rejected || 0 }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            } @else {
              <div class="alert alert-warning text-center">
                No mapping data available. Run a scrape first.
              </div>
            }
          </div>
        </tab>
      </tabset>
    </app-page>
  `
})
export class LegacyRedirectsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("LegacyRedirectsComponent", NgxLoggerLevel.ERROR);
  private legacyUrlMappingService = inject(LegacyUrlMappingService);
  private legacyScrapeRunService = inject(LegacyScrapeRunService);
  private webSocketClientService = inject(WebSocketClientService);
  private notifierService = inject(NotifierService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private stringUtils = inject(StringUtilsService);
  dateUtils = inject(DateUtilsService);
  private subscriptions: Subscription[] = [];
  private notifyTarget: AlertTarget = {};
  private notify: AlertInstance;

  faCheck = faCheck;
  faEdit = faEdit;
  faEyeSlash = faEyeSlash;
  faPlay = faPlay;
  faSpinner = faSpinner;
  faTrash = faTrash;
  faCheckDouble = faCheckDouble;
  faSearch = faSearch;
  faRobot = faRobot;
  faBolt = faBolt;
  faExternalLinkAlt = faExternalLinkAlt;

  allMappings: LegacyUrlMapping[] = [];
  filteredMappings: LegacyUrlMapping[] = [];
  scrapeRuns: LegacyScrapeRun[] = [];
  summary: LegacyRedirectSummary | null = null;
  targetUrlOptions: { path: string; source: string }[] = [];

  filterStatus: string | null = null;
  filterConfidence: string | null = null;
  searchText = "";
  sortKey = "legacyPath";
  sortDirection: string = ASCENDING;

  protected readonly mappingColumns: SortableTableColumn<LegacyUrlMapping>[] = [
    {key: "select", label: ""},
    {key: "legacyUrl", label: "Legacy URL", sortKey: "legacyPath", cellClass: "legacy-url-cell"},
    {key: "title", label: "Title", sortKey: "title", cellClass: "title-cell"},
    {key: "targetUrl", label: "Target URL", sortKey: "targetPath", cellClass: "target-url-cell"},
    {key: "confidence", label: "Confidence", sortKey: "confidence", cellClass: "badge-cell"},
    {key: "status", label: "Status", sortKey: "status", cellClass: "badge-cell"},
    {key: "hits", label: "Hits", sortKey: "hitCount", align: SortableTableAlignment.CENTER},
    {key: "actions", label: "Actions"}
  ];

  editingId: string | null = null;
  editTargetPath = "";
  busy = false;
  selectedIds = new Set<string>();
  bulkDeleteArmed = false;
  protected readonly RedirectMappingStatus = RedirectMappingStatus;
  rowIsEditing = (row: LegacyUrlMapping): boolean => row.id === this.editingId;

  scrapeDomain = "";
  scrapeMaxPages = 500;
  scrapeDelayMs = 500;
  respectRobotsTxt = true;
  scraping = false;
  scrapePercent = 0;
  scrapeMessage = "";

  statusOptions = values(RedirectMappingStatus).map(s => ({ label: s, value: s }));
  confidenceOptions = values(RedirectConfidence).map(c => ({ label: c, value: c }));

  get mappedCount(): number {
    return (this.summary?.total || 0) - (this.summary?.byConfidence?.unmapped || 0);
  }

  get acceptedPercent(): number {
    return this.summary?.total ? ((this.summary.byStatus?.accepted || 0) / this.summary.total) * 100 : 0;
  }

  get pendingPercent(): number {
    return this.summary?.total ? ((this.summary.byStatus?.pending || 0) / this.summary.total) * 100 : 0;
  }

  get ignoredPercent(): number {
    return this.summary?.total ? ((this.summary.byStatus?.ignored || 0) / this.summary.total) * 100 : 0;
  }

  ngOnInit(): void {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.restoreStateFromUrl();
    this.subscriptions.push(
      this.legacyUrlMappingService.notifications().subscribe((response: LegacyUrlMappingApiResponse) => {
        this.logger.debug("mapping notification received:", response);
        if (isArray(response.response)) {
          this.allMappings = response.response;
          this.applyFilters();
        }
      })
    );
    this.subscriptions.push(
      this.legacyScrapeRunService.notifications().subscribe((response: any) => {
        if (isArray(response.response)) {
          this.scrapeRuns = response.response;
        }
      })
    );
    this.connectWebSocket();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private async connectWebSocket(): Promise<void> {
    try {
      await this.webSocketClientService.connect();
      this.subscriptions.push(
        this.webSocketClientService.receiveMessages<any>(MessageType.PROGRESS).subscribe(data => {
          this.scrapeMessage = data.message || "";
          if (data.percent !== undefined) {
            this.scrapePercent = data.percent;
          }
        })
      );
      this.subscriptions.push(
        this.webSocketClientService.receiveMessages<any>(MessageType.COMPLETE).subscribe(data => {
          this.scraping = false;
          this.scrapeMessage = data.message || "Scrape complete";
          this.scrapePercent = 100;
          this.loadData();
        })
      );
      this.subscriptions.push(
        this.webSocketClientService.receiveMessages<any>(MessageType.ERROR).subscribe(data => {
          this.scraping = false;
          this.scrapeMessage = data.message || "Scrape failed";
          this.logger.error("scrape error:", data);
        })
      );
    } catch (error) {
      this.logger.error("WebSocket connection failed:", error);
    }
  }

  private loadData(): void {
    this.legacyUrlMappingService.all({ sort: { legacyPath: 1 } });
    this.legacyScrapeRunService.all({ sort: { startedDate: -1 } });
    this.loadSummary();
    this.loadTargetUrls();
  }

  private async loadSummary(): Promise<void> {
    try {
      this.summary = await this.legacyUrlMappingService.summary(this.scrapeDomain || undefined);
    } catch (error) {
      this.logger.error("failed to load summary:", error);
    }
  }

  private async loadTargetUrls(): Promise<void> {
    try {
      this.targetUrlOptions = await this.legacyUrlMappingService.targetUrls();
    } catch (error) {
      this.logger.error("failed to load target URLs:", error);
    }
  }

  selectTab(tab: string): void {
    this.logger.debug("selected tab:", tab);
    if (tab === "summary") {
      this.loadSummary();
    }
  }

  private restoreStateFromUrl(): void {
    const queryParams = this.activatedRoute.snapshot.queryParams;
    this.filterStatus = queryParams[StoredValue.STATUS] || null;
    this.filterConfidence = queryParams[StoredValue.CONFIDENCE] || null;
    this.searchText = queryParams[StoredValue.SEARCH] || "";
    const sortParam = queryParams[StoredValue.SORT];
    const matchedSortKey = this.mappingColumns
      .map(column => column.sortKey)
      .filter(Boolean)
      .find(key => this.stringUtils.kebabCase(key) === sortParam);
    if (matchedSortKey) {
      this.sortKey = matchedSortKey;
    }
    if (queryParams[StoredValue.SORT_ORDER] === SortDirection.DESC) {
      this.sortDirection = DESCENDING;
    }
  }

  private replaceQueryParams(params: Record<string, string | null>): void {
    this.router.navigate([], {queryParams: params, queryParamsHandling: "merge", replaceUrl: true});
  }

  filtersChanged(): void {
    this.replaceQueryParams({
      [StoredValue.STATUS]: this.filterStatus || null,
      [StoredValue.CONFIDENCE]: this.filterConfidence || null,
      [StoredValue.SEARCH]: this.searchText || null
    });
    this.applyFilters();
  }

  onSortChange(sortState: SortableTableSortState): void {
    this.sortKey = sortState.key;
    this.sortDirection = sortState.direction;
    this.replaceQueryParams({
      [StoredValue.SORT]: sortState.key ? this.stringUtils.kebabCase(sortState.key) : null,
      [StoredValue.SORT_ORDER]: sortState.direction === DESCENDING ? SortDirection.DESC : SortDirection.ASC
    });
  }

  applyFilters(): void {
    let result = [...this.allMappings];

    if (this.filterStatus) {
      result = result.filter(m => m.status === this.filterStatus);
    }
    if (this.filterConfidence) {
      result = result.filter(m => m.confidence === this.filterConfidence);
    }
    if (this.searchText) {
      const search = this.searchText.toLowerCase();
      result = result.filter(m =>
        (m.legacyPath || "").toLowerCase().includes(search) ||
        (m.title || "").toLowerCase().includes(search) ||
        (m.targetPath || "").toLowerCase().includes(search) ||
        (m.legacyDomain || "").toLowerCase().includes(search)
      );
    }

    this.filteredMappings = result;
  }

  async acceptMapping(mapping: LegacyUrlMapping): Promise<void> {
    mapping.status = RedirectMappingStatus.ACCEPTED;
    await this.legacyUrlMappingService.update(mapping);
    this.applyFilters();
    this.loadSummary();
  }

  async ignoreMapping(mapping: LegacyUrlMapping): Promise<void> {
    mapping.status = RedirectMappingStatus.IGNORED;
    await this.legacyUrlMappingService.update(mapping);
    this.applyFilters();
    this.loadSummary();
  }

  async deleteMapping(mapping: LegacyUrlMapping): Promise<void> {
    await this.legacyUrlMappingService.delete(mapping);
    this.allMappings = this.allMappings.filter(m => m.id !== mapping.id);
    this.applyFilters();
    this.loadSummary();
  }

  startEdit(mapping: LegacyUrlMapping): void {
    this.editingId = mapping.id;
    this.editTargetPath = mapping.targetPath || "";
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editTargetPath = "";
  }

  targetHref(mapping: LegacyUrlMapping): string {
    return `/${(mapping.targetPath || "").replace(/^\/+/, "")}`;
  }

  async saveEdit(mapping: LegacyUrlMapping): Promise<void> {
    mapping.targetPath = (this.editTargetPath || "").replace(/^\/+/, "");
    mapping.matchMethod = "manual" as any;
    mapping.confidence = mapping.targetPath ? RedirectConfidence.HIGH : RedirectConfidence.UNMAPPED;
    await this.legacyUrlMappingService.update(mapping);
    this.editingId = null;
    this.editTargetPath = "";
    this.applyFilters();
    this.loadSummary();
  }

  isSelected(mapping: LegacyUrlMapping): boolean {
    return this.selectedIds.has(mapping.id);
  }

  toggleSelection(mapping: LegacyUrlMapping): void {
    if (this.selectedIds.has(mapping.id)) {
      this.selectedIds.delete(mapping.id);
    } else {
      this.selectedIds.add(mapping.id);
    }
    this.bulkDeleteArmed = false;
  }

  allFilteredSelected(): boolean {
    return this.filteredMappings.length > 0 && this.filteredMappings.every(m => this.selectedIds.has(m.id));
  }

  toggleSelectAll(): void {
    if (this.allFilteredSelected()) {
      this.filteredMappings.forEach(m => this.selectedIds.delete(m.id));
    } else {
      this.filteredMappings.forEach(m => this.selectedIds.add(m.id));
    }
    this.bulkDeleteArmed = false;
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.bulkDeleteArmed = false;
  }

  disarmBulkDelete(): void {
    this.bulkDeleteArmed = false;
  }

  async bulkApplyStatus(status: RedirectMappingStatus): Promise<void> {
    this.busy = true;
    try {
      const ids = Array.from(this.selectedIds);
      await this.legacyUrlMappingService.bulkUpdateStatus({ ids, status });
      this.allMappings.filter(m => this.selectedIds.has(m.id)).forEach(m => m.status = status);
      this.clearSelection();
      this.applyFilters();
      this.loadSummary();
    } finally {
      this.busy = false;
    }
  }

  async bulkDelete(): Promise<void> {
    if (!this.bulkDeleteArmed) {
      this.bulkDeleteArmed = true;
    } else {
      this.busy = true;
      try {
        const ids = Array.from(this.selectedIds);
        await this.legacyUrlMappingService.bulkDelete({ ids });
        this.allMappings = this.allMappings.filter(m => !this.selectedIds.has(m.id));
        this.clearSelection();
        this.applyFilters();
        this.loadSummary();
      } finally {
        this.busy = false;
      }
    }
  }

  async bulkAcceptHighConfidence(): Promise<void> {
    this.busy = true;
    try {
      const highConfidencePending = this.allMappings.filter(
        m => m.confidence === RedirectConfidence.HIGH && m.status === RedirectMappingStatus.PENDING && m.targetPath
      );
      if (highConfidencePending.length === 0) {
        return;
      }
      const ids = highConfidencePending.map(m => m.id);
      await this.legacyUrlMappingService.bulkUpdateStatus({
        ids,
        status: RedirectMappingStatus.ACCEPTED
      });
      highConfidencePending.forEach(m => m.status = RedirectMappingStatus.ACCEPTED);
      this.applyFilters();
      this.loadSummary();
    } finally {
      this.busy = false;
    }
  }

  async runAutoMap(): Promise<void> {
    this.busy = true;
    try {
      await this.legacyUrlMappingService.autoMap({ legacyDomain: this.scrapeDomain });
      this.loadData();
    } finally {
      this.busy = false;
    }
  }

  runScrape(): void {
    this.scraping = true;
    this.scrapePercent = 0;
    this.scrapeMessage = "Connecting...";
    this.webSocketClientService.sendMessage(EventType.LEGACY_URL_SCRAPE, {
      legacyDomain: this.scrapeDomain,
      respectRobotsTxt: this.respectRobotsTxt,
      maxPages: this.scrapeMaxPages,
      delayMs: this.scrapeDelayMs
    });
  }
}
