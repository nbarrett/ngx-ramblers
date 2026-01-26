import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
import { Venue as VenueModel, VenueType, VenueWithUsageStats } from "../../../models/event-venue.model";
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
import { VenueLookupComponent } from "./venue-lookup";
import { VenueTypeSelect } from "./venue-type-select";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { isEmpty } from "es-toolkit/compat";
import { Subscription } from "rxjs";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEventType } from "../../../models/broadcast.model";

@Component({
    selector: "app-venue",
    template: `
      <div class="row thumbnail-heading-frame">
        <div class="thumbnail-heading">Venue</div>
        <div class="col-sm-12">
          <app-markdown-editor standalone name="meetup-venue-help" description="Walk venue or pub"/>
        </div>
        @if (allowEdits()) {
          <div class="col-sm-12 mb-3">
            <div class="row thumbnail-heading-frame">
              <div class="thumbnail-heading">Find or add venue</div>
              <div class="col-sm-12">
                <app-venue-lookup
                  [disabled]="disabledInput"
                  [startingPoint]="startingPointCoordinates"
                  [initialVenue]="displayedWalk?.walk?.fields?.venue"
                  [showManageVenuesButton]="isAdmin()"
                  (venueLookup)="onVenueLookup($event)"/>
              </div>
            </div>
          </div>
        }
        @if (showStartingPointPrompt) {
          <div class="col-sm-12 mb-3">
            <div class="alert alert-warning d-flex align-items-center justify-content-between py-2 mb-0">
              <div class="d-flex align-items-center ms-2">
                <fa-icon [icon]="faMapMarkerAlt" class="me-2"></fa-icon>
                <span><strong class="me-2">Starting Point:</strong>Change walk start postcode from <strong>{{ currentStartingPointPostcode || 'not set' }}</strong> to venue postcode <strong>{{ displayedWalk.walk.fields.venue.postcode }}</strong>?</span>
              </div>
              <div class="btn-group btn-group-sm ms-2">
                <button type="button" class="btn btn-primary" (click)="applyVenuePostcodeToStartingPoint()">Apply</button>
                <button type="button" class="btn btn-outline-secondary" (click)="dismissStartingPointPrompt()">Dismiss</button>
              </div>
            </div>
          </div>
        }
        @if (hasSeparateMeetingPoint && displayedWalk?.walk?.fields?.venue?.postcode && showMeetingPointButton()) {
          <div class="col-sm-12 mb-3">
            <div class="alert alert-warning d-flex align-items-center justify-content-between py-2 mb-0">
              <div class="d-flex align-items-center ms-2">
                <fa-icon [icon]="faMapMarkerAlt" class="me-2"></fa-icon>
                <span><strong
                  class="me-2">Meeting Point:</strong>Use venue postcode <strong>{{ displayedWalk.walk.fields.venue.postcode }}</strong> as meeting point?</span>
              </div>
              <div class="btn-group btn-group-sm ms-2">
                <button type="button" class="btn btn-primary" (click)="applyVenueAsMeetingPoint()">Use as Meeting
                  Point
                </button>
                <button type="button" class="btn btn-outline-secondary" (click)="dismissMeetingPointPrompt()">Dismiss
                </button>
              </div>
            </div>
          </div>
        }
        @if (showVenueFromStartingPointPrompt) {
          <div class="col-sm-12 mb-3">
            <div class="alert alert-warning d-flex align-items-center justify-content-between py-2 mb-0">
              <div class="d-flex align-items-center ms-2">
                <fa-icon [icon]="faMapMarkerAlt" class="me-2"></fa-icon>
                <span><strong class="me-2">Venue Postcode:</strong>Use starting point postcode <strong>{{ pendingStartingPostcode || currentStartingPointPostcode }}</strong> for venue?</span>
              </div>
              <div class="btn-group btn-group-sm ms-2">
                <button type="button" class="btn btn-primary" (click)="applyStartingPostcodeToVenue()">Apply</button>
                <button type="button" class="btn btn-outline-secondary" (click)="dismissVenueFromStartingPointPrompt()">Dismiss</button>
              </div>
            </div>
          </div>
        }
        <div class="col-sm-12">
          <div class="row">
            <div class="col-sm-4 mb-3">
              <div class="form-group">
                <label for="venue-type">Type</label>
                <app-venue-type-select
                  [value]="selectedVenueType"
                  (valueChange)="onVenueTypeChange($event)"
                  [disabled]="disabledInput"
                  [clearable]="false">
                </app-venue-type-select>
              </div>
            </div>
            <div class="col-sm-4 mb-3">
              <div class="form-group">
                <label for="name">Name</label>
                <input [disabled]="disabledInput"
                       [(ngModel)]="displayedWalk.walk.fields.venue.name"
                       type="text" class="form-control input-sm"
                       id="name"
                       placeholder="Enter name of venue or pub">
              </div>
            </div>
            <div class="col-sm-4 mb-3">
              <div class="form-group">
                <label for="address1">Address 1</label>
                <input [disabled]="disabledInput"
                       [(ngModel)]="displayedWalk.walk.fields.venue.address1"
                       type="text" class="form-control input-sm"
                       id="address1"
                       placeholder="Enter first line of the address">
              </div>
            </div>
            <div class="col-sm-4 mb-3">
              <div class="form-group">
                <label for="address2">Address 2</label>
                <input [disabled]="disabledInput"
                       [(ngModel)]="displayedWalk.walk.fields.venue.address2"
                       type="text" class="form-control input-sm"
                       id="address2"
                       placeholder="Enter second line of the address">
              </div>
            </div>
            <div class="col-sm-4 mb-3">
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
            <div class="col-sm-4 mb-3">
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
              <div class="col-sm-6 mb-3">
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
              <div class="col-sm-6 mb-3">
                <div class="form-check">
                  <input [(ngModel)]="displayedWalk.walk.fields.venue.isMeetingPlace"
                         [disabled]="!allowEdits() || inputDisabled" (ngModelChange)="isMeetingPlaceChanged($event)"
                         name="isMeetingPlace" class="form-check-input" type="checkbox"
                         id="walk-is-meeting-place">
                  <label class="form-check-label"
                         for="walk-is-meeting-place">This is a meeting place
                  </label>
                </div>
              </div>
            }
            @if (allowEdits() && (displayedWalk?.walk?.fields.venue.url || displayedWalk?.walk?.fields.venue.postcode)) {
              <div class="col-sm-6 mb-3">
                <div class="form-group">
                  <span class="me-2">Link preview:</span>
                  <fa-icon [icon]="displayedWalk?.walk?.fields.venue?.type | toVenueIcon"
                           class="colour-mintcake me-2"></fa-icon>
                  <a [href]="venueLink()"
                     [tooltip]="venueLinkTooltip()"
                     class="related-links-title" target="_blank">
                    {{ venueLabel() }}: {{ displayedWalk.walk.fields.venue?.name }}
                  </a>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    `,
    imports: [MarkdownEditorComponent, FormsModule, FontAwesomeModule, TooltipDirective, VenueIconPipe, VenueLookupComponent, VenueTypeSelect]
})
export class Venue implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("Venue", NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  private venueService = inject(VenueService);
  public display: WalkDisplayService = inject(WalkDisplayService);
  private walksReferenceService = inject(WalksReferenceService);
  private broadcastService = inject<BroadcastService<string>>(BroadcastService);

  @Input()
  public displayedWalk: DisplayedWalk;
  public inputDisabled = false;
  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
    this.updateDisabledInput();
  }
  @Output() venuePostcodeChange = new EventEmitter<string>();
  @Output() useVenueAsMeetingPoint = new EventEmitter<string>();
  @Input() hasSeparateMeetingPoint = false;

  public venueTypes: VenueType[];
  public selectedVenueType: VenueType;
  public disabledInput: boolean;
  public showStartingPointPrompt = false;
  public showVenueFromStartingPointPrompt = false;
  private dismissedForPostcode: string | null = null;
  private dismissedVenueFromStartingPointForPostcode: string | null = null;
  protected pendingStartingPostcode: string | null = null;
  private subscriptions: Subscription[] = [];
  protected faMapMarkerAlt = faMapMarkerAlt;

  get startingPointCoordinates(): { latitude: number; longitude: number } | null {
    const startLocation = this.displayedWalk?.walk?.groupEvent?.start_location;
    if (startLocation?.latitude && startLocation?.longitude) {
      return {
        latitude: startLocation.latitude,
        longitude: startLocation.longitude
      };
    }
    return null;
  }

  get currentStartingPointPostcode(): string {
    return this.displayedWalk?.walk?.groupEvent?.start_location?.postcode || "";
  }

  ngOnInit() {
    this.venueTypes = this.walksReferenceService.venueTypes();
    this.selectedVenueType = this.venueTypes.find(vt => vt.type === this.displayedWalk.walk.fields.venue?.type) || this.venueTypes[0];
    this.logger.info("venue is", this.displayedWalk.walk.fields.venue, "venueTypes", this.venueTypes, "selectedVenueType", this.selectedVenueType);
    this.updateDisabledInput();
    this.checkVenueFromStartingPointPrompt();
    this.subscriptions.push(
      this.broadcastService.on(NamedEventType.WALK_STARTING_POSTCODE_UPDATED, (event) => {
        this.logger.info("WALK_STARTING_POSTCODE_UPDATED received:", event.data);
        this.pendingStartingPostcode = event.data;
        this.checkVenueFromStartingPointPrompt();
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onVenueTypeChange(venueType: VenueType) {
    if (venueType) {
      this.displayedWalk.walk.fields.venue.type = venueType.type;
      this.logger.debug("onVenueTypeChange:", venueType.type);
    }
  }

  allowEdits() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) || this.memberLoginService.allowWalkAdminEdits();
  }

  isAdmin() {
    return this.memberLoginService.allowWalkAdminEdits();
  }

  private updateDisabledInput() {
    this.disabledInput = this.inputDisabled || (!this.allowEdits() && !this.displayedWalk?.walk?.fields?.venue?.venuePublish);
  }

  onVenueLookup(venue: Partial<VenueModel>) {
    this.logger.info("onVenueLookup:", venue);
    this.applyVenueToForm(venue);
  }

  private applyVenueToForm(venue: Partial<VenueModel> | VenueWithUsageStats) {
    const currentVenue = this.displayedWalk.walk.fields.venue;
    const venuePublish = currentVenue.venuePublish;
    const isMeetingPlace = currentVenue.isMeetingPlace;
    currentVenue.storedVenueId = (venue as VenueWithUsageStats).storedVenueId || venue.storedVenueId;
    currentVenue.type = venue.type;
    currentVenue.name = venue.name;
    currentVenue.address1 = venue.address1;
    currentVenue.address2 = venue.address2;
    currentVenue.postcode = venue.postcode;
    currentVenue.url = venue.url;
    currentVenue.lat = venue.lat;
    currentVenue.lon = venue.lon;
    currentVenue.venuePublish = venue.venuePublish ?? venuePublish;
    currentVenue.isMeetingPlace = venue.isMeetingPlace ?? isMeetingPlace;
    if (venue.type) {
      this.selectedVenueType = this.venueTypes.find(venueType => venueType.type === venue.type) || this.selectedVenueType;
    }
    if (venue.postcode) {
      this.checkStartingPointPrompt(venue.postcode);
    }
  }

  onPostcodeChange(postcode: string) {
    this.checkStartingPointPrompt(postcode);
    this.checkVenueFromStartingPointPrompt();
  }

  private checkStartingPointPrompt(venuePostcode: string) {
    if (!this.allowEdits()) {
      return;
    }

    const normalizedVenuePostcode = this.venueService.normalizePostcode(venuePostcode);
    const startPostcode = this.displayedWalk.walk.groupEvent?.start_location?.postcode;
    const normalizedStartPostcode = this.venueService.normalizePostcode(startPostcode);

    const hasVenuePostcode = !isEmpty(normalizedVenuePostcode);
    const postcodesDiffer = normalizedVenuePostcode !== normalizedStartPostcode;
    const wasDismissedForThisPostcode = this.dismissedForPostcode === normalizedVenuePostcode;

    this.showStartingPointPrompt = hasVenuePostcode && postcodesDiffer && !wasDismissedForThisPostcode;
    this.logger.debug("checkStartingPointPrompt: venuePostcode:", normalizedVenuePostcode, "startPostcode:", normalizedStartPostcode, "showPrompt:", this.showStartingPointPrompt);
  }

  applyVenuePostcodeToStartingPoint() {
    const postcode = this.displayedWalk.walk.fields.venue.postcode;
    this.logger.info("applyVenuePostcodeToStartingPoint:", postcode);
    this.venuePostcodeChange.emit(postcode);
    this.showStartingPointPrompt = false;
  }

  dismissStartingPointPrompt() {
    this.dismissedForPostcode = this.venueService.normalizePostcode(this.displayedWalk.walk.fields.venue.postcode);
    this.showStartingPointPrompt = false;
  }

  private dismissedMeetingPointForPostcode: string | null = null;

  showMeetingPointButton(): boolean {
    if (!this.allowEdits()) {
      return false;
    }
    const normalizedVenuePostcode = this.venueService.normalizePostcode(this.displayedWalk?.walk?.fields?.venue?.postcode);
    return this.dismissedMeetingPointForPostcode !== normalizedVenuePostcode;
  }

  applyVenueAsMeetingPoint() {
    const postcode = this.displayedWalk.walk.fields.venue.postcode;
    this.logger.info("applyVenueAsMeetingPoint:", postcode);
    this.useVenueAsMeetingPoint.emit(postcode);
    this.dismissedMeetingPointForPostcode = this.venueService.normalizePostcode(postcode);
  }

  dismissMeetingPointPrompt() {
    this.dismissedMeetingPointForPostcode = this.venueService.normalizePostcode(this.displayedWalk.walk.fields.venue.postcode);
  }

  private checkVenueFromStartingPointPrompt() {
    if (!this.allowEdits()) {
      return;
    }

    const venuePostcode = this.venueService.normalizePostcode(this.displayedWalk?.walk?.fields?.venue?.postcode);
    const startingPostcode = this.pendingStartingPostcode || this.currentStartingPointPostcode;
    const normalizedStartingPostcode = this.venueService.normalizePostcode(startingPostcode);

    const hasStartingPostcode = !isEmpty(normalizedStartingPostcode);
    const venuePostcodeEmpty = isEmpty(venuePostcode);
    const wasDismissedForThisPostcode = this.dismissedVenueFromStartingPointForPostcode === normalizedStartingPostcode;

    this.showVenueFromStartingPointPrompt = hasStartingPostcode && venuePostcodeEmpty && !wasDismissedForThisPostcode;
    this.logger.debug("checkVenueFromStartingPointPrompt: startingPostcode:", normalizedStartingPostcode, "venuePostcode:", venuePostcode, "showPrompt:", this.showVenueFromStartingPointPrompt);
  }

  applyStartingPostcodeToVenue() {
    const postcode = this.pendingStartingPostcode || this.currentStartingPointPostcode;
    this.logger.info("applyStartingPostcodeToVenue:", postcode);
    if (postcode) {
      this.displayedWalk.walk.fields.venue.postcode = postcode.toUpperCase().trim();
      this.showVenueFromStartingPointPrompt = false;
    }
  }

  dismissVenueFromStartingPointPrompt() {
    const postcode = this.pendingStartingPostcode || this.currentStartingPointPostcode;
    this.dismissedVenueFromStartingPointForPostcode = this.venueService.normalizePostcode(postcode);
    this.showVenueFromStartingPointPrompt = false;
  }

  isMeetingPlaceChanged($event: any) {
    this.logger.info("isMeetingPlaceChanged:", $event, "venue:", this.displayedWalk?.walk?.fields.venue);
  }

  venueLink(): string {
    const venue = this.displayedWalk?.walk?.fields?.venue;
    if (venue?.url) {
      return venue.url;
    } else if (venue?.postcode) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.postcode)}`;
    }
    return "";
  }

  venueLinkTooltip(): string {
    const venue = this.displayedWalk?.walk?.fields?.venue;
    if (venue?.url) {
      return `Click to visit ${venue.name}`;
    } else if (venue?.postcode) {
      return `Click to view ${venue.postcode} on Google Maps`;
    }
    return "";
  }

  venueLabel(): string {
    return this.venueService.venueLabel(this.displayedWalk?.walk?.fields?.venue?.isMeetingPlace);
  }
}
