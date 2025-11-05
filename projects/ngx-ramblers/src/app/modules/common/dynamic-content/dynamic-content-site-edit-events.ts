import { Component, inject, Input, OnInit } from "@angular/core";
import { faAdd, faPencil, faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentService } from "../../../services/page-content.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { UrlService } from "../../../services/url.service";
import { enumValues, KeyValue } from "../../../functions/enums";
import { FormsModule } from "@angular/forms";
import { EventsRow } from "../events/events-row";
import { DatePicker } from "../../../date-and-time/date-picker";
import { DateUtilsService } from "../../../services/date-utils.service";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { NgSelectComponent } from "@ng-select/ng-select";
import { DynamicContentMaxColumnsEditorComponent } from "./dynamic-content-max-columns-editor";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { EventsData, EventsDataAllows } from "../../../models/social-events.model";
import { DYNAMIC_CONTENT_FILTER_OPTIONS, FilterCriteria, SortOrder } from "../../../models/api-request.model";
import { SocialDisplayService } from "../../../pages/social/social-display.service";
import { HasStartAndEndTime } from "../../../models/group-event.model";
import { GroupEventSummary, GroupEventTypes } from "../../../models/committee.model";
import { GroupEventSelectorComponent } from "../../../group-events-selector/group-event-selector";

@Component({
  selector: "app-dynamic-content-site-edit-events",
  styleUrls: ["./dynamic-content.sass"],
  template: `
    @if (row?.events?.eventTypes) {

      <div class="row align-items-end mb-3 d-flex">
        <div class="col-md-12">
          <div class="form-group">
            <label
              for="event-type-multi-select-{{id}}">Ramblers {{ stringUtils.pluralise(row.events.eventTypes.length, 'Event Type') }}
              ({{ row.events.eventTypes.length }}
              of {{ eventTypes.length }} selected)</label>
            <ng-select id="event-type-multi-select-{{id}}"
                       [items]="eventTypes"
                       bindLabel="value"
                       bindValue="key"
                       [multiple]="true"
                       [searchable]="true"
                       [clearable]="true"
                       placeholder="Select one or more event types..."
                       (ngModelChange)="modelChange($event)"
                       [ngModel]="row.events.eventTypes">
            </ng-select>
          </div>
        </div>
      </div>
      <div class="row align-items-end mb-3 d-flex">
        <div class="col">
          <div class="form-group">
            <label for="filter-criteria-{{id}}">Filter Criteria</label>
            <select [(ngModel)]="row.events.filterCriteria"
                    (ngModelChange)="broadcastChange()"
                    name="selectType"
                    class="form-control rounded me-3">
              @for (dateCriteria of display.filterCriteriaOptionsFor(DYNAMIC_CONTENT_FILTER_OPTIONS); track dateCriteria.value) {
                <option [ngValue]="dateCriteria.key">{{ dateCriteria.value }}</option>
              }
            </select>
          </div>
        </div>
        <div class="col">
          <div class="form-group">
            <label for="from-date-{{id}}">Select Events From</label>
            <app-date-picker startOfDay
                             [disabled]="row.events.filterCriteria !== FilterCriteria.DATE_RANGE"
                             id="from-date-{{id}}"
                             [size]="'md round'"
                             (change)="row.events.fromDate=$event.value;broadcastChange()"
                             [value]="row.events.fromDate">
            </app-date-picker>
          </div>
        </div>
        <div class="col">
          <div class="form-group">
            <label for="to-date-{{id}}">Select Events To</label>
            <app-date-picker startOfDay
                             [disabled]="row.events.filterCriteria !== FilterCriteria.DATE_RANGE"
                             id="to-date-{{id}}"
                             [size]="'md round'"
                             (change)="row.events.toDate=$event.value;broadcastChange()"
                             [value]="row.events.toDate">
            </app-date-picker>
          </div>
        </div>
        <div class="col">
          <div class="form-group">
            <label for="sort-order-{{id}}">Sort Order</label>
            <select [(ngModel)]="row.events.sortOrder"
                    (ngModelChange)="broadcastChange()" name="sortOrder" id="sort-order-{{id}}"
                    class="form-control rounded">
              @for (sortOrder of display.sortOrderOptions(); track sortOrder.value) {
                <option [ngValue]="sortOrder.key">{{ sortOrder.value }}</option>
              }
            </select>
          </div>
        </div>
        <div class="col">
          <div class="form-group" app-dynamic-content-max-columns-editor [hasColumnRange]="row.events"></div>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-md-12">
          <app-group-event-selector
            [multiple]="true"
            [hideDatePickers]="true"
            [fromDate]="row.events.fromDate"
            [toDate]="row.events.toDate"
            [label]="'Specific Events (leave empty to show all events within date range)'"
            [dataSource]="eventTypeDataSource()"
            [eventIds]="row.events.eventIds"
            (eventsChange)="onEventsChange($event)"/>
        </div>
      </div>
      <div class="row d-flex">
        <div class="col-md-12 d-inline-flex align-items-center flex-wrap gap-3 px-0 pb-2 ms-3">
          <div class="col-auto">
            <div class="form-check form-check-inline mb-0">
              <input name="showSwiper" [(ngModel)]="row.events.allow.quickSearch"
                     [checked]="row.events.allow.quickSearch"
                     type="checkbox" class="form-check-input"
                     [id]="id +'-quick-search'">
              <label class="form-check-label"
                     [for]="id +'-quick-search'">Quick Search
              </label>
            </div>
          </div>
          <div class="col-auto">
            <div class="form-check form-check-inline mb-0">
              <input name="showSwiper" [(ngModel)]="row.events.allow.pagination"
                     [checked]="row.events.allow.pagination"
                     type="checkbox" class="form-check-input"
                     [id]="id +'-pagination'">
              <label class="form-check-label"
                     [for]="id +'-pagination'">Pagination
              </label>
            </div>
          </div>
          <div class="col-auto">
            <div class="form-check form-check-inline mb-0">
              <input name="showSwiper" [(ngModel)]="row.events.allow.alert"
                     [checked]="row.events.allow.alert"
                     type="checkbox" class="form-check-input"
                     [id]="id +'-alert-indicator'">
              <label class="form-check-label"
                     [for]="id +'-alert-indicator'">Alert Indicator
              </label>
            </div>
          </div>
          <div class="col-auto">
            <div class="form-check form-check-inline mb-0">
              <input name="showSwiper" [(ngModel)]="row.events.allow.autoTitle"
                     [checked]="row.events.allow.autoTitle"
                     type="checkbox" class="form-check-input"
                     [id]="id +'-auto-title'">
              <label class="form-check-label"
                     [for]="id +'-auto-title'">Auto Title
              </label>
            </div>
          </div>
          <div class="col-auto">
            <div class="form-check form-check-inline mb-0">
              <input name="showSwiper" [(ngModel)]="row.events.allow.addNew"
                     [checked]="row.events.allow.addNew"
                     type="checkbox" class="form-check-input"
                     [id]="id +'-add-new-event'">
              <label class="form-check-label"
                     [for]="id +'-add-new-event'">Add New Event Button
              </label>
            </div>
          </div>
        </div>
      </div>
    }
    <app-events-row [row]="row" [rowIndex]="rowIndex"/>`,
  imports: [FormsModule, EventsRow, DatePicker, NgSelectComponent, DynamicContentMaxColumnsEditorComponent, GroupEventSelectorComponent]
})
export class DynamicContentSiteEditEvents implements OnInit {
  public display: SocialDisplayService = inject(SocialDisplayService);
  public pageContentService: PageContentService = inject(PageContentService);
  public memberResourcesReferenceData: MemberResourcesReferenceDataService = inject(MemberResourcesReferenceDataService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public urlService: UrlService = inject(UrlService);
  private numberUtils: NumberUtilsService = inject(NumberUtilsService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  public actions: PageContentActionsService = inject(PageContentActionsService);
  protected dateUtils = inject(DateUtilsService);
  protected logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditEvents", NgxLoggerLevel.ERROR);
  public instance = this;
  @Input()
  public row: PageContentRow;
  @Input() rowIndex: number;
  faPencil = faPencil;
  faAdd = faAdd;
  id: string;
  protected readonly faSearch = faSearch;
  public eventTypes: KeyValue<string>[] = enumValues(RamblersEventType).map(item => ({
    key: item,
    value: this.stringUtils.asTitle(item)
  }));

  protected readonly DYNAMIC_CONTENT_FILTER_OPTIONS = DYNAMIC_CONTENT_FILTER_OPTIONS;
  protected readonly FilterCriteria = FilterCriteria;
  protected fromAndTo: HasStartAndEndTime;

  async ngOnInit() {
    this.initialiseRowForEvents(this.row);
    this.logger.info("ngOnInit:row:", this.row, "eventTypes:", this.eventTypes);
    this.id = this.numberUtils.generateUid();
  }

  async broadcastChange(): Promise<void> {
    this.broadcastService.broadcast(NamedEvent.named(NamedEventType.REFRESH));
  }

  onChange($event: any) {
    this.logger.info("onChange:", $event);
  }

  private initialiseRowForEvents(row: PageContentRow) {
    if (!row?.events) {
      const allow: EventsDataAllows = {
        addNew: false,
        pagination: false,
        quickSearch: false
      };
      const events: EventsData = {
        minColumns: 2,
        maxColumns: 2,
        allow,
        eventTypes: [RamblersEventType.GROUP_EVENT],
        fromDate: this.dateUtils.dateTimeNow().toMillis(),
        toDate: this.dateUtils.dateTimeNow().plus({ weeks: 2 }).toMillis(),
        filterCriteria: FilterCriteria.DATE_RANGE,
        sortOrder: SortOrder.DATE_ASCENDING
      };
      this.logger.info("initialiseRowForEvents:row:", this.row, "events:", events);
      row.events = events;
      this.fromAndTo = this.display.fromAndToFrom(row.events);
    } else {
      this.logger.info("initialiseRowForEvents:row already has events:", this.row.events);
    }
  }

  modelChange(eventTypes: RamblersEventType[]) {
    this.row.events.eventTypes = eventTypes;
    this.logger.info("modelChange:eventTypes:", eventTypes, "row.events:", this.row.events);
    this.broadcastChange();
  }

  eventTypeDataSource(): string {
    return GroupEventTypes.WALK.area;
  }

  onEventsChange(events: GroupEventSummary[]) {
    this.row.events.eventIds = events.map(event => event.id);
    this.logger.info("onEventsChange:", events.length, "events selected, eventIds:", this.row.events.eventIds);
    this.broadcastChange();
  }
}
