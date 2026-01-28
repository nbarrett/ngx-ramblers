import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AuthService } from "../../../../auth/auth.service";
import { BadgeButtonComponent } from "../../../../modules/common/badge-button/badge-button";
import { CommonModule } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCheckCircle, faEdit, faInfoCircle, faRefresh, faSave, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FormsModule } from "@angular/forms";
import { AreaGroup, AvailableArea, SharedDistrictStyle, SystemConfig } from "../../../../models/system.model";
import { MarkdownEditorComponent } from "../../../../markdown-editor/markdown-editor.component";
import { NgSelectComponent } from "@ng-select/ng-select";
import { isString } from "es-toolkit/predicate";
import { asNumber } from "../../../../functions/numbers";
import { AreaMap } from "../../../area-map/area-map";
import { faArrowDown, faArrowUp, faSearch } from "@fortawesome/free-solid-svg-icons";
import { ActivatedRoute, Router } from "@angular/router";
import { RamblersWalksAndEventsService } from "../../../../services/walks-and-events/ramblers-walks-and-events.service";
import { RamblersGroupsApiResponse } from "../../../../models/ramblers-walks-manager";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { SharedDistrictStyleSelectorComponent } from "../../../../shared/components/shared-district-style-selector";

@Component({
  selector: "app-area-map-sync-settings",
  styles: [`
    .table-sticky-header thead th
      position: sticky
      top: 0
      background: white
      z-index: 1
      box-shadow: 0 1px 0 #dee2e6

    .sortable-header
      cursor: pointer
      user-select: none

    .sortable-header:hover
      background-color: #f0f0f0

    .map-preview-container
      border-radius: 0.5rem
  `],
  template: `
      <div class="img-thumbnail thumbnail-admin-edit">
          <div class="thumbnail-heading-frame">
              <div class="thumbnail-heading">Area Groups Configuration</div>
              <div class="row">
                  <div class="col-12">
                      @if (districtsLoaded && unallocatedDistricts.length > 0 && hasAreaGroups && relevantUnallocatedDistricts.length > 0) {
                          <div class="alert alert-warning mb-3" role="alert">
                              <strong>Unallocated Districts ({{ relevantUnallocatedDistricts.length }}):</strong>
                              {{ relevantUnallocatedDistricts.join(", ") }}
                          </div>
                      }
                      @if (missingGeographicData) {
                          <div class="alert alert-warning mb-3" role="alert">
                              {{ geographicDataMessage }}
                          </div>
                      }
                      @if (!hasAreaGroups) {
                          <p class="mb-3">
                              Fetch groups from the Ramblers API and configure which districts belong to each group.
                          </p>
                          <div class="d-flex align-items-center mb-3" style="gap: 0.75rem;">
                              <app-badge-button
                                      [caption]="busy ? 'Fetching Groups...' : 'Fetch Groups from Ramblers'"
                                      (click)="fetchRamblersGroups()"
                                      [disabled]="busy"/>
                          </div>
                      } @else {
                          <div class="mb-3">
                              <app-markdown-editor standalone category="admin" name="area-map-group-configuration-help"
                                                   description="Area Map Group Configuration Help"/>
                          </div>
                          <div class="mb-3">
                              <label class="form-label">Neighboring Areas ({{ stringUtils.pluraliseWithCount(neighboringAreaCodes?.length || 0, 'area') }} of {{ availableNeighboringAreas?.length || 0 }} selected)</label>
                              <p class="text-muted small mb-2">
                                  Select neighboring Ramblers areas to include their groups and districts in addition to {{ config?.area?.shortName || 'your area' }}.
                              </p>
                              <ng-select [items]="availableNeighboringAreas"
                                         bindLabel="ngSelectLabel"
                                         bindValue="areaCode"
                                         [multiple]="true"
                                         [searchable]="true"
                                         [closeOnSelect]="false"
                                         [hideSelected]="true"
                                         [loading]="loadingNeighboringAreas"
                                         dropdownPosition="bottom"
                                         placeholder="Select neighboring areas..."
                                         [(ngModel)]="neighboringAreaCodes"
                                         (ngModelChange)="onNeighboringAreasChange($event)">
                              </ng-select>
                          </div>
                          <div class="form-check mb-3">
                              <input type="checkbox" class="form-check-input" id="shared-districts"
                                     [(ngModel)]="sharedDistrictsEnabled">
                              <label class="form-check-label" for="shared-districts">
                                  Allow districts to be shared between multiple groups
                              </label>
                          </div>
                          @if (sharedDistrictsEnabled) {
                              <div class="mb-3">
                                  <label class="form-label">Shared District Display Style</label>
                                  <app-shared-district-style-selector
                                      [(value)]="sharedDistrictStyle">
                                  </app-shared-district-style-selector>
                              </div>
                          }
                          @if (hasS3Data && hasAreaGroups) {
                              <div class="mb-3">
                                  <label class="form-label">Map Preview</label>
                                  <div class="map-preview-container border rounded">
                                      <app-area-map [region]="config?.area?.shortName"
                                                    [preview]="true"
                                                    [previewSharedDistrictStyle]="sharedDistrictStyle">
                                      </app-area-map>
                                  </div>
                              </div>
                          }
                          <div class="mb-2">
                              <div class="input-group input-group-sm">
                                  <span class="input-group-text"><fa-icon [icon]="faSearch"></fa-icon></span>
                                  <input type="text" class="form-control" placeholder="Filter groups..."
                                         [(ngModel)]="filterText" (ngModelChange)="onFilterChange()">
                              </div>
                          </div>
                          <div class="table-responsive mb-3" style="max-height: 500px; overflow-y: auto;">
                              <table class="table table-sm table-striped table-sticky-header">
                                  <thead>
                                  <tr>
                                      <th class="sortable-header" (click)="onSortChange('groupCode')">
                                          Group Code
                                          @if (sortField === 'groupCode') {
                                              <fa-icon [icon]="sortAsc ? faArrowUp : faArrowDown" class="ms-1"></fa-icon>
                                          }
                                      </th>
                                      <th class="sortable-header" (click)="onSortChange('name')">
                                          Group Name
                                          @if (sortField === 'name') {
                                              <fa-icon [icon]="sortAsc ? faArrowUp : faArrowDown" class="ms-1"></fa-icon>
                                          }
                                      </th>
                                      <th class="sortable-header" (click)="onSortChange('districts')">
                                          Districts
                                          @if (sortField === 'districts') {
                                              <fa-icon [icon]="sortAsc ? faArrowUp : faArrowDown" class="ms-1"></fa-icon>
                                          }
                                      </th>
                                      <th>Color</th>
                                      <th class="text-center">Non-Geographic</th>
                                  </tr>
                                  </thead>
                                  <tbody>
                                      @for (group of filteredAndSortedGroups; track group.groupCode) {
                                          <tr>
                                              <td class="align-middle">{{ group.groupCode }}</td>
                                              <td class="align-middle">{{ group.name }}</td>
                                              <td>
                                                  <ng-select [items]="availableDistricts"
                                                             [multiple]="true"
                                                             [searchable]="true"
                                                             [clearable]="true"
                                                             [closeOnSelect]="false"
                                                             [hideSelected]="true"
                                                             [clearSearchOnAdd]="true"
                                                             [disabled]="group.nonGeographic"
                                                             placeholder="Select districts..."
                                                             [(ngModel)]="group.onsDistricts"
                                                             (change)="onDistrictsChange(group)">
                                                  </ng-select>
                                              </td>
                                              <td>
                                                  <input type="color"
                                                         class="form-control form-control-color"
                                                         [(ngModel)]="group.color">
                                              </td>
                                              <td class="text-center align-middle">
                                                  <input type="checkbox" class="form-check-input"
                                                         [(ngModel)]="group.nonGeographic"
                                                         (ngModelChange)="onNonGeographicChange(group)">
                                              </td>
                                          </tr>
                                      }
                                  </tbody>
                              </table>
                          </div>
                          <div class="d-flex align-items-center" style="gap: 0.75rem;">
                              <app-badge-button
                                      [caption]="busy ? 'Rebuilding Groups...' : 'Rebuild Groups'"
                                      [icon]="faRefresh"
                                      (click)="rebuildGroupsInEditMode()"
                                      [disabled]="busy"/>
                          </div>
                      }
                      @if (groupsSuccessMessage) {
                          <div class="alert alert-success mt-3 mb-0" role="alert">
                              <fa-icon [icon]="faInfoCircle" class="me-2"></fa-icon>
                              <strong>Groups refreshed from Ramblers API.</strong> {{ groupsSuccessMessage }}
                          </div>
                      }
                      @if (errorMessage) {
                          <div class="alert alert-danger mt-3 mb-0" role="alert">
                              {{ errorMessage }}
                          </div>
                      }
                  </div>
              </div>
          </div>
          <div class="thumbnail-heading-frame">
              <div class="thumbnail-heading">Geographic Data</div>
              <div class="row">
                  <div class="col-12">
                      @if (!hasAreaGroups) {
                          <div class="alert alert-warning mb-3" role="alert">
                              <strong>Setup Required:</strong> Area groups configuration not found. Please configure
                              your area groups below.
                          </div>
                      } @else if (hasS3Data) {
                          @if (geoDataNeedsUpdate) {
                              <div class="alert alert-warning mb-3" role="alert">
                                  <fa-icon [icon]="faInfoCircle" class="me-2"></fa-icon>
                                  <strong>Update Required:</strong> Group configuration has changed. Click 'Update Geographic Data' to apply changes to the map.
                              </div>
                          } @else {
                              <div class="alert alert-success mb-3" role="alert">
                                  <fa-icon [icon]="faCheckCircle" class="me-2"></fa-icon>
                                  <strong>Area Map Active:</strong> Your area map is configured and ready to use.
                              </div>
                          }
                          <div class="d-flex align-items-center mb-3" style="gap: 0.75rem;">
                              <app-badge-button
                                      [caption]="busy ? 'Updating Geographic Data...' : 'Update Geographic Data'"
                                      (click)="upload()"
                                      [disabled]="busy"/>
                              <app-badge-button
                                      [caption]="busy ? 'Clearing Data...' : 'Clear Geographic Data'"
                                      (click)="deleteS3Data()"
                                      [disabled]="busy"/>
                          </div>
                      } @else {
                          <p class="mb-3">
                              Upload area boundaries for your configured groups. All ONS districts will be processed and
                              optimised for efficient display on maps.
                          </p>
                          <div class="d-flex align-items-center mb-3" style="gap: 0.75rem;">
                              <app-badge-button
                                      [caption]="busy ? 'Uploading Geographic Data...' : 'Upload Geographic Data'"
                                      (click)="upload()"
                                      [disabled]="busy"/>
                          </div>
                      }
                      @if (geoSuccessMessage) {
                          <div class="alert alert-success mt-3 mb-0" role="alert">
                              <fa-icon [icon]="faCheckCircle" class="me-2"></fa-icon>
                              {{ geoSuccessMessage }}
                          </div>
                      }
                      @if (errorMessage) {
                          <div class="alert alert-danger mt-3 mb-0" role="alert">
                              {{ errorMessage }}
                          </div>
                      }
                      @if (hasAreaGroups && effectiveKey) {
                          <p class="mt-3 mb-0 small text-muted">
                              Current version: <code>{{ effectiveKey }}</code>
                          </p>
                      }
                      @if (hasAreaGroups) {
                          <div class="mt-3">
                              <label class="form-label">Default Map Position</label>
                              <div class="row g-2">
                                  <div class="col-md-4">
                                      <label class="form-label small text-muted mb-1">Latitude</label>
                                      <input type="number"
                                             class="form-control"
                                             step="0.01"
                                             placeholder="e.g. 51.25"
                                             [(ngModel)]="centerLatitude">
                                  </div>
                                  <div class="col-md-4">
                                      <label class="form-label small text-muted mb-1">Longitude</label>
                                      <input type="number"
                                             class="form-control"
                                             step="0.01"
                                             placeholder="e.g. 0.75"
                                             [(ngModel)]="centerLongitude">
                                  </div>
                                  <div class="col-md-4">
                                      <label class="form-label small text-muted mb-1">Zoom</label>
                                      <input type="number"
                                             class="form-control"
                                             min="5"
                                             max="15"
                                             step="1"
                                             placeholder="e.g. 10"
                                             [(ngModel)]="mapZoom">
                                  </div>
                              </div>
                              <div class="form-text">
                                  The default center and zoom level for your area map when first loaded.
                              </div>
                          </div>
                          <div class="mt-3">
                              <label class="form-label">Outlier distance cutoff (miles)</label>
                              <input type="number"
                                     class="form-control"
                                     min="100"
                                     max="2000"
                                     step="50"
                                     [(ngModel)]="config.area.mapOutlierMaxDistanceMiles">
                              <div class="form-text">
                                  Points beyond this distance from the area center are excluded from map bounds.
                              </div>
                          </div>
                      }
                  </div>
              </div>
          </div>
      </div>
  `,
  imports: [CommonModule, BadgeButtonComponent, FontAwesomeModule, FormsModule, MarkdownEditorComponent, NgSelectComponent, AreaMap, SharedDistrictStyleSelectorComponent]
})
export class SystemAreaMapSyncComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ramblersService = inject(RamblersWalksAndEventsService);
  stringUtils = inject(StringUtilsService);
  private logger: Logger = inject(LoggerFactory).createLogger("SystemAreaMapSyncComponent", NgxLoggerLevel.ERROR);

  @Input() config: SystemConfig;
  @Output() busyChange = new EventEmitter<boolean>();

  busy = false;
  errorMessage = "";
  groupsSuccessMessage = "";
  geoSuccessMessage = "";
  geoDataNeedsUpdate = false;
  effectiveKey = "";
  hasS3Data = false;
  hasAreaGroups = false;
  availableDistricts: string[] = [];
  districtsLoaded = false;
  private inferredDistrictsByGroup = new Map<string, string[]>();
  private relevantDistricts: Set<string> = new Set<string>();
  missingGeographicData = false;
  geographicDataMessage = "";
  neighboringAreaCodes: string[] = [];
  availableNeighboringAreas: (AvailableArea & { ngSelectLabel: string })[] = [];
  loadingNeighboringAreas = false;
  filterText = "";
  sortField: "groupCode" | "name" | "districts" = "groupCode";
  sortAsc = true;
  faSearch = faSearch;
  faArrowUp = faArrowUp;
  faArrowDown = faArrowDown;

  get exclusiveDistricts(): boolean {
    return this.config?.area?.exclusiveDistricts !== false;
  }

  set exclusiveDistricts(value: boolean) {
    if (this.config?.area) {
      this.config.area.exclusiveDistricts = value;
    }
  }

  get sharedDistrictsEnabled(): boolean {
    return !this.exclusiveDistricts;
  }

  set sharedDistrictsEnabled(value: boolean) {
    this.exclusiveDistricts = !value;
  }

  get sharedDistrictStyle(): SharedDistrictStyle {
    return this.config?.area?.sharedDistrictStyle || SharedDistrictStyle.FIRST_GROUP;
  }

  set sharedDistrictStyle(value: SharedDistrictStyle) {
    if (this.config?.area) {
      this.config.area.sharedDistrictStyle = value;
    }
  }

  get centerLatitude(): number | null {
    return this.config?.area?.center?.[0] ?? null;
  }

  set centerLatitude(value: number | null) {
    if (this.config?.area) {
      if (!this.config.area.center) {
        this.config.area.center = [51.25, 0.75];
      }
      this.config.area.center[0] = value ?? 51.25;
    }
  }

  get centerLongitude(): number | null {
    return this.config?.area?.center?.[1] ?? null;
  }

  set centerLongitude(value: number | null) {
    if (this.config?.area) {
      if (!this.config.area.center) {
        this.config.area.center = [51.25, 0.75];
      }
      this.config.area.center[1] = value ?? 0.75;
    }
  }

  get mapZoom(): number | null {
    return this.config?.area?.zoom ?? null;
  }

  set mapZoom(value: number | null) {
    if (this.config?.area) {
      this.config.area.zoom = value ?? 10;
    }
  }

  get editingGroups(): AreaGroup[] {
    return this.config?.area?.groups || [];
  }

  set editingGroups(groups: AreaGroup[]) {
    if (this.config?.area) {
      this.config.area.groups = groups;
    }
  }

  get filteredAndSortedGroups(): AreaGroup[] {
    let groups = this.editingGroups;
    if (this.filterText) {
      const filter = this.filterText.toLowerCase();
      groups = groups.filter(g =>
        g.groupCode?.toLowerCase().includes(filter) ||
        g.name?.toLowerCase().includes(filter) ||
        (Array.isArray(g.onsDistricts) ? g.onsDistricts.join(" ").toLowerCase().includes(filter) : g.onsDistricts?.toLowerCase().includes(filter))
      );
    }
    return groups.slice().sort((a, b) => {
      let comparison = 0;
      switch (this.sortField) {
        case "groupCode":
          comparison = (a.groupCode || "").localeCompare(b.groupCode || "");
          break;
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "districts":
          const aDistricts = Array.isArray(a.onsDistricts) ? a.onsDistricts.length : (a.onsDistricts ? 1 : 0);
          const bDistricts = Array.isArray(b.onsDistricts) ? b.onsDistricts.length : (b.onsDistricts ? 1 : 0);
          comparison = aDistricts - bDistricts;
          break;
      }
      return this.sortAsc ? comparison : -comparison;
    });
  }

  onFilterChange() {
    this.updateQueryParams();
  }

  onSortChange(field: "groupCode" | "name" | "districts") {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }
    this.updateQueryParams();
  }

  private updateQueryParams() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        filter: this.filterText || null,
        sort: this.sortField !== "groupCode" ? this.sortField : null,
        sortAsc: this.sortAsc ? null : "false"
      },
      queryParamsHandling: "merge"
    });
  }

  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faEdit = faEdit;
  protected readonly faInfoCircle = faInfoCircle;
  protected readonly faRefresh = faRefresh;
  protected readonly faSave = faSave;
  protected readonly faTimes = faTimes;

  ngOnInit() {
    this.refreshKey();
    this.loadAreaGroups();
    this.loadAvailableDistricts();
    this.loadAvailableNeighboringAreas();
    const params = this.route.snapshot.queryParams;
    this.filterText = params["filter"] || "";
    this.sortField = params["sort"] || "groupCode";
    this.sortAsc = params["sortAsc"] !== "false";
  }

  private loadAvailableDistricts() {
    const mainAreaCode = this.config?.area?.groupCode || this.config?.area?.groups?.[0]?.groupCode?.substring(0, 2);

    if (!mainAreaCode) {
      this.districtsLoaded = true;
      return;
    }

    this.missingGeographicData = false;
    this.geographicDataMessage = "";

    const neighboringCodes = this.config?.area?.neighboringAreaCodes || [];
    const allAreaCodes = [mainAreaCode, ...neighboringCodes];
    const params = allAreaCodes.length > 1
      ? { areaCodes: allAreaCodes.join(",") }
      : { areaCode: mainAreaCode };

    this.http.get<{ districts?: string[] }>("api/areas/preview-districts", { params }).subscribe({
      next: (previewResponse) => {
        if (previewResponse.districts && previewResponse.districts.length > 0) {
          this.availableDistricts = previewResponse.districts;
          this.districtsLoaded = true;
          this.updateRelevantDistricts();
        } else {
          this.districtsLoaded = true;
        }
      },
      error: (previewError) => {
        this.logger.error("Failed to load districts from preview API:", previewError);
        this.availableDistricts = [];
        this.districtsLoaded = true;
        this.missingGeographicData = true;
        this.geographicDataMessage = "Upload geographic data to enable district selection.";
        this.updateRelevantDistricts();
      }
    });
  }

  private loadAvailableNeighboringAreas() {
    this.loadingNeighboringAreas = true;
    this.http.get<{ areas: AvailableArea[] }>("api/areas/available-areas").subscribe({
      next: (response) => {
        const currentAreaCode = this.config?.area?.groupCode;
        this.availableNeighboringAreas = response.areas
          .filter(area => area.areaCode !== currentAreaCode)
          .map(area => ({
            ...area,
            ngSelectLabel: `${area.areaName} (${area.areaCode})`
          }));
        this.neighboringAreaCodes = this.config?.area?.neighboringAreaCodes || [];
        this.loadingNeighboringAreas = false;
      },
      error: (error) => {
        this.logger.error("Failed to load available areas:", error);
        this.loadingNeighboringAreas = false;
      }
    });
  }

  onNeighboringAreasChange(selectedCodes: string[]) {
    if (this.config?.area) {
      this.config.area.neighboringAreaCodes = selectedCodes;
    }
    this.loadAvailableDistricts();
  }

  upload() {
    if (this.busy) {
      return;
    }

    this.setBusy(true);
    this.errorMessage = "";
    this.groupsSuccessMessage = "";
    this.geoSuccessMessage = "";
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.authService.authToken() ?? ""}`
    });

    this.http.post<{ key: string; featureCount?: number }>("api/areas/upload-default", {}, { headers }).subscribe({
      next: response => {
        if (response?.key) {
          this.logger.info("Uploaded area map to", response.key);
          const featureInfo = response.featureCount ? ` with ${response.featureCount} district${response.featureCount !== 1 ? "s" : ""}` : "";
          this.geoSuccessMessage = `Successfully uploaded area map${featureInfo}`;
          this.geoDataNeedsUpdate = false;
          this.groupsSuccessMessage = "";
          this.refreshKey();
          this.loadAvailableDistricts();
        } else {
          this.errorMessage = "Upload succeeded but no key was returned";
        }
        this.setBusy(false);
      },
      error: error => {
        this.errorMessage = isString(error?.error) ? error.error : "Failed to upload area map";
        this.logger.error("Area map upload failed", error);
        this.setBusy(false);
      }
    });
  }

  private setBusy(value: boolean) {
    this.busy = value;
    this.busyChange.emit(value);
  }

  deleteS3Data() {
    if (this.busy) {
      return;
    }

    this.setBusy(true);
    this.errorMessage = "";
    this.groupsSuccessMessage = "";
    this.geoSuccessMessage = "";
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.authService.authToken() ?? ""}`
    });

    this.http.delete<{ message: string; deletedKeys: string[] }>("api/areas/s3-data", { headers }).subscribe({
      next: response => {
        const count = response.deletedKeys?.length || 0;
        this.logger.info(`Deleted ${count} area map object(s):`, response.deletedKeys);
        this.geoSuccessMessage = `Successfully reset area map data`;
        this.refreshKey();
        this.loadAvailableDistricts();
        this.setBusy(false);
      },
      error: error => {
        this.errorMessage = isString(error?.error) ? error.error : "Failed to reset area map data";
        this.logger.error("Area map reset failed", error);
        this.setBusy(false);
      }
    });
  }

  private refreshKey() {
    this.http.get<{ key: string | null }>("api/areas/key").subscribe({
      next: response => {
        this.effectiveKey = response.key || "";
        this.hasS3Data = !!response.key;
      },
      error: error => {
        this.logger.warn("Failed to resolve area map key", error);
      }
    });
  }

  private loadAreaGroups() {
    const groups = this.config?.area?.groups || [];
    this.hasAreaGroups = groups.length > 0;
    this.logger.info(`loadAreaGroups: found ${groups.length} groups, hasAreaGroups=${this.hasAreaGroups}`);
    if (!this.hasAreaGroups) {
      this.editingGroups = [];
      this.inferredDistrictsByGroup.clear();
      this.updateRelevantDistricts();
      return;
    }
    this.editingGroups = groups.map(group => ({ ...group, onsDistricts: Array.isArray(group.onsDistricts) ? [...group.onsDistricts] : group.onsDistricts }));
    this.logger.info(`loadAreaGroups: editingGroups populated with ${this.editingGroups.length} groups`);
    this.inferredDistrictsByGroup.clear();
    this.updateRelevantDistricts();
  }

  fetchRamblersGroups() {
    if (this.busy) {
      return;
    }

    this.setBusy(true);
    this.errorMessage = "";
    this.groupsSuccessMessage = "";
    this.geoSuccessMessage = "";

    const mainAreaCode = this.config?.area?.groupCode || this.config?.area?.groups?.[0]?.groupCode?.substring(0, 2);
    if (!mainAreaCode) {
      this.errorMessage = "Unable to determine area code from configuration. Please configure Area & Group settings first.";
      this.setBusy(false);
      return;
    }

    const neighboringCodes = this.config?.area?.neighboringAreaCodes || [];
    const allAreaCodes = [mainAreaCode, ...neighboringCodes];
    const previewParams: Record<string, string> = allAreaCodes.length > 1
      ? { areaCodes: allAreaCodes.join(","), exclusive: String(this.exclusiveDistricts) }
      : { areaCode: mainAreaCode, exclusive: String(this.exclusiveDistricts) };

    this.http.get<{ groups: any[], districts?: string[], groupDistrictMap?: Record<string, string[]> }>("api/areas/preview-districts", { params: previewParams }).subscribe({
      next: async previewResponse => {
        if (previewResponse.districts && previewResponse.districts.length > 0 && this.availableDistricts.length === 0) {
          this.availableDistricts = previewResponse.districts;
          this.districtsLoaded = true;
          this.logger.info(`Loaded ${this.availableDistricts.length} districts from preview API`);
        }

        try {
          const groups = await this.ramblersService.listRamblersGroups(allAreaCodes);
          this.http.get<{ groups: any[] }>("api/areas/groups").subscribe({
            next: existingResponse => {
              this.processRamblersGroups(groups, existingResponse?.groups || [], previewResponse.groupDistrictMap || {}, allAreaCodes);
            },
            error: error => {
              this.errorMessage = isString(error?.error) ? error.error : "Failed to fetch existing groups";
              this.logger.error("Existing groups fetch failed", error);
              this.setBusy(false);
            }
          });
        } catch (error: any) {
          this.errorMessage = isString(error?.error) ? error.error : "Failed to fetch groups from Ramblers";
          this.logger.error("Ramblers groups fetch failed", error);
          this.setBusy(false);
        }
      },
      error: () => {
        this.errorMessage = "No geographic data available. Please upload area map data first.";
        this.logger.warn("Preview districts endpoint not available, cannot rebuild groups without geographic data");
        this.setBusy(false);
      }
    });
  }

  private processRamblersGroups(
    groups: RamblersGroupsApiResponse[],
    existingGroups: any[],
    groupDistrictMap: Record<string, string[]>,
    allAreaCodes: string[]
  ) {
    const existingGroupsMap = new Map(existingGroups.map(existing => [existing.groupCode, existing]));
    const filteredGroups = groups.filter(group => !allAreaCodes.includes(group.group_code));
    const usedColors = new Set<string>();
    this.inferredDistrictsByGroup.clear();

    this.editingGroups = filteredGroups.map(group => {
      const existing = existingGroupsMap.get(group.group_code);
      const inferredDistricts = groupDistrictMap[group.group_code] || [];
      this.inferredDistrictsByGroup.set(group.group_code, inferredDistricts);
      let existingDistricts: string[] = [];
      if (Array.isArray(existing?.onsDistricts)) {
        existingDistricts = [...existing.onsDistricts as string[]];
      } else if (isString(existing?.onsDistricts) && existing.onsDistricts.trim().length > 0) {
        existingDistricts = [existing.onsDistricts];
      }
      const onsDistricts = [...new Set(existingDistricts.length > 0 ? existingDistricts : inferredDistricts)];
      const nonGeographic = onsDistricts.length === 0 ? (existing?.nonGeographic ?? false) : false;
      const color = this.generateUniqueColor(usedColors);
      usedColors.add(color);
      return {
        groupCode: group.group_code,
        name: group.name,
        url: group.url,
        externalUrl: group.external_url,
        onsDistricts,
        color,
        nonGeographic
      };
    });
    this.hasAreaGroups = true;
    this.updateRelevantDistricts();
    this.setBusy(false);
  }

  private generateRandomColor(): string {
    const ramblersColors = [
      "#9BC8AB",
      "#F6B09D",
      "#F9B104",
      "#F08050",
      "#DEE2E6"
    ];
    return ramblersColors[Math.floor(Math.random() * ramblersColors.length)];
  }

  private generateUniqueColor(usedColors: Set<string>): string {
    const ramblersColors = [
      "#9BC8AB",
      "#F6B09D",
      "#F9B104",
      "#F08050",
      "#DEE2E6",
      "#7FB3D5",
      "#C39BD3",
      "#F8C471",
      "#85C1E2",
      "#F1948A",
      "#73C6B6",
      "#D7BDE2"
    ];

    const availableColors = ramblersColors.filter(color => !usedColors.has(color));

    if (availableColors.length > 0) {
      return availableColors[0];
    }

    const hue = Math.floor(Math.random() * 360);
    const saturation = 60 + Math.floor(Math.random() * 20);
    const lightness = 65 + Math.floor(Math.random() * 15);
    const generatedColor = this.hslToHex(hue, saturation, lightness);

    if (!usedColors.has(generatedColor)) {
      return generatedColor;
    }

    return ramblersColors[0];
  }

  private hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  private ensureHexColor(color: string | undefined): string {
    if (!color) {
      return this.generateRandomColor();
    }
    if (color.startsWith("#")) {
      return color;
    }
    const tempElement = document.createElement("div");
    tempElement.style.color = color;
    document.body.appendChild(tempElement);
    const computedColor = window.getComputedStyle(tempElement).color;
    document.body.removeChild(tempElement);
    const match = computedColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (match) {
      const r = asNumber(match[1]).toString(16).padStart(2, "0");
      const g = asNumber(match[2]).toString(16).padStart(2, "0");
      const b = asNumber(match[3]).toString(16).padStart(2, "0");
      return `#${r}${g}${b}`;
    }
    return this.generateRandomColor();
  }


  onNonGeographicChange(group: AreaGroup) {
    if (group.nonGeographic) {
      group.onsDistricts = [];
    }
    this.updateRelevantDistricts();
  }

  onDistrictsChange(group: AreaGroup) {
    const districts = Array.isArray(group.onsDistricts) ? group.onsDistricts : [];
    if (districts.length > 0) {
      group.nonGeographic = false;
      if (this.exclusiveDistricts) {
        this.removeDistrictsFromOtherGroups(group);
      }
    }
    this.updateRelevantDistricts();
  }

  private removeDistrictsFromOtherGroups(changedGroup: AreaGroup) {
    const changedDistricts = Array.isArray(changedGroup.onsDistricts) ? changedGroup.onsDistricts : [];
    this.editingGroups.forEach(group => {
      if (group.groupCode !== changedGroup.groupCode) {
        const groupDistricts = Array.isArray(group.onsDistricts) ? group.onsDistricts : [];
        group.onsDistricts = groupDistricts.filter(district => !changedDistricts.includes(district));
      }
    });
  }

  availableDistrictsForGroup(group: AreaGroup): string[] {
    return this.availableDistricts;
  }

  get unallocatedDistricts(): string[] {
    const allocatedDistricts = new Set<string>();

    this.editingGroups.forEach(group => {
      if (!group.nonGeographic) {
        const districts = Array.isArray(group.onsDistricts) ? group.onsDistricts : [];
        districts.forEach(d => allocatedDistricts.add(d));
      }
    });

    const unallocated = this.availableDistricts.filter(d => !allocatedDistricts.has(d)).sort();

    this.logger.info(`unallocatedDistricts: availableDistricts=${this.availableDistricts.length}, allocated=${allocatedDistricts.size}, unallocated=${unallocated.length}`);
    if (unallocated.length > 0) {
      this.logger.info(`Unallocated districts:`, unallocated);
    }

    return unallocated;
  }

  private updateRelevantDistricts() {
    const relevant = new Set<string>();

    this.editingGroups.forEach(group => {
      const assigned = Array.isArray(group.onsDistricts) ? group.onsDistricts : [];
      assigned.forEach(d => relevant.add(d));
      const inferred = this.inferredDistrictsByGroup.get(group.groupCode) || [];
      inferred.forEach(d => relevant.add(d));
    });

    this.relevantDistricts = relevant;
  }

  get relevantUnallocatedDistricts(): string[] {
    return this.unallocatedDistricts.filter(d => this.relevantDistricts.has(d));
  }

  rebuildGroupsInEditMode() {
    if (this.busy) {
      return;
    }

    this.setBusy(true);
    this.errorMessage = "";
    this.groupsSuccessMessage = "";
    this.geoSuccessMessage = "";

    const existingGroupsMap = new Map(this.editingGroups.map(g => [g.groupCode, g]));
    this.logger.info("Existing groups before rebuild:", this.editingGroups);
    const mainAreaCode = this.config?.area?.groupCode || this.editingGroups[0]?.groupCode?.substring(0, 2);

    if (!mainAreaCode) {
      this.errorMessage = "Unable to determine area code from current configuration. Please configure Area & Group settings first.";
      this.setBusy(false);
      return;
    }

    const neighboringCodes = this.config?.area?.neighboringAreaCodes || [];
    const allAreaCodes = [mainAreaCode, ...neighboringCodes];
    const previewParams: Record<string, string> = allAreaCodes.length > 1
      ? { areaCodes: allAreaCodes.join(","), exclusive: String(this.exclusiveDistricts) }
      : { areaCode: mainAreaCode, exclusive: String(this.exclusiveDistricts) };

    this.editingGroups = [];
    this.inferredDistrictsByGroup.clear();

    this.http.get<{ groupDistrictMap?: Record<string, string[]> }>("api/areas/preview-districts", { params: previewParams }).subscribe({
      next: async previewResponse => {
        const groupDistrictMap = previewResponse.groupDistrictMap || {};

        try {
          const groups = await this.ramblersService.listRamblersGroups(allAreaCodes);
          const filteredGroups = groups.filter(group => !allAreaCodes.includes(group.group_code));
          if (filteredGroups.length === 0) {
            this.errorMessage = "No groups found from Ramblers API";
            this.setBusy(false);
            return;
          }

          const usedColors = new Set<string>();
          existingGroupsMap.forEach(existing => {
            if (existing.color) {
              usedColors.add(this.ensureHexColor(existing.color));
            }
          });

          this.inferredDistrictsByGroup.clear();
          this.editingGroups = filteredGroups.map(group => {
            const existing = existingGroupsMap.get(group.group_code);
            const inferredDistricts = groupDistrictMap[group.group_code] || [];
            this.inferredDistrictsByGroup.set(group.group_code, inferredDistricts);
            const onsDistricts = [...new Set(inferredDistricts)];
            const suggestedNonGeographic = onsDistricts.length === 0 ? (existing?.nonGeographic ?? false) : false;
            let newColor: string;
            if (existing?.color) {
              newColor = this.ensureHexColor(existing.color);
            } else {
              newColor = this.generateUniqueColor(usedColors);
              usedColors.add(newColor);
            }
            this.logger.info(`Rebuilding group ${group.group_code}: color=${newColor}`);
            return {
              groupCode: group.group_code,
              name: group.name,
              url: group.url,
              externalUrl: group.external_url,
              onsDistricts,
              color: newColor,
              nonGeographic: suggestedNonGeographic
            };
          });
          this.groupsSuccessMessage = "Click 'Update Geographic Data' below to apply changes to the map.";
          this.geoDataNeedsUpdate = true;
          this.updateRelevantDistricts();
          this.setBusy(false);
        } catch (error: any) {
          this.errorMessage = isString(error?.error) ? error.error : "Failed to fetch groups from Ramblers";
          this.logger.error("Ramblers groups fetch failed", error);
          this.setBusy(false);
        }
      },
      error: () => {
        this.errorMessage = "No geographic data available. Please upload area map data first.";
        this.logger.warn("Preview districts endpoint not available for rebuild");
        this.setBusy(false);
      }
    });
  }
}
