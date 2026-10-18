import { Component, inject, Input, OnChanges, OnDestroy, OnInit } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
import { Subscription } from "rxjs";
import { isEmpty } from "es-toolkit/compat";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { NamedEventType } from "../../../models/broadcast.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { VenueService } from "../../../services/venue/venue.service";
import { WalkDisplayService } from "../walk-display.service";

@Component({
  selector: "app-venue-from-start-postcode-prompt",
  imports: [FontAwesomeModule],
  template: `
    @if (visible) {
      <div class="alert alert-warning d-flex align-items-start justify-content-between py-2 mb-3">
        <div class="d-flex align-items-start ms-2">
          <fa-icon [icon]="faMapMarkerAlt" class="me-2 mt-1"/>
          <span><strong class="me-2">Venue postcode:</strong>Use starting point postcode <strong>{{ offeredPostcode }}</strong> for the venue?</span>
        </div>
        <div class="d-flex flex-nowrap gap-2 ms-2">
          <button type="button" class="btn btn-primary text-nowrap" (click)="apply()">Apply</button>
          <button type="button" class="btn btn-quiet text-nowrap" (click)="dismiss()">Dismiss</button>
        </div>
      </div>
    }
  `
})
export class VenueFromStartPostcodePromptComponent implements OnInit, OnChanges, OnDestroy {
  @Input() event: ExtendedGroupEvent;
  @Input() showWalkLocationPrompts = true;
  @Input() canEdit = true;
  private venueService = inject(VenueService);
  private display = inject(WalkDisplayService);
  private memberLoginService = inject(MemberLoginService);
  private broadcastService = inject<BroadcastService<string>>(BroadcastService);
  private subscriptions: Subscription[] = [];
  private dismissedForPostcode: string | null = null;
  private pendingStartingPostcode: string | null = null;
  visible = false;
  offeredPostcode = "";
  protected faMapMarkerAlt = faMapMarkerAlt;

  ngOnInit() {
    this.refresh();
    this.subscriptions.push(
      this.broadcastService.on(NamedEventType.WALK_STARTING_POSTCODE_UPDATED, (event) => {
        this.pendingStartingPostcode = event.data;
        this.refresh();
      })
    );
  }

  ngOnChanges() {
    this.refresh();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  apply(): void {
    const postcode = this.offeredPostcode;
    if (postcode && this.event?.fields?.venue) {
      this.venueService.ensureVenue(this.event);
      this.event.fields.venue.postcode = postcode.toUpperCase().trim();
    }
    this.visible = false;
  }

  dismiss(): void {
    this.dismissedForPostcode = this.venueService.normalizePostcode(this.offeredPostcode);
    this.visible = false;
  }

  private refresh(): void {
    const canOffer = this.showWalkLocationPrompts && this.canEdit && !this.display.walkPopulationWalksManager();
    if (!canOffer || !this.event) {
      this.visible = false;
    } else {
      const venuePostcode = this.venueService.normalizePostcode(this.event.fields?.venue?.postcode);
      const startingPostcode = this.pendingStartingPostcode || this.event.groupEvent?.start_location?.postcode || "";
      const normalizedStartingPostcode = this.venueService.normalizePostcode(startingPostcode);
      const hasStartingPostcode = !isEmpty(normalizedStartingPostcode);
      const venuePostcodeEmpty = isEmpty(venuePostcode);
      const postcodesDiffer = normalizedStartingPostcode !== venuePostcode;
      const wasDismissed = this.dismissedForPostcode === normalizedStartingPostcode;
      this.offeredPostcode = (startingPostcode || "").toUpperCase().trim();
      if (hasStartingPostcode && venuePostcodeEmpty && !wasDismissed) {
        this.venueService.ensureVenue(this.event);
        this.venueService.seedVenueFromLocation(this.event.fields.venue, this.event.groupEvent?.start_location);
        this.apply();
      } else {
        this.visible = hasStartingPostcode && postcodesDiffer && !wasDismissed;
      }
    }
  }
}
