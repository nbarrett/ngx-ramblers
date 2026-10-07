import {Component, inject} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faArrowLeft, faArrowRight} from "@fortawesome/free-solid-svg-icons";
import {MarkdownComponent} from "ngx-markdown";
import {NgSelectModule} from "@ng-select/ng-select";
import {DateInputMode, EmailComposerDraftingMode, EventInclusionMode} from "../../models/email-composer.model";
import {GroupEventSummary} from "../../models/committee.model";
import {LinkComponent} from "../../link/link";
import {DisplayDatePipe} from "../../pipes/display-date.pipe";
import {StringUtilsService} from "../../services/string-utils.service";
import {GoogleMapsService} from "../../services/google-maps.service";
import {UrlService} from "../../services/url.service";
import {applyMediaSelection} from "../../functions/email-composer-event-media";
import {DatePicker} from "../../date-and-time/date-picker";
import {DateRangeSlider} from "../../components/date-range-slider/date-range-slider";
import {EmailComposerEventSelectionService} from "../../services/email-composer/email-composer-event-selection.service";
import {EmailComposerSessionService} from "../../services/email-composer/email-composer-session.service";
import {EmailComposerDraftingService} from "../../services/email-composer/email-composer-drafting.service";
import {EmailComposerDraftingComponent} from "./email-composer-drafting.component";

@Component({
  selector: "app-email-composer-events",
  imports: [
    FormsModule,
    FontAwesomeModule,
    MarkdownComponent,
    LinkComponent,
    DisplayDatePipe,
    NgSelectModule,
    DatePicker,
    DateRangeSlider,
    EmailComposerDraftingComponent
  ],
  styleUrls: ["./email-composer-events.sass"],
  template: `
    <div class="row mb-3">
      <div class="col-sm-12">
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="event-inclusion" id="event-inclusion-none"
                 [checked]="session.state.eventInclusion === EventInclusionMode.NONE"
                 (change)="events.setEventInclusionMode(EventInclusionMode.NONE)">
          <label class="form-check-label" for="event-inclusion-none">No events</label>
        </div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="event-inclusion" id="event-inclusion-auto"
                 [checked]="session.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE"
                 (change)="events.setEventInclusionMode(EventInclusionMode.AUTO_INCLUDE)">
          <label class="form-check-label" for="event-inclusion-auto">Auto-include from date range</label>
        </div>
        @if (session.state.singleEvent) {
          <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" name="event-inclusion" id="event-inclusion-single"
                   [checked]="session.state.eventInclusion === EventInclusionMode.SINGLE_EVENT"
                   (change)="events.setEventInclusionMode(EventInclusionMode.SINGLE_EVENT)">
            <label class="form-check-label" for="event-inclusion-single">This event only ({{ session.state.singleEvent?.groupEvent?.title }})</label>
          </div>
        }
      </div>
    </div>
    @if (session.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE) {
      <div class="row mb-3">
        <div class="col-sm-12">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="newsletter-mode"
                   [checked]="session.newsletterMode()"
                   (change)="drafting.onNewsletterModeToggled($any($event.target).checked)">
            <label class="form-check-label" for="newsletter-mode">
              <strong>Newsletter</strong> — carry on from where the last newsletter finished. Newsletters are normally created on Compose; tick this to turn an email you have already started into one.
            </label>
          </div>
        </div>
      </div>
      @if (session.newsletterMode() && session.state.newsletter) {
        <app-email-composer-drafting [mode]="EmailComposerDraftingMode.EVENT_SETTINGS"/>
      }
    }
    @if (session.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE && session.state.groupEventsFilter) {
      <div class="row mb-3">
        <div class="col-sm-12">
          <strong class="me-3">Date range input:</strong>
          <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" name="date-input-mode" id="date-input-slider"
                   [checked]="events.dateInputMode === DateInputMode.Slider"
                   (change)="events.setDateInputMode(DateInputMode.Slider)">
            <label class="form-check-label" for="date-input-slider">Slider</label>
          </div>
          <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" name="date-input-mode" id="date-input-pickers"
                   [checked]="events.dateInputMode === DateInputMode.Pickers"
                   (change)="events.setDateInputMode(DateInputMode.Pickers)">
            <label class="form-check-label" for="date-input-pickers">Individual dates</label>
          </div>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-sm-4">
          <label for="date-range-preset">Quick range:</label>
          <ng-select id="date-range-preset"
                     [items]="events.dateRangePresetItems"
                     bindLabel="label"
                     [clearable]="false"
                     [searchable]="false"
                     [(ngModel)]="events.selectedDateRangePreset"
                     (ngModelChange)="events.onDateRangePresetChange($event)"/>
        </div>
        @if (events.dateInputMode === DateInputMode.Slider) {
          <div class="col-sm-8 d-flex align-items-end">
            <app-date-range-slider class="w-100"
              [minDate]="events.eventSliderMinDate"
              [maxDate]="events.eventSliderMaxDate"
              [range]="events.eventSliderRange()"
              (rangeChange)="events.onEventDateRangeChange($event)"/>
          </div>
        } @else {
          <div class="col-sm-4">
            <label for="from-date">Include events from:</label>
            <app-date-picker startOfDay id="from-date" [size]="'md round'"
                             (change)="events.onFromDateChange($event)"
                             [value]="session.state.groupEventsFilter!.fromDate"/>
          </div>
          <div class="col-sm-4">
            <label for="to-date">Include events to:</label>
            <app-date-picker startOfDay id="to-date" [size]="'md round'"
                             (change)="events.onToDateChange($event)"
                             [value]="session.state.groupEventsFilter!.toDate"/>
          </div>
        }
      </div>
      <div class="row mb-3">
        <div class="col-sm-12 d-flex flex-wrap flex-md-nowrap align-items-center">
          <strong class="me-2 text-nowrap">Include information:</strong>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="user-events-show-description"
                   [(ngModel)]="session.state.groupEventsFilter!.includeDescription"
                   (ngModelChange)="events.populateGroupEvents()">
            <label class="form-check-label" for="user-events-show-description">Description</label>
          </div>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="user-events-show-location"
                   [(ngModel)]="session.state.groupEventsFilter!.includeLocation"
                   (ngModelChange)="events.populateGroupEvents()">
            <label class="form-check-label" for="user-events-show-location">Location</label>
          </div>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="user-events-show-contact"
                   [(ngModel)]="session.state.groupEventsFilter!.includeContact"
                   (ngModelChange)="events.populateGroupEvents()">
            <label class="form-check-label" for="user-events-show-contact">Contact</label>
          </div>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="user-events-show-image"
                   [(ngModel)]="session.state.groupEventsFilter!.includeImage"
                   (ngModelChange)="events.populateGroupEvents()">
            <label class="form-check-label" for="user-events-show-image">Image</label>
          </div>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-sm-12 d-flex flex-wrap flex-md-nowrap align-items-center">
          <strong class="me-2 text-nowrap">Include event types:</strong>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="include-walks"
                   [(ngModel)]="session.state.groupEventsFilter!.includeWalks"
                   (ngModelChange)="events.populateGroupEvents()">
            <label class="form-check-label" for="include-walks">Walks</label>
          </div>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="include-social"
                   [(ngModel)]="session.state.groupEventsFilter!.includeSocialEvents"
                   (ngModelChange)="events.populateGroupEvents()">
            <label class="form-check-label" for="include-social">Social events</label>
          </div>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="include-committee"
                   [(ngModel)]="session.state.groupEventsFilter!.includeCommitteeEvents"
                   (ngModelChange)="events.populateGroupEvents()">
            <label class="form-check-label" for="include-committee">Committee events</label>
          </div>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-sm-12">
          @if (session.state.groupEvents.length > 0) {
            <div class="form-check mb-2">
              <input class="form-check-input" type="checkbox" id="select-all"
                     [(ngModel)]="session.state.groupEventsFilter!.selectAll"
                     (click)="toggleSelectAllGroupEvents()">
              <label class="form-check-label" for="select-all">
                <strong>Select / deselect all</strong> -
                {{ selectedGroupEventCount() }} of
                {{ stringUtils.pluraliseWithCount(session.state.groupEvents.length, "event") }}
              </label>
            </div>
            <ul class="list-unstyled events-scroll">
              @for (event of session.state.groupEvents; let idx = $index; track event.id) {
                <li class="mb-2 event-row">
                  <div class="event-meta">
                    <div class="form-check">
                      <input type="checkbox" class="form-check-input"
                             [id]="'event-' + idx"
                             [(ngModel)]="event.selected"
                             (ngModelChange)="events.onGroupEventSelectionChanged()">
                      <label class="form-check-label" [for]="'event-' + idx">
                        @if (event.newSinceLastNewsletter) {
                          <span class="badge bg-warning text-dark me-1">New</span>
                        }
                        <strong>{{ event.eventDate | displayDate }}</strong>
                        @if (event.eventTime) { <span> &bull; {{ event.eventTime }}</span> }
                        &bull; {{ event?.eventType?.description }}
                        &bull;
                        <app-link [area]="event?.eventType?.area" [id]="event?.slug || event?.id" [text]="event?.title"></app-link>
                        @if (event.distance) { <span> &bull; {{ event.distance }}</span> }
                        @if (session.state.groupEventsFilter!.includeContact && event.contactName) {
                          <span> &bull; <a [href]="event.contactHref"
                                            [target]="event.contactHref?.startsWith('http') ? '_blank' : '_self'">{{ event.contactName || event.contactEmail }}</a></span>
                        }
                        @if (session.state.groupEventsFilter!.includeLocation && event.postcode) {
                          <span> &bull; <a [href]="googleMapsService.urlForPostcode(event.postcode)" target="_blank">{{ event.postcode }}</a></span>
                        }
                      </label>
                    </div>
                    @if (session.state.groupEventsFilter!.includeDescription && event.description) {
                      <div markdown [data]="event.description" class="ms-4 small text-muted"></div>
                    }
                  </div>
                  @if (session.state.groupEventsFilter!.includeImage && event.image) {
                    <div class="event-image">
                      <img [src]="urlService.imageSource(event.image, true)" [alt]="event.title || ''"/>
                      @if ((event.media?.length ?? 0) > 1) {
                        <div class="event-image-controls">
                          <button type="button" class="btn btn-primary"
                                  (click)="cycleEventMedia(event, -1)">
                            <fa-icon [icon]="faArrowLeft"/>
                          </button>
                          <span class="small text-muted">{{ (event.selectedMediaIndex ?? 0) + 1 }} of {{ event.media?.length }}</span>
                          <button type="button" class="btn btn-primary"
                                  (click)="cycleEventMedia(event, 1)">
                            <fa-icon [icon]="faArrowRight"/>
                          </button>
                        </div>
                      }
                    </div>
                  }
                </li>
              }
            </ul>
          } @else {
            <div class="text-muted">No events found in the current date range.</div>
          }
        </div>
      </div>
    } @else if (session.state.eventInclusion === EventInclusionMode.SINGLE_EVENT && session.state.singleEvent) {
      <div class="row mb-3">
        <div class="col-sm-12">
          <p class="mb-2">Sending notification about <strong>{{ session.state.singleEvent?.groupEvent?.title }}</strong>. Switch to <em>Auto-include from date range</em> if you'd like to add more events.</p>
          @if (session.state.groupEventsFilter) {
            <label class="form-label mt-2"><strong>Include information:</strong></label>
            <div class="d-flex flex-wrap gap-3">
              <div class="form-check">
                <input type="checkbox" class="form-check-input" id="single-include-description"
                       [(ngModel)]="session.state.groupEventsFilter.includeDescription">
                <label class="form-check-label" for="single-include-description">Description</label>
              </div>
              <div class="form-check">
                <input type="checkbox" class="form-check-input" id="single-include-location"
                       [(ngModel)]="session.state.groupEventsFilter.includeLocation">
                <label class="form-check-label" for="single-include-location">Location</label>
              </div>
              <div class="form-check">
                <input type="checkbox" class="form-check-input" id="single-include-contact"
                       [(ngModel)]="session.state.groupEventsFilter.includeContact">
                <label class="form-check-label" for="single-include-contact">Contact</label>
              </div>
              <div class="form-check">
                <input type="checkbox" class="form-check-input" id="single-include-image"
                       [(ngModel)]="session.state.groupEventsFilter.includeImage">
                <label class="form-check-label" for="single-include-image">Image</label>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `
})
export class EmailComposerEventsComponent {
  protected session = inject(EmailComposerSessionService);
  protected events = inject(EmailComposerEventSelectionService);
  protected drafting = inject(EmailComposerDraftingService);
  protected stringUtils = inject(StringUtilsService);
  protected googleMapsService = inject(GoogleMapsService);
  protected urlService = inject(UrlService);
  protected readonly EventInclusionMode = EventInclusionMode;
  protected readonly DateInputMode = DateInputMode;
  protected readonly EmailComposerDraftingMode = EmailComposerDraftingMode;
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faArrowRight = faArrowRight;

  protected selectedGroupEventCount(): number {
    return this.session.state.groupEvents.filter(event => event.selected).length;
  }

  protected toggleSelectAllGroupEvents(): void {
    const filter = this.session.state.groupEventsFilter;
    if (filter) {
      filter.selectAll = !filter.selectAll;
      this.session.state.groupEvents.forEach(event => event.selected = filter.selectAll);
      this.events.onGroupEventSelectionChanged();
    }
  }

  cycleEventMedia(event: GroupEventSummary, direction: number): void {
    const media = event.media ?? [];
    if (!(media.length === 0)) {
      const currentIndex = event.selectedMediaIndex ?? 0;
      const nextIndex = (currentIndex + direction + media.length) % media.length;
      applyMediaSelection(event, nextIndex);
    }
  }
}
