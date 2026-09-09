import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowDownWideShort, faArrowUpShortWide, faBookmark, faCalendarDays, faCircleCheck, faCircleExclamation, faDownload, faMagnifyingGlass, faMap, faPersonWalking, faSpinner, faSync } from "@fortawesome/free-solid-svg-icons";
import { ActivatedRoute } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { Subscription } from "rxjs";
import { OsMapsRoutePreviewMapComponent } from "./os-maps-route-preview-map";
import {
  OsMapsExportJobStatus,
  OsMapsListedRoute,
  OsMapsRouteListFilter,
  OsMapsRouteListing,
  OsMapsRouteSource,
  osMapsRouteVisible
} from "../../../models/os-maps-export.model";
import { SortDirection } from "../../../models/sort.model";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { StoredValue } from "../../../models/ui-actions";
import { DEFAULT_WALKS_AREA, WALKS_ADMIN_SEGMENT } from "../../../models/walks-route-paths.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UIDateFormat } from "../../../models/date-format.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { OsMapsExportService } from "../../../services/maps/os-maps-export.service";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { DistanceUnit } from "../../../models/walk.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { UrlService } from "../../../services/url.service";
import { PageComponent } from "../../../page/page.component";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalkDisplayService } from "../walk-display.service";
import { AppPath, RouteFollowQueryParam } from "../../../models/route-follow.model";
import { Router } from "@angular/router";
import { OsMapsLoginRequiredAlertComponent } from "../walk-edit/os-maps-login-required-alert";
import { SerenityJobAuditPanelComponent } from "./serenity-job-audit-panel";
import { RamblersUploadAuditService } from "../../../services/walks/ramblers-upload-audit.service";
import { AuditType, RamblersUploadAudit, Status } from "../../../models/ramblers-upload-audit.model";

@Component({
  selector: "app-os-maps-export",
  imports: [PageComponent, FormsModule, FontAwesomeModule, OsMapsLoginRequiredAlertComponent, SerenityJobAuditPanelComponent, TooltipDirective, OsMapsRoutePreviewMapComponent],
  template: `
    <app-page pageTitle="OS Maps Routes">
      @if (!loginConfigured) {
        <div class="mb-3">
          <app-os-maps-login-required-alert/>
        </div>
      }
      <div class="os-maps-export-actions d-flex flex-wrap align-items-center gap-2 mb-3">
        <button type="button" class="btn btn-quiet" (click)="navigateBackToAdmin()">Back to walks admin</button>
        @if (listing.routes.length === 0) {
          <button type="button" class="btn btn-primary" (click)="refreshRoutes()" [disabled]="busy() || !loginConfigured">
            <fa-icon [icon]="loading ? faSpinner : faSync" class="me-2"/>
            {{ loading ? "Loading routes…" : "Load routes from OS Maps" }}
          </button>
        } @else {
          <button type="button" class="btn btn-primary" (click)="convertSelected()" [disabled]="busy() || !loginConfigured || selectedIds.size === 0">
            <fa-icon [icon]="converting ? faSpinner : faDownload" class="me-2"/>
            {{ converting ? "Converting…" : "Convert selected to GPX" }}
          </button>
          <div class="d-flex align-items-center gap-2 ms-sm-auto os-maps-export-actions-status">
            <span class="text-muted">Last loaded {{ lastLoadedLabel }}</span>
            <button type="button" class="btn btn-quiet btn-icon os-maps-export-actions-icon" (click)="refreshRoutes()" [disabled]="busy() || !loginConfigured"
                    tooltip="Reload routes from OS Maps" container="body">
              <fa-icon [icon]="loading ? faSpinner : faSync"/>
            </button>
          </div>
        }
      </div>
      <div class="thumbnail-heading-frame">
        <div class="thumbnail-heading">OS Maps routes</div>
        <p>Search and tick the routes you want, then convert them to GPX. Imported routes stay marked so you can see what is still to do next time. When new routes have been saved on the OS Maps account, reload the list using the button next to the last-loaded time.</p>
        @if (errorMessage) {
          <div class="alert alert-danger d-flex align-items-start gap-2" role="alert">
            <fa-icon [icon]="faCircleExclamation"/>
            <div>
              <strong>Could not load or convert routes</strong>
              <div>{{ errorMessage }}</div>
            </div>
          </div>
        }
        @if (warningMessage) {
          <div class="alert alert-warning d-flex align-items-start gap-2" role="alert">
            <fa-icon [icon]="faCircleExclamation"/>
            <div>
              <strong>Some routes were not converted</strong>
              <div>{{ warningMessage }}</div>
            </div>
          </div>
        }
        @if (successMessage) {
          <div class="alert alert-success d-flex align-items-start gap-2" role="alert">
            <fa-icon [icon]="faCircleCheck"/>
            <div>
              <strong>Routes converted</strong>
              <div>{{ successMessage }}</div>
            </div>
          </div>
        }
        <div class="os-maps-route-filters d-flex flex-wrap align-items-end gap-2 mb-2">
          <div class="flex-grow-1">
            <label class="form-label mb-1" for="os-maps-route-search">Search</label>
            <div class="input-group">
              <span class="input-group-text"><fa-icon [icon]="faMagnifyingGlass"/></span>
              <input id="os-maps-route-search" type="search" class="form-control"
                     placeholder="Search route titles"
                     [ngModel]="search" (ngModelChange)="onSearchChange($event)"/>
            </div>
          </div>
          <div>
            <label class="form-label mb-1" for="os-maps-route-filter">Show</label>
            <select id="os-maps-route-filter" class="form-select" [ngModel]="importFilter" (ngModelChange)="onFilterChange($event)">
              <option [value]="OsMapsRouteListFilter.ALL">All routes</option>
              <option [value]="OsMapsRouteListFilter.NOT_IMPORTED">Not imported</option>
              <option [value]="OsMapsRouteListFilter.IMPORTED">Imported</option>
            </select>
          </div>
          <div>
            <label class="form-label mb-1" for="os-maps-route-sort">Sort by</label>
            <div class="d-flex">
              <select id="os-maps-route-sort" class="form-select" [ngModel]="sortKey" (ngModelChange)="onSortKeyChange($event)">
                <option value="createdAtValue">Date</option>
                <option value="title">Title</option>
                <option value="distanceMetres">Distance</option>
                <option value="importedAt">Imported</option>
              </select>
              <button type="button" class="btn btn-quiet flex-shrink-0 d-flex align-items-center justify-content-center ms-1"
                      [style.width.px]="38" [style.padding.px]="0" (click)="toggleSortDirection()"
                      tooltip="Reverse sort order" container="body" aria-label="Reverse sort order">
                <fa-icon [icon]="sortDirection === ASCENDING ? faArrowUpShortWide : faArrowDownWideShort"/>
              </button>
            </div>
          </div>
        </div>
        @if (hasActiveQuery() && visibleRoutes().length > 0) {
          <div class="d-flex flex-wrap align-items-center gap-3 mb-2">
            <div class="form-check mb-0">
              <input type="checkbox" class="form-check-input" id="select-all-os-maps-routes"
                     [checked]="allSelected()" (change)="toggleSelectAll()"/>
              <label class="form-check-label" for="select-all-os-maps-routes">
                Select all shown ({{ visibleRoutes().length }})
              </label>
            </div>
            @if (selectedIds.size > 0) {
              <span class="text-muted">{{ selectedIds.size }} selected</span>
            }
            <span class="text-muted ms-auto">
              @if (matchedCount() > visibleRoutes().length) {
                Showing the first {{ visibleRoutes().length }} of {{ matchedCount() }} matches - narrow your search to see the rest
              } @else {
                {{ matchedCount() }} of {{ listing.routes.length }} routes
              }
            </span>
          </div>
        }
        @if (hasActiveQuery()) {
          <div class="d-flex flex-column gap-2">
            @for (route of visibleRoutes(); track route.id) {
              <div class="img-thumbnail d-flex gap-3 p-2">
                <input type="checkbox" class="form-check-input mt-1 align-self-start" [checked]="isSelected(route)" (change)="toggleSelected(route)"/>
                <app-os-maps-route-preview-map [route]="route"
                                                [style.cursor]="canEditRoute(route) ? 'pointer' : null"
                                                (click)="canEditRoute(route) && editRoute(route)"/>
                <div class="flex-grow-1 min-w-0">
                  @if (canEditRoute(route)) {
                    <button type="button" class="btn btn-link p-0 fw-bold text-start" (click)="editRoute(route)">{{ route.title }}</button>
                  } @else {
                    <span class="fw-bold">{{ route.title }}</span>
                  }
                  <div class="d-flex flex-wrap align-items-center gap-2 text-muted mt-1">
                    <span><fa-icon [icon]="faPersonWalking" class="me-1"/>{{ displayDistance(route) }}</span>
                    <span><fa-icon [icon]="faCalendarDays" class="me-1"/>{{ displayDateShort(route) }}</span>
                    <span [tooltip]="sourceLabel(route)" container="body">
                      <fa-icon [icon]="route.source === OsMapsRouteSource.BOOKMARKED ? faBookmark : faMap"/>
                    </span>
                  </div>
                  <div class="d-flex flex-wrap align-items-center gap-2 mt-1">
                    <a [href]="route.url" target="_blank" rel="noopener" class="small d-inline-flex align-items-center gap-1">
                      <img src="/assets/images/local/os-api/os-logo-maps.svg" alt="" width="46" height="12"/>
                      Open in OS Maps
                    </a>
                  </div>
                </div>
              </div>
            } @empty {
              <div class="text-muted p-2">{{ emptyMessage() }}</div>
            }
          </div>
        } @else {
          <div class="alert alert-warning d-flex align-items-start gap-2" role="alert">
            <fa-icon [icon]="faMagnifyingGlass"/>
            <div>
              <strong>Search to see routes</strong>
              <div>{{ emptyMessage() }}</div>
            </div>
          </div>
        }
      </div>
      @if (currentJobFileName) {
        <div class="mt-3">
          <app-serenity-job-audit-panel [fileName]="currentJobFileName"/>
        </div>
      }
    </app-page>
  `,
  styles: [`
    .os-maps-export-actions
      @media (max-width: 575.98px)
        flex-direction: column
        align-items: stretch

        .btn:not(.os-maps-export-actions-icon)
          width: 100%

        .os-maps-export-actions-status
          justify-content: space-between
          margin-left: 0

    .os-maps-route-filters
      @media (max-width: 575.98px)
        > div
          flex: 1 1 100%
  `]
})
export class OsMapsExportPage implements OnInit, OnDestroy {
  private logger = inject(LoggerFactory).createLogger("OsMapsExportPage", NgxLoggerLevel.ERROR);
  private osMapsExportService = inject(OsMapsExportService);
  private distanceValidation = inject(DistanceValidationService);
  private dateUtils = inject(DateUtilsService);
  private uiActions = inject(UiActionsService);
  private stringUtils = inject(StringUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private urlService = inject(UrlService);
  private router = inject(Router);
  private walkDisplay = inject(WalkDisplayService);
  private systemConfigService = inject(SystemConfigService);
  private ramblersUploadAuditService = inject(RamblersUploadAuditService);
  private subscriptions: Subscription[] = [];
  loginConfigured = false;
  currentJobFileName: string | null = null;
  private currentJobId: string | null = null;
  private destroyed = false;
  faSync = faSync;
  faSpinner = faSpinner;
  faDownload = faDownload;
  faMagnifyingGlass = faMagnifyingGlass;
  faCircleExclamation = faCircleExclamation;
  faCircleCheck = faCircleCheck;
  faMap = faMap;
  faPersonWalking = faPersonWalking;
  faCalendarDays = faCalendarDays;
  faBookmark = faBookmark;
  faArrowUpShortWide = faArrowUpShortWide;
  faArrowDownWideShort = faArrowDownWideShort;
  listing: OsMapsRouteListing = {listedAt: 0, routes: []};
  selectedIds = new Set<string>();
  loading = false;
  converting = false;
  errorMessage = "";
  warningMessage = "";
  successMessage = "";
  search = "";
  importFilter = OsMapsRouteListFilter.ALL;
  sortKey = "createdAtValue";
  sortDirection = DESCENDING;
  lastLoadedLabel = "";
  protected readonly OsMapsRouteListFilter = OsMapsRouteListFilter;
  protected readonly OsMapsRouteSource = OsMapsRouteSource;
  protected readonly ASCENDING = ASCENDING;
  private searchWait = {timer: null as ReturnType<typeof setTimeout> | null};
  private readonly maxVisibleRoutes = 50;
  private readonly sortKeys = ["createdAtValue", "title", "distanceMetres", "importedAt"];

  ngOnInit(): void {
    const sortParam = this.activatedRoute.snapshot.queryParams[StoredValue.SORT];
    const matchedSortKey = this.sortKeys.find(key => this.stringUtils.kebabCase(key) === sortParam);
    if (matchedSortKey) {
      this.sortKey = matchedSortKey;
    }
    if (this.activatedRoute.snapshot.queryParams[StoredValue.SORT_ORDER] === SortDirection.ASC) {
      this.sortDirection = ASCENDING;
    }
    this.search = this.activatedRoute.snapshot.queryParams[StoredValue.SEARCH] || "";
    const filterParam = this.activatedRoute.snapshot.queryParams[StoredValue.FILTER];
    if (filterParam === OsMapsRouteListFilter.IMPORTED || filterParam === OsMapsRouteListFilter.NOT_IMPORTED) {
      this.importFilter = filterParam;
    }
    this.loginConfigured = this.systemConfigService.osMapsLoginConfigured();
    this.subscriptions.push(this.systemConfigService.events().subscribe(() => {
      this.loginConfigured = this.systemConfigService.osMapsLoginConfigured();
    }));
    void this.loadListing();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.searchWait.timer) {
      clearTimeout(this.searchWait.timer);
    }
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  navigateBackToAdmin(): void {
    const area = this.urlService.area() === WALKS_ADMIN_SEGMENT ? DEFAULT_WALKS_AREA : this.urlService.area();
    this.urlService.navigateTo([area, WALKS_ADMIN_SEGMENT]);
  }

  displayDate(route: OsMapsListedRoute): string {
    if (!route.createdAtValue) {
      return "";
    } else {
      return this.dateUtils.displayDate(route.createdAtValue);
    }
  }

  displayDistance(route: OsMapsListedRoute): string {
    if (!route.distanceMetres) {
      return "";
    } else {
      const miles = this.distanceValidation.convertKmToMiles(route.distanceMetres / 1000);
      return `${miles} ${DistanceUnit.MILES}`;
    }
  }

  displayDateShort(route: OsMapsListedRoute): string {
    if (!route.createdAtValue) {
      return "";
    } else {
      return this.dateUtils.asString(route.createdAtValue, undefined, UIDateFormat.DISPLAY_DATE_NO_DAY);
    }
  }

  canEditRoute(route: OsMapsListedRoute): boolean {
    return !!route.importedAt && !!route.gpxFile?.awsFileName;
  }

  editRoute(route: OsMapsListedRoute): void {
    this.walkDisplay.rememberFollowReturnUrl();
    void this.router.navigate(["/" + AppPath.ROOT + "/" + AppPath.FOLLOW], {
      queryParams: {[RouteFollowQueryParam.OS_MAPS_ROUTE_ID]: route.id}
    });
  }

  hasActiveQuery(): boolean {
    return this.search.trim().length > 0 || this.importFilter !== OsMapsRouteListFilter.ALL;
  }

  private matchedRoutes(): OsMapsListedRoute[] {
    if (!this.hasActiveQuery()) {
      return [];
    } else {
      return this.sortRoutes(this.listing.routes.filter(route => osMapsRouteVisible(route, this.search, this.importFilter)));
    }
  }

  matchedCount(): number {
    return this.matchedRoutes().length;
  }

  visibleRoutes(): OsMapsListedRoute[] {
    return this.matchedRoutes().slice(0, this.maxVisibleRoutes);
  }

  sourceLabel(route: OsMapsListedRoute): string {
    return route.source === OsMapsRouteSource.BOOKMARKED ? "Bookmarked" : "Created";
  }

  private sortRoutes(routes: OsMapsListedRoute[]): OsMapsListedRoute[] {
    const direction = this.sortDirection === ASCENDING ? 1 : -1;
    return [...routes].sort((first, second) => this.compareBySortKey(first, second) * direction);
  }

  private compareBySortKey(first: OsMapsListedRoute, second: OsMapsListedRoute): number {
    if (this.sortKey === "title") {
      return (first.title || "").localeCompare(second.title || "");
    } else if (this.sortKey === "distanceMetres") {
      return (first.distanceMetres || 0) - (second.distanceMetres || 0);
    } else if (this.sortKey === "importedAt") {
      return (first.importedAt || 0) - (second.importedAt || 0);
    } else {
      return (first.createdAtValue || 0) - (second.createdAtValue || 0);
    }
  }

  emptyMessage(): string {
    if (this.listing.routes.length === 0) {
      return "No OS Maps routes loaded yet. Use Load routes from OS Maps.";
    } else if (!this.hasActiveQuery()) {
      return `Type a route name in the search box, or choose a filter, to see matching routes. There are ${this.listing.routes.length} routes in total.`;
    } else {
      return "No OS Maps routes match that search.";
    }
  }

  isSelected(route: OsMapsListedRoute): boolean {
    return this.selectedIds.has(route.id);
  }

  allSelected(): boolean {
    const visible = this.visibleRoutes();
    return visible.length > 0 && visible.every(route => this.selectedIds.has(route.id));
  }

  toggleSelected(route: OsMapsListedRoute): void {
    const next = new Set(this.selectedIds);
    if (next.has(route.id)) {
      next.delete(route.id);
    } else {
      next.add(route.id);
    }
    this.selectedIds = next;
  }

  toggleSelectAll(): void {
    const visibleIds = this.visibleRoutes().map(route => route.id);
    if (this.allSelected()) {
      this.selectedIds = new Set([...this.selectedIds].filter(id => !visibleIds.includes(id)));
    } else {
      this.selectedIds = new Set([...this.selectedIds, ...visibleIds]);
    }
  }

  onSearchChange(value: string): void {
    this.search = value;
    if (this.searchWait.timer) {
      clearTimeout(this.searchWait.timer);
    }
    this.searchWait.timer = setTimeout(() => {
      this.writeViewToUrl();
    }, 300);
  }

  onFilterChange(value: OsMapsRouteListFilter): void {
    this.importFilter = value;
    this.writeViewToUrl();
  }

  onSortKeyChange(value: string): void {
    this.sortKey = value || "createdAtValue";
    this.writeViewToUrl();
  }

  toggleSortDirection(): void {
    this.sortDirection = this.sortDirection === ASCENDING ? DESCENDING : ASCENDING;
    this.writeViewToUrl();
  }

  private writeViewToUrl(): void {
    this.uiActions.updateQueryParameters({
      [StoredValue.SORT]: this.sortKey ? this.stringUtils.kebabCase(this.sortKey) : null,
      [StoredValue.SORT_ORDER]: this.sortDirection === DESCENDING ? SortDirection.DESC : SortDirection.ASC,
      [StoredValue.SEARCH]: this.search || null,
      [StoredValue.FILTER]: this.importFilter === OsMapsRouteListFilter.ALL ? null : this.importFilter
    });
  }

  async loadListing(): Promise<void> {
    try {
      this.listing = await this.osMapsExportService.listing();
      this.lastLoadedLabel = this.listing.listedAt
        ? this.dateUtils.asString(this.listing.listedAt, undefined, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED_TIME)
        : "";
    } catch (error) {
      this.logger.error("loadListing failed:", error);
      this.errorMessage = this.failureMessage(error, "Failed to load saved routes");
    }
  }

  busy(): boolean {
    return this.loading || this.converting;
  }

  private clearMessages(): void {
    this.errorMessage = "";
    this.warningMessage = "";
    this.successMessage = "";
  }

  async refreshRoutes(): Promise<void> {
    if (this.loginConfigured) {
      this.loading = true;
      this.clearMessages();
      const previousListedAt = this.listing.listedAt;
      try {
        const started = await this.osMapsExportService.refresh();
        this.currentJobFileName = started.fileName || this.currentJobFileName;
        await this.waitForFreshListing(previousListedAt);
      } catch (error) {
        this.logger.error("refreshRoutes failed:", error);
        this.errorMessage = this.failureMessage(error, "Failed to start loading routes from OS Maps");
      }
      this.loading = false;
    }
  }

  async convertSelected(): Promise<void> {
    if (this.loginConfigured) {
      const routeUrls = this.listing.routes
        .filter(route => this.selectedIds.has(route.id))
        .map(route => route.url);
      this.converting = true;
      this.clearMessages();
      try {
        const started = await this.osMapsExportService.exportRoutes(routeUrls);
        this.currentJobFileName = started.fileName || this.currentJobFileName;
        this.currentJobId = started.jobId;
        const result = await this.osMapsExportService.waitForExport(started.jobId, () => !this.destroyed && this.currentJobId === started.jobId);
        if (result.status === OsMapsExportJobStatus.COMPLETED) {
          this.successMessage = `${this.stringUtils.pluraliseWithCount(result.gpxFiles.length, "GPX file")} saved and ready to attach to a walk`;
          this.warningMessage = result.error || "";
          await this.loadListing();
        } else if (result.status === OsMapsExportJobStatus.FAILED) {
          this.errorMessage = await this.lastJobError(started.fileName) || result.error || "Failed to convert the selected routes";
        } else if (!this.destroyed) {
          this.warningMessage = "The conversion is taking longer than expected and this page has stopped waiting for it. The job progress below keeps updating; reload the routes list once it has finished.";
        }
      } catch (error) {
        this.logger.error("convertSelected failed:", error);
        this.errorMessage = this.failureMessage(error, "Failed to convert the selected routes");
      }
      this.converting = false;
    }
  }

  private async lastJobError(fileName: string | undefined): Promise<string> {
    if (!fileName) {
      return "";
    } else {
      try {
        const audits = await this.ramblersUploadAuditService.all({
          criteria: {fileName, status: Status.ERROR, type: AuditType.STEP},
          sort: {record: -1},
          limit: 10
        });
        const rows: RamblersUploadAudit[] = audits.response || [];
        const withDetail = rows.find(row => row.errorResponse?.message) || rows.find(row => /^\w*Error:/.test(row.message || ""));
        return withDetail?.errorResponse?.message || withDetail?.message || "";
      } catch (error) {
        this.logger.error("lastJobError failed:", error);
        return "";
      }
    }
  }

  private async waitForFreshListing(previousListedAt: number): Promise<void> {
    const attempts = {count: 0};
    const maxAttempts = 40;
    const poll = async (): Promise<void> => {
      await this.loadListing();
      attempts.count += 1;
      if (this.listing.listedAt > previousListedAt || attempts.count >= maxAttempts) {
        return;
      } else {
        await new Promise(resolve => setTimeout(resolve, 3000));
        return poll();
      }
    };
    return poll();
  }

  private failureMessage(error: unknown, fallback: string): string {
    const asHttp = error as {error?: {error?: string}; message?: string};
    if (asHttp.error?.error) {
      return asHttp.error.error;
    } else {
      return asHttp.message || fallback;
    }
  }
}
