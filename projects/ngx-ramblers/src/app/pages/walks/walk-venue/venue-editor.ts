import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faSearch, faSpinner, faTimes } from "@fortawesome/free-solid-svg-icons";
import { StoredVenue, Venue, VenueType, VenueWithUsageStats } from "../../../models/event-venue.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { VenueScraperService } from "../../../services/venue/venue-scraper.service";
import { AlertInstance } from "../../../services/notifier.service";
import { VenueLookupComponent } from "./venue-lookup";
import { VenueTypeSelect } from "./venue-type-select";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
  selector: "app-venue-editor",
  standalone: true,
  imports: [FormsModule, FontAwesomeModule, VenueLookupComponent, VenueTypeSelect, TooltipDirective],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading d-flex justify-content-between align-items-center">
        <span>{{ heading }}</span>
        @if (showCloseButton) {
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="onClose()">
            <fa-icon [icon]="faTimes"></fa-icon>
          </button>
        }
      </div>
      <div class="col-sm-12">
        <app-venue-lookup
          [disabled]="disabled"
          [startingPoint]="startingPoint"
          [initialVenue]="venue"
          (venueLookup)="onVenueLookup($event)"/>
      </div>
      <div class="col-sm-12 mt-3">
        <div class="row">
          <div class="col-sm-4 mb-3">
            <div class="form-group">
              <label for="venue-type">Type</label>
              <app-venue-type-select
                [value]="selectedVenueType"
                (valueChange)="onVenueTypeChange($event)"
                [disabled]="disabled"
                [clearable]="false">
              </app-venue-type-select>
            </div>
          </div>
          <div class="col-sm-4 mb-3">
            <div class="form-group">
              <label for="name">Name</label>
              <input [disabled]="disabled"
                     [(ngModel)]="venue.name"
                     type="text" class="form-control input-sm"
                     id="name"
                     placeholder="Enter name of venue">
            </div>
          </div>
          <div class="col-sm-4 mb-3">
            <div class="form-group">
              <label for="address1">Address 1</label>
              <input [disabled]="disabled"
                     [(ngModel)]="venue.address1"
                     type="text" class="form-control input-sm"
                     id="address1"
                     placeholder="Enter first line of the address">
            </div>
          </div>
          <div class="col-sm-4 mb-3">
            <div class="form-group">
              <label for="address2">Address 2</label>
              <input [disabled]="disabled"
                     [(ngModel)]="venue.address2"
                     type="text" class="form-control input-sm"
                     id="address2"
                     placeholder="Enter second line of the address">
            </div>
          </div>
          <div class="col-sm-4 mb-3">
            <div class="form-group">
              <label for="postcode">Postcode</label>
              <input [disabled]="disabled"
                     [(ngModel)]="venue.postcode"
                     (ngModelChange)="onPostcodeChange($event)"
                     type="text" class="form-control input-sm"
                     id="postcode"
                     placeholder="Enter postcode">
            </div>
          </div>
          <div class="col-sm-4 mb-3">
            <div class="form-group">
              <label for="url">Web address</label>
              <div class="input-group">
                <input [disabled]="disabled"
                       [(ngModel)]="venue.url"
                       type="text" class="form-control input-sm"
                       id="url"
                       placeholder="Enter web address">
                <button type="button" class="btn btn-primary"
                        [disabled]="disabled || searchingWebsite || !venue.name"
                        (click)="searchForWebsite()"
                        tooltip="Search for venue website">
                  @if (searchingWebsite) {
                    <fa-icon [icon]="faSpinner" [spin]="true"></fa-icon>
                  } @else {
                    <fa-icon [icon]="faSearch"></fa-icon>
                  }
                </button>
              </div>
            </div>
          </div>
          @if (showCoordinates && venue.lat && venue.lon) {
            <div class="col-sm-12 mb-3">
              <div class="form-group">
                <label>Coordinates</label>
                <div class="form-control-plaintext small">
                  Lat: {{ venue.lat }}, Lon: {{ venue.lon }}
                </div>
              </div>
            </div>
          }
        </div>
      </div>
      @if (showActions) {
        <div class="col-sm-12 d-flex justify-content-end gap-2 mt-2">
          <button type="button" class="btn btn-primary" [disabled]="!venue.name" (click)="onSave()">
            {{ saveButtonText }}
          </button>
          <button type="button" class="btn btn-secondary" (click)="onCancel()">
            Cancel
          </button>
        </div>
      }
    </div>
  `
})
export class VenueEditorComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("VenueEditorComponent", NgxLoggerLevel.ERROR);
  private walksReferenceService = inject(WalksReferenceService);

  @Input() venue: Partial<StoredVenue> = {};
  @Input() disabled = false;
  @Input() heading = "Edit venue";
  @Input() showActions = true;
  @Input() showCloseButton = false;
  @Input() showCoordinates = true;
  @Input() saveButtonText = "Save";
  @Input() startingPoint: { latitude: number; longitude: number } | null = null;
  @Input() notify: AlertInstance;

  @Output() save = new EventEmitter<Partial<StoredVenue>>();
  @Output() cancel = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();
  @Output() venueChange = new EventEmitter<Partial<StoredVenue>>();
  @Output() postcodeChange = new EventEmitter<string>();

  venueTypes: VenueType[];
  selectedVenueType: VenueType;
  searchingWebsite = false;
  faTimes = faTimes;
  faSearch = faSearch;
  faSpinner = faSpinner;

  ngOnInit() {
    this.venueTypes = this.walksReferenceService.venueTypes();
    this.selectedVenueType = this.venueTypes.find(vt => vt.type === this.venue?.type) || this.venueTypes[0];
    if (!this.venue) {
      this.venue = {};
    }
  }

  onVenueTypeChange(venueType: VenueType) {
    if (venueType) {
      this.venue.type = venueType.type;
      this.venueChange.emit(this.venue);
    }
  }

  onVenueLookup(lookupVenue: Partial<Venue>) {
    this.logger.info("onVenueLookup:", lookupVenue);
    const venueWithStats = lookupVenue as VenueWithUsageStats;
    if (venueWithStats.storedVenueId) {
      this.venue.id = venueWithStats.storedVenueId;
    }
    this.venue.type = lookupVenue.type;
    this.venue.name = lookupVenue.name;
    this.venue.address1 = lookupVenue.address1;
    this.venue.address2 = lookupVenue.address2;
    this.venue.postcode = lookupVenue.postcode;
    this.venue.url = lookupVenue.url;
    this.venue.lat = lookupVenue.lat;
    this.venue.lon = lookupVenue.lon;
    if (lookupVenue.type) {
      this.selectedVenueType = this.venueTypes.find(vt => vt.type === lookupVenue.type) || this.selectedVenueType;
    }
    this.venueChange.emit(this.venue);
  }

  onPostcodeChange(postcode: string) {
    this.postcodeChange.emit(postcode);
    this.venueChange.emit(this.venue);
  }

  onSave() {
    this.save.emit(this.venue);
  }

  onCancel() {
    this.cancel.emit();
  }

  onClose() {
    this.close.emit();
  }

  private venueScraperService = inject(VenueScraperService);

  async searchForWebsite() {
    if (!this.venue.name || this.searchingWebsite) {
      return;
    }

    this.searchingWebsite = true;
    try {
      const searchQuery = [
        this.venue.name,
        this.venue.address1,
        this.venue.postcode
      ].filter(Boolean).join(" ");

      this.logger.info("Searching for website:", searchQuery);
      const result = await this.venueScraperService.searchForVenueWebsite(searchQuery);

      if (result?.url) {
        this.venue.url = result.url;
        this.logger.info("Found website:", result.url);
        this.notify?.success({title: "Website Found", message: result.url});
        this.venueChange.emit(this.venue);
      } else {
        this.notify?.warning({title: "Website Search", message: "No website found for this venue"});
      }
    } catch (error: any) {
      this.logger.error("Error searching for website:", error);
      this.notify?.error({title: "Website Search Failed", message: error?.message || "Search failed"});
    } finally {
      this.searchingWebsite = false;
    }
  }
}
