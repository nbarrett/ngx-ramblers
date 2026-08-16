import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleCheck, faCircleExclamation, faDownload, faMagnifyingGlass, faPencil, faSpinner, faSync } from "@fortawesome/free-solid-svg-icons";
import { ActivatedRoute } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import {
  OsMapsExportJobStatus,
  OsMapsListedRoute,
  OsMapsRouteListFilter,
  OsMapsRouteListing,
  osMapsRouteVisible
} from "../../../models/os-maps-export.model";
import { SortDirection } from "../../../models/sort.model";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { StoredValue } from "../../../models/ui-actions";
import { DEFAULT_WALKS_AREA, WALKS_ADMIN_SEGMENT } from "../../../models/walks-route-paths.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { OsMapsExportService } from "../../../services/maps/os-maps-export.service";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { DistanceUnit } from "../../../models/walk.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { UrlService } from "../../../services/url.service";
import { PageComponent } from "../../../page/page.component";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalkDisplayService } from "../walk-display.service";
import { AppPath, RouteFollowQueryParam } from "../../../models/route-follow.model";
import { Router } from "@angular/router";
import { OsMapsLoginRequiredAlertComponent } from "../walk-edit/os-maps-login-required-alert";
import { SerenityJobAuditPanelComponent } from "./serenity-job-audit-panel";

@Component({
  selector: "app-os-maps-export",
  imports: [PageComponent, FormsModule, FontAwesomeModule, SortableTableComponent, SortableTableCellDirective, OsMapsLoginRequiredAlertComponent, SerenityJobAuditPanelComponent],
  template: `
    <app-page pageTitle="OS Maps Routes">
      @if (!loginConfigured) {
        <div class="mb-3">
          <app-os-maps-login-required-alert/>
        </div>
      }
      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        <button type="button" class="btn btn-quiet" (click)="navigateBackToAdmin()">Back to walks admin</button>
        <button type="button" class="btn btn-primary" (click)="refreshRoutes()" [disabled]="busy || !loginConfigured">
          <fa-icon [icon]="busy ? faSpinner : faSync" class="me-2"/>
          {{ busy ? "Working…" : "Load routes from OS Maps" }}
        </button>
        <button type="button" class="btn btn-primary" (click)="convertSelected()" [disabled]="busy || !loginConfigured || selectedIds.size === 0">
          <fa-icon [icon]="faDownload" class="me-2"/>
          Convert selected to GPX
        </button>
        @if (listing.listedAt) {
          <span class="text-muted">Last loaded {{ lastLoadedLabel }}</span>
        }
      </div>
      <div class="thumbnail-heading-frame">
        <div class="thumbnail-heading">OS Maps routes</div>
        <p>Load the routes saved on the OS Maps account, then search and choose which ones to convert to GPX. Imported routes stay marked so you can see what is still to do next time.</p>
        @if (errorMessage) {
          <div class="alert alert-danger d-flex align-items-start gap-2" role="alert">
            <fa-icon [icon]="faCircleExclamation"/>
            <div>
              <strong>Could not load or convert routes</strong>
              <div>{{ errorMessage }}</div>
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
        <div class="d-flex flex-wrap align-items-end gap-2 mb-2">
          <div class="flex-grow-1">
            <label class="form-label mb-1" for="os-maps-route-search">Search</label>
            <div class="input-group">
              <span class="input-group-text"><fa-icon [icon]="faMagnifyingGlass"/></span>
              <input id="os-maps-route-search" type="search" class="form-control"
                     placeholder="Search titles, for example Nik"
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
          <div class="form-check mb-2">
            <input type="checkbox" class="form-check-input" id="select-all-os-maps-routes"
                   [checked]="allSelected()" (change)="toggleSelectAll()"/>
            <label class="form-check-label" for="select-all-os-maps-routes">
              Select all ({{ visibleRoutes().length }})
            </label>
          </div>
          @if (selectedIds.size > 0) {
            <span class="text-muted mb-2">{{ selectedIds.size }} selected</span>
          }
          <span class="text-muted mb-2">{{ visibleRoutes().length }} of {{ listing.routes.length }}</span>
        </div>
        <app-sortable-table
          [columns]="columns"
          [rows]="visibleRoutes()"
          [defaultSortKey]="sortKey"
          [defaultSortDirection]="sortDirection"
          (sortChange)="onSortChange($event)"
          [emptyMessage]="emptyMessage()">
          <ng-template appSortableTableCell="selected" let-row>
            <input type="checkbox" class="form-check-input"
                   [checked]="isSelected(row)"
                   (change)="toggleSelected(row)"/>
          </ng-template>
          <ng-template appSortableTableCell="createdAt" let-row>
            {{ displayDate(row) }}
          </ng-template>
          <ng-template appSortableTableCell="title" let-row>
            <a [href]="row.url" target="_blank" rel="noopener">{{ row.title }}</a>
          </ng-template>
          <ng-template appSortableTableCell="distance" let-row>
            {{ displayDistance(row) }}
          </ng-template>
          <ng-template appSortableTableCell="imported" let-row>
            {{ displayImported(row) }}
          </ng-template>
          <ng-template appSortableTableCell="edit" let-row>
            @if (canEditRoute(row)) {
              <button type="button" class="btn btn-quiet btn-sm" (click)="editRoute(row)">
                <fa-icon [icon]="faPencil" class="me-2"/>Edit route
              </button>
            }
          </ng-template>
        </app-sortable-table>
      </div>
      @if (currentJobFileName) {
        <div class="mt-3">
          <app-serenity-job-audit-panel [fileName]="currentJobFileName"/>
        </div>
      }
    </app-page>
  `
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
  private subscriptions: Subscription[] = [];
  loginConfigured = false;
  currentJobFileName: string | null = null;
  faSync = faSync;
  faSpinner = faSpinner;
  faDownload = faDownload;
  faMagnifyingGlass = faMagnifyingGlass;
  faPencil = faPencil;
  faCircleExclamation = faCircleExclamation;
  faCircleCheck = faCircleCheck;
  listing: OsMapsRouteListing = {listedAt: 0, routes: []};
  selectedIds = new Set<string>();
  busy = false;
  errorMessage = "";
  successMessage = "";
  search = "";
  importFilter = OsMapsRouteListFilter.ALL;
  sortKey = "createdAtValue";
  sortDirection = DESCENDING;
  lastLoadedLabel = "";
  protected readonly OsMapsRouteListFilter = OsMapsRouteListFilter;
  private searchWait = {timer: null as ReturnType<typeof setTimeout> | null};
  columns: SortableTableColumn<OsMapsListedRoute>[] = [
    {key: "selected", label: ""},
    {key: "createdAt", label: "Date", sortKey: "createdAtValue"},
    {key: "title", label: "Title", sortKey: "title"},
    {key: "distance", label: "Distance", sortKey: "distanceMetres"},
    {key: "imported", label: "Imported", sortKey: "importedAt"},
    {key: "edit", label: ""}
  ];

  ngOnInit(): void {
    const sortParam = this.activatedRoute.snapshot.queryParams[StoredValue.SORT];
    const matchedSortKey = this.columns
      .map(column => column.sortKey)
      .filter(Boolean)
      .find(key => this.stringUtils.kebabCase(key) === sortParam);
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

  canEditRoute(route: OsMapsListedRoute): boolean {
    return !!route.importedAt && !!route.gpxFile?.awsFileName;
  }

  editRoute(route: OsMapsListedRoute): void {
    this.walkDisplay.rememberFollowReturnUrl();
    void this.router.navigate(["/" + AppPath.ROOT + "/" + AppPath.FOLLOW], {
      queryParams: {[RouteFollowQueryParam.OS_MAPS_ROUTE_ID]: route.id}
    });
  }

  displayImported(route: OsMapsListedRoute): string {
    if (route.importedAt) {
      return this.dateUtils.displayDate(route.importedAt);
    } else {
      return "Not imported";
    }
  }

  visibleRoutes(): OsMapsListedRoute[] {
    return this.listing.routes.filter(route => osMapsRouteVisible(route, this.search, this.importFilter));
  }

  emptyMessage(): string {
    if (this.listing.routes.length === 0) {
      return "No OS Maps routes loaded yet. Use Load routes from OS Maps.";
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

  onSortChange(state: SortableTableSortState): void {
    this.sortKey = state.key || "createdAtValue";
    this.sortDirection = state.direction === ASCENDING ? ASCENDING : DESCENDING;
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
        ? this.dateUtils.displayDateAndTime(this.listing.listedAt)
        : "";
    } catch (error) {
      this.logger.error("loadListing failed:", error);
      this.errorMessage = this.failureMessage(error, "Failed to load saved routes");
    }
  }

  async refreshRoutes(): Promise<void> {
    if (this.loginConfigured) {
      this.busy = true;
      this.errorMessage = "";
      this.successMessage = "";
      const previousListedAt = this.listing.listedAt;
      try {
        const started = await this.osMapsExportService.refresh();
        this.currentJobFileName = started.fileName || this.currentJobFileName;
        await this.waitForFreshListing(previousListedAt);
      } catch (error) {
        this.logger.error("refreshRoutes failed:", error);
        this.errorMessage = this.failureMessage(error, "Failed to start loading routes from OS Maps");
      }
      this.busy = false;
    }
  }

  async convertSelected(): Promise<void> {
    if (this.loginConfigured) {
      const routeUrls = this.listing.routes
        .filter(route => this.selectedIds.has(route.id))
        .map(route => route.url);
      this.busy = true;
      this.errorMessage = "";
      this.successMessage = "";
      try {
        const started = await this.osMapsExportService.exportRoutes(routeUrls);
        this.currentJobFileName = started.fileName || this.currentJobFileName;
        const result = await this.osMapsExportService.waitForExport(started.jobId);
        if (result.status === OsMapsExportJobStatus.COMPLETED) {
          this.successMessage = `${this.stringUtils.pluraliseWithCount(result.gpxFiles.length, "GPX file")} saved and ready to attach to a walk`;
          await this.loadListing();
        } else if (result.status === OsMapsExportJobStatus.FAILED) {
          this.errorMessage = result.error || "Failed to convert the selected routes";
        } else {
          this.errorMessage = "Conversion is still running. Check back shortly, or try again.";
        }
      } catch (error) {
        this.logger.error("convertSelected failed:", error);
        this.errorMessage = this.failureMessage(error, "Failed to convert the selected routes");
      }
      this.busy = false;
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
