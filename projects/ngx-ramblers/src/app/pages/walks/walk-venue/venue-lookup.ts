import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faGlobe, faMagic, faSearch, faExclamationTriangle, faSpinner, faCheckCircle, faMap } from "@fortawesome/free-solid-svg-icons";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { VenueParserService } from "../../../services/venue/venue-parser.service";
import { VenueScraperService } from "../../../services/venue/venue-scraper.service";
import { StoredVenueService } from "../../../services/venue/stored-venue.service";
import { StoredVenue, Venue, VenueParseResult, VenueWithUsageStats } from "../../../models/event-venue.model";
import { StoredValue } from "../../../models/ui-actions";
import { isEmpty } from "es-toolkit/compat";
import { VenueAutocompleteComponent } from "./venue-autocomplete";
import { VenueMapSelectorComponent } from "./venue-map-selector";
import { Subscription } from "rxjs";
import { SectionToggle, SectionToggleTab } from "../../../shared/components/section-toggle";

export type VenueLookupMode = "url" | "paste" | "search" | "map";

@Component({
  selector: "app-venue-lookup",
  standalone: true,
  imports: [FormsModule, FontAwesomeModule, VenueAutocompleteComponent, VenueMapSelectorComponent, SectionToggle, RouterLink],
  template: `
    <div class="venue-lookup-content">
      <div class="venue-toggle-row">
        <app-section-toggle
          [tabs]="modeTabs"
          [selectedTab]="mode"
          [fullWidth]="true"
          [disabled]="disabled"
          [queryParamKey]="StoredValue.VENUE_MODE"
          (selectedTabChange)="onModeChange($event)"/>
        @if (showManageVenuesButton) {
          <a routerLink="/admin/venue-settings" class="btn btn-primary text-nowrap manage-venues-btn">
            Manage Venues
          </a>
        }
      </div>

      @switch (mode) {
        @case ("url") {
          <div class="url-mode">
            <label class="form-label">Website URL</label>
            <div class="input-group">
              <input type="url" class="form-control"
                     [(ngModel)]="websiteUrl"
                     [disabled]="disabled || scraping"
                     placeholder="https://www.example-venue.com"
                     (keydown.enter)="scrapeVenue()">
              <button class="btn btn-primary px-4" type="button"
                      [disabled]="disabled || scraping || !isValidUrl()"
                      (click)="scrapeVenue()">
                @if (scraping) {
                  <fa-icon [icon]="faSpinner" [spin]="true" class="me-1"></fa-icon>
                  Scraping...
                } @else {
                  <fa-icon [icon]="faGlobe" class="ms-2 me-2"></fa-icon>
                  Fetch Details
                }
              </button>
            </div>
            <small class="text-muted">Enter the venue website URL to automatically extract address details</small>
            @if (lastResult) {
              <div class="mt-2">
                @if (lastResult.confidence > 0) {
                  <div class="alert alert-success py-2 d-flex align-items-center justify-content-between">
                    <div>
                      <fa-icon [icon]="faCheckCircle" class="me-2"></fa-icon>
                      <span>Found: <strong>{{ lastResult.venue.name || 'Venue' }}</strong>
                        @if (lastResult.venue.postcode) {
                          , {{ lastResult.venue.postcode }}
                        }
                      </span>
                      <span class="badge ms-2" [class.bg-success]="lastResult.confidence >= 50" [class.bg-warning]="lastResult.confidence < 50">
                        {{ lastResult.confidence }}% confidence
                      </span>
                    </div>
                  </div>
                }
                @if (lastResult.warnings?.length) {
                  @for (warning of lastResult.warnings; track warning) {
                    <div class="alert alert-warning py-1 px-2 mb-1 small d-flex align-items-center">
                      <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                      {{ warning }}
                    </div>
                  }
                }
              </div>
            }
            @if (scrapeError) {
              <div class="alert alert-danger py-2 mt-2">
                <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                {{ scrapeError }}
              </div>
            }
          </div>
        }
        @case ("paste") {
          <div class="paste-mode">
            <label class="form-label">Paste venue details</label>
            <textarea
              class="form-control"
              [(ngModel)]="pastedText"
              [disabled]="disabled"
              rows="4"
              placeholder="Paste venue details here (e.g., name, address, postcode, website URL copied from a website)..."></textarea>
            <div class="mt-2 d-flex align-items-center gap-2">
              <button type="button" class="btn btn-primary btn-sm"
                      [disabled]="disabled || !pastedText?.trim()"
                      (click)="parseAndApply()">
                <fa-icon [icon]="faMagic" class="me-1"></fa-icon>
                Parse & Apply
              </button>
              <button type="button" class="btn btn-outline-secondary btn-sm"
                      [disabled]="disabled"
                      (click)="clearPastedText()">
                Clear
              </button>
              @if (lastResult && lastResult.confidence > 0) {
                <span class="badge" [class.bg-success]="lastResult.confidence >= 50" [class.bg-warning]="lastResult.confidence < 50">
                  Confidence: {{ lastResult.confidence }}%
                </span>
              }
            </div>
            @if (lastResult?.warnings?.length) {
              <div class="mt-2">
                @for (warning of lastResult.warnings; track warning) {
                  <div class="alert alert-warning py-1 px-2 mb-1 small d-flex align-items-center">
                    <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                    {{ warning }}
                  </div>
                }
              </div>
            }
          </div>
        }
        @case ("search") {
          <div class="search-mode">
            <label class="form-label">Search previous venues</label>
            <app-venue-autocomplete
              [disabled]="disabled"
              [startingPoint]="startingPoint"
              [initialVenue]="initialVenue"
              (venueSelected)="onVenueSelected($event)"/>
          </div>
        }
        @case ("map") {
          <div class="map-mode">
            <app-venue-map-selector
              [disabled]="disabled"
              [startingPoint]="startingPoint"
              [initialVenue]="initialVenue"
              (venueSelected)="onVenueSelected($event)"
              (newVenueCreated)="onNewVenueCreated($event)"/>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .venue-lookup-content
      padding: 8px 0
    .venue-toggle-row
      display: flex
      flex-direction: column
      gap: 0.5rem
      margin-bottom: 0.75rem
    @media (min-width: 768px)
      .venue-toggle-row
        flex-direction: row
        align-items: center
    .venue-toggle-row ::ng-deep .section-toggle
      flex: 1
      margin-bottom: 0
    .manage-venues-btn
      align-self: flex-start
      display: flex
      align-items: center
      justify-content: center
    @media (min-width: 768px)
      .manage-venues-btn
        align-self: stretch
    .btn-group .btn
      flex: 1
    .btn-group .btn-check:checked + .btn
      font-weight: 600
    .input-group .btn
      white-space: nowrap
      flex-shrink: 0
  `]
})
export class VenueLookupComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("VenueLookupComponent", NgxLoggerLevel.ERROR);
  private venueParserService = inject(VenueParserService);
  private venueScraperService = inject(VenueScraperService);
  private storedVenueService = inject(StoredVenueService);
  private subscriptions: Subscription[] = [];

  @Input() disabled = false;
  @Input() startingPoint: { latitude: number; longitude: number } | null = null;
  @Input() initialVenue: Partial<VenueWithUsageStats> | null = null;
  @Input() showManageVenuesButton = false;
  @Output() venueLookup = new EventEmitter<Partial<Venue>>();

  mode: VenueLookupMode = "search";
  protected readonly StoredValue = StoredValue;
  websiteUrl = "";
  pastedText = "";
  scraping = false;
  scrapeError: string | null = null;
  lastResult: VenueParseResult | null = null;
  localMatchFound: StoredVenue | null = null;

  faGlobe = faGlobe;
  faMagic = faMagic;
  faSearch = faSearch;
  faMap = faMap;
  faExclamationTriangle = faExclamationTriangle;
  faSpinner = faSpinner;
  faCheckCircle = faCheckCircle;

  modeTabs: SectionToggleTab[] = [
    { value: "search", label: "Search Previous", icon: faSearch },
    { value: "url", label: "Website URL", icon: faGlobe },
    { value: "paste", label: "Smart Paste", icon: faMagic },
    { value: "map", label: "Map", icon: faMap }
  ];

  ngOnInit() {
    this.logger.info("VenueLookupComponent initialized");
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onModeChange(newMode: string) {
    this.mode = newMode as VenueLookupMode;
  }

  isValidUrl(): boolean {
    return this.venueScraperService.isValidUrl(this.websiteUrl);
  }

  async scrapeVenue() {
    if (!this.isValidUrl() || this.scraping) {
      return;
    }

    this.scraping = true;
    this.scrapeError = null;
    this.lastResult = null;
    this.localMatchFound = null;

    try {
      // First check local venues by base URL
      this.logger.info("Checking local venues for URL:", this.websiteUrl);
      const localVenue = await this.storedVenueService.findByBaseUrl(this.websiteUrl);

      if (localVenue) {
        this.logger.info("Found local venue match:", localVenue);
        this.localMatchFound = localVenue;
        const venueWithStats: VenueWithUsageStats = {
          storedVenueId: localVenue.id,
          type: localVenue.type,
          name: localVenue.name,
          address1: localVenue.address1,
          address2: localVenue.address2,
          postcode: localVenue.postcode,
          lat: localVenue.lat,
          lon: localVenue.lon,
          url: localVenue.url,
          usageCount: localVenue.usageCount || 0,
          lastUsed: localVenue.lastUsed?.toString()
        };
        this.venueLookup.emit(venueWithStats);
        return;
      }

      // No local match, scrape from web
      this.logger.info("No local match, scraping venue from URL:", this.websiteUrl);
      this.lastResult = await this.venueScraperService.scrapeVenueFromUrl(this.websiteUrl);

      if (this.lastResult.confidence > 0) {
        this.logger.info("Scraped venue:", this.lastResult.venue);
        this.venueLookup.emit(this.lastResult.venue);
      } else {
        this.scrapeError = "Could not extract venue details from the website. Try using Smart Paste instead.";
      }
    } catch (error: any) {
      this.logger.error("Error scraping venue:", error);
      this.scrapeError = error?.message || "Failed to fetch venue details from URL";
    } finally {
      this.scraping = false;
    }
  }

  parseAndApply() {
    if (isEmpty(this.pastedText?.trim())) {
      return;
    }

    this.logger.info("parseAndApply: parsing text");
    this.lastResult = this.venueParserService.parse(this.pastedText);

    if (this.lastResult.confidence > 0) {
      this.logger.info("parseAndApply: emitting parsed venue", this.lastResult.venue);
      this.venueLookup.emit(this.lastResult.venue);
    }
  }

  clearPastedText() {
    this.pastedText = "";
    this.lastResult = null;
  }

  onVenueSelected(venue: VenueWithUsageStats) {
    this.logger.info("Venue selected:", venue);
    this.venueLookup.emit(venue);
  }

  onNewVenueCreated(venue: Partial<Venue>) {
    this.logger.info("New venue created:", venue);
    this.venueLookup.emit(venue);
  }
}
