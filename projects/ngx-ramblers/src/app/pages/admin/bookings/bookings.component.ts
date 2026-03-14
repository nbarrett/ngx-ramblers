import { Component, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import {
  bookingEnabledForEventType,
  BookingConfig,
  BookingEmailTemplates,
  BookingEmailType,
  BookingPlaceholder,
  enabledBookingEventTypes
} from "../../../models/booking-config.model";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { ContentText, InsertableField, View } from "../../../models/content-text.model";
import { Booking, BookingApiResponse, BookingStatus, BookingSummaryRow } from "../../../models/booking.model";
import { BookingService } from "../../../services/booking.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faDownload, faEye, faPencil, faTicket, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FormsModule } from "@angular/forms";
import { CsvExportComponent, CsvOptions } from "../../../csv-export/csv-export";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { MarkdownComponent } from "ngx-markdown";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { StoredValue } from "../../../models/ui-actions";
import { ActivatedRoute, Router } from "@angular/router";
import { kebabCase } from "es-toolkit/compat";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { BookingConfigService } from "../../../services/system/booking-config.service";
import { GroupEventField } from "../../../models/walk.model";
import { EventQueryParameters, RamblersEventType } from "../../../models/ramblers-walks-manager";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SectionToggle } from "../../../shared/components/section-toggle";

export enum BookingTab {
  SUMMARY = "Summary",
  PER_EVENT_DETAIL = "Per-Event Detail",
  CONFIGURATION = "Configuration",
  EMAIL_TEMPLATES = "Default Email Templates"
}

@Component({
    selector: "app-bookings-admin",
    template: `
      <app-page autoTitle>
        <div class="row">
          <div class="col-sm-12">
            <tabset class="custom-tabset">
              <tab [active]="tabActive(BookingTab.SUMMARY)"
                   (selectTab)="selectTab(BookingTab.SUMMARY)"
                   [heading]="BookingTab.SUMMARY">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="col-sm-12 mb-3">
                    <app-markdown-editor standalone category="admin" name="bookings-summary-help"
                                        description="Bookings Summary Help"/>
                  </div>
                  @if (notifyTarget.showAlert) {
                    <div class="alert {{notifyTarget.alert.class}} mb-3">
                      <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                      @if (notifyTarget.alertTitle) {
                        <strong> {{ notifyTarget.alertTitle }}: </strong>
                      }
                      {{ notifyTarget.alertMessage }}
                    </div>
                  }
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <p class="mb-0 text-muted">Report generated: {{ reportDate | displayDate }}</p>
                    <button type="button" class="btn btn-warning btn-sm" (click)="downloadSummaryCsv()">
                      <fa-icon [icon]="faDownload" class="me-1"></fa-icon>Download CSV
                    </button>
                  </div>
                  <div class="table-responsive">
                    <table class="table table-striped table-hover">
                      <thead>
                      <tr>
                        <th>Event</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th class="text-end">Booked</th>
                        <th class="text-end">Capacity</th>
                      </tr>
                      </thead>
                      <tbody>
                      @for (row of summaryRows; track row.eventIds[0]) {
                        <tr class="cursor-pointer" (click)="selectEvent(row.eventIds[0])">
                          <td>{{ row.eventTitle }}</td>
                          <td>{{ row.eventDate }}</td>
                          <td>{{ row.eventTime }}</td>
                          <td class="text-end">{{ row.totalBooked }}</td>
                          <td class="text-end">{{ row.maxCapacity }}</td>
                        </tr>
                      }
                      @if (summaryRows.length === 0) {
                        <tr>
                          <td colspan="5" class="text-center text-muted">No events with bookings enabled</td>
                        </tr>
                      }
                      </tbody>
                    </table>
                  </div>
                </div>
              </tab>
              <tab [active]="tabActive(BookingTab.PER_EVENT_DETAIL)"
                   (selectTab)="selectTab(BookingTab.PER_EVENT_DETAIL)"
                   [heading]="BookingTab.PER_EVENT_DETAIL">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="col-sm-12 mb-3">
                    <app-markdown-editor standalone category="admin" name="bookings-detail-help"
                                        description="Bookings Per-Event Detail Help"/>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Find upcoming event</label>
                    <ng-select [items]="availableEventRows"
                               bindLabel="eventSelectorLabel"
                               bindValue="eventId"
                               [searchable]="true"
                               [clearable]="true"
                               [editableSearchTerm]="true"
                               [dropdownPosition]="'bottom'"
                               [closeOnSelect]="true"
                               [placeholder]="'Select an upcoming event'"
                               [(ngModel)]="selectedEventId"
                               (ngModelChange)="onSelectedEventSelected($event)">
                    <ng-template ng-option-tmp let-item="item">
                        {{ item.eventSelectorLabel }}
                      </ng-template>
                    </ng-select>
                  </div>
                  @if (selectedEventId) {
                    <div class="row align-items-end mb-3">
                      <div class="col-sm-6 col-lg-4">
                        <label class="form-label" for="selected-event-max-capacity">Max capacity for this event</label>
                        <input [(ngModel)]="selectedEventMaxCapacity"
                               (ngModelChange)="markSelectedEventDirty()"
                               type="number"
                               min="0"
                               class="form-control"
                               id="selected-event-max-capacity"
                               placeholder="0 = no bookings">
                      </div>
                    </div>
                    <hr class="my-3"/>
                    <h6>Per-event email overrides (optional)</h6>
                    <p class="text-muted mb-2">Override the default email templates for this event only. Leave blank to use the global templates. Use the <strong>#</strong> button on the toolbar to insert placeholders.</p>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <app-section-toggle
                        [tabs]="emailTemplateTabs"
                        [(selectedTab)]="selectedEventEmailOverrideType"/>
                      @if (!selectedEventEmailOverrideValue()) {
                        <button type="button" class="btn btn-outline-secondary btn-sm" (click)="loadDefaultForOverride(selectedEventEmailOverrideType)">
                          Load default
                        </button>
                      }
                    </div>
                    <app-markdown-editor [data]="{text: selectedEventEmailOverrideValue()}"
                                         [name]="'event-' + selectedEventEmailOverrideType + '-override'"
                                         [initialView]="View.EDIT"
                                         [rows]="10"
                                         [insertableFields]="placeholderFields"
                                         (changed)="eventEmailOverrideChanged(selectedEventEmailOverrideType, $event)"/>
                    <div class="d-flex justify-content-start gap-2 mt-3 mb-3">
                      <button type="button" class="btn btn-success" (click)="saveSelectedEventChanges()">
                        Save all changes
                      </button>
                      <button type="button" class="btn btn-outline-secondary" (click)="revertSelectedEventChanges()">
                        Revert changes
                      </button>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-3">
                      <p class="mb-0 text-muted">{{ eventBookings.length }} bookings for this event</p>
                      <button type="button" class="btn btn-warning btn-sm" (click)="downloadDetailCsv()">
                        <fa-icon [icon]="faDownload" class="me-1"></fa-icon>Download CSV
                      </button>
                    </div>
                    <div class="table-responsive">
                      <table class="table table-striped table-hover">
                        <thead>
                        <tr>
                          <th>Attendee(s)</th>
                          <th>Email(s)</th>
                          <th>Phone</th>
                          <th>Booked</th>
                          <th>Status</th>
                          <th class="text-end">Places</th>
                          <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        @for (booking of eventBookings; track booking.id) {
                          <tr [class.table-warning]="booking.status === BookingStatus.WAITLISTED">
                            <td>{{ attendeeDisplayNames(booking) }}</td>
                            <td>{{ attendeeEmailList(booking) }}</td>
                            <td>{{ attendeePhone(booking) }}</td>
                            <td>{{ booking.createdAt | displayDate }}</td>
                            <td>
                              @if (booking.status === BookingStatus.WAITLISTED) {
                                <span class="badge bg-warning text-dark">Waitlisted</span>
                              } @else {
                                <span class="badge bg-success">Active</span>
                              }
                            </td>
                            <td class="text-end">{{ booking.attendees.length }}</td>
                            <td>
                              <button type="button" class="btn btn-outline-danger btn-sm"
                                      (click)="deleteBooking(booking)">
                                <fa-icon [icon]="faTrash"></fa-icon>
                              </button>
                            </td>
                          </tr>
                        }
                        @if (eventBookings.length === 0) {
                          <tr>
                            <td colspan="7" class="text-center text-muted">No bookings for this event</td>
                          </tr>
                        }
                        </tbody>
                      </table>
                    </div>
                  }
                </div>
              </tab>
              <tab [active]="tabActive(BookingTab.CONFIGURATION)"
                   (selectTab)="selectTab(BookingTab.CONFIGURATION)"
                   [heading]="BookingTab.CONFIGURATION">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="col-sm-12 mb-3">
                    <app-markdown-editor standalone category="admin" name="bookings-configuration-help"
                                        description="Bookings Configuration Help"/>
                  </div>
                  @if (bookingConfig) {
                    <div>
                      <div class="form-check mb-3">
                        <input [(ngModel)]="bookingConfig.enabled"
                               type="checkbox"
                               class="form-check-input"
                               id="booking-enabled">
                        <label class="form-check-label" for="booking-enabled">Enable booking on events</label>
                      </div>
                      @if (bookingConfig.enabled) {
                        <div class="mb-3">
                          <label class="form-label d-block">Enable booking for event types</label>
                          @for (eventType of bookingEventTypes; track eventType) {
                            <div class="form-check mb-2">
                              <input [checked]="bookingEnabledForEventTypeValue(eventType)"
                                     (change)="toggleBookingEventType(eventType, $any($event.target).checked)"
                                     type="checkbox"
                                     class="form-check-input"
                                     id="booking-event-type-{{eventType}}">
                              <label class="form-check-label" for="booking-event-type-{{eventType}}">{{ eventTypeLabel(eventType) }}</label>
                            </div>
                          }
                        </div>
                        <div class="form-group mb-3">
                          <label for="default-max-capacity">Default max capacity (0 = no default, set per event)</label>
                          <input [(ngModel)]="bookingConfig.defaultMaxCapacity"
                                 type="number"
                                 class="form-control input-sm"
                                 id="default-max-capacity"
                                 min="0"
                                 placeholder="0">
                        </div>
                        <div class="form-group mb-3">
                          <label for="default-max-group-size">Default max attendees per booking</label>
                          <input [(ngModel)]="bookingConfig.defaultMaxGroupSize"
                                 type="number"
                                 class="form-control input-sm"
                                 id="default-max-group-size"
                                 min="1" max="20"
                                 placeholder="3">
                        </div>
                        <div class="form-group mb-3">
                          <label for="default-member-priority-days">Default member priority days (0 = no member priority)</label>
                          <input [(ngModel)]="bookingConfig.defaultMemberPriorityDays"
                                 type="number"
                                 class="form-control input-sm"
                                 id="default-member-priority-days"
                                 min="0" max="365"
                                 placeholder="0">
                        </div>
                        <div class="form-group mb-3">
                          <label for="reminder-days-before">Reminder days before event (0 = no reminders)</label>
                          <input [(ngModel)]="bookingConfig.reminderDaysBefore"
                                 type="number"
                                 class="form-control input-sm"
                                 id="reminder-days-before"
                                 min="0" max="30"
                                 placeholder="0">
                        </div>
                      }
                      <div class="d-flex justify-content-start">
                        <button type="button" class="btn btn-success" (click)="saveBookingConfig()">
                          Save booking configuration
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </tab>
              <tab [active]="tabActive(BookingTab.EMAIL_TEMPLATES)"
                   (selectTab)="selectTab(BookingTab.EMAIL_TEMPLATES)"
                   [heading]="BookingTab.EMAIL_TEMPLATES">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="col-sm-12 mb-3">
                    <app-markdown-editor standalone category="admin" name="bookings-email-templates-help"
                                        description="Email Templates Help"/>
                  </div>
                  @if (bookingConfig) {
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <app-section-toggle
                        [tabs]="emailTemplateTabs"
                        [(selectedTab)]="selectedEmailTemplateType"/>
                      <button type="button" class="btn btn-sm"
                              [class.btn-secondary]="emailTemplateView === View.EDIT"
                              [class.btn-outline-secondary]="emailTemplateView !== View.EDIT"
                              (click)="toggleEmailTemplateView()">
                        <fa-icon [icon]="emailTemplateView === View.EDIT ? faEye : faPencil" class="me-1"/>
                        {{ emailTemplateView === View.EDIT ? 'Preview' : 'Edit' }}
                      </button>
                    </div>
                    @if (emailTemplateView === View.EDIT) {
                      <app-markdown-editor [data]="{text: emailTemplateValue(selectedEmailTemplateType)}"
                                           [name]="selectedEmailTemplateType + '-template'"
                                           [initialView]="View.EDIT"
                                           [rows]="15"
                                           [insertableFields]="placeholderFields"
                                           (changed)="emailTemplateChanged(selectedEmailTemplateType, $event)"/>
                    } @else {
                      <div class="border rounded p-3" markdown ngPreserveWhitespaces [data]="emailTemplateValue(selectedEmailTemplateType) || '*No template configured*'"></div>
                    }
                    <div class="d-flex justify-content-start gap-2 mt-3">
                      <button type="button" class="btn btn-success" (click)="saveBookingConfig()">
                        Save email templates
                      </button>
                      <button type="button" class="btn btn-outline-secondary" (click)="revertEmailTemplates()">
                        Revert changes
                      </button>
                    </div>
                  }
                </div>
              </tab>
            </tabset>
          </div>
        </div>
        <app-csv-export hidden #csvComponent
                        [data]="csvData"
                        [filename]="csvFilename"
                        [options]="csvConfig"></app-csv-export>
      </app-page>`,
    styles: [`
      .cursor-pointer
        cursor: pointer
    `],
    imports: [PageComponent, FontAwesomeModule, FormsModule, DisplayDatePipe, CsvExportComponent, TabsetComponent, TabDirective, MarkdownEditorComponent, MarkdownComponent, NgSelectComponent, NgOptionTemplateDirective, SectionToggle]
})
export class BookingsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("BookingsComponent", NgxLoggerLevel.ERROR);
  private bookingService = inject(BookingService);
  private dateUtils = inject(DateUtilsService);
  private notifierService = inject(NotifierService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private bookingConfigService = inject(BookingConfigService);
  protected stringUtils = inject(StringUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);

  faTicket = faTicket;
  faDownload = faDownload;
  faTrash = faTrash;
  faEye = faEye;
  faPencil = faPencil;

  notifyTarget: AlertTarget = {};
  notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  private subscriptions: Subscription[] = [];

  private tab: BookingTab = BookingTab.SUMMARY;
  reportDate: number;
  summaryRows: BookingSummaryRow[] = [];
  allBookings: Booking[] = [];
  eventBookings: Booking[] = [];
  selectedEventId: string = null;
  selectedEventMaxCapacity: number = null;
  bookingConfig: BookingConfig = this.bookingConfigService.default();
  bookingEventTypes = enabledBookingEventTypes(this.bookingConfig);
  availableEventRows: BookingSummaryRow[] = [];
  csvData: any[] = [];
  csvFilename = "";
  csvConfig: CsvOptions;
  private eventsMap: Map<string, ExtendedGroupEvent> = new Map();
  private futureEventRows: BookingSummaryRow[] = [];

  protected readonly BookingTab = BookingTab;
  protected readonly BookingStatus = BookingStatus;
  protected readonly View = View;
  emailTemplateTypes: BookingEmailType[] = enumKeyValues(BookingEmailType).map(p => p.value as BookingEmailType);
  selectedEmailTemplateType: BookingEmailType = BookingEmailType.CONFIRMATION;
  selectedEventEmailOverrideType: BookingEmailType = BookingEmailType.CONFIRMATION;
  emailTemplateTabs = this.emailTemplateTypes.map(type => ({value: type, label: this.stringUtils.asTitle(type)}));
  emailTemplateView: View = View.EDIT;
  private dirtyEventIds: Set<string> = new Set();
  placeholderFields: InsertableField[] = enumKeyValues(BookingPlaceholder).map(p => ({
    label: this.stringUtils.asTitle(p.value),
    value: `{{${p.value}}}`
  }));

  @ViewChild("csvComponent") csvComponent: CsvExportComponent;

  ngOnInit() {
    this.reportDate = this.dateUtils.dateTimeNowAsValue();
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      this.tab = params[StoredValue.TAB] || kebabCase(BookingTab.SUMMARY);
    }));
    this.subscriptions.push(this.bookingConfigService.events().subscribe(config => {
      this.bookingConfig = config;
      this.bookingEventTypes = enabledBookingEventTypes(this.bookingConfig);
    }));
    this.loadBookingAdminData();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  tabActive(tab: BookingTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }

  selectTab(tab: BookingTab) {
    this.router.navigate([], {
      queryParams: {[StoredValue.TAB]: kebabCase(tab)},
      queryParamsHandling: "merge"
    });
  }

  attendeeDisplayNames(booking: Booking): string {
    return booking.attendees.map(a => a.displayName).join(", ");
  }

  attendeePhone(booking: Booking): string {
    const firstWithPhone = booking.attendees.find(a => a.phone);
    return firstWithPhone?.phone || "";
  }

  attendeeEmailList(booking: Booking): string {
    return booking.attendees.map(a => a.email).join(", ");
  }

  private async loadBookingAdminData() {
    await this.loadSummary();
    await this.loadFutureEvents();
  }

  async loadSummary() {
    this.notify.progress({title: "Loading", message: "Fetching booking data..."});
    try {
      const apiResponse: BookingApiResponse = await new Promise((resolve) => {
        this.subscriptions.push(this.bookingService.notifications().subscribe(resolve));
        this.bookingService.all();
      });
      this.allBookings = (apiResponse.response as Booking[]).filter(b => b.status !== BookingStatus.CANCELLED);
      const eventIds = [...new Set(this.allBookings.flatMap(b => b.eventIds))];
      await this.loadEvents(eventIds);
      this.buildSummaryRows();
      this.notify.clearBusy();
      this.notify.success({title: "Loaded", message: `${this.allBookings.length} bookings across ${this.summaryRows.length} events`});
    } catch (error) {
      this.notify.error({title: "Loading failed", message: "Could not load bookings"});
      this.logger.error("loadSummary failed:", error);
    }
  }

  private async loadEvents(eventIds: string[]) {
    const loadPromises = eventIds.map(async id => {
      const event = await this.walksAndEventsService.queryById(id);
      if (event) {
        this.eventsMap.set(id, event);
      }
    });
    await Promise.all(loadPromises);
  }

  private buildSummaryRows() {
    const grouped: Map<string, Booking[]> = new Map();
    this.allBookings.forEach(booking => {
      booking.eventIds.forEach(eventId => {
        const existing = grouped.get(eventId) || [];
        grouped.set(eventId, [...existing, booking]);
      });
    });
    this.summaryRows = Array.from(grouped).map(([eventId, bookings]) => {
      const event = this.eventsMap.get(eventId);
      const totalBooked = bookings.reduce((sum, b) => sum + b.attendees.length, 0);
      return {
        eventId,
        eventIds: [eventId],
        eventTitle: event?.groupEvent?.title || "Unknown event",
        eventDate: event?.groupEvent?.start_date_time ? this.dateUtils.displayDate(this.dateUtils.asValueNoTime(event.groupEvent.start_date_time)) : "",
        eventTime: event?.groupEvent?.start_date_time ? this.dateUtils.displayTime(event.groupEvent.start_date_time) : "",
        eventType: event?.groupEvent?.item_type,
        eventSelectorLabel: this.eventSelectorLabel(event?.groupEvent?.title || "Unknown event", event?.groupEvent?.item_type, event?.groupEvent?.start_date_time),
        totalBooked,
        maxCapacity: this.maxCapacityFor(event)
      };
    });
    this.refreshAvailableEventRows();
    this.loadEventBookings();
  }

  private async loadFutureEvents() {
    try {
      const futureQuery: EventQueryParameters = {
        inputSource: null,
        suppressEventLinking: false,
        types: enabledBookingEventTypes(this.bookingConfigService.bookingConfig()),
        dataQueryOptions: {
          criteria: {
            [GroupEventField.START_DATE]: {$gte: this.dateUtils.dateTimeNowNoTime().toJSDate()}
          }
        }
      };
      const futureEvents = await this.walksAndEventsService.all(futureQuery);
      futureEvents.forEach(event => this.eventsMap.set(event.id, event));
      this.futureEventRows = futureEvents.map(event => ({
          eventId: event.id,
          eventIds: [event.id],
          eventTitle: event?.groupEvent?.title || "Unknown event",
          eventDate: event?.groupEvent?.start_date_time ? this.dateUtils.displayDate(this.dateUtils.asValueNoTime(event.groupEvent.start_date_time)) : "",
          eventTime: event?.groupEvent?.start_date_time ? this.dateUtils.displayTime(event.groupEvent.start_date_time) : "",
          eventType: event?.groupEvent?.item_type,
          eventSelectorLabel: this.eventSelectorLabel(event?.groupEvent?.title || "Unknown event", event?.groupEvent?.item_type, event?.groupEvent?.start_date_time),
          totalBooked: this.allBookings.filter(booking => booking.eventIds.includes(event.id)).reduce((sum, booking) => sum + booking.attendees.length, 0),
          maxCapacity: this.maxCapacityFor(event)
        }));
      this.refreshAvailableEventRows();
      if (this.selectedEventId) {
        this.onSelectedEventChange();
      }
    } catch (error) {
      this.logger.error("loadFutureEvents failed:", error);
    }
  }

  private refreshAvailableEventRows() {
    const rowsById = new Map<string, BookingSummaryRow>();
    [...this.futureEventRows, ...this.summaryRows].forEach(row => rowsById.set(row.eventIds[0], row));
    this.availableEventRows = [...rowsById.values()];
  }

  onSelectedEventSelected(eventId: string) {
    this.selectedEventId = eventId;
    this.onSelectedEventChange();
  }

  selectEvent(eventId: string) {
    this.selectedEventId = eventId;
    this.selectTab(BookingTab.PER_EVENT_DETAIL);
    this.onSelectedEventChange();
  }

  loadEventBookings() {
    if (this.selectedEventId) {
      this.eventBookings = this.allBookings.filter(b => b.eventIds.includes(this.selectedEventId));
    } else {
      this.eventBookings = [];
    }
  }

  onSelectedEventChange() {
    const event = this.eventsMap.get(this.selectedEventId);
    this.selectedEventMaxCapacity = event?.fields?.maxCapacity ?? this.bookingConfigService.bookingConfig()?.defaultMaxCapacity ?? 0;
    this.loadEventBookings();
  }



  async saveBookingConfig() {
    try {
      await this.bookingConfigService.saveConfig(this.bookingConfig);
      this.bookingEventTypes = enabledBookingEventTypes(this.bookingConfig);
      await this.loadFutureEvents();
      this.notify.success({title: "Saved", message: "Booking configuration updated"});
    } catch (error) {
      this.notify.error({title: "Save failed", message: "Could not update booking configuration"});
      this.logger.error("saveBookingConfig failed:", error);
    }
  }

  toggleEmailTemplateView() {
    this.emailTemplateView = this.emailTemplateView === View.EDIT ? View.VIEW : View.EDIT;
  }

  async revertEmailTemplates() {
    await this.bookingConfigService.refresh();
    this.notify.success({title: "Reverted", message: "Email templates restored to last saved state"});
  }

  async deleteBooking(booking: Booking) {
    try {
      await this.bookingService.delete(booking);
      this.allBookings = this.allBookings.filter(b => b.id !== booking.id);
      this.buildSummaryRows();
      await this.loadFutureEvents();
      this.notify.success({title: "Deleted", message: "Booking removed"});
    } catch (error) {
      this.notify.error({title: "Delete failed", message: "Could not delete booking"});
      this.logger.error("deleteBooking failed:", error);
    }
  }

  downloadSummaryCsv() {
    const csvHeaders = ["Event", "Date", "Time", "Total Booked", "Max Capacity"];
    this.csvData = this.summaryRows.map(row => ({
      "Event": row.eventTitle,
      "Date": row.eventDate,
      "Time": row.eventTime,
      "Total Booked": row.totalBooked,
      "Max Capacity": row.maxCapacity
    }));
    this.csvFilename = "booking-summary";
    this.csvConfig = this.buildCsvOptions(csvHeaders, csvHeaders);
    setTimeout(() => this.csvComponent.generateCsv());
  }

  downloadDetailCsv() {
    const csvHeaders = ["Attendee(s)", "Email(s)", "Phone", "Booked", "Status", "Places"];
    this.csvData = this.eventBookings.map(booking => ({
      "Attendee(s)": this.attendeeDisplayNames(booking),
      "Email(s)": this.attendeeEmailList(booking),
      "Phone": this.attendeePhone(booking),
      "Booked": this.dateUtils.displayDate(booking.createdAt),
      "Status": booking.status === BookingStatus.WAITLISTED ? "Waitlisted" : "Active",
      "Places": booking.attendees.length
    }));
    const eventTitle = this.eventsMap.get(this.selectedEventId)?.groupEvent?.title || "event";
    this.csvFilename = `bookings-${eventTitle}`;
    this.csvConfig = this.buildCsvOptions(csvHeaders, csvHeaders);
    setTimeout(() => this.csvComponent.generateCsv());
  }

  private buildCsvOptions(headers: string[], csvKeys: string[]): CsvOptions {
    return {
      filename: this.csvFilename,
      fieldSeparator: ",",
      quoteStrings: "\"",
      decimalSeparator: ".",
      showLabels: true,
      showTitle: false,
      title: "",
      useBom: true,
      headers,
      keys: csvKeys,
      removeNewLines: true
    };
  }

  private maxCapacityFor(event: ExtendedGroupEvent): number {
    return event?.fields?.maxCapacity || this.bookingConfigService.bookingConfig()?.defaultMaxCapacity || 0;
  }

  bookingEnabledForEventTypeValue(eventType: RamblersEventType): boolean {
    return this.bookingConfig?.enabledForEventTypes?.includes(eventType);
  }

  toggleBookingEventType(eventType: RamblersEventType, checked: boolean) {
    const current = this.bookingConfig?.enabledForEventTypes || [];
    this.bookingConfig.enabledForEventTypes = checked
      ? [...new Set([...current, eventType])]
      : current.filter(type => type !== eventType);
  }

  eventTypeLabel(eventType: RamblersEventType): string {
    return this.stringUtils.asTitle(eventType);
  }

  private eventSelectorLabel(title: string, eventType: RamblersEventType, startDateTime: string): string {
    const eventDate = startDateTime ? this.dateUtils.displayDate(this.dateUtils.asValueNoTime(startDateTime)) : "";
    return `${this.eventTypeLabel(eventType)}: ${title} (${eventDate})`;
  }

  placeholderList(): string {
    return enumKeyValues(BookingPlaceholder).map(p => `{{${p.value}}}`).join(", ");
  }

  emailTemplateValue(emailType: BookingEmailType): string {
    return this.bookingConfig?.emailTemplates?.[emailType] || "";
  }

  emailTemplateChanged(emailType: BookingEmailType, event: ContentText) {
    if (!this.bookingConfig.emailTemplates) {
      this.bookingConfig.emailTemplates = {} as BookingEmailTemplates;
    }
    this.bookingConfig.emailTemplates[emailType] = event.text || "";
  }

  selectedEventEmailOverrideValue(): string {
    const overrides = this.eventsMap.get(this.selectedEventId)?.fields?.bookingEmailOverrides;
    return overrides?.[this.selectedEventEmailOverrideType] || "";
  }

  loadDefaultForOverride(emailType: BookingEmailType) {
    const defaultText = this.bookingConfig?.emailTemplates?.[emailType] || "";
    if (!defaultText) {
      this.notify.warning({title: "No default", message: "No default template configured for " + this.stringUtils.asTitle(emailType)});
      return;
    }
    this.eventEmailOverrideChanged(emailType, {text: defaultText});
  }

  eventEmailOverrideChanged(emailType: BookingEmailType, event: ContentText) {
    const selectedEvent = this.eventsMap.get(this.selectedEventId);
    if (!selectedEvent) {
      return;
    }
    if (!selectedEvent.fields.bookingEmailOverrides) {
      selectedEvent.fields.bookingEmailOverrides = {};
    }
    selectedEvent.fields.bookingEmailOverrides[emailType] = event.text || "";
    this.markSelectedEventDirty();
  }

  markSelectedEventDirty() {
    if (this.selectedEventId) {
      this.dirtyEventIds.add(this.selectedEventId);
    }
  }

  async saveSelectedEventChanges() {
    const selectedEvent = this.eventsMap.get(this.selectedEventId);
    if (!selectedEvent) {
      this.notify.error({title: "Save failed", message: "Please select an event first"});
      return;
    }
    try {
      const updatedEvent: ExtendedGroupEvent = {
        ...selectedEvent,
        fields: {
          ...selectedEvent.fields,
          maxCapacity: this.selectedEventMaxCapacity > 0 ? this.selectedEventMaxCapacity : null,
          bookingEmailOverrides: selectedEvent.fields.bookingEmailOverrides || null
        }
      };
      const savedEvent = await this.walksAndEventsService.update(updatedEvent);
      this.eventsMap.set(savedEvent.id, savedEvent);
      this.dirtyEventIds.delete(this.selectedEventId);
      this.buildSummaryRows();
      await this.loadFutureEvents();
      this.notify.success({title: "Saved", message: "Event changes saved"});
    } catch (error) {
      this.notify.error({title: "Save failed", message: "Could not save event changes"});
      this.logger.error("saveSelectedEventChanges failed:", error);
    }
  }

  async revertSelectedEventChanges() {
    await this.loadFutureEvents();
    this.dirtyEventIds.delete(this.selectedEventId);
    this.onSelectedEventChange();
    this.notify.success({title: "Reverted", message: "Event changes reverted"});
  }
}
