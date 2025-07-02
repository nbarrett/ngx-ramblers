import { Component, inject, Input, OnInit } from "@angular/core";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { ExtendedGroupEventQueryService } from "../../../services/walks-and-events/extended-group-event-query.service";
import { ExtendedGroupEventForSelect, GROUP_EVENT_START_DATE, ImageSource } from "../../../models/walk.model";
import {
  EventQueryParameters,
  RamblersGroupsApiResponse,
  RamblersGroupWithLabel
} from "../../../models/ramblers-walks-manager";
import { sortBy } from "../../../functions/arrays";
import { DateUtilsService } from "../../../services/date-utils.service";
import { BASIC_FILTER_OPTIONS, FilterCriteria } from "../../../models/api-request.model";
import { NgSelectComponent } from "@ng-select/ng-select";
import { FormsModule } from "@angular/forms";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { HasBasicEventSelection } from "../../../models/search.model";
import { ExtendedGroupEvent } from "../../../models/group-event.model";

@Component({
  selector: "app-walk-images-selection-walks-manager",
  imports: [
    NgSelectComponent,
    FormsModule
  ],
  template: `
    <div>
      <div class="form-group">
        <label for="group-select">Import images from walk in another Ramblers Group</label>
        <ng-select id="group-select"
                   [items]="availableGroups"
                   bindLabel="ngSelectAttributes.label"
                   bindValue="group_code"
                   [searchable]="true"
                   [clearable]="true"
                   [loading]="loadingGroups"
                   placeholder="Select one or more groups..."
                   [ngModel]="groupEvent.fields.imageConfig.importFrom.groupCode"
                   (ngModelChange)="groupChange($event)">
        </ng-select>
      </div>
      <div class="form-group">
        <label for="walk-filter">Walk Selection</label>
        <select id="walk-filter"
                [(ngModel)]="groupEvent.fields.imageConfig.importFrom.filterParameters.selectType"
                (ngModelChange)="refreshWalks()"
                name="selectType"
                class="form-control rounded">
          @for (filter of walksFilter(); track filter.value) {
            <option [ngValue]="filter.value" [selected]="filter.selected">
              {{ filter.description }}
            </option>
          }
        </select>
      </div>
      <div class="form-group">
        <label for="linked-walk">Import from walk ({{ eventsForSelect?.length }} found)</label>
        <ng-select id="linked-walk"
                   [items]="eventsForSelect"
                   bindLabel="ngSelectAttributes.label"
                   bindValue="groupEvent.id"
                   [placeholder]="'Select a walk - type part of title to filter items'"
                   [dropdownPosition]="'bottom'"
                   [clearAllText]="'clear current selection'"
                   [closeOnSelect]="true"
                   [(ngModel)]="groupEvent.fields.imageConfig.importFrom.walkId"
                   (ngModelChange)="walkChange($event)">
        </ng-select>
      </div>
    </div>
  `
})
export class EventImageSelectionForWalksManager implements OnInit {
  private walksReferenceService = inject(WalksReferenceService);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private extendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  private dateUtils = inject(DateUtilsService);
  private logger: Logger = inject(LoggerFactory).createLogger("WalkImageSelectionWalksManagerComponent", NgxLoggerLevel.ERROR);
  loadingGroups = false;
  availableGroups: RamblersGroupWithLabel[] = [];
  groups: RamblersGroupsApiResponse[] = [];
  selectedGroup: RamblersGroupsApiResponse;
  areaGroup: RamblersGroupsApiResponse;
  public eventsForSelect: ExtendedGroupEventForSelect[] = [];
  public event: ExtendedGroupEventForSelect;
  @Input() groupEvent!: ExtendedGroupEvent;

  async ngOnInit() {
    await this.refreshGroupsAndWalksIfApplicable();
  }

  private async refreshGroupsAndWalksIfApplicable() {
    if (this.groupEvent?.fields?.imageConfig?.source === ImageSource.WALKS_MANAGER && this.groupEvent?.fields?.imageConfig?.importFrom?.areaCode) {
      await this.queryGroups(this.groupEvent.fields.imageConfig.importFrom.areaCode);
      this.updateSelectedGroupCodes();
    } else {
      this.logger.info("Not querying groups and walks - areaCode:", this.groupEvent?.fields?.imageConfig?.importFrom?.areaCode, "imageConfig.source:", this.groupEvent?.fields?.imageConfig.source);
    }
  }

  walksFilter() {
    return this.walksReferenceService.walksFilter.filter(item => BASIC_FILTER_OPTIONS.includes(item.value));
  }

  private updateSelectedGroupCodes() {
    this.selectedGroup = this.availableGroups.find(group => group.group_code === this.groupEvent?.fields?.imageConfig?.importFrom?.groupCode);
  }

  public async queryGroups(group: string): Promise<void> {
    if (group) {
      try {
        this.loadingGroups = true;
        this.groups = await this.ramblersWalksAndEventsService.listRamblersGroups([group]);
        this.availableGroups = this.groups.filter(group => group.scope === "G").map(group => ({
          ...group, ngSelectAttributes: {label: `${group.name} (${group.group_code})`}
        }));
        this.areaGroup = this.groups.find(group => group.scope === "A");
        this.logger.info("Searched for group:", group, "returned:", this.groups, "areaGroup:", this.areaGroup);
        if (this.areaGroup) {
          this.refreshWalks();
        }
      } catch (error) {
        this.logger.error("Error querying groups:", error);
      } finally {
        this.loadingGroups = false;
      }
    } else {
      this.logger.info("no group found in config group:", group, "found:", this.groups, "areaGroup:", this.areaGroup);
    }
  }

  refreshWalks() {
    const {groupCode, filterParameters} = this.groupEvent.fields.imageConfig.importFrom;
    const eventQueryParameters: EventQueryParameters = {
      groupCode,
      dataQueryOptions: this.extendedGroupEventQueryService.dataQueryOptions(filterParameters)
    };
    this.ramblersWalksAndEventsService.all(eventQueryParameters).then(eventsForSelect => {
      this.eventsForSelect = eventsForSelect
        .filter(walk => walk.groupEvent?.media?.length > 0)
        .sort(sortBy(this.sortColumn(filterParameters)))
        .map(walk => ({
          ...walk,
          ngSelectAttributes: {label: `${this.dateUtils.displayDate(walk.groupEvent.start_date_time)} - ${walk.groupEvent.title} - ${walk?.fields?.contactDetails?.displayName || "no walk leader found"}`}
        }));
    });
  }

  private sortColumn(filterParameters: HasBasicEventSelection) {
    return `${filterParameters.selectType === FilterCriteria.FUTURE_EVENTS ? "" : "-"}${GROUP_EVENT_START_DATE}`;
  }

  walkChange(ramblersWalkId: string) {
    this.logger.info("onChange of ramblersWalkId:", ramblersWalkId, "imageConfig:", this.groupEvent.fields.imageConfig);
    const ramblersWalk: ExtendedGroupEventForSelect = this.eventsForSelect.find(walk => walk.groupEvent.id === ramblersWalkId);
    this.ramblersWalksAndEventsService.copyMediaIfApplicable(this.groupEvent, ramblersWalk.groupEvent, true);
  }

  groupChange(groupCode: string) {
    this.groupEvent.fields.imageConfig.importFrom.groupCode = groupCode;
    this.refreshWalks();
  }
}
