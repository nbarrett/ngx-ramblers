import {Component, inject} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {NgSelectModule} from "@ng-select/ng-select";
import {DateInputMode, EmailComposerDraftingMode, EventInclusionMode} from "../../models/email-composer.model";
import {StringUtilsService} from "../../services/string-utils.service";
import {WalkProgrammeRowComponent} from "../walks/walk-programme-row/walk-programme-row";
import {DatePicker} from "../../date-and-time/date-picker";
import {DateRangeSlider} from "../../components/date-range-slider/date-range-slider";
import {EmailComposerEventSelectionService} from "../../services/email-composer/email-composer-event-selection.service";
import {EmailComposerSessionService} from "../../services/email-composer/email-composer-session.service";
import {EmailComposerDraftingService} from "../../services/email-composer/email-composer-drafting.service";
import {EmailComposerDraftingComponent} from "./email-composer-drafting.component";
import {EmailComposerProgrammeComponent} from "./email-composer-programme.component";
import {EmailComposerProgrammeService} from "../../services/email-composer/email-composer-programme.service";

@Component({
  selector: "app-email-composer-events",
  imports: [
    FormsModule,
    NgSelectModule,
    WalkProgrammeRowComponent,
    DatePicker,
    DateRangeSlider,
    EmailComposerDraftingComponent,
    EmailComposerProgrammeComponent
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
          <ng-select dropdownPosition="bottom" id="date-range-preset"
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
                     [checked]="allGroupEventsSelected()"
                     [indeterminate]="someGroupEventsSelected()"
                     (change)="toggleSelectAllGroupEvents()">
              <label class="form-check-label" for="select-all">
                <strong>Select / deselect all</strong> -
                {{ selectedGroupEventCount() }} of
                {{ stringUtils.pluraliseWithCount(session.state.groupEvents.length, "event") }}
              </label>
            </div>
            @if (events.autoIncludesReadyEventsOnly()) {
              <p class="text-muted small mb-2">Published and approved events are ticked automatically. Incomplete dates, empty slots and events still awaiting details are left off so they do not go in the email. Tick any extra events you want, or use Select all for the whole range.</p>
            }
            <div class="walk-rows">
              @for (event of session.state.groupEvents; track event.id) {
                @if (event.programmeRow) {
                  <app-walk-programme-row [row]="event.programmeRow" selectable [reserveThumbnail]="anyThumbnails()">
                    <input type="checkbox" class="form-check-input"
                           [id]="'event-' + event.id"
                           [attr.aria-label]="'Include ' + (event.title || 'event')"
                           [(ngModel)]="event.selected"
                           (ngModelChange)="events.onGroupEventSelectionChanged()">
                  </app-walk-programme-row>
                }
              }
            </div>
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
    @if (session.state.eventInclusion !== EventInclusionMode.NONE && (selectedGroupEventCount() > 0 || programme.generated())) {
      <app-email-composer-programme/>
    }
  `
})
export class EmailComposerEventsComponent {
  protected session = inject(EmailComposerSessionService);
  protected events = inject(EmailComposerEventSelectionService);
  protected drafting = inject(EmailComposerDraftingService);
  protected programme = inject(EmailComposerProgrammeService);
  protected stringUtils = inject(StringUtilsService);
  protected readonly EventInclusionMode = EventInclusionMode;
  protected readonly DateInputMode = DateInputMode;
  protected readonly EmailComposerDraftingMode = EmailComposerDraftingMode;

  protected anyThumbnails(): boolean {
    return this.session.state.groupEvents.some(event => !!event.programmeRow?.thumbnailUrl);
  }

  protected selectedGroupEventCount(): number {
    return this.session.state.groupEvents.filter(event => event.selected).length;
  }

  protected allGroupEventsSelected(): boolean {
    return this.session.state.groupEvents.length > 0 && this.selectedGroupEventCount() === this.session.state.groupEvents.length;
  }

  protected someGroupEventsSelected(): boolean {
    const selected = this.selectedGroupEventCount();
    return selected > 0 && selected < this.session.state.groupEvents.length;
  }

  protected toggleSelectAllGroupEvents(): void {
    const filter = this.session.state.groupEventsFilter;
    if (filter) {
      filter.selectAll = !this.allGroupEventsSelected();
      this.session.state.groupEvents.forEach(event => event.selected = filter.selectAll);
      this.events.onGroupEventSelectionChanged();
    }
  }

}
