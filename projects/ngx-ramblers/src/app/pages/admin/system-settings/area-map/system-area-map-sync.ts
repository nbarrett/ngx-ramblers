import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AuthService } from "../../../../auth/auth.service";
import { BadgeButtonComponent } from "../../../../modules/common/badge-button/badge-button";
import { CommonModule } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCheckCircle, faEdit, faRefresh, faSave, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FormsModule } from "@angular/forms";
import { AreaGroup, SystemConfig } from "../../../../models/system.model";
import { MarkdownEditorComponent } from "../../../../markdown-editor/markdown-editor.component";
import { NgSelectComponent } from "@ng-select/ng-select";
import { isString } from "es-toolkit/predicate";
import { asNumber } from "../../../../functions/numbers";

interface RamblersGroupsResponse {
  request: any;
  response?: RamblersGroup[];
}

interface RamblersGroup {
  group_code: string;
  name: string;
  url: string;
  latitude?: number;
  longitude?: number;
}

@Component({
  selector: "app-area-map-sync-settings",
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
                          <div class="table-responsive mb-3">
                              <table class="table table-sm table-striped">
                                  <thead>
                                  <tr>
                                      <th>Group Code</th>
                                      <th>Group Name</th>
                                      <th>Districts</th>
                                      <th>Color</th>
                                      <th class="text-center">Non-Geographic</th>
                                  </tr>
                                  </thead>
                                  <tbody>
                                      @for (group of editingGroups; track group.groupCode) {
                                          <tr>
                                              <td class="align-middle">{{ group.groupCode }}</td>
                                              <td class="align-middle">{{ group.name }}</td>
                                              <td>
                                                  <ng-select [items]="availableDistricts"
                                                             [multiple]="true"
                                                             [searchable]="true"
                                                             [clearable]="true"
                                                             [closeOnSelect]="false"
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
                      @if (successMessage) {
                          <div class="alert alert-success mt-3 mb-0" role="alert">
                              {{ successMessage }}
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
                          <div class="alert alert-success mb-3" role="alert">
                              <fa-icon [icon]="faCheckCircle" class="me-2"></fa-icon>
                              <strong>Area Map Active:</strong> Your area map is configured and ready to use.
                          </div>
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
                      @if (successMessage) {
                          <div class="alert alert-success mt-3 mb-0" role="alert">
                              {{ successMessage }}
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
                  </div>
              </div>
          </div>
      </div>
  `,
  imports: [CommonModule, BadgeButtonComponent, FontAwesomeModule, FormsModule, MarkdownEditorComponent, NgSelectComponent]
})
export class SystemAreaMapSyncComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private logger: Logger = inject(LoggerFactory).createLogger("SystemAreaMapSyncComponent", NgxLoggerLevel.ERROR);

  @Input() config: SystemConfig;
  @Output() busyChange = new EventEmitter<boolean>();

  busy = false;
  errorMessage = "";
  successMessage = "";
  effectiveKey = "";
  hasS3Data = false;
  hasAreaGroups = false;
  availableDistricts: string[] = [];
  districtsLoaded = false;
  private inferredDistrictsByGroup = new Map<string, string[]>();
  private relevantDistricts: Set<string> = new Set<string>();
  missingGeographicData = false;
  geographicDataMessage = "";

  get editingGroups(): AreaGroup[] {
    return this.config?.area?.groups || [];
  }

  set editingGroups(groups: AreaGroup[]) {
    if (this.config?.area) {
      this.config.area.groups = groups;
    }
  }
  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faEdit = faEdit;
  protected readonly faRefresh = faRefresh;
  protected readonly faSave = faSave;
  protected readonly faTimes = faTimes;

  ngOnInit() {
    this.refreshKey();
    this.loadAreaGroups();
    this.loadAvailableDistricts();
  }

  private loadAvailableDistricts() {
    const areaCode = this.config?.area?.groupCode || this.config?.area?.groups?.[0]?.groupCode?.substring(0, 2);

    if (!areaCode) {
      this.districtsLoaded = true;
      return;
    }

    this.missingGeographicData = false;
    this.geographicDataMessage = "";

    this.http.get<{ districts?: string[] }>("api/areas/preview-districts", { params: { areaCode } }).subscribe({
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

  upload() {
    if (this.busy) {
      return;
    }

    this.setBusy(true);
    this.errorMessage = "";
    this.successMessage = "";
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.authService.authToken() ?? ""}`
    });

    this.http.post<{ key: string; featureCount?: number }>("api/areas/upload-default", {}, { headers }).subscribe({
      next: response => {
        if (response?.key) {
          this.logger.info("Uploaded area map to", response.key);
          const featureInfo = response.featureCount ? ` with ${response.featureCount} district${response.featureCount !== 1 ? "s" : ""}` : "";
          this.successMessage = `Successfully uploaded area map${featureInfo}`;
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
    this.successMessage = "";
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.authService.authToken() ?? ""}`
    });

    this.http.delete<{ message: string; deletedKeys: string[] }>("api/areas/s3-data", { headers }).subscribe({
      next: response => {
        const count = response.deletedKeys?.length || 0;
        this.logger.info(`Deleted ${count} area map object(s):`, response.deletedKeys);
        this.successMessage = `Successfully reset area map data`;
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
    this.successMessage = "";

    const areaCode = this.config?.area?.groupCode || this.config?.area?.groups?.[0]?.groupCode?.substring(0, 2);
    if (!areaCode) {
      this.errorMessage = "Unable to determine area code from configuration. Please configure Area & Group settings first.";
      this.setBusy(false);
      return;
    }

    this.http.get<{ groups: any[], districts?: string[], groupDistrictMap?: Record<string, string[]> }>("api/areas/preview-districts", { params: { areaCode } }).subscribe({
      next: previewResponse => {
        if (previewResponse.districts && previewResponse.districts.length > 0 && this.availableDistricts.length === 0) {
          this.availableDistricts = previewResponse.districts;
          this.districtsLoaded = true;
          this.logger.info(`Loaded ${this.availableDistricts.length} districts from preview API`);
        }

        const body = { groups: [areaCode] };
        this.http.post<RamblersGroupsResponse>("api/ramblers/walks-manager/list-groups", body).subscribe({
          next: ramblersResponse => {
            const groups = ramblersResponse?.response || [];
            this.http.get<{ groups: any[] }>("api/areas/groups").subscribe({
              next: existingResponse => {
                const existingGroupsMap = new Map((existingResponse?.groups || []).map(existing => [existing.groupCode, existing]));
                const filteredGroups = groups.filter(group => group.group_code !== areaCode);
                const usedColors = new Set<string>();
                this.inferredDistrictsByGroup.clear();
                const groupDistrictMap = previewResponse.groupDistrictMap || {};

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
                    onsDistricts,
                    color,
                    nonGeographic
                  };
                });
                this.hasAreaGroups = true;
                this.updateRelevantDistricts();
                this.setBusy(false);
              },
              error: error => {
                this.errorMessage = isString(error?.error) ? error.error : "Failed to fetch existing groups";
                this.logger.error("Existing groups fetch failed", error);
                this.setBusy(false);
              }
            });
          },
          error: error => {
            this.errorMessage = isString(error?.error) ? error.error : "Failed to fetch groups from Ramblers";
            this.logger.error("Ramblers groups fetch failed", error);
            this.setBusy(false);
          }
        });
      },
      error: () => {
        this.errorMessage = "No geographic data available. Please upload area map data first.";
        this.logger.warn("Preview districts endpoint not available, cannot rebuild groups without geographic data");
        this.setBusy(false);
      }
    });
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
      "#7FB3D5",  // Light Blue
      "#C39BD3",  // Light Purple
      "#F8C471",  // Light Orange
      "#85C1E2",  // Sky Blue
      "#F1948A",  // Light Red
      "#73C6B6",  // Teal
      "#D7BDE2"   // Lavender
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
      this.removeDistrictsFromOtherGroups(group);
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
    this.successMessage = "";

    const existingGroupsMap = new Map(this.editingGroups.map(g => [g.groupCode, g]));
    this.logger.info("Existing groups before rebuild:", this.editingGroups);
    const areaCode = this.config?.area?.groupCode || this.editingGroups[0]?.groupCode?.substring(0, 2);

    if (!areaCode) {
      this.errorMessage = "Unable to determine area code from current configuration. Please configure Area & Group settings first.";
      this.setBusy(false);
      return;
    }

    this.editingGroups = [];
    this.inferredDistrictsByGroup.clear();

    this.http.get<{ groupDistrictMap?: Record<string, string[]> }>("api/areas/preview-districts", { params: { areaCode } }).subscribe({
      next: previewResponse => {
        const groupDistrictMap = previewResponse.groupDistrictMap || {};
        const body = { groups: [areaCode] };
        this.http.post<RamblersGroupsResponse>("api/ramblers/walks-manager/list-groups", body).subscribe({
          next: ramblersResponse => {
            const groups = ramblersResponse?.response || [];
            const filteredGroups = groups.filter(group => group.group_code !== areaCode);
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
                onsDistricts,
                color: newColor,
                nonGeographic: suggestedNonGeographic
              };
            });
            this.successMessage = "Groups refreshed from Ramblers API";
            this.updateRelevantDistricts();
            this.setBusy(false);
          },
          error: error => {
            this.errorMessage = isString(error?.error) ? error.error : "Failed to fetch groups from Ramblers";
            this.logger.error("Ramblers groups fetch failed", error);
            this.setBusy(false);
          }
        });
      },
      error: () => {
        this.errorMessage = "No geographic data available. Please upload area map data first.";
        this.logger.warn("Preview districts endpoint not available for rebuild");
        this.setBusy(false);
      }
    });
  }
}
