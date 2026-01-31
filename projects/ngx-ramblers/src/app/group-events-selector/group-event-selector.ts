import { Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";
import { NgOptgroupTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import {
  GroupEventsFilter,
  GroupEventSummary,
  GroupEventType,
  groupEventTypeFor,
  GroupEventTypes
} from "../models/committee.model";
import { NgxLoggerLevel } from "ngx-logger";
import { ContentMetadataItem } from "../models/content-metadata.model";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { CommitteeQueryService } from "../services/committee/committee-query.service";
import { DateUtilsService } from "../services/date-utils.service";
import { NumberUtilsService } from "../services/number-utils.service";
import { StringUtilsService } from "../services/string-utils.service";
import { FormsModule } from "@angular/forms";
import { DatePicker } from "../date-and-time/date-picker";
import { isUndefined } from "es-toolkit/compat";

@Component({
    selector: "app-group-event-selector",
    template: `
      @if (!hideDatePickers) {
        <div class="row">
          <div class="col">
            <div class="form-group">
              <label for="from-date">{{ groupEventType?.description }}s From:</label>
              <app-date-picker startOfDay
                               id="from-date"
                               [size]="'md round'"
                               (change)="fromDate=$event.value;queryGroupEvents()"
                               [value]="fromDate">
              </app-date-picker>
            </div>
          </div>
          <div class="col">
            <div class="form-group">
              <label for="to-date">{{ groupEventType?.description }}s To:</label>
              <app-date-picker startOfDay
                               id="to-date"
                               [size]="'md round'"
                               (change)="toDate=$event.value;queryGroupEvents()"
                               [value]="toDate">
              </app-date-picker>
            </div>
          </div>
        </div>
      }
      <div class="row">
        <div class="col">
          <label [for]="id">{{ label }} ({{ this.groupEvents.length }} found)</label>
          @if (multiple) {
            <ng-select [id]="id" #select [items]="groupEvents"
                       bindLabel="description"
                       bindValue="id"
                       [multiple]="true"
                       [placeholder]="'Select one or more ' + groupEventType?.description + ' events - type part of title to filter items'"
                       [dropdownPosition]="'bottom'"
                       [clearAllText]="'clear current selection'"
                       [closeOnSelect]="false"
                       (search)="searchFor($event)"
                       [(ngModel)]="eventIds"
                       (clear)="clearEvent()"
                       (change)="onChange()"
                       (click)="selectClick(select)">
              <ng-template ng-optgroup-tmp let-item="item">
                <span class="group-header">{{ item?.name }} {{ dataSource }} </span>
                <span class="ms-1 badge bg-secondary badge-group"> {{ item?.total }} </span>
              </ng-template>
            </ng-select>
          } @else {
            <ng-select [id]="id" #select [items]="groupEvents"
                       bindLabel="description"
                       bindValue="id"
                       [multiple]="false"
                       [placeholder]="'Select a ' + groupEventType?.description + ' event - type part of title to filter items'"
                       [dropdownPosition]="'bottom'"
                       [clearAllText]="'clear current selection'"
                       [closeOnSelect]="true"
                       (search)="searchFor($event)"
                       [(ngModel)]="eventId"
                       (clear)="clearEvent()"
                       (change)="onChange()"
                       (click)="selectClick(select)">
              <ng-template ng-optgroup-tmp let-item="item">
                <span class="group-header">{{ item?.name }} {{ dataSource }} </span>
                <span class="ms-1 badge bg-secondary badge-group"> {{ item?.total }} </span>
              </ng-template>
            </ng-select>
          }
        </div>
      </div>`,
    imports: [NgSelectComponent, FormsModule, NgOptgroupTemplateDirective, DatePicker]
})
export class GroupEventSelectorComponent implements OnInit, OnChanges {
  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventSelectorComponent", NgxLoggerLevel.ERROR);
  numberUtilsService = inject(NumberUtilsService);
  private committeeQueryService = inject(CommitteeQueryService);
  dateUtils = inject(DateUtilsService);
  stringUtils = inject(StringUtilsService);


  @Input() eventId: string;
  @Input() eventIds: string[];
  @Input() label: string;
  @Input() multiple = false;
  @Input() hideDatePickers = false;

  private internalFromDate: number;
  private internalToDate: number;

  @Input() set fromDate(value: number) {
    this.logger.info("fromDate setter called with value:", value, "current internalFromDate:", this.internalFromDate, "initialised:", this.initialised);
    if (value !== this.internalFromDate) {
      this.internalFromDate = value;
      if (this.initialised) {
        this.logger.info("Re-querying due to fromDate change");
        this.queryGroupEvents();
      }
    }
  }

  get fromDate(): number {
    return this.internalFromDate;
  }

  @Input() set toDate(value: number) {
    this.logger.info("toDate setter called with value:", value, "current internalToDate:", this.internalToDate, "initialised:", this.initialised);
    if (value !== this.internalToDate) {
      this.internalToDate = value;
      if (this.initialised) {
        this.logger.info("Re-querying due to toDate change");
        this.queryGroupEvents();
      }
    }
  }

  get toDate(): number {
    return this.internalToDate;
  }

  @Input("dataSource") set dataSourceValue(dataSource: string) {
    this.logger.info("dataSource:", dataSource);
    this.dataSource = dataSource;
    this.groupEventType = groupEventTypeFor(this.dataSource);
  }

  @Output() imagedSavedOrReverted: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() eventChange: EventEmitter<GroupEventSummary> = new EventEmitter();
  @Output() eventsChange: EventEmitter<GroupEventSummary[]> = new EventEmitter();
  @Output() eventCleared: EventEmitter<void> = new EventEmitter();

  public dataSource: string;
  public groupEvents: GroupEventSummary[] = [];
  private search: string;
  public id: string;
  public groupEventType: GroupEventType;
  private initialised = false;

  ngOnChanges(changes: SimpleChanges) {
    if ((changes["fromDate"] || changes["toDate"]) && this.initialised) {
      this.logger.info("ngOnChanges - fromDate changed from", changes["fromDate"]?.previousValue, "to", changes["fromDate"]?.currentValue, "toDate changed from", changes["toDate"]?.previousValue, "to", changes["toDate"]?.currentValue);
      if (!isUndefined(changes["fromDate"]?.currentValue)) {
        this.internalFromDate = changes["fromDate"].currentValue;
      }
      if (!isUndefined(changes["toDate"]?.currentValue)) {
        this.internalToDate = changes["toDate"].currentValue;
      }
      this.queryGroupEvents();
    }
  }

  async ngOnInit() {
    this.logger.info("ngOnInit:search", this.search, "eventId:", this.eventId, "eventIds:", this.eventIds, "fromDate:", this.fromDate, "toDate:", this.toDate, "hideDatePickers:", this.hideDatePickers);
    this.id = this.numberUtilsService.generateUid();
    if (!this.fromDate) {
      this.internalFromDate = this.dateUtils.dateTimeNow().minus({ weeks: 2 }).toMillis();
    }
    if (!this.toDate) {
      this.internalToDate = this.dateUtils.dateTimeNow().plus({ days: 1 }).toMillis();
    }
    if (this.eventId || (this.eventIds && this.eventIds.length > 0)) {
      const events = await this.queryGroupEvents();
      if (events.length === 1 && !this.hideDatePickers) {
        this.initialiseDateRange(events[0].eventDate);
      }
    }
    this.initialised = true;
  }

  initialiseDateRange(referenceDate: number) {
    if (!this.hideDatePickers) {
      this.internalFromDate = this.dateUtils.asDateTime(referenceDate).minus({ weeks: 2 }).toMillis();
      this.internalToDate = this.dateUtils.asDateTime(referenceDate).plus({ weeks: 2 }).toMillis();
    }
  }

  queryGroupEvents(): Promise<GroupEventSummary[]> {
    const fromDateValue = this.dateUtils.asDateValue(this.fromDate);
    const toDateValue = this.dateUtils.asDateValue(this.toDate);
    this.logger.info("queryGroupEvents called - dataSource:", this.dataSource, "internal dates - from millis:", this.internalFromDate, "to millis:", this.internalToDate, "fromDateValue:", fromDateValue?.date, "toDateValue:", toDateValue?.date);
    const eventIdsForQuery = this.multiple ? [] : (this.eventId ? [this.eventId] : []);
    const groupEventsFilter: GroupEventsFilter = {
      search: this.search,
      eventIds: eventIdsForQuery,
      selectAll: true,
      fromDate: fromDateValue,
      toDate: toDateValue,
      includeImage: true,
      includeContact: true,
      includeDescription: true,
      includeLocation: true,
      includeWalks: this.dataSource === GroupEventTypes.WALK.area,
      includeSocialEvents: this.dataSource === GroupEventTypes.SOCIAL.area,
      includeCommitteeEvents: this.dataSource === GroupEventTypes.COMMITTEE.area,
      sortBy: "-eventDate"
    };

    return this.committeeQueryService.groupEvents(groupEventsFilter)
      .then(events => {
        this.groupEvents = events.map(event => ({
          ...event,
          description: this.dateUtils.displayDate(event.eventDate) + ", " + event.contactName + ", " + event.title
        }));
        this.logger.info("groupEventsFilter - from:", fromDateValue?.date, "to:", toDateValue?.date, "found:", events.length, "events");
        return events;
      });
  }

  selectClick(select: NgSelectComponent) {
    this.logger.info("selectClick:", select);
    this.refreshGroupEventsIfRequired();
  }

  onChange() {
    if (this.multiple) {
      const events: GroupEventSummary[] = this.groupEvents.filter(event => this.eventIds?.includes(event.id));
      this.logger.info("onChange (multiple):", events.length, "events selected, emitting:", events);
      this.eventsChange.emit(events);
    } else {
      const event: GroupEventSummary = this.groupEvents.find(event => event.id === this.eventId);
      if (event) {
        this.logger.info("onChange:", this.dateUtils.displayDate(event.eventDate), "emitting event:", event);
        this.eventChange.emit(event);
      } else {
        this.logger.info("onChange:no event found for event id", this.eventId);
      }
    }
  }

  refreshGroupEventsIfRequired() {
    if (this.groupEventType) {
      this.logger.debug("filterEventsBySourceAndDate as group event type is", this.groupEventType);
      this.queryGroupEvents();
    } else {
      this.logger.debug("not refreshing as group event type is", this.groupEventType);
    }
  }

  searchFor(search: { term: string; items: any[] }) {
    this.logger.info("search:", search);
    this.search = search.term;
    if (search.term && search.items.length === 0) {
      this.logger.info("no search items and a search term of", search, "qualifies for a new search");
      this.queryGroupEvents();
    } else {
      this.logger.info(this.stringUtils.pluraliseWithCount(search.items.length, "search item"), "and a search term of", search, "does not qualify for a new search");
    }
  }

  clearEvent() {
    this.eventCleared.emit();
    this.eventId = null;
    this.eventIds = [];
    this.search = null;
    this.queryGroupEvents();
  }
}
