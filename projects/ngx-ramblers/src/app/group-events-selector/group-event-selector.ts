import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { NgSelectComponent } from "@ng-select/ng-select";
import { GroupEvent, GroupEventsFilter, groupEventTypeFor, GroupEventTypes } from "../models/committee.model";
import { NgxLoggerLevel } from "ngx-logger";
import { ContentMetadataItem } from "../models/content-metadata.model";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { CommitteeQueryService } from "../services/committee/committee-query.service";
import { DateUtilsService } from "../services/date-utils.service";
import { NumberUtilsService } from "../services/number-utils.service";

@Component({
  selector: "app-group-event-selector",
  template: `
      <label [for]="id">{{label}}</label>
      <ng-select [id]="id" #select [items]="groupEvents"
                 bindLabel="description"
                 bindValue="id"
                 [placeholder]="'Select a ' + dataSource + ' event - type part of title to filter items'"
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
      </ng-select>`
})
export class GroupEventSelectorComponent implements OnInit {

  @Input() eventId: string;
  @Input() label: string;
  @Input() dataSource: string;
  @Output() imagedSavedOrReverted: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() eventChange: EventEmitter<GroupEvent> = new EventEmitter();
  @Output() eventCleared: EventEmitter<void> = new EventEmitter();

  private logger: Logger;
  public groupEvents: GroupEvent[] = [];
  private search: string;
  public id: string;

  constructor(public numberUtilsService: NumberUtilsService,
              private committeeQueryService: CommitteeQueryService,
              public dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("GroupEventSelectorComponent", NgxLoggerLevel.OFF);
  }


  ngOnInit() {
    this.logger.info("ngOnInit:search", this.search, "eventId:", this.eventId);
    this.id = this.numberUtilsService.generateUid();
    if (this.eventId) {
      this.refreshGroupEvents();
    }
  }


  queryGroupEvents(dataSource: string, date: number) {
    this.logger.info("filterEventsBySourceAndDate:", dataSource, "date:", date);
    const groupEventsFilter: GroupEventsFilter = {
      search: this.search,
      eventIds: this.eventId ? [this.eventId] : [],
      selectAll: true,
      fromDate: this.dateUtils.asDateValue(this.dateUtils.asMoment(date).subtract(2, "weeks").valueOf()),
      toDate: this.dateUtils.asDateValue(this.dateUtils.asMoment(date).add(2, "day")),
      includeContact: true,
      includeDescription: true,
      includeLocation: true,
      includeWalks: dataSource === GroupEventTypes.WALK.area,
      includeSocialEvents: dataSource === GroupEventTypes.SOCIAL.area,
      includeCommitteeEvents: dataSource === GroupEventTypes.COMMITTEE.area,
      sortBy: "-eventDate"
    };

    this.committeeQueryService.groupEvents(groupEventsFilter)
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
    const event: GroupEvent = this.groupEvents.find(event => event.id === this.eventId);
    if (event) {
      this.logger.info("onChange:", this.dateUtils.displayDate(event.eventDate), "event:", event);
      this.eventChange.emit(event);
    } else {
      this.logger.info("onChange:no event found for event id", this.eventId);
    }
  }

  refreshGroupEventsIfRequired() {
    const groupEventType = groupEventTypeFor(this.dataSource);
    if (groupEventType) {
      this.logger.debug("filterEventsBySourceAndDate as group event type is", groupEventType);
      this.queryGroupEvents(this.dataSource, this.dateUtils.momentNow().valueOf());
    } else {
      this.logger.debug("not refreshing as group event type is", groupEventType);
    }
  }

  refreshGroupEvents() {
    this.queryGroupEvents(this.dataSource, this.dateUtils.momentNow().valueOf());
  }

  searchFor(search: { term: string; items: any[] }) {
    this.logger.info("search:", search);
    this.search = search.term;
    if (search.term && search.items.length === 0) {
      this.logger.info("this qualifies for a new search:", search);
      this.refreshGroupEvents();
    }
  }

  clearEvent() {
    this.eventCleared.emit();
    this.eventId = null;
    this.refreshGroupEvents();
  }
}
