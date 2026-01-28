import { Component, inject, Input, OnInit } from "@angular/core";
import { faAdd, faRemove } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AvailableArea, EventPopulation, SystemConfig } from "../../../../models/system.model";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UiSwitchModule } from "ngx-ui-switch";
import { enumKeyValues, KeyValue } from "../../../../functions/enums";
import { WalkListView } from "../../../../models/walk.model";
import { RamblersWalksAndEventsService } from "../../../../services/walks-and-events/ramblers-walks-and-events.service";
import { RamblersGroupsApiResponse, RamblersGroupWithLabel } from "../../../../models/ramblers-walks-manager";
import { NgSelectComponent } from "@ng-select/ng-select";
import { StatusIconComponent } from "../../status-icon";
import { Status } from "../../../../models/ramblers-upload-audit.model";
import { AlertComponent } from "ngx-bootstrap/alert";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ALERT_WARNING } from "../../../../models/alert-target.model";
import { EM_DASH } from "../../../../models/content-text.model";
import { HttpClient } from "@angular/common/http";

@Component({
  selector: "[app-area-and-group-settings]",
  styles: [`
    .area-status-icon
      position: absolute
      right: 32px
      top: 50%
      transform: translateY(-50%)
      z-index: 10
      pointer-events: none
  `],
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row">
        <div class="col-md-12">
          <div class="form-group">
            <label for="area-group-code">Ramblers Area ({{ loadingAreas ? 'retrieving areas...' : availableAreas.length + ' areas available' }})</label>
            <div class="position-relative">
              <ng-select id="area-group-code"
                         [items]="availableAreas"
                         bindLabel="ngSelectLabel"
                         bindValue="areaCode"
                         [searchable]="true"
                         [clearable]="false"
                         dropdownPosition="bottom"
                         placeholder="Select an area..."
                         [(ngModel)]="config.area.groupCode"
                         (ngModelChange)="onAreaCodeChange($event)">
              </ng-select>
              <app-status-icon noLabel [status]="areaQueryStatus" class="area-status-icon"/>
            </div>
          </div>
        </div>
        <div class="col-md-12">
          <alert [type]="ALERT_WARNING.type">
            <fa-icon [icon]="ALERT_WARNING.icon"></fa-icon>
            <strong class="ms-2">Group Search</strong>
            <span class="p-2">{{ groupSearchMessage }}</span>
          </alert>
        </div>
        <div class="col-md-12">
          <div class="form-group">
            <label class="me-2">Selection Mode:</label>
            <div class="form-check form-check-inline">
              <input class="form-check-input"
                     id="area-selection-mode"
                     name="selection-mode"
                     type="radio"
                     [value]="'area'"
                     [(ngModel)]="selectionMode"
                     (change)="onSelectionModeChange()"/>
              <label class="form-check-label" for="area-selection-mode">Area Selection Mode</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input"
                     id="group-selection-mode"
                     name="selection-mode"
                     type="radio"
                     [value]="'group'"
                     [(ngModel)]="selectionMode"
                     (change)="onSelectionModeChange()"/>
              <label class="form-check-label" for="group-selection-mode">Group Selection Mode</label>
            </div>
          </div>
        </div>
        @if (selectionMode === 'group') {
          <div class="col-md-12">
            <div class="form-group">
              @if (areaGroup) {
                <label for="group-multi-select">Ramblers {{ stringUtils.pluralise(groupCodes().length, 'Group') }}
                  ({{ selectedGroups.length }}
                  of {{ availableGroups.length }} selected)</label>
                <ng-select id="group-multi-select"
                           [items]="availableGroups"
                           bindLabel="ngSelectAttributes.label"
                           [multiple]="true"
                           [searchable]="true"
                           [clearable]="true"
                           [loading]="loadingGroups"
                           dropdownPosition="bottom"
                           placeholder="Select one or more groups..."
                           [ngModel]="selectedGroups"
                           (ngModelChange)="onGroupCodesChange($event)">
                </ng-select>
              }
            </div>
          </div>
        }
        <div class="col-md-6">
          <div class="form-group">
            <label for="group-group-code">Ramblers
              Group {{ stringUtils.pluralise(groupCodes().length, 'Code') }}</label>
            <input disabled
                   [value]="groupCodesJoined()"
                   type="text" class="form-control input-sm"
                   id="group-group-code">
          </div>
        </div>
        <div class="col-md-6">
          <div class="form-group">
            <label for="group-long-name">Long Name</label>
            <input [(ngModel)]="config.group.longName"
                   type="text" class="form-control input-sm"
                   id="group-long-name"
                   placeholder="Enter a title for group long name">
          </div>
        </div>
        <div class="col-md-6">
          <div class="form-group">
            <label for="group-short-name">Short Name</label>
            <input [(ngModel)]="config.group.shortName"
                   type="text" class="form-control input-sm"
                   id="group-short-name"
                   placeholder="Enter a title for group short name">
          </div>
        </div>
        <div class="col-md-6">
          <div class="form-group">
            <label for="group-href">Web Url</label>
            <input [(ngModel)]="config.group.href"
                   type="text" class="form-control input-sm"
                   id="group-href"
                   placeholder="Enter a link">
          </div>
        </div>
        <div class="col-md-6">
          <div class="form-group">
            <label for="walk-population">Walk Population</label>
            <select [(ngModel)]="config.group.walkPopulation"
                    class="form-control" id="walk-population">
              @for (walkPopulation of populationMethods; track walkPopulation.key) {
                <option [ngValue]="walkPopulation.value">{{ stringUtils.asTitle(walkPopulation.value) }}</option>
              }
            </select>
          </div>
          <div class="form-group">
            <div class="form-check">
              <input [(ngModel)]="config.group.walkContactDetailsPublic"
                     type="checkbox" class="form-check-input"
                     id="walk-contact-details-public-viewable">
              <label class="form-check-label"
                     for="walk-contact-details-public-viewable">Walk Contact Details Public Viewable</label>
            </div>
          </div>
          <div class="form-group">
            <div class="form-check">
              <input [(ngModel)]="config.group.allowSwitchWalkView"
                     type="checkbox" class="form-check-input" id="allow-walk-listing-to-be-switched">
              <label class="form-check-label"
                     for="allow-walk-listing-to-be-switched">Allow Walk Listing to be switched
                between {{ walkListViewsJoined }}</label>
            </div>
          </div>
          <div class="form-group">
            <div class="form-check">
              <input [(ngModel)]="config.enableMigration.events"
                     type="checkbox" class="form-check-input" id="enable-event-migration">
              <label class="form-check-label"
                     for="enable-event-migration">Enable Migration of Events</label>
            </div>
          </div>
          <div class="form-group">
            <label for="navbar-location">Default Walk List View</label>
            <select class="form-control input-sm"
                    [(ngModel)]="config.group.defaultWalkListView"
                    id="navbar-location">
              @for (type of walkListViews; track type.key) {
                <option [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}</option>
              }
            </select>
          </div>
        </div>
        <div class="col-md-6">
          <div class="form-group">
            <label for="social-event-population">Social Event Population</label>
            <select [(ngModel)]="config.group.socialEventPopulation"
                    class="form-control" id="social-event-population">
              @for (walkPopulation of populationMethods; track walkPopulation.key) {
                <option [ngValue]="walkPopulation.value">{{ stringUtils.asTitle(walkPopulation.value) }}</option>
              }
            </select>
          </div>
          <div class="form-group">
            <div class="form-check">
              <input [(ngModel)]="config.group.socialDetailsPublic"
                     type="checkbox" class="form-check-input" id="social-details-public-viewable">
              <label class="form-check-label"
                     for="social-details-public-viewable">Social Details Public Viewable</label>
            </div>
          </div>
        </div>
      </div>
    </div>`,
  imports: [UiSwitchModule, NgSelectComponent, StatusIconComponent, AlertComponent, FontAwesomeModule]
})
export class AreaAndGroupSettingsComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("GroupSettingsComponent", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  stringUtils = inject(StringUtilsService);
  dateUtils = inject(DateUtilsService);
  ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  populationMethods: KeyValue<string>[] = enumKeyValues(EventPopulation);
  walkListViews: KeyValue<string>[] = enumKeyValues(WalkListView);
  walkListViewsJoined = this.walkListViews.map(item => this.stringUtils.asTitle(item.value)).join(" and ");
  faAdd = faAdd;
  faRemove = faRemove;
  groups: RamblersGroupsApiResponse[] = [];
  availableGroups: RamblersGroupWithLabel[] = [];
  availableAreas: (AvailableArea & { ngSelectLabel: string })[] = [];
  loadingAreas = false;
  @Input() config: SystemConfig;
  loadingGroups = false;
  selectedGroups: RamblersGroupsApiResponse[] = [];
  areaGroup: RamblersGroupsApiResponse;
  public selectionMode: string;
  protected readonly Status = Status;
  protected areaQueryStatus: Status = Status.INFO;
  protected groupQueryStatus: Status = Status.INFO;
  protected readonly ALERT_WARNING = ALERT_WARNING;
  protected groupSearchMessage: string;

  onSelectionModeChange() {
    if (this.selectionMode === "area") {
      this.config.group.groupCode = this.config.area.groupCode;
    } else {
      this.config.group.groupCode = "";
    }
    this.updateSelectedGroupCodes();
  }

  async ngOnInit() {
    this.logger.info("constructed with:config:", this.config);
    if (!this.config.enableMigration) {
      this.config.enableMigration = { events: false };
    }
    if (!this.config.area.groupCode && this.config.group.groupCode) {
      this.config.area.groupCode = this.stringUtils.left(this.config.group.groupCode, 2);
    }
    this.selectionMode = this.config?.group?.groupCode?.length === 2 ? "area" : "group";
    const initialAreaCode = this.config.area.groupCode;
    await this.loadAvailableAreas();
    if (initialAreaCode) {
      await this.queryGroups(initialAreaCode);
      this.updateSelectedGroupCodes();
    }
  }

  private async loadAvailableAreas(): Promise<void> {
    this.loadingAreas = true;
    this.areaQueryStatus = Status.ACTIVE;
    try {
      const response = await this.http.get<{ areas: AvailableArea[] }>("api/areas/available-areas").toPromise();
      this.availableAreas = (response?.areas || []).map(area => ({
        ...area,
        ngSelectLabel: `${area.areaName} (${area.areaCode})`
      }));
      this.areaQueryStatus = this.availableAreas.length > 0 ? Status.COMPLETE : Status.ERROR;
      this.logger.info("Loaded available areas:", this.availableAreas, "current groupCode:", this.config.area.groupCode);
      // Trigger change detection by re-setting the value after items are loaded
      if (this.config.area.groupCode) {
        const currentCode = this.config.area.groupCode;
        this.config.area.groupCode = null;
        setTimeout(() => this.config.area.groupCode = currentCode, 0);
      }
    } catch (error) {
      this.logger.error("Failed to load available areas:", error);
      this.areaQueryStatus = Status.ERROR;
    } finally {
      this.loadingAreas = false;
    }
  }

  async onAreaCodeChange(areaCode: string): Promise<void> {
    if (areaCode) {
      const selectedArea = this.availableAreas.find(a => a.areaCode === areaCode);
      if (selectedArea) {
        this.config.area.shortName = selectedArea.areaName;
      }
      await this.queryGroups(areaCode);
    }
  }

  public async queryGroups(group: string): Promise<void> {
    if (!group) {
      this.availableGroups = [];
      this.groups = [];
    } else {
      try {
        this.groupSearchMessage = "searching for groups";
        this.groupQueryStatus = Status.ACTIVE;
        this.loadingGroups = true;
        this.groups = await this.ramblersWalksAndEventsService.listRamblersGroups([group]);
        this.logger.info("Raw groups data returned from API:", this.groups);
        this.groupQueryStatus = this.groups.length > 0 ? Status.COMPLETE : Status.ERROR;
        const suffix = this.groups.length === 0 ? `${EM_DASH}try selecting a different area` : "";
        this.groupSearchMessage = `${this.stringUtils.pluraliseWithCount(this.groups.length, "area and group record")} found${suffix}`;
        this.availableGroups = this.groups.filter(group => group.scope === "G").map(group => ({
          ...group, ngSelectAttributes: {label: `${group.name} (${group.group_code})`}
        }));
        this.areaGroup = this.groups.find(group => group.scope === "A");
        this.logger.info("finding group:", group, "found:", this.groups, "areaGroup:", this.areaGroup);
        this.logger.info("Available groups (scope=G):", this.availableGroups.map(g => `${g.name} (${g.group_code})`).join(", "));
        if (this.areaGroup) {
          this.config.area.groupCode = this.areaGroup.group_code;
          this.config.area.shortName = this.areaGroup.name;
        }
      } catch (error) {
        this.logger.error("Error querying groups:", error);
        this.groupSearchMessage = `Error querying groups: ${this.stringUtils.stringifyObject(error)}`;
        this.groupQueryStatus = Status.ERROR;
      } finally {
        this.loadingGroups = false;
      }
    }
  }

  onGroupCodesChange(selectedItems: RamblersGroupsApiResponse[]) {
    this.logger.info("onGroupCodesChange:selectedItems:", selectedItems);
    this.config.group.groupCode = selectedItems.map(item => item.group_code).join(",");
    this.config.group.longName = selectedItems.map(item => item.name).join(", ");
    this.updateSelectedGroupCodes();
  }

  private updateSelectedGroupCodes() {
    const selectedCodes = this.groupCodes();
    this.selectedGroups = this.availableGroups.filter(group => selectedCodes.includes(group.group_code));
  }

  public splitDelimitedList(groupCode: string): string[] {
    return groupCode.split(",").map(item => item.trim()).filter(Boolean);
  }

  public groupCodesJoined(): string {
    return this.groupCodes()?.join(", ");
  }

  public groupCodes(): string[] {
    return this.splitDelimitedList(this.config?.group?.groupCode);
  }
}
