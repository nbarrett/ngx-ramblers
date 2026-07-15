import { AdminPath } from "../../../models/admin-route-paths.model";
import { Component, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import {
  BookingConfig,
  BookingEmailType,
  BookingScope,
  BOOKING_EMAIL_BLOCK_KEYS,
  DEFAULT_BOOKING_EMAIL_BLOCKS,
  bookingEnabledForEvent,
  effectiveMaxCapacityForEvent,
  enabledBookingEventTypes
} from "../../../models/booking-config.model";
import { EmailPreviewComponent } from "../../../modules/common/email-preview/email-preview.component";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import {
  NotificationConfig,
  TemplateOverrideState,
  TemplateOverrideType
} from "../../../models/mail.model";
import { Booking, BookingApiResponse, BookingStatus, BookingSummaryRow } from "../../../models/booking.model";
import { BookingService } from "../../../services/booking.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faDownload,
  faExclamationTriangle,
  faEye,
  faEyeSlash,
  faPencil,
  faPaperPlane,
  faSpinner,
  faTicket,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { FormsModule } from "@angular/forms";
import { CsvExportComponent, CsvOptions } from "../../../csv-export/csv-export";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { WalkDisplayService } from "../../walks/walk-display.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { BOOKING_MERGE_FIELD_CATALOGUE } from "../../../models/email-composer.model";
import {
  contentBlockState,
  contentBlockStateTabs,
  ContentBlockEditorComponent,
  setContentBlockState
} from "../system-settings/mail/content-block-editor";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { StickyControlsDirective } from "../../../modules/common/tiptap-editor/sticky-controls.directive";
import { StoredValue } from "../../../models/ui-actions";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { kebabCase, values } from "es-toolkit/compat";
import { enumKeyValues } from "../../../functions/enums";
import { BookingConfigService } from "../../../services/system/booking-config.service";
import { NotificationConfigService } from "../../../services/notification-config.service";
import { GroupEventField } from "../../../models/walk.model";
import { EventQueryParameters, RamblersEventType } from "../../../models/ramblers-walks-manager";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { SectionToggleTab } from "../../../models/section-toggle.model";

export enum BookingTab {
  SUMMARY = "Summary",
  PER_EVENT_DETAIL = "Per-Event Detail",
  CONFIGURATION = "Configuration"
}

@Component({
    selector: "app-bookings-admin",
    template: `
      <app-page autoTitle>
        <div class="row">
          <div class="col-sm-12">
            @if (notifyTarget.showAlert) {
              <div class="alert {{notifyTarget.alert.class}} mb-3">
                <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                @if (notifyTarget.alertTitle) {
                  <strong> {{ notifyTarget.alertTitle }}: </strong>
                }
                {{ notifyTarget.alertMessage }}
              </div>
            }
            <tabset class="custom-tabset">
              <tab [active]="tabActive(BookingTab.SUMMARY)"
                   (selectTab)="selectTab(BookingTab.SUMMARY)"
                   [heading]="BookingTab.SUMMARY">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="col-sm-12 mb-3">
                    <app-markdown-editor standalone category="admin" name="bookings-summary-help"
                                        description="Bookings Summary Help"/>
                  </div>
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <p class="mb-0 text-muted">Report generated: {{ reportDate | displayDate }}</p>
                    <div class="d-flex gap-2">
                      <button type="button" class="btn btn-warning btn-sm" (click)="downloadSummaryCsv()">
                        <fa-icon [icon]="faDownload" class="me-1"></fa-icon>Download summary CSV
                      </button>
                      <button type="button" class="btn btn-warning btn-sm" [disabled]="allBookings.length === 0" (click)="downloadAllAttendeesCsv()">
                        <fa-icon [icon]="faDownload" class="me-1"></fa-icon>Download all attendees CSV
                      </button>
                    </div>
                  </div>
                  <div class="table-responsive">
                    <table class="table table-striped table-hover">
                      <thead>
                      <tr>
                        <th>Event</th>
                        <th>Group</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th class="text-end">Booked</th>
                        <th class="text-end">Capacity</th>
                      </tr>
                      </thead>
                      <tbody>
                      @for (row of summaryRows; track row.eventIds[0]) {
                        <tr class="cursor-pointer" [class.table-warning]="row.orphaned" (click)="selectEvent(row.eventIds[0])">
                          <td>{{ row.eventTitle }}@if (row.orphaned) { <span class="badge bg-warning text-dark ms-1">Orphaned</span>}</td>
                          <td>{{ row.groupName }}{{ row.groupCode ? ' (' + row.groupCode + ')' : '' }}</td>
                          <td>{{ row.eventDate }}</td>
                          <td>{{ row.eventTime }}</td>
                          <td class="text-nowrap">
                            @if (row.bookable) {
                              <span class="badge-mintcake text-nowrap">Bookable</span>
                            } @else {
                              <span class="badge-granite text-nowrap">Not bookable</span>
                            }
                          </td>
                          <td class="text-end">{{ row.totalBooked }}</td>
                          <td class="text-end">{{ row.maxCapacity }}</td>
                        </tr>
                      }
                      @if (summaryRows.length === 0) {
                        <tr>
                          <td colspan="7" class="text-center text-muted">No events with bookings enabled</td>
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
                    <div class="d-flex justify-content-between align-items-end mb-1">
                      <label class="form-label mb-0">Find upcoming event</label>
                      <div class="form-check">
                        <input [(ngModel)]="includePastEventsInPicker"
                               (ngModelChange)="onIncludePastEventsToggle()"
                               type="checkbox"
                               class="form-check-input"
                               id="include-past-events-in-picker">
                        <label class="form-check-label" for="include-past-events-in-picker">Include past events</label>
                      </div>
                    </div>
                    <ng-select [items]="pickerEventRows"
                               bindLabel="eventSelectorLabel"
                               bindValue="eventId"
                               [searchable]="true"
                               [searchFn]="rowSearchFn"
                               [clearable]="true"
                               [editableSearchTerm]="true"
                               [dropdownPosition]="'bottom'"
                               [closeOnSelect]="true"
                               [placeholder]="includePastEventsInPicker ? 'Select any event' : 'Select an upcoming event'"
                               [(ngModel)]="selectedEventId"
                               (ngModelChange)="onSelectedEventSelected($event)">
                      <ng-template ng-label-tmp let-item="item">
                        {{ item.eventSelectorLabel }}
                        @if (item.groupName || item.groupCode) {
                          <small class="text-muted ms-1">&mdash; {{ item.groupName }}{{ item.groupCode ? ' (' + item.groupCode + ')' : '' }}</small>
                        }
                      </ng-template>
                      <ng-template ng-option-tmp let-item="item">
                        <div class="d-flex justify-content-between align-items-center gap-2">
                          <span>{{ item.eventSelectorLabel }}</span>
                          <span class="text-nowrap flex-shrink-0" [class]="item.bookable ? 'badge-mintcake' : 'badge-granite'">
                            {{ item.bookable ? "Bookable" : "Not bookable" }}
                          </span>
                        </div>
                        @if (item.groupName || item.groupCode) {
                          <div><small class="text-muted">{{ item.groupName }}{{ item.groupCode ? ' (' + item.groupCode + ')' : '' }}</small></div>
                        }
                      </ng-template>
                    </ng-select>
                  </div>
                  @if (selectedEventId && selectedEventOrphaned) {
                    <div class="alert alert-warning mb-3">
                      <strong><fa-icon [icon]="faExclamationTriangle" class="me-1"></fa-icon>Orphaned bookings detected</strong>
                      <p class="mb-2">The event linked to these bookings no longer exists. This typically happens when the Walks Manager sync replaces an event with a new one. You can reassign these bookings to a valid event below, or delete them individually.</p>
                      <div class="d-flex align-items-end gap-2">
                        <div class="flex-grow-1">
                          <label class="form-label">Reassign bookings to</label>
                          <ng-select [items]="reassignTargetRows"
                                     bindLabel="eventSelectorLabel"
                                     bindValue="eventId"
                                     [searchable]="true"
                                     [searchFn]="rowSearchFn"
                                     [clearable]="true"
                                     [editableSearchTerm]="true"
                                     [dropdownPosition]="'bottom'"
                                     [closeOnSelect]="true"
                                     [placeholder]="'Select a valid event'"
                                     [(ngModel)]="reassignTargetEventId">
                            <ng-template ng-label-tmp let-item="item">
                              {{ item.eventSelectorLabel }}
                              @if (item.groupName || item.groupCode) {
                                <small class="text-muted ms-1">&mdash; {{ item.groupName }}{{ item.groupCode ? ' (' + item.groupCode + ')' : '' }}</small>
                              }
                            </ng-template>
                            <ng-template ng-option-tmp let-item="item">
                              <div>{{ item.eventSelectorLabel }}</div>
                              @if (item.groupName || item.groupCode) {
                                <small class="text-muted">{{ item.groupName }}{{ item.groupCode ? ' (' + item.groupCode + ')' : '' }}</small>
                              }
                            </ng-template>
                          </ng-select>
                        </div>
                        <div class="flex-shrink-0">
                          <button type="button" class="btn btn-warning"
                                  [disabled]="!reassignTargetEventId"
                                  (click)="reassignBookings()">
                            Reassign {{ stringUtils.pluraliseWithCount(eventBookings.length, "booking") }}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-3 mt-3">
                      <p
                        class="mb-0 text-muted">{{ stringUtils.pluraliseWithCount(eventBookings.length, "orphaned booking") }}</p>
                    </div>
                    <div class="table-responsive">
                      <table class="table table-striped table-hover">
                        <thead>
                        <tr>
                          <th>Attendees</th>
                          <th>Emails</th>
                          <th>Phone</th>
                          <th>Booked</th>
                          <th>Status</th>
                          <th class="text-end">Places</th>
                          <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        @for (booking of eventBookings; track booking.id) {
                          <tr>
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
                        </tbody>
                      </table>
                    </div>
                  }
                  @if (selectedEventId && !selectedEventOrphaned) {
                    <div class="row align-items-end mb-3">
                      <div class="col-auto">
                        <div class="form-check mb-2">
                          <input [(ngModel)]="selectedEventBookingsEnabled"
                                 (ngModelChange)="markSelectedEventDirty()"
                                 type="checkbox"
                                 class="form-check-input"
                                 id="selected-event-bookings-enabled">
                          <label class="form-check-label" for="selected-event-bookings-enabled">Bookings enabled for this event</label>
                        </div>
                      </div>
                      <div class="col-sm-6 col-lg-4">
                        <label class="form-label" for="selected-event-max-capacity">Max capacity for this event</label>
                        <input [(ngModel)]="selectedEventMaxCapacity"
                               (ngModelChange)="markSelectedEventDirty()"
                               type="number"
                               min="0"
                               class="form-control"
                               id="selected-event-max-capacity"
                               placeholder="leave blank to use default">
                      </div>
                    </div>
                    <hr class="my-3"/>
                    <h6>Per-event email overrides (optional)</h6>
                    <p class="mb-2 text-muted">
                      These overrides apply only to the selected event. Global booking email wording is configured in
                      <a [routerLink]="'/' + adminMailSettingsPath" [queryParams]="bookingNotificationQueryParams"><strong>Admin &gt; Mail Settings &gt; Email Configurations &gt; Booking Notification</strong></a>.
                    </p>
                    <div appStickyControls class="d-flex align-items-start gap-2 mb-2 pt-2">
                      <app-section-toggle [tabs]="emailTemplateTabs" [selectedTab]="selectedEventEmailOverrideType" (selectedTabChange)="onEmailTypeTabChange($event)"/>
                      @if (perEventNotifConfig && !bookingPreviewVisible) {
                        <app-section-toggle [tabs]="selectedEventContentStateTabs()" [selectedTab]="selectedEventContentState()" (selectedTabChange)="onSelectedEventContentStateChange($event)" [fullWidth]="false"/>
                      }
                      <button type="button" class="btn booking-preview-toggle ms-auto"
                              (click)="toggleBookingEmailPreview()">
                        <fa-icon [icon]="bookingPreviewVisible ? faEyeSlash : faEye" class="me-1"></fa-icon>{{ bookingPreviewVisible ? "Hide preview" : "Preview" }}
                      </button>
                    </div>
                    @if (perEventNotifConfig && !bookingPreviewVisible) {
                      <app-content-block-editor [notificationConfig]="perEventNotifConfig" [blockKeys]="[BOOKING_EMAIL_BLOCK_KEYS[selectedEventEmailOverrideType]]" [blockDefaults]="selectedEventBlockDefaults" [omitAllowed]="false" [frameless]="true" [mergeFieldCatalogue]="BOOKING_MERGE_FIELD_CATALOGUE" [stateQueryParamKey]="StoredValue.EMAIL_STATE" [showStateToggle]="false"/>
                    }
                    @if (bookingPreviewVisible) {
                      <app-email-preview #bookingEmailPreview/>
                    }
                    <div class="d-flex justify-content-start gap-2 mt-3 mb-3">
                      <button type="button" class="btn btn-success" (click)="saveSelectedEventChanges()">
                        Save all changes
                      </button>
                      <button type="button" class="btn btn-outline-secondary" (click)="revertSelectedEventChanges()">
                        Revert changes
                      </button>
                    </div>
                    @if (selectedTypeAlreadySent().length > 0) {
                      <div class="alert alert-warning py-2 px-3 mb-2">
                        <div>
                          <fa-icon [icon]="faExclamationTriangle" class="me-1"/>
                          @if (!resendToAlreadySent) {
                            <strong>{{ stringUtils.pluraliseWithCount(selectedTypeAlreadySent().length, "booking") }} already sent the {{ sendEmailLabelType() }} email</strong> - these will be skipped.
                          } @else {
                            <strong>Re-send is on</strong> - the {{ stringUtils.pluraliseWithCount(selectedTypeAlreadySent().length, "already-sent booking") }} will be included.
                          }
                          <button type="button" class="btn btn-link btn-sm p-0 ms-1 align-baseline" (click)="alreadySentDetailsExpanded = !alreadySentDetailsExpanded">
                            {{ alreadySentDetailsExpanded ? "Hide who" : "Show who" }}
                          </button>
                        </div>
                        @if (alreadySentDetailsExpanded) {
                          <ul class="mb-0 mt-1">
                            @for (booking of selectedTypeAlreadySent(); track booking.id) {
                              <li><small>{{ attendeeDisplayNames(booking) }} - sent {{ emailSentAtFor(booking, selectedEventEmailOverrideType) | displayDate }}</small></li>
                            }
                          </ul>
                        }
                        <div class="form-check mt-2">
                          <input class="form-check-input" type="checkbox" id="resend-already-sent"
                                 [checked]="resendToAlreadySent" (change)="onResendToAlreadySentChange()">
                          <label class="form-check-label small" for="resend-already-sent">
                            Re-send to people already sent this {{ sendEmailLabelType() }} email
                          </label>
                        </div>
                      </div>
                    }
                    @if (candidateBookingsForSelectedType().length > 0) {
                      <div class="form-group mb-2">
                        <label for="booking-recipient-select" class="control-label">Send {{ sendEmailLabelType() }} to specific people (optional)</label>
                        <ng-select [items]="bookingRecipientOptions"
                                   bindLabel="label"
                                   bindValue="id"
                                   labelForId="booking-recipient-select"
                                   placeholder="Leave empty to send to everyone, or pick specific people"
                                   [multiple]="true"
                                   [closeOnSelect]="false"
                                   [(ngModel)]="selectedBookingIds">
                        </ng-select>
                        <small class="text-muted">Pick individuals to send only to them. Leave empty to use the option above.</small>
                      </div>
                    }
                    <div class="d-flex justify-content-between align-items-center mb-3">
                      <p class="mb-0 text-muted">{{ eventBookings.length }} bookings for this event</p>
                      <div class="d-flex gap-2 align-items-center">
                        @if (sendingEmailStatus) {
                          <small class="text-muted">{{ sendingEmailStatus }}</small>
                        }
                        <button type="button" class="btn btn-warning btn-sm" [disabled]="isSendingEmails" (click)="sendBookingEmailsForSelectedType()">
                          @if (isSendingEmails) {
                            <fa-icon [icon]="faSpinner" [spin]="true" class="me-1"/>
                          } @else {
                            <fa-icon [icon]="faPaperPlane" class="me-1"/>
                          }
                          {{ isSendingEmails ? "Sending..." : "Send " + sendEmailLabelType() + " emails now" }}
                        </button>
                        <button type="button" class="btn btn-warning btn-sm" (click)="downloadDetailCsv()">
                          <fa-icon [icon]="faDownload" class="me-1"></fa-icon>Download CSV
                        </button>
                      </div>
                    </div>
                    <div class="table-responsive">
                      <table class="table table-striped table-hover">
                        <thead>
                        <tr>
                          <th>Attendees</th>
                          <th>Emails</th>
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
                          <label class="form-label d-block">Which events accept bookings?</label>
                          <div class="form-check">
                            <input type="radio"
                                   class="form-check-input"
                                   name="booking-scope"
                                   id="booking-scope-all"
                                   [value]="BookingScope.ALL_EVENTS"
                                   [(ngModel)]="bookingConfig.scope">
                            <label class="form-check-label" for="booking-scope-all">
                              <strong>All events</strong> of the enabled types accept bookings automatically
                            </label>
                          </div>
                          <div class="form-check">
                            <input type="radio"
                                   class="form-check-input"
                                   name="booking-scope"
                                   id="booking-scope-per-event"
                                   [value]="BookingScope.PER_EVENT"
                                   [(ngModel)]="bookingConfig.scope">
                            <label class="form-check-label" for="booking-scope-per-event">
                              <strong>Per event</strong> &mdash; only events with <em>Bookings enabled</em> ticked on the event will accept bookings
                            </label>
                          </div>
                        </div>
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
                        <div class="form-check mb-3">
                          <input [(ngModel)]="bookingConfig.templatesIncludeSalutation"
                                 type="checkbox"
                                 class="form-check-input"
                                 id="templates-include-salutation">
                          <label class="form-check-label" for="templates-include-salutation">
                            Email templates include their own salutation
                          </label>
                          <div class="form-text">
                            Tick when your templates start with <code [textContent]="bookingSalutationExample"></code> so the Brevo layout won't render a duplicate greeting. Untick if your templates omit the salutation and you want the Brevo layout to render it.
                          </div>
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

      .booking-preview-toggle
        align-items: center
        background-color: #e9ecef
        border: 2px solid #adb5bd
        color: #6c757d
        display: inline-flex
        font-weight: 700
        line-height: 1.5
        margin-bottom: 0.75rem
        padding: 0.375rem 1rem

      .booking-preview-toggle:hover,
      .booking-preview-toggle:focus
        background-color: var(--ramblers-colour-sunrise)
        border-color: var(--ramblers-colour-sunrise)
        color: var(--ramblers-colour-black)
    `],
    imports: [PageComponent, FontAwesomeModule, FormsModule, DisplayDatePipe, CsvExportComponent, TabsetComponent, TabDirective, MarkdownEditorComponent, ContentBlockEditorComponent, NgSelectComponent, NgOptionTemplateDirective, SectionToggle, EmailPreviewComponent, RouterLink, StickyControlsDirective]
})
export class BookingsComponent implements OnInit, OnDestroy {
  adminMailSettingsPath = AdminPath.MAIL_SETTINGS;
  private logger: Logger = inject(LoggerFactory).createLogger("BookingsComponent", NgxLoggerLevel.ERROR);
  private bookingService = inject(BookingService);
  private dateUtils = inject(DateUtilsService);
  private notifierService = inject(NotifierService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private walkDisplayService = inject(WalkDisplayService);
  private bookingConfigService = inject(BookingConfigService);
  private notificationConfigService = inject(NotificationConfigService);
  protected stringUtils = inject(StringUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);

  faTicket = faTicket;
  faDownload = faDownload;
  faTrash = faTrash;
  faEye = faEye;
  faEyeSlash = faEyeSlash;
  faPencil = faPencil;
  faPaperPlane = faPaperPlane;
  faSpinner = faSpinner;
  faExclamationTriangle = faExclamationTriangle;

  notifyTarget: AlertTarget = {};
  notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  private subscriptions: Subscription[] = [];

  private tab: BookingTab = BookingTab.SUMMARY;
  reportDate: number;
  summaryRows: BookingSummaryRow[] = [];
  allBookings: Booking[] = [];
  private readonly bookingEventProjection = {
    [GroupEventField.ID]: 1,
    [GroupEventField.URL]: 1,
    [GroupEventField.TITLE]: 1,
    [GroupEventField.START_DATE]: 1,
    [GroupEventField.ITEM_TYPE]: 1,
    [GroupEventField.GROUP_NAME]: 1,
    [GroupEventField.GROUP_CODE]: 1,
    "fields.maxCapacity": 1,
    "fields.bookingsEnabled": 1,
    "fields.bookingEmailOverrides": 1
  };
  eventBookings: Booking[] = [];
  selectedEventId: string = null;
  selectedEventMaxCapacity: number = null;
  selectedEventBookingsEnabled: boolean = false;
  includePastEventsInPicker = false;
  bookingPreviewVisible = false;
  bookingConfig: BookingConfig = this.bookingConfigService.default();
  bookingEventTypes = enabledBookingEventTypes(this.bookingConfig);
  protected readonly bookingNotificationQueryParams = {[StoredValue.TAB]: "email-configurations", [StoredValue.CONFIGURATION]: "booking-notification"};
  protected readonly BookingScope = BookingScope;
  protected readonly StoredValue = StoredValue;
  protected readonly BOOKING_MERGE_FIELD_CATALOGUE = BOOKING_MERGE_FIELD_CATALOGUE;
  protected readonly bookingSalutationExample = "Hi {{params.bookingMergeFields.ATTENDEE_NAME}},";
  availableEventRows: BookingSummaryRow[] = [];
  pickerEventRows: BookingSummaryRow[] = [];
  csvData: any[] = [];
  csvFilename = "";
  csvConfig: CsvOptions;
  private eventsMap: Map<string, ExtendedGroupEvent> = new Map();
  private futureEventRows: BookingSummaryRow[] = [];

  protected readonly BookingTab = BookingTab;
  protected readonly BookingStatus = BookingStatus;

  emailTemplateTypes: BookingEmailType[] = enumKeyValues(BookingEmailType).map(p => p.value as BookingEmailType);
  selectedEventEmailOverrideType: string = BookingEmailType.CONFIRMATION;
  emailTemplateTabs: SectionToggleTab[] = this.emailTemplateTypes.map(type => ({value: type, label: this.stringUtils.asTitle(type)}));
  perEventNotifConfig: NotificationConfig | null = null;
  siteBookingNotifConfig: NotificationConfig | null = null;
  isSendingEmails = false;
  sendingEmailStatus: string | null = null;
  resendToAlreadySent = false;
  alreadySentDetailsExpanded = false;
  selectedBookingIds: string[] = [];
  private cachedRecipientOptions: { id: string; label: string; disabled: boolean }[] = [];
  private cachedRecipientOptionsKey = "";
  private dirtyEventIds: Set<string> = new Set();
  reassignTargetEventId: string = null;
  reassignTargetRows: BookingSummaryRow[] = [];
  selectedEventOrphaned = false;
  protected readonly BOOKING_EMAIL_BLOCK_KEYS = BOOKING_EMAIL_BLOCK_KEYS;

  get selectedEventBlockDefaults(): Record<string, string> {
    const emailType = this.selectedEventEmailOverrideType;
    const blockKey = BOOKING_EMAIL_BLOCK_KEYS[emailType];
    const siteDefault = this.siteBookingNotifConfig?.templateOverrides?.[blockKey]?.content;
    return { [blockKey]: siteDefault || DEFAULT_BOOKING_EMAIL_BLOCKS[emailType as BookingEmailType] || "" };
  }

  selectedEventContentStateTabs(): SectionToggleTab[] {
    return contentBlockStateTabs(false);
  }

  selectedEventContentState(): TemplateOverrideState {
    return this.perEventNotifConfig
      ? contentBlockState(this.perEventNotifConfig, this.selectedEventContentBlockKey())
      : TemplateOverrideState.DEFAULT;
  }

  onSelectedEventContentStateChange(state: string): void {
    if (this.perEventNotifConfig) {
      setContentBlockState(this.perEventNotifConfig, this.selectedEventContentBlockKey(), state as TemplateOverrideState, this.selectedEventBlockDefaults);
      this.syncPerEventNotifConfig();
    }
  }

  private selectedEventContentBlockKey(): string {
    return BOOKING_EMAIL_BLOCK_KEYS[this.selectedEventEmailOverrideType];
  }

  @ViewChild("csvComponent") csvComponent: CsvExportComponent;
  @ViewChild("bookingEmailPreview") bookingEmailPreview: EmailPreviewComponent;

  ngOnInit() {
    this.reportDate = this.dateUtils.dateTimeNowAsValue();
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      this.tab = params[StoredValue.TAB] || kebabCase(BookingTab.SUMMARY);
      const emailTypeParam = params[StoredValue.EMAIL_TYPE];
      if (emailTypeParam && values(BookingEmailType).includes(emailTypeParam)) {
        this.selectedEventEmailOverrideType = emailTypeParam;
      }
      const eventSlugParam = params[StoredValue.EVENT_ID];
      if (eventSlugParam) {
        const resolvedEventId = this.resolveEventIdFromSlug(eventSlugParam);
        if (resolvedEventId && resolvedEventId !== this.selectedEventId) {
          this.selectedEventId = resolvedEventId;
          this.onSelectedEventChange();
        }
      }
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
    return booking.attendees.map(attendee => attendee.email).filter((email): email is string => !!email).join(", ");
  }

  private async loadBookingAdminData() {
    const notificationConfigLoad = this.loadBookingNotificationConfig();
    await this.loadSummary();
    await this.loadFutureEvents();
    await notificationConfigLoad;
    const urlEventParam = this.activatedRoute.snapshot.queryParams[StoredValue.EVENT_ID];
    if (urlEventParam && !this.selectedEventId) {
      const resolvedEventId = this.resolveEventIdFromSlug(urlEventParam);
      if (resolvedEventId) {
        this.selectedEventId = resolvedEventId;
        this.onSelectedEventChange();
      }
    }
  }

  private async loadBookingNotificationConfig(): Promise<void> {
    try {
      const configs = await this.notificationConfigService.all();
      this.siteBookingNotifConfig = configs.find(config =>
        config.templateOverrides &&
        values(BOOKING_EMAIL_BLOCK_KEYS).some(key => config.templateOverrides[key])
      ) || null;
    } catch (error) {
      this.logger.error("Failed to load booking notification config:", error);
      this.siteBookingNotifConfig = null;
    }
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
    if (eventIds.length === 0) {
      return;
    }
    const eventQuery: EventQueryParameters = {
      inputSource: null,
      suppressEventLinking: false,
      ids: eventIds,
      dataQueryOptions: {select: this.bookingEventProjection}
    };
    const events = await this.walksAndEventsService.all(eventQuery);
    events.forEach(event => this.eventsMap.set(event.id, event));
  }

  private buildSummaryRows() {
    const grouped: Map<string, Booking[]> = new Map();
    this.allBookings.forEach(booking => {
      booking.eventIds.forEach(eventId => {
        const existing = grouped.get(eventId) || [];
        grouped.set(eventId, [...existing, booking]);
      });
    });
    const nowMillis = this.dateUtils.dateTimeNowNoTime().toMillis();
    this.summaryRows = Array.from(grouped).map(([eventId, bookings]) => {
      const event = this.eventsMap.get(eventId);
      const orphaned = !event;
      const totalBooked = bookings.reduce((sum, b) => sum + b.attendees.length, 0);
      const title = event?.groupEvent?.title || "Unknown event";
      const label = orphaned
        ? `Orphaned: ${title} (${this.stringUtils.pluraliseWithCount(totalBooked, "booking")})`
        : this.eventSelectorLabel(title, event?.groupEvent?.item_type, event?.groupEvent?.start_date_time);
      const startDateTime = event?.groupEvent?.start_date_time;
      const upcoming = !!startDateTime && this.dateUtils.asValueNoTime(startDateTime) >= nowMillis;
      return {
        eventId,
        eventIds: [eventId],
        eventTitle: title,
        eventStartDateTime: startDateTime,
        eventDate: startDateTime ? this.dateUtils.displayDate(this.dateUtils.asValueNoTime(startDateTime)) : "",
        eventTime: startDateTime ? this.dateUtils.displayTime(startDateTime) : "",
        eventType: event?.groupEvent?.item_type,
        eventSelectorLabel: label,
        eventSlug: event ? this.walkDisplayService.walkSlug(event) : eventId,
        groupName: event?.groupEvent?.group_name,
        groupCode: event?.groupEvent?.group_code,
        bookable: !orphaned && bookingEnabledForEvent(this.bookingConfigService.bookingConfig(), event),
        upcoming,
        totalBooked,
        maxCapacity: this.maxCapacityFor(event),
        orphaned
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
          select: this.bookingEventProjection,
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
          eventStartDateTime: event?.groupEvent?.start_date_time,
          eventDate: event?.groupEvent?.start_date_time ? this.dateUtils.displayDate(this.dateUtils.asValueNoTime(event.groupEvent.start_date_time)) : "",
          eventTime: event?.groupEvent?.start_date_time ? this.dateUtils.displayTime(event.groupEvent.start_date_time) : "",
          eventType: event?.groupEvent?.item_type,
          eventSelectorLabel: this.eventSelectorLabel(event?.groupEvent?.title || "Unknown event", event?.groupEvent?.item_type, event?.groupEvent?.start_date_time),
          eventSlug: this.walkDisplayService.walkSlug(event),
          groupName: event?.groupEvent?.group_name,
          groupCode: event?.groupEvent?.group_code,
          bookable: bookingEnabledForEvent(this.bookingConfigService.bookingConfig(), event),
          upcoming: true,
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
    this.recomputePickerEventRows();
  }

  onSelectedEventSelected(eventId: string) {
    this.selectedEventId = eventId;
    this.onSelectedEventChange();
    this.syncSelectedEventToUrl();
  }

  selectEvent(eventId: string) {
    this.selectedEventId = eventId;
    this.onSelectedEventChange();
    this.router.navigate([], {
      queryParams: {
        [StoredValue.TAB]: kebabCase(BookingTab.PER_EVENT_DETAIL),
        [StoredValue.EVENT_ID]: this.slugForEventId(eventId)
      },
      queryParamsHandling: "merge"
    });
    this.tab = kebabCase(BookingTab.PER_EVENT_DETAIL) as BookingTab;
  }

  private syncSelectedEventToUrl() {
    this.router.navigate([], {
      queryParams: {[StoredValue.EVENT_ID]: this.slugForEventId(this.selectedEventId)},
      queryParamsHandling: "merge"
    });
  }

  private slugForEventId(eventId: string): string | null {
    if (!eventId) {
      return null;
    }
    const row = this.availableEventRows.find(candidate => candidate.eventId === eventId);
    return row?.eventSlug || eventId;
  }

  private resolveEventIdFromSlug(slugOrId: string): string | null {
    const row = this.availableEventRows.find(candidate => candidate.eventSlug === slugOrId)
      || this.availableEventRows.find(candidate => candidate.eventId === slugOrId);
    return row?.eventId || null;
  }

  async onEmailTypeTabChange(emailType: string) {
    this.selectedEventEmailOverrideType = emailType;
    this.resendToAlreadySent = false;
    this.alreadySentDetailsExpanded = false;
    this.selectedBookingIds = [];
    this.buildPerEventNotifConfig();
    this.router.navigate([], {
      queryParams: {[StoredValue.EMAIL_TYPE]: emailType},
      queryParamsHandling: "merge"
    });
    if (this.bookingPreviewVisible) {
      await Promise.resolve();
      await this.previewSelectedEventEmail();
    }
  }

  async toggleBookingEmailPreview() {
    this.bookingPreviewVisible = !this.bookingPreviewVisible;
    if (this.bookingPreviewVisible) {
      await Promise.resolve();
      await this.previewSelectedEventEmail();
    }
  }

  sendEmailLabelType(): string {
    return this.stringUtils.asTitle(this.selectedEventEmailOverrideType || BookingEmailType.REMINDER).toLowerCase();
  }

  private relevantStatusesForType(emailType: string): BookingStatus[] {
    return emailType === BookingEmailType.WAITLISTED
      ? [BookingStatus.WAITLISTED]
      : emailType === BookingEmailType.CANCELLATION
        ? [BookingStatus.CANCELLED]
        : [BookingStatus.ACTIVE];
  }

  emailSentAtFor(booking: Booking, emailType: string): number | undefined {
    return booking.emailSends?.[emailType]
      ?? (emailType === BookingEmailType.REMINDER ? booking.reminderSentAt : undefined);
  }

  candidateBookingsForSelectedType(): Booking[] {
    const emailType = this.selectedEventEmailOverrideType || BookingEmailType.REMINDER;
    const statuses = this.relevantStatusesForType(emailType);
    return this.eventBookings.filter(booking => statuses.includes(booking.status ?? BookingStatus.ACTIVE));
  }

  selectedTypeAlreadySent(): Booking[] {
    const emailType = this.selectedEventEmailOverrideType || BookingEmailType.REMINDER;
    return this.candidateBookingsForSelectedType().filter(booking => !!this.emailSentAtFor(booking, emailType));
  }

  onResendToAlreadySentChange(): void {
    this.resendToAlreadySent = !this.resendToAlreadySent;
    if (!this.resendToAlreadySent) {
      const emailType = this.selectedEventEmailOverrideType || BookingEmailType.REMINDER;
      this.selectedBookingIds = this.selectedBookingIds.filter(id => {
        const booking = this.candidateBookingsForSelectedType().find(candidate => candidate.id === id);
        return booking && !this.emailSentAtFor(booking, emailType);
      });
    }
  }

  get bookingRecipientOptions(): { id: string; label: string; disabled: boolean }[] {
    const emailType = this.selectedEventEmailOverrideType || BookingEmailType.REMINDER;
    const candidates = this.candidateBookingsForSelectedType();
    const key = `${emailType}|${this.resendToAlreadySent}|${candidates.map(booking => `${booking.id}:${this.emailSentAtFor(booking, emailType) ?? 0}`).join(",")}`;
    if (key !== this.cachedRecipientOptionsKey) {
      this.cachedRecipientOptionsKey = key;
      this.cachedRecipientOptions = candidates.map(booking => {
        const sentAt = this.emailSentAtFor(booking, emailType);
        const suffix = sentAt ? ` (already sent ${this.dateUtils.displayDate(sentAt)})` : "";
        return {id: booking.id, label: `${this.attendeeDisplayNames(booking)}${suffix}`, disabled: !!sentAt && !this.resendToAlreadySent};
      });
    }
    return this.cachedRecipientOptions;
  }

  async sendBookingEmailsForSelectedType() {
    if (!this.selectedEventId) {
      this.notify.error({title: "Send failed", message: "Please select an event first"});
      return;
    }
    const emailType = (this.selectedEventEmailOverrideType || BookingEmailType.REMINDER) as BookingEmailType;
    this.isSendingEmails = true;
    this.sendingEmailStatus = `Sending ${this.sendEmailLabelType()} emails...`;
    try {
      const bookingIds = this.selectedBookingIds.length ? this.selectedBookingIds : null;
      const dispatch = emailType === BookingEmailType.REMINDER
        ? await this.bookingService.sendReminders(this.selectedEventId, this.resendToAlreadySent, bookingIds)
        : await this.bookingService.sendEmailsByType(this.selectedEventId, emailType, this.resendToAlreadySent, bookingIds);
      await this.loadSummary();
      this.loadEventBookings();
      this.selectedBookingIds = [];
      const messageParts = [
        `${dispatch.sentCount} sent`,
        dispatch.alreadySentCount > 0 ? `${dispatch.alreadySentCount} already sent` : null,
        dispatch.skippedCount > 0 ? `${dispatch.skippedCount} failed` : null
      ].filter(part => !!part);
      this.sendingEmailStatus = `${dispatch.eventTitle}: ${messageParts.join(", ")}`;
    } catch (error) {
      this.sendingEmailStatus = `Send failed for ${this.sendEmailLabelType()} emails`;
      this.logger.error("sendBookingEmailsForSelectedType failed:", error);
    } finally {
      this.isSendingEmails = false;
    }
  }

  async previewSelectedEventEmail() {
    if (!this.selectedEventId) {
      this.bookingEmailPreview?.showError("Select an event first to preview its email.");
      return;
    }
    const emailType = (this.selectedEventEmailOverrideType || BookingEmailType.REMINDER) as BookingEmailType;
    try {
      const request = await this.bookingService.previewEmail(this.selectedEventId, emailType);
      await this.bookingEmailPreview?.render(request);
    } catch (error) {
      this.bookingEmailPreview?.showError("Preview could not be rendered.");
      this.logger.error("previewSelectedEventEmail failed:", error);
    }
  }

  loadEventBookings() {
    if (this.selectedEventId) {
      this.eventBookings = this.allBookings.filter(b => b.eventIds.includes(this.selectedEventId));
    } else {
      this.eventBookings = [];
    }
  }

  onSelectedEventChange() {
    this.resendToAlreadySent = false;
    this.alreadySentDetailsExpanded = false;
    this.selectedBookingIds = [];
    this.ensureSelectedEventVisibleInPicker();
    const event = this.eventsMap.get(this.selectedEventId);
    this.selectedEventOrphaned = !event && !!this.selectedEventId;
    this.reassignTargetEventId = null;
    this.reassignTargetRows = this.availableEventRows.filter(row => !row.orphaned && row.bookable && row.eventIds[0] !== this.selectedEventId);
    this.selectedEventMaxCapacity = event?.fields?.maxCapacity ?? null;
    this.selectedEventBookingsEnabled = !!event?.fields?.bookingsEnabled;
    this.loadEventBookings();
    this.buildPerEventNotifConfig();
    if (this.bookingPreviewVisible && this.selectedEventId) {
      this.previewSelectedEventEmail();
    }
  }

  private ensureSelectedEventVisibleInPicker() {
    if (!this.selectedEventId) {
      return;
    }
    if (this.pickerEventRows.some(row => row.eventId === this.selectedEventId)) {
      return;
    }
    const selectedRow = this.availableEventRows.find(row => row.eventId === this.selectedEventId);
    if (selectedRow && !this.includePastEventsInPicker) {
      this.includePastEventsInPicker = true;
      this.recomputePickerEventRows();
    }
  }

  async reassignBookings() {
    if (!this.reassignTargetEventId || !this.selectedEventId) {
      return;
    }
    const orphanedEventId = this.selectedEventId;
    const bookingsToReassign = this.allBookings.filter(b => b.eventIds.includes(orphanedEventId));
    if (bookingsToReassign.length === 0) {
      this.notify.warning({title: "No bookings", message: "No bookings found to reassign"});
      return;
    }
    this.notify.progress({
      title: "Reassigning",
      message: `Moving ${this.stringUtils.pluraliseWithCount(bookingsToReassign.length, "booking")} to new event...`
    });
    try {
      const updatePromises = bookingsToReassign.map(async b => {
        const updatedBooking: Booking = {
          ...b,
          eventIds: b.eventIds.map(id => id === orphanedEventId ? this.reassignTargetEventId : id)
        };
        return this.bookingService.update(updatedBooking);
      });
      await Promise.all(updatePromises);
      this.selectedEventId = this.reassignTargetEventId;
      this.reassignTargetEventId = null;
      await this.loadBookingAdminData();
      this.onSelectedEventChange();
      this.notify.success({
        title: "Reassigned",
        message: `${this.stringUtils.pluraliseWithCount(bookingsToReassign.length, "booking")} moved to the selected event`
      });
    } catch (error) {
      this.notify.error({title: "Reassign failed", message: "Could not reassign bookings"});
      this.logger.error("reassignBookings failed:", error);
    }
  }



  async saveBookingConfig() {
    try {
      await this.bookingConfigService.saveConfig(this.bookingConfig);
      this.bookingEventTypes = enabledBookingEventTypes(this.bookingConfig);
      await this.loadFutureEvents();
      if (this.bookingPreviewVisible && this.selectedEventId) {
        await this.previewSelectedEventEmail();
      }
      this.notify.success({title: "Saved", message: "Booking configuration updated"});
    } catch (error) {
      this.notify.error({title: "Save failed", message: "Could not update booking configuration"});
      this.logger.error("saveBookingConfig failed:", error);
    }
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
    const csvHeaders = ["Attendees", "Emails", "Phone", "Booked", "Status", "Places"];
    this.csvData = this.eventBookings.map(booking => ({
      "Attendees": this.attendeeDisplayNames(booking),
      "Emails": this.attendeeEmailList(booking),
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

  downloadAllAttendeesCsv() {
    const csvHeaders = ["Event", "Date", "Time", "Group", "Attendee", "Email", "Phone", "Status", "Booked"];
    const rowByEventId = new Map(this.summaryRows.map(row => [row.eventIds[0], row]));
    this.csvData = this.allBookings.flatMap(booking =>
      booking.eventIds.flatMap(eventId => {
        const eventRow = rowByEventId.get(eventId);
        const groupLabel = eventRow ? `${eventRow.groupName || ""}${eventRow.groupCode ? ` (${eventRow.groupCode})` : ""}`.trim() : "";
        return booking.attendees.map(attendee => ({
          "Event": eventRow?.eventTitle || "Unknown event",
          "Date": eventRow?.eventDate || "",
          "Time": eventRow?.eventTime || "",
          "Group": groupLabel,
          "Attendee": attendee.displayName,
          "Email": attendee.email || "",
          "Phone": attendee.phone || "",
          "Status": booking.status === BookingStatus.WAITLISTED ? "Waitlisted" : "Active",
          "Booked": this.dateUtils.displayDate(booking.createdAt)
        }));
      }));
    this.csvFilename = "all-booking-attendees";
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
    return effectiveMaxCapacityForEvent(this.bookingConfigService.bookingConfig(), event);
  }

  private recomputePickerEventRows() {
    this.pickerEventRows = this.includePastEventsInPicker
      ? this.availableEventRows
      : this.availableEventRows.filter(row => row.upcoming || row.orphaned);
  }

  onIncludePastEventsToggle() {
    this.recomputePickerEventRows();
  }

  rowSearchFn = (term: string, item: BookingSummaryRow): boolean => {
    if (!term) {
      return true;
    }
    const needle = term.toLowerCase();
    const haystack = [
      item.eventSelectorLabel,
      item.eventTitle,
      item.groupName,
      item.groupCode,
      item.eventDate,
      item.eventTime,
      item.bookable ? "bookable" : "not bookable"
    ];
    return haystack.some(value => value?.toLowerCase().includes(needle));
  };

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

  private buildPerEventNotifConfig(): void {
    const event = this.eventsMap.get(this.selectedEventId);
    if (!event) {
      this.perEventNotifConfig = null;
      return;
    }
    const emailType = this.selectedEventEmailOverrideType;
    const overrideValue = event.fields?.bookingEmailOverrides?.[emailType] || "";
    const blockKey = BOOKING_EMAIL_BLOCK_KEYS[emailType];
    this.perEventNotifConfig = {
      subject: { prefixParameter: null, text: null, suffixParameter: null },
      body: "",
      preSendActions: [],
      postSendActions: [],
      defaultMemberSelection: null,
      bannerId: null,
      templateOverrides: overrideValue
        ? { [blockKey]: { type: TemplateOverrideType.CONTENT, state: TemplateOverrideState.CUSTOM, content: overrideValue } }
        : {}
    };
  }

  private syncPerEventNotifConfig(): void {
    const event = this.eventsMap.get(this.selectedEventId);
    if (!event || !this.perEventNotifConfig) {
      return;
    }
    const emailType = this.selectedEventEmailOverrideType;
    const blockKey = BOOKING_EMAIL_BLOCK_KEYS[emailType];
    const override = this.perEventNotifConfig.templateOverrides?.[blockKey];
    if (!event.fields.bookingEmailOverrides) {
      event.fields.bookingEmailOverrides = {};
    }
    if (override?.state === TemplateOverrideState.CUSTOM && override.content?.trim()) {
      event.fields.bookingEmailOverrides[emailType] = override.content;
    } else {
      delete event.fields.bookingEmailOverrides[emailType];
    }
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
    this.syncPerEventNotifConfig();
    try {
      const overrides = selectedEvent.fields.bookingEmailOverrides;
      const hasAnyOverrides = overrides && values(overrides).some(v => v?.trim());
      const updatedEvent: ExtendedGroupEvent = {
        ...selectedEvent,
        fields: {
          ...selectedEvent.fields,
          maxCapacity: this.selectedEventMaxCapacity > 0 ? this.selectedEventMaxCapacity : null,
          bookingsEnabled: this.selectedEventBookingsEnabled,
          bookingEmailOverrides: hasAnyOverrides ? overrides : null
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
    if (!this.selectedEventId) {
      return;
    }
    try {
      const freshEvent = await this.walksAndEventsService.queryById(this.selectedEventId);
      if (freshEvent) {
        this.eventsMap.set(freshEvent.id, freshEvent);
      }
      this.dirtyEventIds.delete(this.selectedEventId);
      this.buildSummaryRows();
      this.onSelectedEventChange();
      this.notify.success({title: "Reverted", message: "Event changes reverted"});
    } catch (error) {
      this.notify.error({title: "Revert failed", message: "Could not reload the event"});
      this.logger.error("revertSelectedEventChanges failed:", error);
    }
  }
}
