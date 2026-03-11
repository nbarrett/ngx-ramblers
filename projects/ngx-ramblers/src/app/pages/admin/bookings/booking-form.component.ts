import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { bookingEnabledForEventType } from "../../../models/booking-config.model";
import { Booking, BookingAttendee, BookingCapacity, DEFAULT_MAX_GROUP_SIZE } from "../../../models/booking.model";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { BookingService } from "../../../services/booking.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { BookingConfigService } from "../../../services/system/booking-config.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faPlus,
  faTrash,
  faTicket,
  faBan,
  faSearch,
  faCheckCircle,
  faExclamationTriangle,
  faInfoCircle,
  faClock
} from "@fortawesome/free-solid-svg-icons";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";

@Component({
    selector: "app-booking-form",
    template: `
      @if (bookingEnabled) {
        <div class="event-panel rounded event-panel-inner booking-panel">
          <div class="booking-panel-content">
            @if (capacity) {
              @if (memberPriorityActive && !memberLoggedIn && !capacity.fullyBooked) {
                <div class="alert alert-warning mb-2">
                  <fa-icon [icon]="faInfoCircle" class="ms-1 me-2"></fa-icon>
                  Members have priority booking until {{ publicBookingOpensAt | displayDate }}.
                  If the event fills up, member bookings may take priority over non-member bookings.
                </div>
              }
              @if (mode === "book") {
                @if (bookingSubmitted) {
                  <div class="alert alert-success mb-0">
                    <fa-icon [icon]="faCheckCircle" class="ms-1 me-2"></fa-icon>
                    <strong>Booking confirmed</strong> — thank you for booking {{ stringUtils.pluraliseWithCount(lastBooking?.attendees?.length || 0, "place") }}.
                  </div>
                } @else if (capacity.fullyBooked && !(memberPriorityActive && memberLoggedIn)) {
                  <div class="alert alert-warning mb-0">
                    <fa-icon [icon]="faExclamationTriangle" class="ms-1 me-2"></fa-icon>
                    <strong>Fully booked</strong> — all {{ capacity.maxCapacity }} places have been taken.
                    @if (totalWaitlisted > 0) {
                      {{ stringUtils.pluraliseWithCount(totalWaitlisted, "person") }} {{ stringUtils.pluralise(totalWaitlisted, "is", "are") }} on the waiting list.
                    }
                  </div>
                } @else {
                  @if (capacity.fullyBooked && memberPriorityActive && memberLoggedIn) {
                    <div class="alert alert-success mb-3">
                      <fa-icon [icon]="faTicket" class="ms-1 me-2"></fa-icon>
                      <strong>Member Priority Booking</strong> — this event is full but as a member you can still book.
                      A non-member booking will be moved to the waiting list to make room.
                    </div>
                  } @else {
                    <div class="alert alert-success mb-3">
                      <fa-icon [icon]="faTicket" class="ms-1 me-2"></fa-icon>
                      <strong>Book a Place</strong> — {{ capacity.remainingPlaces }} of {{ capacity.maxCapacity }} places remaining
                    </div>
                  }
                  <form (ngSubmit)="submitBooking()" #bookingForm="ngForm">
                    @for (attendee of attendees; track attendeeIndex; let attendeeIndex = $index) {
                      <div class="mb-2">
                        <label class="form-label mb-1 text-nowrap">Attendee {{ attendeeIndex + 1 }}</label>
                        <div class="attendee-fields">
                          <input class="form-control attendee-field" type="text"
                                 [name]="'attendee-name-' + attendeeIndex"
                                 [(ngModel)]="attendees[attendeeIndex].displayName"
                                 [required]="attendeeIndex === 0"
                                 placeholder="Full name">
                          <input class="form-control attendee-field" type="email"
                                 [name]="'attendee-email-' + attendeeIndex"
                                 [(ngModel)]="attendees[attendeeIndex].email"
                                 [required]="attendeeIndex === 0"
                                 placeholder="email@example.com">
                          <input class="form-control attendee-field" type="tel"
                                 [name]="'attendee-phone-' + attendeeIndex"
                                 [(ngModel)]="attendees[attendeeIndex].phone"
                                 placeholder="Phone (optional)">
                          @if (attendees.length > 1) {
                            <button type="button" class="btn btn-outline-danger btn-sm attendee-remove"
                                    [class.invisible]="attendeeIndex === 0"
                                    (click)="removeAttendee(attendeeIndex)">
                              <fa-icon [icon]="faTrash"></fa-icon>
                            </button>
                          }
                        </div>
                      </div>
                    }
                    @if (notifyTarget.showAlert) {
                      <div class="alert {{notifyTarget.alertClass}} mt-2">
                        <fa-icon [icon]="notifyTarget.alert.icon" class="ms-1 me-2"></fa-icon>
                        @if (notifyTarget.alertTitle) {
                          <strong>{{ notifyTarget.alertTitle }}</strong>
                        }
                        {{ notifyTarget.alertMessage }}
                      </div>
                    }
                    <div class="action-row mt-2">
                      @if (attendees.length < maxGroupSize) {
                        <button type="button" class="btn btn-warning w-100"
                                (click)="addAttendee()">
                          <fa-icon [icon]="faPlus" class="me-1"></fa-icon>Add another attendee
                        </button>
                      }
                      <button type="submit" class="btn btn-primary w-100"
                              [disabled]="bookingForm.invalid || submitting">
                        {{ submitting ? "Booking..." : "Book Now" }}
                      </button>
                    </div>
                  </form>
                }
              }
              @if (mode === "cancel") {
                @if (cancellationConfirmed) {
                  <div class="alert alert-success mb-0">
                    <fa-icon [icon]="faCheckCircle" class="ms-1 me-2"></fa-icon>
                    <strong>Booking cancelled</strong> — your places have been released.
                  </div>
                } @else {
                  <form (ngSubmit)="lookupBookings()" #lookupForm="ngForm">
                    <div class="alert alert-warning mb-2">
                      <fa-icon [icon]="faInfoCircle" class="ms-1 me-2"></fa-icon>
                      Enter your email address to find your booking
                    </div>
                    <div class="mb-2">
                      <label class="form-label">Email address</label>
                      <input class="form-control" type="email" name="lookupEmail"
                             [(ngModel)]="lookupEmail" required placeholder="your@email.com">
                    </div>
                    @if (notifyTarget.showAlert) {
                      <div class="alert {{notifyTarget.alertClass}} mt-2">
                        <fa-icon [icon]="notifyTarget.alert.icon" class="ms-1 me-2"></fa-icon>
                        @if (notifyTarget.alertTitle) {
                          <strong>{{ notifyTarget.alertTitle }}</strong>
                        }
                        {{ notifyTarget.alertMessage }}
                      </div>
                    }
                    <button type="submit" class="btn btn-primary mt-2"
                            [disabled]="lookupForm.invalid || lookingUp">
                      <fa-icon [icon]="faSearch" class="me-1"></fa-icon>{{ lookingUp ? "Searching..." : "Find My Booking" }}
                    </button>
                  </form>
                  @if (lookedUpBookings.length > 0) {
                    <div class="mt-3">
                      <h5>Your bookings</h5>
                      @for (foundBooking of lookedUpBookings; track foundBooking.id) {
                        <div class="d-flex justify-content-between align-items-center border rounded p-2 mb-2">
                          <div>
                            <strong>{{ attendeeSummary(foundBooking) }}</strong>
                            @if (foundBooking.status === "waitlisted") {
                              <br><small class="text-warning">
                                <fa-icon [icon]="faClock" class="me-1"></fa-icon>On waiting list — you will be notified if a place becomes available
                              </small>
                            } @else {
                              <br><small class="text-muted">Booked: {{ foundBooking.createdAt | displayDate }}</small>
                            }
                          </div>
                          <button type="button" class="btn btn-outline-danger btn-sm"
                                  [disabled]="cancelling"
                                  (click)="cancelBooking(foundBooking)">
                            <fa-icon [icon]="faBan" class="me-1"></fa-icon>{{ cancelling ? "Cancelling..." : "Cancel" }}
                          </button>
                        </div>
                      }
                    </div>
                  }
                }
              }
              @if (mode === "book" && capacity?.totalBooked > 0) {
                <div class="mt-3">
                  <button type="button" class="btn btn-link btn-sm p-0 text-muted"
                          (click)="switchMode('cancel')">
                    Need to cancel a booking?
                  </button>
                </div>
              }
              @if (mode === "cancel") {
                <div class="mt-3">
                  <button type="button" class="btn btn-link btn-sm p-0 text-muted"
                          (click)="switchMode('book')">
                    Back to booking
                  </button>
                </div>
              }
            }
          </div>
        </div>
      }`,
    styles: [`
      :host
        display: block
        container-type: inline-size
      .booking-panel
        padding-bottom: 12px
      .booking-panel-content
        padding-right: 11px
      .attendee-fields
        display: grid
        grid-template-columns: minmax(0, 1fr)
        gap: 12px
      .action-row
        display: grid
        grid-template-columns: minmax(0, 1fr)
        gap: 8px
        align-items: stretch
      .action-row > *
        width: 100%
        min-width: 0
        margin-left: 0 !important
        margin-right: 0 !important
      .attendee-field
        width: 100%
        min-width: 0
      @container (min-width: 640px)
        .action-row
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.9fr)
      @container (min-width: 840px)
        .attendee-fields
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.8fr)
      .attendee-remove
        align-self: flex-end
      .booking-panel > :last-child
        margin-bottom: 0 !important
    `],
    imports: [FormsModule, FontAwesomeModule, DisplayDatePipe]
})
export class BookingFormComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("BookingFormComponent", NgxLoggerLevel.ERROR);
  private bookingService = inject(BookingService);
  private dateUtils = inject(DateUtilsService);
  private memberLoginService = inject(MemberLoginService);
  private notifierService = inject(NotifierService);
  private bookingConfigService = inject(BookingConfigService);
  protected stringUtils = inject(StringUtilsService);
  private subscriptions: Subscription[] = [];

  faPlus = faPlus;
  faTrash = faTrash;
  faTicket = faTicket;
  faBan = faBan;
  faSearch = faSearch;
  faCheckCircle = faCheckCircle;
  faExclamationTriangle = faExclamationTriangle;
  faInfoCircle = faInfoCircle;
  faClock = faClock;

  notifyTarget: AlertTarget = {};
  notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  mode: "book" | "cancel" = "book";
  attendees: BookingAttendee[] = [{displayName: "", email: ""}];
  submitting = false;
  bookingSubmitted = false;
  lastBooking: Booking;
  capacity: BookingCapacity;
  bookingEnabled = false;
  maxGroupSize = DEFAULT_MAX_GROUP_SIZE;
  private extendedGroupEvent: ExtendedGroupEvent;

  lookupEmail = "";
  lookingUp = false;
  lookedUpBookings: Booking[] = [];
  cancelling = false;
  cancellationConfirmed = false;
  memberPriorityActive = false;
  memberLoggedIn = false;
  publicBookingOpensAt: number = null;
  totalWaitlisted = 0;
  @Input() eventLink: string;

  @Input("extendedGroupEvent") set eventInput(event: ExtendedGroupEvent) {
    this.extendedGroupEvent = event;
    this.configureBooking();
  }

  ngOnInit() {
    this.logger.debug("initialised");
    this.subscriptions.push(this.bookingConfigService.events().subscribe(() => this.configureBooking()));
  }

  private configureBooking() {
    const event = this.extendedGroupEvent;
    if (!event) {
      this.bookingEnabled = false;
      return;
    }
    const bookingSettings = this.bookingConfigService.bookingConfig();
    const maxCapacity = event?.fields?.maxCapacity || bookingSettings?.defaultMaxCapacity || 0;
    this.bookingEnabled = bookingEnabledForEventType(bookingSettings, event?.groupEvent?.item_type) && maxCapacity > 0;
    if (this.bookingEnabled) {
      this.capacity = this.capacity || {
        eventIds: [event.id],
        totalBooked: 0,
        maxCapacity,
        fullyBooked: false,
        remainingPlaces: maxCapacity
      };
      this.maxGroupSize = event?.fields?.maxGroupSize || bookingSettings?.defaultMaxGroupSize || DEFAULT_MAX_GROUP_SIZE;
      this.memberLoggedIn = this.memberLoginService.memberLoggedIn();
      this.refreshEligibility();
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  switchMode(newMode: "book" | "cancel") {
    this.mode = newMode;
    this.notify.hide();
    this.lookedUpBookings = [];
    this.cancellationConfirmed = false;
    this.lookupEmail = "";
  }

  addAttendee() {
    if (this.attendees.length < this.maxGroupSize) {
      this.attendees = [...this.attendees, {displayName: "", email: ""}];
    }
  }

  removeAttendee(index: number) {
    this.attendees = this.attendees.filter((_, i) => i !== index);
  }

  attendeeSummary(bookingItem: Booking): string {
    return bookingItem.attendees.map(a => a.displayName).join(", ");
  }

  async refreshEligibility() {
    try {
      const eligibility = await this.bookingService.eligibility(this.extendedGroupEvent.id);
      this.memberPriorityActive = eligibility.memberPriorityActive;
      this.publicBookingOpensAt = eligibility.publicBookingOpensAt;
      this.capacity = eligibility.capacity;
      this.totalWaitlisted = eligibility.totalWaitlisted || 0;
      this.logger.debug("eligibility refreshed:", eligibility);
    } catch (error) {
      this.logger.error("eligibility check failed:", error);
      this.refreshCapacity();
    }
  }

  async refreshCapacity() {
    const capacityResponse = await this.bookingService.publicCapacity(this.extendedGroupEvent.id);
    const maxCapacity = this.extendedGroupEvent.fields.maxCapacity || this.bookingConfigService.bookingConfig()?.defaultMaxCapacity || 0;
    this.capacity = {
      eventIds: [this.extendedGroupEvent.id],
      totalBooked: capacityResponse.totalBooked,
      maxCapacity,
      fullyBooked: capacityResponse.totalBooked >= maxCapacity,
      remainingPlaces: Math.max(0, maxCapacity - capacityResponse.totalBooked)
    };
    this.logger.debug("capacity refreshed:", this.capacity);
  }

  async submitBooking() {
    this.submitting = true;
    const filledAttendees = this.attendees.filter(a => a.displayName?.trim()?.length > 0 && a.email?.trim()?.length > 0);
    if (filledAttendees.length === 0) {
      this.notify.error({title: "Booking failed", message: "Please enter at least one attendee name and email"});
      this.submitting = false;
      return;
    }
    const memberPriorityBooking = this.memberPriorityActive && this.memberLoggedIn;
    if (!memberPriorityBooking && this.capacity && (this.capacity.totalBooked + filledAttendees.length) > this.capacity.maxCapacity) {
      this.notify.error({
        title: "Booking failed",
        message: `Only ${this.capacity.remainingPlaces} places remaining but you requested ${filledAttendees.length}`
      });
      this.submitting = false;
      return;
    }
    const booking: Booking = {
      eventIds: [this.extendedGroupEvent.id],
      attendees: filledAttendees,
      createdAt: this.dateUtils.dateTimeNowAsValue()
    };
    try {
      this.lastBooking = await this.bookingService.create(booking, this.eventLink);
      this.bookingSubmitted = true;
      await this.refreshEligibility();
      this.logger.debug("booking created:", this.lastBooking);
    } catch (error) {
      const serverMessage = error?.error?.error || "Please try again later";
      this.notify.error({title: "Booking failed", message: serverMessage});
      this.logger.error("booking failed:", error);
    } finally {
      this.submitting = false;
    }
  }

  async lookupBookings() {
    this.lookingUp = true;
    this.notify.hide();
    try {
      this.lookedUpBookings = await this.bookingService.lookupByEmail(this.extendedGroupEvent.id, this.lookupEmail);
      if (this.lookedUpBookings.length === 0) {
        this.notify.warning({title: "No bookings found", message: "No active bookings found for this email address"});
      }
      this.logger.debug("lookup result:", this.lookedUpBookings);
    } catch (error) {
      this.notify.error({title: "Lookup failed", message: "Please try again later"});
      this.logger.error("lookup failed:", error);
    } finally {
      this.lookingUp = false;
    }
  }

  async cancelBooking(bookingToCancel: Booking) {
    this.cancelling = true;
    this.notify.hide();
    try {
      await this.bookingService.cancel(bookingToCancel.id, this.lookupEmail, this.eventLink);
      this.lookedUpBookings = this.lookedUpBookings.filter(b => b.id !== bookingToCancel.id);
      await this.refreshEligibility();
      if (this.lookedUpBookings.length === 0) {
        this.cancellationConfirmed = true;
      } else {
        this.notify.success({title: "Cancelled", message: `Booking for ${this.attendeeSummary(bookingToCancel)} has been cancelled`});
      }
      this.logger.debug("booking cancelled:", bookingToCancel.id);
    } catch (error) {
      this.notify.error({title: "Cancellation failed", message: "Please try again later"});
      this.logger.error("cancel failed:", error);
    } finally {
      this.cancelling = false;
    }
  }
}
