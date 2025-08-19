import { Component, inject, Input, OnInit } from "@angular/core";
import { faAdd, faRemove } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { EventPopulation, SystemConfig } from "../../../../models/system.model";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { LinksEditComponent } from "../../../../modules/common/links-edit/links-edit";
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

@Component({
  selector: "[app-area-and-group-settings]",
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row">
        <div class="col-md-6"><label for="area-group-code">Ramblers Area Code</label>
          <div class="input-group">
            <input [(ngModel)]="config.area.groupCode"
                   (ngModelChange)="queryGroups(config.area.groupCode)"
                   type="text" class="form-control input-sm"
                   id="area-group-code"
                   placeholder="Enter a 2 digit Area Code">
            <div class="input-group-append">
              <div class="input-group-text">
                <app-status-icon noLabel [status]="groupQueryStatus"/>
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="form-group">
            <label for="area-name">Area Name</label>
            <input [(ngModel)]="config.area.shortName"
                   type="text" class="form-control input-sm"
                   id="area-name"
                   placeholder="Enter a 2 digit Area Code">
          </div>
        </div>
        <div class="col-md-12">
          <alert [type]="ALERT_WARNING.type">
            <fa-icon [icon]="ALERT_WARNING.icon"></fa-icon>
            <strong class="ml-2">Group Search</strong>
            <span class="p-2">{{ groupSearchMessage }}</span>
          </alert>
        </div>
        <div class="col-md-12">
          <div class="form-group">
            <label class="mr-2">Selection Mode:</label>
            <div class="custom-control custom-radio custom-control-inline">
              <input class="custom-control-input"
                     id="area-selection-mode"
                     name="selection-mode"
                     type="radio"
                     [value]="'area'"
                     [(ngModel)]="selectionMode"
                     (change)="onSelectionModeChange()"/>
              <label class="custom-control-label" for="area-selection-mode">Area Selection Mode</label>
            </div>
            <div class="custom-control custom-radio custom-control-inline">
              <input class="custom-control-input"
                     id="group-selection-mode"
                     name="selection-mode"
                     type="radio"
                     [value]="'group'"
                     [(ngModel)]="selectionMode"
                     (change)="onSelectionModeChange()"/>
              <label class="custom-control-label" for="group-selection-mode">Group Selection Mode</label>
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
            <div class="custom-control custom-checkbox">
              <input [(ngModel)]="config.group.walkContactDetailsPublic"
                     type="checkbox" class="custom-control-input"
                     id="walk-contact-details-public-viewable">
              <label class="custom-control-label"
                     for="walk-contact-details-public-viewable">Walk Contact Details Public Viewable</label>
            </div>
          </div>
          <div class="form-group">
            <div class="custom-control custom-checkbox">
              <input [(ngModel)]="config.group.allowSwitchWalkView"
                     type="checkbox" class="custom-control-input" id="allow-walk-listing-to-be-switched">
              <label class="custom-control-label"
                     for="allow-walk-listing-to-be-switched">Allow Walk Listing to be switched
                between {{ walkListViewsJoined }}</label>
            </div>
          </div>
          <div class="form-group">
            <div class="custom-control custom-checkbox">
              <input [(ngModel)]="config.enableMigration.events"
                     type="checkbox" class="custom-control-input" id="enable-event-migration">
              <label class="custom-control-label"
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
            <div class="custom-control custom-checkbox">
              <input [(ngModel)]="config.group.socialDetailsPublic"
                     type="checkbox" class="custom-control-input" id="social-details-public-viewable">
              <label class="custom-control-label"
                     for="social-details-public-viewable">Social Details Public Viewable</label>
            </div>
          </div>
        </div>
      </div>
      <app-links-edit [heading]='"Pages on Site"' [links]="config.group.pages"/>
    </div>`,
  imports: [LinksEditComponent, UiSwitchModule, NgSelectComponent, StatusIconComponent, AlertComponent, FontAwesomeModule]
})
export class AreaAndGroupSettingsComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("GroupSettingsComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  dateUtils = inject(DateUtilsService);
  ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  populationMethods: KeyValue<string>[] = enumKeyValues(EventPopulation);
  walkListViews: KeyValue<string>[] = enumKeyValues(WalkListView).filter(item => item.value !== WalkListView.MAP);
  walkListViewsJoined = this.walkListViews.map(item => this.stringUtils.asTitle(item.value)).join(" and ");
  faAdd = faAdd;
  faRemove = faRemove;
  groups: RamblersGroupsApiResponse[] = [];
  availableGroups: RamblersGroupWithLabel[] = [];
  @Input() config: SystemConfig;
  loadingGroups = false;
  selectedGroups: RamblersGroupsApiResponse[] = [];
  areaGroup: RamblersGroupsApiResponse;
  public selectionMode: string;
  protected readonly Status = Status;
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
    if (this.config.area.groupCode) {
      await this.queryGroups(this.config.area.groupCode);
      this.updateSelectedGroupCodes();
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
        this.groupQueryStatus = this.groups.length > 0 ? Status.COMPLETE : Status.ERROR;
        const suffix = this.groups.length === 0 ? `${EM_DASH}try entering a different 2 character value into the Ramblers Area Code` : "";
        this.groupSearchMessage = `${this.stringUtils.pluraliseWithCount(this.groups.length, "area and group record")} found${suffix}`;
        this.availableGroups = this.groups.filter(group => group.scope === "G").map(group => ({
          ...group, ngSelectAttributes: {label: `${group.name} (${group.group_code})`}
        }));
        this.areaGroup = this.groups.find(group => group.scope === "A");
        this.logger.info("finding group:", group, "found:", this.groups, "areaGroup:", this.areaGroup);
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
