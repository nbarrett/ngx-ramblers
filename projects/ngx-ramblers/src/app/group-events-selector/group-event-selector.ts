import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
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
import { DatePicker } from "../date-and-time/date-picker";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-group-event-selector",
    template: `
    <div class="row">
      <div class="col">
        <div class="form-group">
          <label for="from-date">{{groupEventType?.description}}s From:</label>
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
          <label for="to-date">{{groupEventType?.description}}s To:</label>
          <app-date-picker startOfDay
                           id="to-date"
                           [size]="'md round'"
                           (change)="toDate=$event.value;queryGroupEvents()"
                           [value]="toDate">
          </app-date-picker>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col">
        <label [for]="id">{{label}} ({{this.groupEvents.length}} found)</label>
        <ng-select [id]="id" #select [items]="groupEvents"
                   bindLabel="description"
                   bindValue="id"
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
            <span class="group-header">{{item?.name}} {{dataSource}} </span>
            <span class="ml-1 badge badge-secondary badge-group"> {{item?.total}} </span>
          </ng-template>
        </ng-select>
      </div>
    </div>`,
    imports: [DatePicker, NgSelectComponent, FormsModule, NgOptgroupTemplateDirective]
})
export class GroupEventSelectorComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventSelectorComponent", NgxLoggerLevel.ERROR);
  numberUtilsService = inject(NumberUtilsService);
  private committeeQueryService = inject(CommitteeQueryService);
  dateUtils = inject(DateUtilsService);
  stringUtils = inject(StringUtilsService);


  @Input() eventId: string;
  @Input() label: string;

  @Input("dataSource") set dataSourceValue(dataSource: string) {
    this.logger.info("dataSource:", dataSource);
    this.dataSource = dataSource;
    this.groupEventType = groupEventTypeFor(this.dataSource);
  }

  @Output() imagedSavedOrReverted: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() eventChange: EventEmitter<GroupEventSummary> = new EventEmitter();
  @Output() eventCleared: EventEmitter<void> = new EventEmitter();

  public dataSource: string;
  public groupEvents: GroupEventSummary[] = [];
  private search: string;
  public fromDate: number = this.dateUtils.asMoment().subtract(2, "weeks").valueOf();
  public toDate: number = this.dateUtils.asMoment().add(1, "day").valueOf();
  public id: string;
  public groupEventType: GroupEventType;

  async ngOnInit() {
    this.logger.info("ngOnInit:search", this.search, "eventId:", this.eventId);
    this.id = this.numberUtilsService.generateUid();
    if (this.eventId) {
      const events = await this.queryGroupEvents();
      if (events.length === 1) {
        this.initialiseDateRange(events[0].eventDate);
      }

    }
  }

  initialiseDateRange(referenceDate: number) {
    this.fromDate = this.dateUtils.asMoment(referenceDate).subtract(2, "weeks").valueOf();
    this.toDate = this.dateUtils.asMoment(referenceDate).add(2, "weeks").valueOf();
  }

  queryGroupEvents(): Promise<GroupEventSummary[]> {
    this.logger.info("filterEventsBySourceAndDate:", this.dataSource);
    const groupEventsFilter: GroupEventsFilter = {
      search: this.search,
      eventIds: this.eventId ? [this.eventId] : [],
      selectAll: true,
      fromDate: this.dateUtils.asDateValue(this.fromDate),
      toDate: this.dateUtils.asDateValue(this.toDate),
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
        this.logger.info("groupEventsFilter:", groupEventsFilter, "groupEvents:", events);
        return events;
      });
  }

  selectClick(select: NgSelectComponent) {
    this.logger.info("selectClick:", select);
    this.refreshGroupEventsIfRequired();
  }

  onChange() {
    const event: GroupEventSummary = this.groupEvents.find(event => event.id === this.eventId);
    if (event) {
      this.logger.info("onChange:", this.dateUtils.displayDate(event.eventDate), "emitting event:", event);
      this.eventChange.emit(event);
    } else {
      this.logger.info("onChange:no event found for event id", this.eventId);
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
    this.search = null;
    this.queryGroupEvents();
  }
}
