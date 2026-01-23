import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Venue, VenueType, VenueWithUsageStats } from "../../../models/event-venue.model";
import { DisplayedWalk } from "../../../models/walk.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { VenueService } from "../../../services/venue/venue.service";
import { WalkDisplayService } from "../walk-display.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { VenueIconPipe } from "../../../pipes/venue-icon.pipe";
import { VenueAutocompleteComponent } from "./venue-autocomplete";
import { VenueSmartPasteComponent } from "./venue-smart-paste";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { isEmpty } from "es-toolkit/compat";

@Component({
    selector: "app-walk-venue",
    template: `
      <div class="row thumbnail-heading-frame">
        <div class="thumbnail-heading">Venue</div>
        <div class="col-sm-12">
          <app-markdown-editor standalone name="meetup-venue-help" description="Walk venue or pub"/>
        </div>
        @if (allowEdits()) {
          <div class="col-sm-12 mb-3">
            <div class="row">
              <div class="col-sm-6">
                <label class="form-label">Search previous venues</label>
                <app-venue-autocomplete
                  [disabled]="disabledInput"
                  (venueSelected)="onVenueSelected($event)"/>
              </div>
              <div class="col-sm-6">
                <app-venue-smart-paste
                  [disabled]="disabledInput"
                  (venueParsed)="onVenueParsed($event)"/>
              </div>
            </div>
          </div>
        }
        @if (showStartingPointPrompt) {
          <div class="col-sm-12">
            <div class="alert alert-info d-flex align-items-center justify-content-between py-2">
              <span>Use venue postcode <strong>{{ displayedWalk.walk.fields.venue.postcode }}</strong> as the walk starting point?</span>
              <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-primary" (click)="applyVenuePostcodeToStartingPoint()">Apply</button>
                <button type="button" class="btn btn-outline-secondary" (click)="dismissStartingPointPrompt()">Dismiss</button>
              </div>
            </div>
          </div>
        }
        <div class="col-sm-12">
          <div class="row">
            <div class="col-sm-4">
              <div class="form-group">
                <label for="type">Type</label>
                @if (venueTypes) {
                  <select [disabled]="disabledInput" class="form-control input-sm"
                          [(ngModel)]="displayedWalk.walk.fields.venue.type"
                          id="type">
                    @for (type of venueTypes; track venueTracker($index, type)) {
                      <option
                        [ngValue]="type.type"
                        [textContent]="type.type">
                      </option>
                    }
                  </select>
                }
              </div>
            </div>
            <div class="col-sm-4">
              <div class="form-group">
                <label for="name">Name</label>
                <input [disabled]="disabledInput"
                       [(ngModel)]="displayedWalk.walk.fields.venue.name"
                       type="text" class="form-control input-sm"
                       id="name"
                       placeholder="Enter name of venue or pub">
              </div>
            </div>
            <div class="col-sm-4">
              <div class="form-group">
                <label for="address1">Address 1</label>
                <input [disabled]="disabledInput"
                       [(ngModel)]="displayedWalk.walk.fields.venue.address1"
                       type="text" class="form-control input-sm"
                       id="address1"
                       placeholder="Enter first line of the address">
              </div>
            </div>
            <div class="col-sm-4">
              <div class="form-group">
                <label for="address2">Address 2</label>
                <input [disabled]="disabledInput"
                       [(ngModel)]="displayedWalk.walk.fields.venue.address2"
                       type="text" class="form-control input-sm"
                       id="address2"
                       placeholder="Enter second line of the address">
              </div>
            </div>
            <div class="col-sm-4">
              <div class="form-group">
                <label for="postcode">Postcode</label>
                <input [disabled]="disabledInput"
                       [(ngModel)]="displayedWalk.walk.fields.venue.postcode"
                       (ngModelChange)="onPostcodeChange($event)"
                       type="text" class="form-control input-sm"
                       id="postcode"
                       placeholder="Enter postcode">
              </div>
            </div>
            <div class="col-sm-4">
              <div class="form-group">
                <label for="url">Web address</label>
                <input [disabled]="disabledInput"
                       [(ngModel)]="displayedWalk.walk.fields.venue.url"
                       type="text" class="form-control input-sm"
                       id="url"
                       placeholder="Enter web address">
              </div>
            </div>
            @if (allowEdits()) {
              <div class="col-sm-6">
              <div class="form-check">
                <input [(ngModel)]="displayedWalk.walk.fields.venue.venuePublish"
                       [disabled]="!allowEdits() || inputDisabled"
                       name="showDetail" class="form-check-input" type="checkbox"
                       id="walk-publish-venue">
                  <label class="form-check-label"
                         for="walk-publish-venue">Publish venue on site
                  </label>
                </div>
              </div>
            }
            @if (allowEdits()) {
              <div class="col-sm-6">
                @if (displayedWalk?.walk?.fields.venue.url) {
                  <div class="form-group">
                    <label>Link preview:
                      <fa-icon [icon]="displayedWalk?.walk?.fields.venue?.type | toVenueIcon"
                               class="fa-icon fa-lg"></fa-icon>
                      <a [href]="displayedWalk?.walk?.fields.venue.url"
                         tooltip="Click to visit {{displayedWalk?.walk?.fields.venue?.name}}"
                         class="related-links-title" target="_blank">
                        {{ displayedWalk.walk.fields.venue?.name }}
                      </a>
                    </label>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    `,
    imports: [MarkdownEditorComponent, FormsModule, FontAwesomeModule, TooltipDirective, VenueIconPipe, VenueAutocompleteComponent, VenueSmartPasteComponent]
})
export class WalkVenueComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkVenueComponent", NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  private venueService = inject(VenueService);
  public display: WalkDisplayService = inject(WalkDisplayService);
  private walksReferenceService = inject(WalksReferenceService);

  @Input()
  public displayedWalk: DisplayedWalk;
  public inputDisabled = false;
  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
    this.updateDisabledInput();
  }
  @Output() venuePostcodeChange = new EventEmitter<string>();

  public venueTypes: VenueType[];
  public disabledInput: boolean;
  public showStartingPointPrompt = false;
  private promptDismissed = false;

  venueTracker(index: number, venueType: VenueType) {
    return venueType?.type;
  }

  ngOnInit() {
    this.venueTypes = this.walksReferenceService.venueTypes();
    this.logger.debug("venue is", this.displayedWalk.walk.fields.venue, "venueTypes", this.venueTypes);
    this.updateDisabledInput();
  }

  allowEdits() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) || this.memberLoginService.allowWalkAdminEdits();
  }

  private updateDisabledInput() {
    this.disabledInput = this.inputDisabled || (!this.allowEdits() && !this.displayedWalk?.walk?.fields?.venue?.venuePublish);
  }

  onVenueSelected(venue: VenueWithUsageStats) {
    this.logger.info("onVenueSelected:", venue);
    this.applyVenueToForm(venue);
  }

  onVenueParsed(venue: Partial<Venue>) {
    this.logger.info("onVenueParsed:", venue);
    this.applyVenueToForm(venue);
  }

  private applyVenueToForm(venue: Partial<Venue>) {
    const currentVenue = this.displayedWalk.walk.fields.venue;
    if (venue.type) {
      currentVenue.type = venue.type;
    }
    if (venue.name) {
      currentVenue.name = venue.name;
    }
    if (venue.address1) {
      currentVenue.address1 = venue.address1;
    }
    if (venue.address2) {
      currentVenue.address2 = venue.address2;
    }
    if (venue.postcode) {
      currentVenue.postcode = venue.postcode;
      this.checkStartingPointPrompt(venue.postcode);
    }
    if (venue.url) {
      currentVenue.url = venue.url;
    }
    if (venue.venuePublish !== undefined) {
      currentVenue.venuePublish = venue.venuePublish;
    }
  }

  onPostcodeChange(postcode: string) {
    this.checkStartingPointPrompt(postcode);
  }

  private checkStartingPointPrompt(venuePostcode: string) {
    if (this.promptDismissed || !this.allowEdits()) {
      return;
    }

    const normalizedVenuePostcode = this.venueService.normalizePostcode(venuePostcode);
    const startPostcode = this.displayedWalk.walk.groupEvent?.start_location?.postcode;
    const normalizedStartPostcode = this.venueService.normalizePostcode(startPostcode);

    const hasVenuePostcode = !isEmpty(normalizedVenuePostcode);
    const postcodesDiffer = normalizedVenuePostcode !== normalizedStartPostcode;

    this.showStartingPointPrompt = hasVenuePostcode && postcodesDiffer;
    this.logger.debug("checkStartingPointPrompt: venuePostcode:", normalizedVenuePostcode, "startPostcode:", normalizedStartPostcode, "showPrompt:", this.showStartingPointPrompt);
  }

  applyVenuePostcodeToStartingPoint() {
    const postcode = this.displayedWalk.walk.fields.venue.postcode;
    this.logger.info("applyVenuePostcodeToStartingPoint:", postcode);
    this.venuePostcodeChange.emit(postcode);
    this.showStartingPointPrompt = false;
  }

  dismissStartingPointPrompt() {
    this.showStartingPointPrompt = false;
    this.promptDismissed = true;
  }

}
