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
import { EventsComponent } from "../events/events";
import { DatePickerComponent } from "../../../date-picker/date-picker.component";
import { DateUtilsService } from "../../../services/date-utils.service";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { CommitteeQueryService } from "../../../services/committee/committee-query.service";
import { GroupEvent, GroupEventsFilter } from "../../../models/committee.model";
import { NgSelectComponent } from "@ng-select/ng-select";
import { RowSettingsActionButtonsComponent } from "./dynamic-content-row-settings-action-buttons";
import { DynamicContentMaxColumnsEditorComponent } from "./dynamic-content-max-columns-editor";

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
        <div class="col">
          <div class="form-group">
            <label for="from-date-{{id}}">Select Events From:</label>
            <app-date-picker startOfDay
                             id="from-date-{{id}}"
                             [size]="'md round'"
                             (dateChange)="row.events.fromDate=$event.value;queryGroupEvents()"
                             [value]="row.events.fromDate">
            </app-date-picker>
          </div>
        </div>
        <div class="col">
          <div class="form-group">
            <label for="to-date-{{id}}">Select Events To:</label>
            <app-date-picker startOfDay
                             id="to-date-{{id}}"
                             [size]="'md round'"
                             (dateChange)="row.events.toDate=$event.value;queryGroupEvents()"
                             [value]="row.events.toDate">
            </app-date-picker>
          </div>
        </div>
        <div class="col">
          <div class="form-group" app-dynamic-content-max-columns-editor [hasMaxColumns]="row.events"></div>
        </div>
      </div>
    }
    <app-events [row]="row" [rowIndex]="rowIndex"/>`,
  imports: [FormsModule, EventsComponent, DatePickerComponent, NgSelectComponent, RowSettingsActionButtonsComponent, DynamicContentMaxColumnsEditorComponent]
})
export class EventsSiteEditComponent implements OnInit {
  public pageContentService: PageContentService = inject(PageContentService);
  public memberResourcesReferenceData: MemberResourcesReferenceDataService = inject(MemberResourcesReferenceDataService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public urlService: UrlService = inject(UrlService);
  private numberUtils: NumberUtilsService = inject(NumberUtilsService);
  public actions: PageContentActionsService = inject(PageContentActionsService);
  private committeeQueryService = inject(CommitteeQueryService);
  dateUtils = inject(DateUtilsService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("EventsSiteEditComponent", NgxLoggerLevel.ERROR);
  public instance = this;
  @Input()
  public row: PageContentRow;
  @Input() rowIndex: number;
  faPencil = faPencil;
  faAdd = faAdd;
  id: string;
  protected readonly faSearch = faSearch;
  public groupEvents: GroupEvent[] = [];
  public eventTypes: KeyValue<string>[] = enumValues(RamblersEventType).map(item => ({
    key: item,
    value: this.stringUtils.asTitle(item)
  }));

  async ngOnInit() {
    this.initialiseRowForEvents(this.row);
    this.logger.info("ngOnInit:row:", this.row, "eventTypes:", this.eventTypes);
    this.id = this.numberUtils.generateUid();
    await this.queryGroupEvents();
    this.logger.info("ngOnInit:groupEvents:", this.groupEvents);
  }

  queryGroupEvents(): Promise<GroupEvent[]> {
    const groupEventsFilter: GroupEventsFilter = {
      search: null,
      selectAll: true,
      fromDate: this.dateUtils.asDateValue(this.row.events.fromDate),
      toDate: this.dateUtils.asDateValue(this.row.events.toDate),
      includeImage: true,
      includeContact: true,
      includeDescription: true,
      includeLocation: true,
      includeWalks: this.row.events.eventTypes.includes(RamblersEventType.GROUP_WALK),
      includeSocialEvents: this.row.events.eventTypes.includes(RamblersEventType.GROUP_EVENT),
      includeCommitteeEvents: false,
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

  eventTypeTitles() {
    return this.row.events.eventTypes.map(item => this.stringUtils.asTitle(item)).join(", ");
  }

  onChange($event: any) {
    this.logger.info("onChange:", $event);
  }

  private initialiseRowForEvents(row: PageContentRow) {
    if (!row?.events) {
      row.events = {
        maxColumns: 2,
        allow: {addNew: false, pagination: false, quickSearch: false},
        eventTypes: [RamblersEventType.GROUP_EVENT],
        fromDate: this.dateUtils.asMoment().valueOf(),
        toDate: this.dateUtils.asMoment().add(2, "weeks").valueOf()
      };
    }
  }

  modelChange(eventTypes: RamblersEventType[]) {
    // const eventTypeValues = eventTypes.filter(item => item).map(item => item.key) as RamblersEventType[];
    this.row.events.eventTypes = eventTypes;
    this.logger.info("modelChange:eventTypes:", eventTypes, "row.events:", this.row.events);
  }
}
