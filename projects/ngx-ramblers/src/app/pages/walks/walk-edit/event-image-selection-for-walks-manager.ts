import { Component, inject, Input, OnInit } from "@angular/core";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { ExtendedGroupEventQueryService } from "../../../services/walks-and-events/extended-group-event-query.service";
import { ExtendedGroupEventWithLabel, GroupEventField } from "../../../models/walk.model";
import { RamblersGroupsApiResponse } from "../../../models/ramblers-walks-manager";
import { sortBy } from "../../../functions/arrays";
import { DateUtilsService } from "../../../services/date-utils.service";
import { BASIC_FILTER_OPTIONS, FilterCriteria } from "../../../models/api-request.model";
import { NgSelectComponent } from "@ng-select/ng-select";
import { FormsModule } from "@angular/forms";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { HasBasicEventSelection } from "../../../models/search.model";
import { ExtendedGroupEvent, InputSource } from "../../../models/group-event.model";
import { GroupSelector } from "./group-selector";

@Component({
  selector: "app-walk-images-selection-walks-manager",
  imports: [
    NgSelectComponent,
    FormsModule,
    GroupSelector
  ],
  template: `
    <div>
      <app-group-selector label="Import images from a walk in another Ramblers Group"
                          [groupCode]="groupEvent.fields.imageConfig.importFrom.groupCode"
                          [areaCode]="groupEvent.fields.imageConfig.importFrom.areaCode"
                          (groupChanged)="groupChange($event)"/>
      <div class="form-group">
        <label for="walk-filter">Walk Selection</label>
        <select id="walk-filter"
                [(ngModel)]="groupEvent.fields.imageConfig.importFrom.filterParameters.selectType"
                (ngModelChange)="refreshRamblersWalks()"
                name="selectType"
                class="form-control rounded">
          @for (filter of walksFilter(); track filter.value) {
            <option [ngValue]="filter.value" [selected]="filter.selected">
              {{ filter.description }}
            </option>
          }
        </select>
      </div>
      @if (eventsForSelect?.length > 0) {
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
      }
    </div>
  `
})
export class EventImageSelectionForWalksManager implements OnInit {
  protected readonly GroupEventField = GroupEventField;
  private walksReferenceService = inject(WalksReferenceService);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private extendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  private dateUtils = inject(DateUtilsService);
  private logger: Logger = inject(LoggerFactory).createLogger("EventImageSelectionForWalksManager", NgxLoggerLevel.ERROR);
  public eventsForSelect: ExtendedGroupEventWithLabel[] = [];
  public event: ExtendedGroupEventWithLabel;
  @Input() groupEvent!: ExtendedGroupEvent;

  async ngOnInit() {
  }

  walksFilter() {
    return this.walksReferenceService.walksFilter.filter(item => BASIC_FILTER_OPTIONS.includes(item.value));
  }

  refreshRamblersWalks() {
    const {groupCode, filterParameters} = this.groupEvent.fields.imageConfig.importFrom;
    this.ramblersWalksAndEventsService.all({
      inputSource: InputSource.MANUALLY_CREATED,
      suppressEventLinking: true,
      groupCode,
      dataQueryOptions: this.extendedGroupEventQueryService.dataQueryOptions(filterParameters)
    }).then(eventsForSelect => {
      this.logger.info("refreshRamblersWalks:groupCode:", groupCode, "filterParameters:", filterParameters, "eventsForSelect:", eventsForSelect, "importFrom:", this.groupEvent.fields.imageConfig.importFrom);
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
    return `${filterParameters.selectType === FilterCriteria.FUTURE_EVENTS ? "" : "-"}${GroupEventField.START_DATE}`;
  }

  walkChange(ramblersWalkId: string) {
    this.logger.info("onChange of ramblersWalkId:", ramblersWalkId, "imageConfig:", this.groupEvent.fields.imageConfig);
    const ramblersWalk: ExtendedGroupEventWithLabel = this.eventsForSelect.find(walk => walk.groupEvent.id === ramblersWalkId);
    this.ramblersWalksAndEventsService.copyMediaIfApplicable(this.groupEvent, ramblersWalk.groupEvent, true);
  }

  groupChange(apiResponse: RamblersGroupsApiResponse) {
    this.logger.info("onChange of groupCode:apiResponse:", apiResponse, "imageConfig:", this.groupEvent.fields.imageConfig);
    this.groupEvent.fields.imageConfig.importFrom.groupCode = apiResponse.group_code;
    this.refreshRamblersWalks();
  }
}
